import * as THREE from 'three';

/**
 * Physics-based secondary motion (spring-mass-damper physics) for character chest/breast bones.
 * Provides organic, soft-body secondary bounce and inertia responding to:
 * 1. Torso movement and acceleration from idle animations
 * 2. Natural breathing expansion and contraction
 * 3. Soft harmonic secondary oscillation with stiffness and damping
 */
export class ChestPhysics {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;
    this.breastBones = [];

    // Physics parameters (tuned for natural, subtle soft-body elastic behavior)
    this.stiffness = 38.0;      // Spring restoring force coefficient
    this.damping = 5.2;         // Velocity damping coefficient (prevents perpetual ringing)
    this.mass = 1.0;            // Normalized mass
    this.breathingCoupling = 0.024; // Elastic coupling with breathing cycle
    this.inertiaGain = 0.65;    // Sensitivity to torso acceleration

    // Tracking torso movement for inertial physics
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

    if (!vrm?.scene) return;

    // Locate torso/chest bone for reference motion
    if (vrm.humanoid) {
      this.chestBone = vrm.humanoid.getNormalizedBoneNode('chest') ||
                       vrm.humanoid.getNormalizedBoneNode('spine');
    }

    if (this.chestBone) {
      this.prevChestRotX = this.chestBone.rotation.x;
      this.prevChestRotY = this.chestBone.rotation.y;
    }

    // Discover all chest/breast bones across model naming conventions
    // (e.g. Changli: 121joint_LeftBreast, 122joint_RightBreast, 119!joint_hidarimunehenkei, etc.)
    const discovered = [];

    vrm.scene.traverse((node) => {
      if (!node.isBone && !node.isObject3D) return;
      const lower = node.name.toLowerCase();

      // Exclude leaf tips (which only serve as end points)
      if (lower.includes('tip') || lower.includes('saki')) return;

      const isBreast =
        lower.includes('breast') ||
        lower.includes('mune') ||
        lower.includes('chestbone');

      if (isBreast) {
        const isLeft = lower.includes('left') || lower.includes('hidari') || lower.includes('_l');
        discovered.push({
          node,
          name: node.name,
          isLeft,
          // Store rest local rotation
          restRotation: node.rotation.clone(),
          // Spring physics state
          displacementX: 0, // Pitch (up/down bounce)
          displacementY: 0, // Yaw (subtle side sway)
          displacementZ: 0, // Roll
          velocityX: 0,
          velocityY: 0,
          velocityZ: 0
        });
      }
    });

    this.breastBones = discovered;
    console.log(`[ChestPhysics] Initialized ${this.breastBones.length} physics bones:`, this.breastBones.map((b) => b.name));
  }

  /**
   * Physics update step called every animation frame with delta time
   */
  update(delta) {
    if (!this.vrm || this.breastBones.length === 0) return;

    // Clamp delta to prevent numerical instability on large lag spikes
    const dt = Math.min(delta, 0.05);
    if (dt <= 0) return;

    this.time += dt;

    // 1. Calculate torso acceleration & velocity
    let accelX = 0;
    let accelY = 0;

    if (this.chestBone) {
      const currentRotX = this.chestBone.rotation.x;
      const currentRotY = this.chestBone.rotation.y;

      const newVelX = (currentRotX - this.prevChestRotX) / dt;
      const newVelY = (currentRotY - this.prevChestRotY) / dt;

      accelX = (newVelX - this.chestVelX) / dt;
      accelY = (newVelY - this.chestVelY) / dt;

      this.chestVelX = newVelX;
      this.chestVelY = newVelY;
      this.prevChestRotX = currentRotX;
      this.prevChestRotY = currentRotY;
    }

    // 2. Harmonic breathing oscillation force
    // Subtle, organic sinusoidal breathing cycle (~0.9 Hz)
    const breatheFreq = 0.9 * Math.PI * 2;
    const breathePhase = Math.sin(this.time * breatheFreq);
    const breatheForce = Math.cos(this.time * breatheFreq) * this.breathingCoupling;

    // 3. Update physics for each bone via damped harmonic oscillator
    for (let i = 0; i < this.breastBones.length; i++) {
      const bone = this.breastBones[i];
      const sideSign = bone.isLeft ? 1 : -1;

      // External forces:
      // - Counter-inertial force from torso acceleration (leads to realistic lag & bounce)
      // - Breathing expansion & relaxation
      // - Subtle micro-flutter for soft-body vitality
      const microFlutter = Math.sin(this.time * 3.4 + i * 0.7) * 0.003;
      const extForceX = -accelX * this.inertiaGain * 0.08 + breatheForce + microFlutter;
      const extForceY = -accelY * this.inertiaGain * 0.04 * sideSign;

      // Physics equation: a = (-k * x - c * v + F_ext) / m
      const aX = (-this.stiffness * bone.displacementX - this.damping * bone.velocityX + extForceX) / this.mass;
      const aY = (-this.stiffness * bone.displacementY - this.damping * bone.velocityY + extForceY) / this.mass;
      const aZ = (-this.stiffness * bone.displacementZ - this.damping * bone.velocityZ + (breathePhase * 0.004 * sideSign)) / this.mass;

      // Integrate velocity and displacement (Euler-Cromer method for energy stability)
      bone.velocityX += aX * dt;
      bone.velocityY += aY * dt;
      bone.velocityZ += aZ * dt;

      bone.displacementX += bone.velocityX * dt;
      bone.displacementY += bone.velocityY * dt;
      bone.displacementZ += bone.velocityZ * dt;

      // Anatomically realistic limits (soft clamping to prevent any mesh distortion)
      bone.displacementX = THREE.MathUtils.clamp(bone.displacementX, -0.065, 0.085);
      bone.displacementY = THREE.MathUtils.clamp(bone.displacementY, -0.035, 0.035);
      bone.displacementZ = THREE.MathUtils.clamp(bone.displacementZ, -0.025, 0.025);

      // Apply dynamic rotation relative to rest pose
      bone.node.rotation.x = bone.restRotation.x + bone.displacementX;
      bone.node.rotation.y = bone.restRotation.y + bone.displacementY;
      bone.node.rotation.z = bone.restRotation.z + bone.displacementZ;
    }
  }
}
