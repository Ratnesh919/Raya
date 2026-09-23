import * as THREE from 'three';

export class LifeSimulator {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

    // 1. Breathing parameters (organic human respiration cycle)
    this.breatheTime = 0;
    this.breatheFreq = 0.75; // Calm, relaxed resting respiratory rate (~12-14 breaths/min)
    this.breatheSpineAmp = 0.0; // Keep spine stable to eliminate head and upper-body wobbling
    this.breatheChestAmp = 0.018; // Subtle, natural chest pitch breathing motion (~1.0 deg)

    // 2. Natural Blinking
    this.isBlinking = false;
    this.blinkProgress = 0;
    this.blinkDuration = 0.18;
    this.timeSinceLastBlink = 0;
    this.nextBlinkInterval = 2.5;

    // 3. Eye Saccades
    this.saccadeTimer = 0;
    this.nextSaccadeInterval = 1.8;
    this.saccadeOffset = new THREE.Vector2(0, 0);
    this.saccadeTarget = new THREE.Vector2(0, 0);

    // 4. Cursor / Gaze Tracking & Camera Head Tracking
    this.cursorNorm = new THREE.Vector2(0, 0);
    this.smoothedGaze = new THREE.Vector2(0, 0);

    // Anatomical head and eye rotation tracking state
    this.currentHeadYaw = 0;
    this.currentHeadPitch = 0;
    this._headWorldPos = new THREE.Vector3();
    this._camTargetPos = new THREE.Vector3();
    // Zero-allocation scratch math objects for 60fps performance
    this._toCamWorld = new THREE.Vector3();
    this._toCamLocal = new THREE.Vector3();
    this._invSceneQuat = new THREE.Quaternion();
    this._bodyFwdWorld = new THREE.Vector3();
    this._eyeTargetWorld = new THREE.Vector3();

    this.setupListeners();

    this.vrmManager.addModelLoadedListener((vrm) => {
      this.vrm = vrm;
    });
  }

  setupListeners() {
    window.addEventListener('mousemove', (e) => {
      this.cursorNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.cursorNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.cursorNorm.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.cursorNorm.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      }
    }, { passive: true });
  }

  getManager() {
    return this.vrm?.expressionManager || this.vrm?.blendShapeProxy;
  }

  update(delta) {
    if (!this.vrm) return;

    this.updateBreathing(delta);
    this.updateBlinking(delta);
    this.updateSaccades(delta);
    this.updateGaze(delta);
  }

  updateBreathing(delta) {
    this.breatheTime += delta * this.breatheFreq * Math.PI * 2;
    const breatheSin = Math.sin(this.breatheTime);

    if (this.vrm.humanoid) {
      const chest = this.vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        // Natural gentle chest pitch (smooth human respiration without body/head swaying)
        chest.rotation.x += breatheSin * this.breatheChestAmp;
      }
    }
  }

  updateBlinking(delta) {
    const manager = this.getManager();
    if (!manager) return;

    this.timeSinceLastBlink += delta;

    if (!this.isBlinking && this.timeSinceLastBlink >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta / this.blinkDuration;
      if (this.blinkProgress >= 1.0) {
        this.blinkProgress = 1.0;
        this.isBlinking = false;
        this.timeSinceLastBlink = 0;
        this.nextBlinkInterval = 1.8 + Math.random() * 2.7;
      }

      const blinkVal = Math.sin(this.blinkProgress * Math.PI);
      try {
        if (typeof manager.getExpression === 'function') {
          if (manager.getExpression('blink')) {
            manager.setValue('blink', blinkVal);
          } else if (manager.getExpression('Blink')) {
            manager.setValue('Blink', blinkVal);
          }
        } else {
          manager.setValue('blink', blinkVal);
        }
      } catch (e) {}
    }
  }

  updateSaccades(delta) {
    this.saccadeTimer += delta;
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.saccadeTimer = 0;
      this.nextSaccadeInterval = 0.8 + Math.random() * 2.2;
      this.saccadeTarget.set(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.08
      );
    }

    this.saccadeOffset.lerp(this.saccadeTarget, THREE.MathUtils.clamp(delta * 12, 0, 1));
  }

  updateGaze(delta) {
    if (!this.vrm?.humanoid) return;

    const head = this.vrm.humanoid.getNormalizedBoneNode('head');
    const neck = this.vrm.humanoid.getNormalizedBoneNode('neck');
    if (!head || !neck) return;

    // Smooth cursor/touch gaze tracking
    this.smoothedGaze.lerp(this.cursorNorm, THREE.MathUtils.clamp(delta * 4, 0, 1));

    const camera = this.vrmManager?.camera;
    if (camera && this.vrm.scene) {
      head.getWorldPosition(this._headWorldPos);

      // Target position in world space = Camera position + cursor micro-offset + natural saccade jitter
      this._camTargetPos.copy(camera.position);
      this._camTargetPos.x += (this.smoothedGaze.x * 0.28) + this.saccadeOffset.x;
      this._camTargetPos.y += (this.smoothedGaze.y * 0.18) + this.saccadeOffset.y;

      // Direction from head to camera in world space (reusing scratch vector)
      this._toCamWorld.copy(this._camTargetPos).sub(this._headWorldPos).normalize();

      // Transform to the avatar's body/scene space (reusing scratch quaternion and vector)
      this._invSceneQuat.copy(this.vrm.scene.quaternion).invert();
      this._toCamLocal.copy(this._toCamWorld).applyQuaternion(this._invSceneQuat);

      // In avatar's local coordinates, facing direction is -Z.
      // In Three.js bone hierarchy, rotation around +Y rotates local -Z towards -X.
      // Therefore, to rotate towards +X local coordinate, rotation around Y is negative.
      const localYaw = -Math.atan2(this._toCamLocal.x, -this._toCamLocal.z);
      const horizDist = Math.hypot(this._toCamLocal.x, this._toCamLocal.z);
      const localPitch = Math.atan2(this._toCamLocal.y, Math.max(horizDist, 0.001));

      // Realistic human cervical spine turning limits:
      // Active human neck rotation limit is ~68° (1.187 rad).
      // Beyond 68°, rotation ceases (stops). Beyond 95°, head relaxes back to body alignment.
      const MAX_YAW = 68 * (Math.PI / 180); // 68 degrees anatomical limit
      const CEASE_YAW = 95 * (Math.PI / 180); // 95 degrees cease threshold

      const absYaw = Math.abs(localYaw);
      const signYaw = Math.sign(localYaw) || 1;
      let targetYaw = 0;

      if (absYaw <= MAX_YAW) {
        // Full head tracking within comfortable human range
        targetYaw = localYaw;
      } else if (absYaw <= CEASE_YAW) {
        // Cease/stop head rotation at the anatomical limit
        targetYaw = signYaw * MAX_YAW;
      } else {
        // When character turns away (back to camera), smoothly return to natural forward body pose
        const returnFactor = Math.max(0, 1 - (absYaw - CEASE_YAW) / (Math.PI - CEASE_YAW));
        targetYaw = signYaw * MAX_YAW * returnFactor;
      }

      // Vertical pitch limits (~20° up / down)
      const targetPitch = THREE.MathUtils.clamp(localPitch, -0.35, 0.35);

      // Smooth interpolation using frame delta
      const lerpSpeed = THREE.MathUtils.clamp(delta * 5.5, 0, 1);
      this.currentHeadYaw = THREE.MathUtils.lerp(this.currentHeadYaw, targetYaw, lerpSpeed);
      this.currentHeadPitch = THREE.MathUtils.lerp(this.currentHeadPitch, targetPitch, lerpSpeed);

      // Biomechanical distribution: 35% cervical neck, 65% head
      neck.rotation.y = this.currentHeadYaw * 0.35;
      neck.rotation.x = this.currentHeadPitch * 0.35;

      head.rotation.y = this.currentHeadYaw * 0.65;
      head.rotation.x = this.currentHeadPitch * 0.65;

      // Eye Tracking: keep eyes fixed on the user/camera throughout line of sight
      if (this.vrm.lookAt) {
        if (absYaw <= 88 * (Math.PI / 180)) {
          // In view: eyes lock onto the camera target
          this.vrm.lookAt.lookAt(this._camTargetPos);
        } else {
          // Out of view: eyes look naturally forward with the body (zero-allocation)
          this._bodyFwdWorld.set(0, 0, -1).applyQuaternion(this.vrm.scene.quaternion).multiplyScalar(3.0);
          this._eyeTargetWorld.copy(this._headWorldPos).add(this._bodyFwdWorld);
          this.vrm.lookAt.lookAt(this._eyeTargetWorld);
        }
      }
    } else {
      // Fallback if no camera
      const headX = THREE.MathUtils.clamp(-this.smoothedGaze.y * 0.22, -0.25, 0.25);
      const headY = THREE.MathUtils.clamp(-this.smoothedGaze.x * 0.35, -0.35, 0.35);
      neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, headX * 0.4, 0.1);
      neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, headY * 0.4, 0.1);
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headX * 0.6, 0.1);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headY * 0.6, 0.1);
    }
  }
}
