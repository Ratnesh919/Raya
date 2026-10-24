import * as THREE from 'three';

/**
 * BodyCollisionGuard
 * Inspired by open-annie's body-collide.js
 *
 * Prevents hands and forearms from penetrating/clipping through the avatar's
 * chest, torso, hips, and upper thighs. Runs every frame after animation
 * updates and smoothly pushes penetrating arm/hand bones outward along
 * surface collision normals with critically damped recovery.
 *
 * High Performance & Zero Garbage Collection:
 * All THREE.Vector3, THREE.Quaternion, and THREE.Matrix4 instances are allocated
 * once in constructor scratchpads.
 */
export class BodyCollisionGuard {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;
    this.enabled = true;

    // Body collider specifications (local radii and offsets in humanoid bone coordinates)
    this.colliderDefs = [
      // 1. Upper Torso / Bust (centered on upperChest or chest)
      {
        boneName: 'upperChest',
        fallbackBone: 'chest',
        radius: 0.155, // Radius of upper torso
        forwardOffset: 0.055, // Forward protrusion for chest/bust
        verticalOffset: 0.0,
        height: 0.16
      },
      // 2. Abdomen / Mid Torso
      {
        boneName: 'spine',
        fallbackBone: 'chest',
        radius: 0.135,
        forwardOffset: 0.015,
        verticalOffset: 0.0,
        height: 0.14
      },
      // 3. Pelvis / Hips
      {
        boneName: 'hips',
        fallbackBone: null,
        radius: 0.150,
        forwardOffset: 0.010,
        verticalOffset: -0.03,
        height: 0.15
      },
      // 4. Left Upper Leg / Thigh
      {
        boneName: 'leftUpperLeg',
        fallbackBone: null,
        radius: 0.088,
        forwardOffset: 0.0,
        verticalOffset: -0.10,
        height: 0.20
      },
      // 5. Right Upper Leg / Thigh
      {
        boneName: 'rightUpperLeg',
        fallbackBone: null,
        radius: 0.088,
        forwardOffset: 0.0,
        verticalOffset: -0.10,
        height: 0.20
      }
    ];

    // Joints to protect from penetrating the body
    this.probeJoints = [
      {
        boneName: 'leftHand',
        parentArm: 'leftLowerArm',
        grandParentArm: 'leftUpperArm',
        probeRadius: 0.045, // Hand/wrist envelope
        side: 'left'
      },
      {
        boneName: 'rightHand',
        parentArm: 'rightLowerArm',
        grandParentArm: 'rightUpperArm',
        probeRadius: 0.045,
        side: 'right'
      },
      {
        boneName: 'leftLowerArm',
        parentArm: 'leftUpperArm',
        grandParentArm: null,
        probeRadius: 0.040, // Forearm envelope
        side: 'left'
      },
      {
        boneName: 'rightLowerArm',
        parentArm: 'rightUpperArm',
        grandParentArm: null,
        probeRadius: 0.040,
        side: 'right'
      }
    ];

    // Dynamic smoothing / damping state for corrections per probe joint
    this.jointCorrections = new Map();
    this.probeJoints.forEach((j) => {
      this.jointCorrections.set(j.boneName, {
        currentOffset: new THREE.Vector3(0, 0, 0),
        targetOffset: new THREE.Vector3(0, 0, 0),
        active: false
      });
    });

    // Zero-allocation scratchpads for 60fps frame loops
    this._vColliderWorld = new THREE.Vector3();
    this._vProbeWorld = new THREE.Vector3();
    this._vParentWorld = new THREE.Vector3();
    this._vDelta = new THREE.Vector3();
    this._vNorm = new THREE.Vector3();
    this._vPush = new THREE.Vector3();
    this._vArmDir = new THREE.Vector3();
    this._vTargetArmDir = new THREE.Vector3();
    this._qDelta = new THREE.Quaternion();
    this._qParentWorld = new THREE.Quaternion();
    this._qInvParentWorld = new THREE.Quaternion();

    this.vrmManager?.addModelLoadedListener((vrm) => {
      this.bindModel(vrm);
    });
  }

  bindModel(vrm) {
    this.vrm = vrm;
    // Reset all active corrections
    this.jointCorrections.forEach((c) => {
      c.currentOffset.set(0, 0, 0);
      c.targetOffset.set(0, 0, 0);
      c.active = false;
    });
  }

  getBoneNode(boneName, fallback = null) {
    if (!this.vrm?.humanoid) return null;
    let node = this.vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!node && fallback) {
      node = this.vrm.humanoid.getNormalizedBoneNode(fallback);
    }
    return node;
  }

  /**
   * Main collision evaluation & resolution loop.
   * Call after AnimationEngine / procedural physics updates.
   */
  update(delta) {
    if (!this.enabled || !this.vrm?.humanoid) return;

    const smoothing = THREE.MathUtils.clamp(delta * 14.0, 0.05, 1.0);

    for (let pIdx = 0; pIdx < this.probeJoints.length; pIdx++) {
      const probe = this.probeJoints[pIdx];
      const probeNode = this.getBoneNode(probe.boneName);
      if (!probeNode) continue;

      const parentNode = this.getBoneNode(probe.parentArm);
      if (!parentNode) continue;

      probeNode.getWorldPosition(this._vProbeWorld);
      parentNode.getWorldPosition(this._vParentWorld);

      const corr = this.jointCorrections.get(probe.boneName);
      let maxPenetration = 0;
      this._vPush.set(0, 0, 0);

      // Test against each body volume
      for (let cIdx = 0; cIdx < this.colliderDefs.length; cIdx++) {
        const colDef = this.colliderDefs[cIdx];
        const colNode = this.getBoneNode(colDef.boneName, colDef.fallbackBone);
        if (!colNode) continue;

        colNode.getWorldPosition(this._vColliderWorld);

        // Apply local offsets (forward chest bust, vertical hip drops)
        if (colDef.forwardOffset !== 0 || colDef.verticalOffset !== 0) {
          // Transform local offset by collider bone world orientation
          colNode.getWorldQuaternion(this._qParentWorld);
          this._vDelta.set(0, colDef.verticalOffset, colDef.forwardOffset);
          this._vDelta.applyQuaternion(this._qParentWorld);
          this._vColliderWorld.add(this._vDelta);
        }

        // Vector from collider center to probe joint
        this._vDelta.subVectors(this._vProbeWorld, this._vColliderWorld);

        // Consider height flattening along collider Y axis for cylinder capsule approximation
        const distSq = this._vDelta.lengthSq();
        const combinedRadius = colDef.radius + probe.probeRadius;

        if (distSq < combinedRadius * combinedRadius) {
          const dist = Math.max(Math.sqrt(distSq), 0.0001);
          const penetration = combinedRadius - dist;

          if (penetration > maxPenetration) {
            maxPenetration = penetration;
            // Normal points outwards from collider to probe
            this._vNorm.copy(this._vDelta).multiplyScalar(1.0 / dist);

            // If probe is stuck right in center, push forward and lateral
            if (dist < 0.02) {
              const lateralSign = probe.side === 'left' ? 1 : -1;
              colNode.getWorldQuaternion(this._qParentWorld);
              this._vNorm.set(lateralSign * 0.4, 0.1, 0.9).normalize().applyQuaternion(this._qParentWorld);
            }

            this._vPush.copy(this._vNorm).multiplyScalar(penetration);
          }
        }
      }

      if (maxPenetration > 0.001) {
        corr.targetOffset.copy(this._vPush);
        corr.active = true;
      } else {
        corr.targetOffset.set(0, 0, 0);
      }

      // Smooth offset via exponential damping to prevent popping
      corr.currentOffset.lerp(corr.targetOffset, smoothing);

      if (corr.currentOffset.lengthSq() > 0.000001) {
        // Apply outward rotational displacement to parent arm bone
        // Arm original direction in world space
        this._vArmDir.subVectors(this._vProbeWorld, this._vParentWorld).normalize();

        // Target position = probe + push offset
        this._vTargetArmDir.copy(this._vProbeWorld).add(corr.currentOffset).sub(this._vParentWorld).normalize();

        // Calculate rotation that directs parent arm bone outward
        this._qDelta.setFromUnitVectors(this._vArmDir, this._vTargetArmDir);

        // Convert delta rotation to parent bone's local coordinate space
        parentNode.parent.getWorldQuaternion(this._qParentWorld);
        this._qInvParentWorld.copy(this._qParentWorld).invert();

        // qLocalDelta = qInvParent * qDeltaWorld * qParent
        this._qDelta.premultiply(this._qInvParentWorld).multiply(this._qParentWorld);

        // Blend onto parent bone's local rotation
        parentNode.quaternion.multiply(this._qDelta);
        parentNode.updateMatrixWorld(true);
        probeNode.updateMatrixWorld(true);
      }
    }
  }
}
