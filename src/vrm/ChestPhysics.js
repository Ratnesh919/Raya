import * as THREE from 'three';

/**
 * Real-world physics-based secondary motion (spring-mass-damper & rotational inertia)
 * for character chest, breast, and thoracic spine bones.
 * 
 * Physics Capabilities:
 * 1. Rotational Inertia (Newton's 1st Law): When the model rotates left/right,
 *    soft-body mass lags behind the angular acceleration, then rebounds with
 *    damped harmonic oscillation.
 * 2. Centrifugal Outward Force (F_c = m * omega^2 * r): Radial expansion during rotation.
 * 3. Coriolis 3D Gyroscopic Coupling: Cross-axis orbital deflection.
 * 4. Torso Torsional Compliance: Natural spinal elasticity of the thoracic ribcage.
 * 5. Organic Respiration Coupling: Sinusoidal chest expansion and relaxation.
 */
export class ChestPhysics {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;
    this.breastBones = [];

    // Physics parameters (grounded in human biomechanics & soft-tissue elasticity)
    this.stiffness = 32.0;          // Spring restoring force coefficient (k)
    this.damping = 4.8;             // Viscous damping coefficient (c)
    this.mass = 1.0;                // Normalized mass (m)
    this.breathingCoupling = 0.024; // Sinusoidal breathing coupling
    this.inertiaGain = 0.60;        // Sensitivity to torso linear acceleration
    this.rotInertiaGain = 0.028;    // Rotational inertia lag on left/right turn
    this.rotDragGain = 0.012;       // Angular velocity drag/sway
    this.centrifugalGain = 0.0012;  // Radial outward centrifugal expansion
    this.coriolisGain = 0.16;       // 3D gyroscopic cross-axis coupling

    // Torso Torsional Compliance (whole ribcage flexibility when rotating)
    this.torsoStiffness = 42.0;
    this.torsoDamping = 6.2;
    this.torsoMass = 1.0;
    this.torsoDisplacementY = 0;
    this.torsoVelocityY = 0;

    // Tracking model / scene rotation (e.g. mouse drag, touch rotate, root turn)
    this.prevSceneRotY = 0;
    this.sceneAngVelY = 0;
    this.prevSceneAngVelY = 0;

    // Tracking torso / chest bone local movement
    this.chestBone = null;
    this.prevChestRotX = 0;
    this.prevChestRotY = 0;
    this.chestVelX = 0;
    this.chestVelY = 0;

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

    // Discover all chest/breast bones across model conventions (Changli, Cantarella, VRoid, MMD, etc.)
    const discovered = [];

    vrm.scene.traverse((node) => {
      if (!node.isBone && !node.isObject3D) return;
      const lower = node.name.toLowerCase();

      // Exclude leaf tips (which only serve as zero-length end points)
      if (lower.includes('tip') || lower.includes('saki') || lower.includes('end')) return;

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
        if (lower.includes('002') || lower.includes('02') || lower.includes('mid')) {
          chainWeight = 0.65;
        } else if (lower.includes('003') || lower.includes('03')) {
          chainWeight = 0.35;
        }

        discovered.push({
          node,
          name: node.name,
          isLeft,
          chainWeight,
          // Store rest local rotation
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
    console.log(`[ChestPhysics] Initialized ${this.breastBones.length} secondary physics bones:`, this.breastBones.map((b) => b.name));
  }

  /**
   * Physics update step called every animation frame with delta time
   */
  update(delta) {
    if (!this.vrm) return;

    // Clamp delta to prevent numerical instability on large lag spikes
    const dt = Math.min(delta, 0.05);
    if (dt <= 0) return;

    this.time += dt;

    // 1. Calculate Model / Scene rotation velocity & acceleration (mouse drag, touch rotate, root turn)
    let sceneDeltaY = 0;
    if (this.vrm.scene) {
      const curSceneY = this.vrm.scene.rotation.y;
      sceneDeltaY = curSceneY - this.prevSceneRotY;
      while (sceneDeltaY > Math.PI) sceneDeltaY -= Math.PI * 2;
      while (sceneDeltaY < -Math.PI) sceneDeltaY += Math.PI * 2;
      this.prevSceneRotY = curSceneY;
    }
    const rawSceneAngVelY = sceneDeltaY / dt;
    const sceneAngVelY = THREE.MathUtils.clamp(rawSceneAngVelY, -30, 30);
    const sceneAngAccelY = THREE.MathUtils.clamp((sceneAngVelY - this.prevSceneAngVelY) / dt, -150, 150);
    this.prevSceneAngVelY = sceneAngVelY;

    // 2. Calculate Torso / Chest bone movement & acceleration (animations, life simulation, behavioral turns)
    let chestDeltaX = 0;
    let chestDeltaY = 0;

    if (this.chestBone) {
      const currentRotX = this.chestBone.rotation.x;
      const currentRotY = this.chestBone.rotation.y;

      chestDeltaX = currentRotX - this.prevChestRotX;
      chestDeltaY = currentRotY - this.prevChestRotY;

      this.prevChestRotX = currentRotX;
      this.prevChestRotY = currentRotY;
    }

    const chestVelX = THREE.MathUtils.clamp(chestDeltaX / dt, -20, 20);
    const chestVelY = THREE.MathUtils.clamp(chestDeltaY / dt, -20, 20);

    const chestAccelX = THREE.MathUtils.clamp((chestVelX - this.chestVelX) / dt, -45, 45);
    const chestAccelY = THREE.MathUtils.clamp((chestVelY - this.chestVelY) / dt, -45, 45);

    this.chestVelX = chestVelX;
    this.chestVelY = chestVelY;

    // Combined angular kinematics experienced by the upper chest
    const totalAngVelY = sceneAngVelY + chestVelY;
    const totalAngAccelY = THREE.MathUtils.clamp(sceneAngAccelY + chestAccelY, -120, 120);

    // 3. Torso Torsional Compliance (Realistic human ribcage flexibility when rotating)
    const torsoInertiaForce = -totalAngAccelY * 0.035 - totalAngVelY * 0.015;
    const torsoA = (-this.torsoStiffness * this.torsoDisplacementY - this.torsoDamping * this.torsoVelocityY + torsoInertiaForce) / this.torsoMass;
    this.torsoVelocityY += torsoA * dt;
    this.torsoDisplacementY += this.torsoVelocityY * dt;
    this.torsoDisplacementY = THREE.MathUtils.clamp(this.torsoDisplacementY, -0.065, 0.065); // ~3.7 deg natural thoracic compliance

    if (this.chestBone) {
      this.chestBone.rotation.y += this.torsoDisplacementY;
    }

    // 4. Harmonic breathing oscillation force
    const breatheFreq = 0.75 * Math.PI * 2;
    const breathePhase = Math.sin(this.time * breatheFreq);
    const breatheForce = Math.cos(this.time * breatheFreq) * this.breathingCoupling;

    // 5. Rotational Soft-Body Physics for Chest / Breast Bones
    if (this.breastBones.length === 0) return;

    // Real-world rotational inertial torque: soft mass opposes angular acceleration & velocity
    const F_rotY = -this.rotInertiaGain * totalAngAccelY - this.rotDragGain * totalAngVelY;

    // Centrifugal force (F_c = m * omega^2 * r): pulls radially outward in both directions
    const F_cent = this.centrifugalGain * (totalAngVelY * totalAngVelY);

    // Update each secondary bone using Euler-Cromer numerical integration
    for (let i = 0; i < this.breastBones.length; i++) {
      const bone = this.breastBones[i];
      const sideSign = bone.isLeft ? 1 : -1;
      const chainScale = bone.chainWeight || 1.0;

      // Coriolis gyroscopic cross-coupling
      const F_coriolisZ = -2 * this.coriolisGain * totalAngVelY * bone.velocityX;
      const F_coriolisX = 2 * this.coriolisGain * totalAngVelY * bone.velocityZ;

      // Lateral roll torque induced by horizontal angular shear
      const F_rollZ = -F_rotY * sideSign * 0.40;

      // Net external forces along anatomical axes
      const extForceX = (-chestAccelX * this.inertiaGain * 0.05 + breatheForce + (F_cent * 0.65) + F_coriolisX) * chainScale;
      const extForceY = (F_rotY + (F_cent * sideSign * 0.85)) * chainScale;
      const extForceZ = (F_rollZ + (breathePhase * 0.002 * sideSign) + F_coriolisZ) * chainScale;

      // Physics equation: a = (-k * x - c * v + F_ext) / m
      const aX = (-this.stiffness * bone.displacementX - this.damping * bone.velocityX + extForceX) / this.mass;
      const aY = (-this.stiffness * bone.displacementY - this.damping * bone.velocityY + extForceY) / this.mass;
      const aZ = (-this.stiffness * bone.displacementZ - this.damping * bone.velocityZ + extForceZ) / this.mass;

      // Semi-implicit Euler integration (symplectic: guarantees energy stability without jitter)
      bone.velocityX += aX * dt;
      bone.velocityY += aY * dt;
      bone.velocityZ += aZ * dt;

      bone.displacementX += bone.velocityX * dt;
      bone.displacementY += bone.velocityY * dt;
      bone.displacementZ += bone.velocityZ * dt;

      // Anatomically grounded safety limits (preserves natural range without clipping)
      bone.displacementX = THREE.MathUtils.clamp(bone.displacementX, -0.065, 0.080);
      bone.displacementY = THREE.MathUtils.clamp(bone.displacementY, -0.055, 0.055);
      bone.displacementZ = THREE.MathUtils.clamp(bone.displacementZ, -0.045, 0.045);

      // Apply dynamic rotation relative to rest pose
      bone.node.rotation.x = bone.restRotation.x + bone.displacementX;
      bone.node.rotation.y = bone.restRotation.y + bone.displacementY;
      bone.node.rotation.z = bone.restRotation.z + bone.displacementZ;
    }
  }
}
