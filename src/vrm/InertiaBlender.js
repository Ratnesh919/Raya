import * as THREE from 'three';

/**
 * InertiaBlender
 * Inspired by open-annie's inertia.js
 *
 * Implements inertialized animation blending for humanoid skeletons.
 * When switching animation clips, captures the instantaneous pose offset
 * and smoothly decays it using critically damped polynomial spring curves.
 * Eliminates linear crossfade pops, jerkiness, and limb sliding.
 */
export class InertiaBlender {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

    this.isTransitioning = false;
    this.transitionTime = 0;
    this.transitionDuration = 0.38; // 380ms smooth inertial settling

    // Bones tracked for inertialized blending
    this.trackedBoneNames = [
      'hips',
      'spine',
      'chest',
      'upperChest',
      'neck',
      'head',
      'leftShoulder',
      'leftUpperArm',
      'leftLowerArm',
      'leftHand',
      'rightShoulder',
      'rightUpperArm',
      'rightLowerArm',
      'rightHand'
    ];

    // Inertial offset quaternions per tracked bone
    this.boneOffsets = new Map();
    this.trackedBoneNames.forEach((name) => {
      this.boneOffsets.set(name, {
        sourceQuat: new THREE.Quaternion(),
        targetQuat: new THREE.Quaternion(),
        diffQuat: new THREE.Quaternion(),
        currentDecayedQuat: new THREE.Quaternion(),
        active: false
      });
    });

    // Zero-allocation scratchpad objects
    this._qIdentity = new THREE.Quaternion();
    this._qTemp = new THREE.Quaternion();

    this.vrmManager?.addModelLoadedListener((vrm) => {
      this.vrm = vrm;
      this.reset();
    });
  }

  reset() {
    this.isTransitioning = false;
    this.transitionTime = 0;
    this.boneOffsets.forEach((b) => {
      b.diffQuat.copy(this._qIdentity);
      b.currentDecayedQuat.copy(this._qIdentity);
      b.active = false;
    });
  }

  /**
   * Called right before switching to a new animation clip.
   * Captures the instantaneous bone rotation snapshot.
   */
  startTransition(duration = 0.38) {
    if (!this.vrm?.humanoid) return;

    this.transitionDuration = Math.max(0.15, duration);
    this.transitionTime = 0;
    this.isTransitioning = true;

    for (let i = 0; i < this.trackedBoneNames.length; i++) {
      const boneName = this.trackedBoneNames[i];
      const node = this.vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) continue;

      const record = this.boneOffsets.get(boneName);
      record.sourceQuat.copy(node.quaternion);
      record.active = true;
    }
  }

  /**
   * Called after mixer evaluates the first frame of the target clip.
   * Computes the initial offset difference between source and target pose.
   */
  postTargetSample() {
    if (!this.isTransitioning || !this.vrm?.humanoid) return;

    for (let i = 0; i < this.trackedBoneNames.length; i++) {
      const boneName = this.trackedBoneNames[i];
      const node = this.vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) continue;

      const record = this.boneOffsets.get(boneName);
      if (!record.active) continue;

      record.targetQuat.copy(node.quaternion);

      // diff = source * target^-1
      this._qTemp.copy(record.targetQuat).invert();
      record.diffQuat.copy(record.sourceQuat).multiply(this._qTemp);
    }
  }

  /**
   * Evaluates inertial decay curve:
   * Critically damped cubic hermite decay: f(t) = (1 - u)^2 * (1 + 2u) where u = t / duration
   */
  update(delta) {
    if (!this.isTransitioning || !this.vrm?.humanoid) return;

    this.transitionTime += delta;
    const u = Math.min(1.0, this.transitionTime / this.transitionDuration);

    if (u >= 1.0) {
      this.reset();
      return;
    }

    // Smooth critically damped decay weight (1 at t=0 down to 0 at t=1)
    const decayWeight = (1.0 - u) * (1.0 - u) * (1.0 + 2.0 * u);

    for (let i = 0; i < this.trackedBoneNames.length; i++) {
      const boneName = this.trackedBoneNames[i];
      const node = this.vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) continue;

      const record = this.boneOffsets.get(boneName);
      if (!record.active) continue;

      // Slerp diff towards identity by (1 - decayWeight)
      record.currentDecayedQuat.copy(this._qIdentity).slerp(record.diffQuat, decayWeight);

      // Premultiply decayed inertial offset onto node rotation
      node.quaternion.premultiply(record.currentDecayedQuat);
      node.quaternion.normalize();
    }
  }
}
