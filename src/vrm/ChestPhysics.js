import * as THREE from 'three';

/**
 * Real-world physics-based secondary motion (spring-mass-damper & rotational inertia)
 * for character chest, breast, and thoracic spine bones.
 * 
 * Physics Capabilities:
 * 1. Rotational Inertia (Newton's 1st Law): When the avatar or scene rotates left/right,
 *    soft-body mass lags behind the angular acceleration, then rebounds with
 *    damped harmonic oscillation.
 * 2. Centrifugal Outward Force (F_c = m * omega^2 * r): Radial expansion and upward lift during rotation.
 * 3. Smooth Exponential Filtering: Eliminates mouse polling jitter so rotations feel silky and continuous.
 * 4. Dual-Mode Integration: Operates harmoniously on top of VRM Spring Bones (Yinlin, Changli, Iuno)
 *    and direct bone hierarchies without accumulation or interference.
 * 5. Organic Respiration Coupling: Sinusoidal chest expansion and relaxation.
 */
export class ChestPhysics {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;
    this.breastBones = [];

    // Zero Garbage Collection scratch objects
    this._scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._scratchQuat = new THREE.Quaternion();

    // Physics parameters (grounded in biomechanics & soft-tissue elasticity)
    this.stiffness = 26.0;          // Spring restoring force coefficient (k)
    this.damping = 4.0;             // Viscous damping coefficient (c) (underdamped ~0.39 for natural rebound ripples)
    this.mass = 1.0;                // Normalized mass (m)
    this.breatheCoupling = 0.015;   // Sinusoidal breathing coupling
    this.rotInertiaGain = 1.25;     // Dynamic rotational inertia lag on left/right turn
    this.rotDragGain = 0.35;        // Sustained angular velocity drag
    this.rotAccelGain = 0.055;      // Sudden flick acceleration response
    this.centrifugalGain = 0.0022;  // Radial outward centrifugal expansion and lift

    // Torso Torsional Compliance (whole ribcage flexibility when rotating)
    this.torsoStiffness = 38.0;
    this.torsoDamping = 5.8;
    this.torsoMass = 1.0;
    this.torsoDisplacementY = 0;
    this.torsoVelocityY = 0;

    // Tracking model / scene rotation (e.g. mouse drag, touch rotate, root turn)
    this.prevSceneRotY = 0;
    this.sceneAngVelY = 0;
    this.prevSceneAngVelY = 0;
    this.sceneAngVelX = 0;
    this.prevSceneAngVelX = 0;

    // Tracking torso / chest bone local movement
    this.chestBone = null;
    this.prevChestRotX = 0;
    this.prevChestRotY = 0;
    this.chestVelX = 0;
    this.chestVelY = 0;
    this.prevChestVelX = 0;
    this.prevChestVelY = 0;

    this.time = 0;

    // Register with VRM manager model load lifecycle
    this.vrmManager.addModelLoadedListener((vrm) => this.bindModel(vrm));
  }

  bindModel(vrm) {
    this.vrm = vrm;
    this.breastBones = [];
    this.chestBone = null;
    this.torsoDisplacementY = 0;
    this.torsoVelocityY = 0;
    this.sceneAngVelY = 0;
    this.prevSceneAngVelY = 0;
    this.sceneAngVelX = 0;
    this.prevSceneAngVelX = 0;
    this.chestVelX = 0;
    this.chestVelY = 0;
    this.prevChestVelX = 0;
    this.prevChestVelY = 0;

    if (!vrm?.scene) return;

    // Store baseline scene rotation
    this.prevSceneRotY = vrm.scene.rotation.y;

    // Locate torso/chest bone for reference motion & torsional flex
    if (vrm.humanoid) {
      this.chestBone = vrm.humanoid.getNormalizedBoneNode('chest') ||
                       vrm.humanoid.getNormalizedBoneNode('upperChest') ||
                       vrm.humanoid.getNormalizedBoneNode('spine');
    }

    if (this.chestBone) {
      this.prevChestRotX = this.chestBone.rotation.x;
      this.prevChestRotY = this.chestBone.rotation.y;
    }

    // Set of bones managed by VRMSpringBone
    const springJoints = vrm.springBoneManager?.joints || [];
    const springBoneSet = new Set(springJoints.map((j) => j.bone));

    // Discover all chest/breast bones across model conventions (Changli, Yinlin, Iuno, Cantarella, etc.)
    const discovered = [];

    vrm.scene.traverse((node) => {
      if (!node.isBone && !node.isObject3D) return;
      const lower = node.name.toLowerCase();

      // Exclude leaf tips (zero-length end points) and auxiliary corrective bones (henkei)
      if (lower.includes('tip') || lower.includes('saki') || lower.includes('end') || lower.includes('henkei')) return;

      const isBreast =
        lower.includes('breast') ||
        lower.includes('bust') ||
        lower.includes('mune') ||
        lower.includes('chestbone') ||
        lower.includes('bone_chest') ||
        (lower.includes('chest') && (
          lower.includes('_l') || lower.includes('_r') ||
          lower.includes('.l') || lower.includes('.r') ||
          lower.includes('left') || lower.includes('right') ||
          lower.includes('00')
        ));

      if (isBreast) {
        const isLeft =
          lower.includes('left') ||
          lower.includes('hidari') ||
          lower.includes('_l') ||
          lower.includes('.l') ||
          lower.endsWith('l') ||
          lower.includes('l_') ||
          lower.includes('_l_');

        // Segment chain depth weighting (root carries primary inertia, child segments flex smoothly)
        let chainWeight = 1.0;
        if (lower.includes('002') || lower.includes('02') || lower.includes('mid') || lower.includes('breast2')) {
          chainWeight = 0.70;
        } else if (lower.includes('003') || lower.includes('03')) {
          chainWeight = 0.40;
        }

        const isSpringBone = springBoneSet.has(node);

        discovered.push({
          node,
          name: node.name,
          isLeft,
          isSpringBone,
          chainWeight,
          // Store rest local rotation and clean base quaternion
          baseLocalQuaternion: node.quaternion.clone(),
          restRotation: node.rotation.clone(),
          // Spring physics state
          displacementX: 0, // Pitch (up/down bounce & centrifugal lift)
          displacementY: 0, // Yaw (lateral left/right lag & rebound)
          displacementZ: 0, // Roll (swivel & tilt)
          velocityX: 0,
          velocityY: 0,
          velocityZ: 0
        });
      }
    });

    this.breastBones = discovered;
    console.log(
      `[ChestPhysics] Initialized ${this.breastBones.length} secondary physics bones:`,
      this.breastBones.map((b) => `${b.name} (${b.isLeft ? 'L' : 'R'}, spring=${b.isSpringBone})`)
    );
  }

  /**
   * Physics update step called every animation frame with delta time.
   * Runs right after vrm.update() so it blends dynamically on top of
   * VRM spring bones and animations without being overwritten.
   */
  update(delta) {
    if (!this.vrm) return;

    // Clamp delta to prevent numerical instability on large lag spikes
    const dt = Math.min(delta, 0.05);
    if (dt <= 0) return;

    this.time += dt;

    // 1. Calculate Model / Scene rotation velocity & acceleration (mouse drag, touch rotate, root turn)
    let sceneDeltaY = this.vrmManager.turnDeltaY || 0;
    this.vrmManager.turnDeltaY = 0;
    let sceneDeltaX = this.vrmManager.turnDeltaX || 0;
    this.vrmManager.turnDeltaX = 0;

    if (this.vrm.scene) {
      const curSceneY = this.vrm.scene.rotation.y;
      let autoDelta = curSceneY - this.prevSceneRotY;
      while (autoDelta > Math.PI) autoDelta -= Math.PI * 2;
      while (autoDelta < -Math.PI) autoDelta += Math.PI * 2;
      this.prevSceneRotY = curSceneY;

      // If no explicit drag this frame, use automatic scene rotation delta
      if (Math.abs(sceneDeltaY) < 0.0001) {
        sceneDeltaY = autoDelta;
      }
    }

    const rawSceneAngVelY = THREE.MathUtils.clamp(sceneDeltaY / dt, -35, 35);
    // Smooth angular velocity with exponential filter to eliminate mouse polling jitter
    this.sceneAngVelY += (rawSceneAngVelY - this.sceneAngVelY) * Math.min(1.0, dt * 20.0);
    const sceneAngAccelY = THREE.MathUtils.clamp((this.sceneAngVelY - this.prevSceneAngVelY) / dt, -180, 180);
    this.prevSceneAngVelY = this.sceneAngVelY;

    // Pitch angular kinematics (vertical camera tilt / model pitch)
    const rawSceneAngVelX = THREE.MathUtils.clamp(sceneDeltaX / dt, -35, 35);
    this.sceneAngVelX += (rawSceneAngVelX - this.sceneAngVelX) * Math.min(1.0, dt * 20.0);
    const sceneAngAccelX = THREE.MathUtils.clamp((this.sceneAngVelX - this.prevSceneAngVelX) / dt, -180, 180);
    this.prevSceneAngVelX = this.sceneAngVelX;

    // 2. Calculate Torso / Chest bone movement & acceleration (animations, life simulation, behavioral turns)
    let chestDeltaY = 0;
    let chestDeltaX = 0;

    if (this.chestBone) {
      const currentRotX = this.chestBone.rotation.x;
      const currentRotY = this.chestBone.rotation.y;

      let dX = currentRotX - this.prevChestRotX;
      let dY = currentRotY - this.prevChestRotY;
      while (dY > Math.PI) dY -= Math.PI * 2;
      while (dY < -Math.PI) dY += Math.PI * 2;

      chestDeltaX = dX;
      chestDeltaY = dY;

      this.prevChestRotX = currentRotX;
      this.prevChestRotY = currentRotY;
    }

    const rawChestVelY = THREE.MathUtils.clamp(chestDeltaY / dt, -20, 20);
    this.chestVelY += (rawChestVelY - this.chestVelY) * Math.min(1.0, dt * 20.0);
    const chestAccelY = (this.chestVelY - this.prevChestVelY) / dt;
    this.prevChestVelY = this.chestVelY;

    const rawChestVelX = THREE.MathUtils.clamp(chestDeltaX / dt, -20, 20);
    this.chestVelX += (rawChestVelX - this.chestVelX) * Math.min(1.0, dt * 20.0);
    const chestAccelX = (this.chestVelX - this.prevChestVelX) / dt;
    this.prevChestVelX = this.chestVelX;

    // Combined angular kinematics experienced by the upper torso
    const totalAngVelY = this.sceneAngVelY + this.chestVelY;
    const totalAngAccelY = THREE.MathUtils.clamp(sceneAngAccelY + chestAccelY, -160, 160);

    const totalAngVelX = this.sceneAngVelX + this.chestVelX;
    const totalAngAccelX = THREE.MathUtils.clamp(sceneAngAccelX + chestAccelX, -160, 160);

    // 3. Torso Torsional Compliance (ribcage elasticity when rotating)
    const torsoInertiaForce = -totalAngAccelY * 0.045 - totalAngVelY * 0.025;
    const torsoA = (-this.torsoStiffness * this.torsoDisplacementY - this.torsoDamping * this.torsoVelocityY + torsoInertiaForce) / this.torsoMass;
    this.torsoVelocityY += torsoA * dt;
    this.torsoDisplacementY += this.torsoVelocityY * dt;
    this.torsoDisplacementY = THREE.MathUtils.clamp(this.torsoDisplacementY, -0.075, 0.075); // ~4.3 deg natural thoracic compliance

    if (this.chestBone) {
      this.chestBone.rotation.y += this.torsoDisplacementY;
    }

    if (this.breastBones.length === 0) return;

    // 4. Force Calculations for Soft-Body Secondary Motion
    // Rotational inertia: soft mass opposes angular turn speed and acceleration
    const F_rotLag = -this.rotInertiaGain * totalAngVelY - this.rotAccelGain * totalAngAccelY - this.rotDragGain * Math.sign(totalAngVelY) * Math.min(Math.abs(totalAngVelY), 8.0);

    // Pitch rotational inertia (vertical lag and harmonic bounce when tilting up and down)
    const F_rotPitchLag = -this.rotInertiaGain * 1.35 * totalAngVelX - this.rotAccelGain * totalAngAccelX;

    // Centrifugal expansion: pushes soft mass radially outward from rotation center and lifts
    const F_centrifugal = THREE.MathUtils.clamp(this.centrifugalGain * (totalAngVelY * totalAngVelY), 0, 0.28);

    // Harmonic breathing cycle:
    const breatheFreq = 0.85 * Math.PI * 2;
    const breathePhase = Math.sin(this.time * breatheFreq);
    const breatheLift = breathePhase * this.breatheCoupling;

    // 5. Update each secondary bone using Euler-Cromer numerical integration
    for (let i = 0; i < this.breastBones.length; i++) {
      const bone = this.breastBones[i];
      const sideSign = bone.isLeft ? 1 : -1;
      const chainScale = bone.chainWeight || 1.0;

      // Net external forces along anatomical axes:
      // Yaw (Y axis): left/right sway opposite to turn direction, plus outward centrifugal spread
      const extForceY = (F_rotLag + (F_centrifugal * sideSign * 0.45)) * chainScale;

      // Pitch (X axis): vertical rotational inertia lag, bounce, respiration, and centrifugal lift
      const extForceX = (F_rotPitchLag + F_centrifugal * 0.85 + breatheLift * 18.0) * chainScale;

      // Roll (Z axis): natural lateral tilt
      const extForceZ = (-F_rotLag * sideSign * 0.22) * chainScale;

      // Physics equation: a = (F_ext - k * x - c * v) / m
      const aX = (extForceX - this.stiffness * bone.displacementX - this.damping * bone.velocityX) / this.mass;
      const aY = (extForceY - this.stiffness * bone.displacementY - this.damping * bone.velocityY) / this.mass;
      const aZ = (extForceZ - this.stiffness * bone.displacementZ - this.damping * bone.velocityZ) / this.mass;

      // Symplectic Euler integration
      bone.velocityX += aX * dt;
      bone.velocityY += aY * dt;
      bone.velocityZ += aZ * dt;

      bone.displacementX += bone.velocityX * dt;
      bone.displacementY += bone.velocityY * dt;
      bone.displacementZ += bone.velocityZ * dt;

      // Anatomically grounded safety limits (preserves natural range without clipping)
      bone.displacementX = THREE.MathUtils.clamp(bone.displacementX, -0.16, 0.22); // Up/down pitch
      bone.displacementY = THREE.MathUtils.clamp(bone.displacementY, -0.26, 0.26); // Left/right yaw (~15 deg)
      bone.displacementZ = THREE.MathUtils.clamp(bone.displacementZ, -0.12, 0.12); // Roll

      // Build physical offset quaternion
      this._scratchEuler.set(
        bone.displacementX,
        bone.displacementY,
        bone.displacementZ,
        'YXZ'
      );
      this._scratchQuat.setFromEuler(this._scratchEuler);

      if (bone.isSpringBone) {
        // Multiply on top of the VRM spring-simulated pose
        bone.node.quaternion.multiply(this._scratchQuat);
      } else {
        // Restore clean base quaternion and apply dynamic physics offset
        bone.node.quaternion.copy(bone.baseLocalQuaternion).multiply(this._scratchQuat);
      }

      // Force Three.js SkinnedMesh to immediately compute the updated matrices
      bone.node.updateMatrix();
      bone.node.updateWorldMatrix(true, false);
    }
  }
}
