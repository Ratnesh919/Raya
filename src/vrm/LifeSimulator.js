import * as THREE from 'three';

export class LifeSimulator {
  constructor(vrmManager, expressionManager = null) {
    this.vrmManager = vrmManager;
    this.expressionManager = expressionManager || vrmManager?.expressionManager || null;
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

    // 5. Emotional Behavioral Movement & Gaze Aversion Engine
    this.activeBehavior = null; // { name, elapsed, duration }
    this.behaviorTarget = {
      headPitch: 0,
      headYaw: 0,
      headRoll: 0,
      neckRoll: 0,
      spinePitch: 0,
      spineRoll: 0,
      chestPitch: 0,
      leftShoulderZ: 0,
      rightShoulderZ: 0,
      gazeOffsetX: 0,
      gazeOffsetY: 0,
      breatheFreqMult: 1.0,
      breatheAmpMult: 1.0
    };
    this.behaviorCurrent = {
      headPitch: 0,
      headYaw: 0,
      headRoll: 0,
      neckRoll: 0,
      spinePitch: 0,
      spineRoll: 0,
      chestPitch: 0,
      leftShoulderZ: 0,
      rightShoulderZ: 0,
      gazeOffsetX: 0,
      gazeOffsetY: 0,
      breatheFreqMult: 1.0,
      breatheAmpMult: 1.0
    };

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

  triggerBehavior(name, duration = 4.5) {
    const cleanName = (name || '').toLowerCase().trim();
    this.activeBehavior = {
      name: cleanName,
      elapsed: 0,
      duration: Math.max(1.5, duration)
    };

    const exprMgr = this.expressionManager || this.vrmManager?.expressionManager;
    if (exprMgr && typeof exprMgr.setEmotion === 'function') {
      if (cleanName === 'shy' || cleanName === 'blush' || cleanName === 'embarrassment') {
        exprMgr.setEmotion('shy', 1.0);
      } else if (cleanName === 'concern' || cleanName === 'caring' || cleanName === 'empathy' || cleanName === 'console') {
        exprMgr.setEmotion('concern', 1.0);
      } else if (cleanName === 'love' || cleanName === 'admiration') {
        exprMgr.setEmotion('love', 1.0);
      } else if (cleanName === 'think' || cleanName === 'curiosity') {
        exprMgr.setEmotion('think', 1.0);
      }
    }
  }

  clearBehavior() {
    this.activeBehavior = null;
    this.behaviorTarget.headPitch = 0;
    this.behaviorTarget.headYaw = 0;
    this.behaviorTarget.headRoll = 0;
    this.behaviorTarget.neckRoll = 0;
    this.behaviorTarget.spinePitch = 0;
    this.behaviorTarget.spineRoll = 0;
    this.behaviorTarget.chestPitch = 0;
    this.behaviorTarget.leftShoulderZ = 0;
    this.behaviorTarget.rightShoulderZ = 0;
    this.behaviorTarget.gazeOffsetX = 0;
    this.behaviorTarget.gazeOffsetY = 0;
    this.behaviorTarget.breatheFreqMult = 1.0;
    this.behaviorTarget.breatheAmpMult = 1.0;
  }

  updateBehavior(delta) {
    if (!this.activeBehavior) {
      // Smoothly relax posture back to baseline forward user-tracking
      const returnSpeed = THREE.MathUtils.clamp(delta * 4.0, 0, 1);
      for (const k in this.behaviorCurrent) {
        const target = (k === 'breatheFreqMult' || k === 'breatheAmpMult') ? 1.0 : 0.0;
        this.behaviorCurrent[k] = THREE.MathUtils.lerp(this.behaviorCurrent[k], target, returnSpeed);
      }
      return;
    }

    this.activeBehavior.elapsed += delta;
    const t = this.activeBehavior.elapsed;
    const dur = this.activeBehavior.duration;

    if (t >= dur) {
      this.clearBehavior();
      const exprMgr = this.expressionManager || this.vrmManager?.expressionManager;
      if (exprMgr && typeof exprMgr.setEmotion === 'function') {
        exprMgr.setEmotion('neutral');
      }
      return;
    }

    const name = this.activeBehavior.name;

    if (name === 'shy' || name === 'embarrassment' || name === 'blush') {
      // 1. SHY SEQUENCE (Bashful head tilt, looks at user, breaks gaze downward, holds, then peeks back up)
      const tNotice = Math.min(0.7, dur * 0.16);
      const tTilt = Math.min(1.9, dur * 0.42);
      const tHold = Math.min(3.0, dur * 0.67);

      if (t < tNotice) {
        // Stage 1: Notices attention, direct gaze
        this.behaviorTarget.headPitch = 0;
        this.behaviorTarget.headYaw = 0;
        this.behaviorTarget.headRoll = 0;
        this.behaviorTarget.neckRoll = 0;
        this.behaviorTarget.spinePitch = 0;
        this.behaviorTarget.leftShoulderZ = 0;
        this.behaviorTarget.gazeOffsetX = 0;
        this.behaviorTarget.gazeOffsetY = 0;
      } else if (t < tTilt) {
        // Stage 2: Gaze aversion & head tilts down & to the side
        const p = (t - tNotice) / (tTilt - tNotice);
        const ease = p * p * (3 - 2 * p); // smoothstep
        // Eyes dart down and away first
        this.behaviorTarget.gazeOffsetY = -0.55 * ease;
        this.behaviorTarget.gazeOffsetX = 0.28 * ease;
        // Head follows
        this.behaviorTarget.headPitch = -0.22 * ease; // ~ -13 deg pitch down
        this.behaviorTarget.headYaw = 0.20 * ease;    // ~ +11.5 deg turn away
        this.behaviorTarget.headRoll = 0.16 * ease;   // ~ +9 deg lateral tilt
        this.behaviorTarget.neckRoll = 0.08 * ease;
        // Body posture: modest inward hunch & slight shoulder elevation
        this.behaviorTarget.spinePitch = -0.05 * ease;
        this.behaviorTarget.leftShoulderZ = 0.05 * ease;

        // Trigger a bashful blink midway through the gaze break
        if (p > 0.4 && p < 0.6 && !this.isBlinking && this.timeSinceLastBlink > 1.0) {
          this.isBlinking = true;
          this.blinkProgress = 0;
        }
      } else if (t < tHold) {
        // Stage 3: Bashful hold with living micro-flutter
        this.behaviorTarget.gazeOffsetY = -0.55;
        this.behaviorTarget.gazeOffsetX = 0.28;
        this.behaviorTarget.headPitch = -0.22;
        this.behaviorTarget.headYaw = 0.20;
        this.behaviorTarget.headRoll = 0.16;
        this.behaviorTarget.neckRoll = 0.08;
        this.behaviorTarget.spinePitch = -0.05;
        this.behaviorTarget.leftShoulderZ = 0.05;
      } else {
        // Stage 4: Eyes dart back up FIRST to look at user through eyelashes, then head gently recovers
        const pTotal = (t - tHold) / (dur - tHold);
        // Eyes return rapidly in first 40% of phase 4
        const eyeP = Math.min(1.0, pTotal / 0.45);
        const eyeEase = eyeP * eyeP * (3 - 2 * eyeP);
        this.behaviorTarget.gazeOffsetY = -0.55 * (1 - eyeEase);
        this.behaviorTarget.gazeOffsetX = 0.28 * (1 - eyeEase);

        // Head and spine follow smoothly
        const headP = Math.max(0, (pTotal - 0.25) / 0.75);
        const headEase = headP * headP * (3 - 2 * headP);
        this.behaviorTarget.headPitch = -0.22 * (1 - headEase);
        this.behaviorTarget.headYaw = 0.20 * (1 - headEase);
        this.behaviorTarget.headRoll = 0.16 * (1 - headEase);
        this.behaviorTarget.neckRoll = 0.08 * (1 - headEase);
        this.behaviorTarget.spinePitch = -0.05 * (1 - headEase);
        this.behaviorTarget.leftShoulderZ = 0.05 * (1 - headEase);
      }
    } else if (name === 'concern' || name === 'caring' || name === 'empathy' || name === 'console') {
      // 2. CONCERN SEQUENCE (Empathetic lateral head tilt, forward body lean, focused gaze)
      let p = Math.min(1.0, t / 0.8);
      if (t > dur - 1.0) {
        p = Math.max(0, (dur - t) / 1.0);
      }
      const ease = p * p * (3 - 2 * p);

      // Sympathetic lateral head tilt (-11.5 deg)
      this.behaviorTarget.headRoll = -0.20 * ease;
      this.behaviorTarget.neckRoll = -0.08 * ease;
      this.behaviorTarget.headPitch = 0.04 * ease;
      this.behaviorTarget.headYaw = 0.02 * ease;

      // Active empathetic listening: lean body forward towards user/camera
      this.behaviorTarget.spinePitch = 0.08 * ease; // forward lean (+4.6 deg)
      this.behaviorTarget.chestPitch = 0.04 * ease;

      // Subtle empathetic nod at midpoint
      if (t >= 1.8 && t <= 2.6) {
        const nodSin = Math.sin((t - 1.8) * Math.PI * 2.5);
        this.behaviorTarget.headPitch += nodSin * 0.05;
      }

      this.behaviorTarget.gazeOffsetX = 0;
      this.behaviorTarget.gazeOffsetY = 0;
    } else if (name === 'love' || name === 'admiration') {
      // 3. LOVE / FONDNESS SEQUENCE (Warm head tilt exposing neck, relaxed chest expansion, soft eyes)
      let p = Math.min(1.0, t / 0.9);
      if (t > dur - 1.1) {
        p = Math.max(0, (dur - t) / 1.1);
      }
      const ease = p * p * (3 - 2 * p);

      this.behaviorTarget.headRoll = 0.14 * ease; // gentle +8 deg head tilt exposing neck
      this.behaviorTarget.neckRoll = 0.06 * ease;
      this.behaviorTarget.headPitch = -0.03 * ease;
      this.behaviorTarget.headYaw = -0.04 * ease;

      // Deep, soothing breathing cycle
      this.behaviorTarget.breatheFreqMult = 1.0 - (0.35 * ease); // slower rate
      this.behaviorTarget.breatheAmpMult = 1.0 + (0.55 * ease);  // deeper breaths
      this.behaviorTarget.spinePitch = 0.02 * ease;
      this.behaviorTarget.chestPitch = 0.03 * ease;

      this.behaviorTarget.gazeOffsetX = 0;
      this.behaviorTarget.gazeOffsetY = 0;
    } else if (name === 'think' || name === 'curiosity') {
      // 4. THINKING SEQUENCE (Head tilted up and away, eyes gazing up for cognitive retrieval)
      let p = Math.min(1.0, t / 0.7);
      if (t > dur - 0.8) {
        p = Math.max(0, (dur - t) / 0.8);
      }
      const ease = p * p * (3 - 2 * p);

      this.behaviorTarget.headPitch = 0.14 * ease; // +8 deg up
      this.behaviorTarget.headYaw = -0.20 * ease;  // -11.5 deg turn
      this.behaviorTarget.headRoll = -0.06 * ease;
      this.behaviorTarget.gazeOffsetY = 0.38 * ease; // look up
      this.behaviorTarget.gazeOffsetX = -0.28 * ease; // look left
      this.behaviorTarget.spinePitch = -0.03 * ease;
    }

    // Smooth lerp to target for fluid 60fps motion
    const blendSpeed = THREE.MathUtils.clamp(delta * 6.0, 0, 1);
    for (const k in this.behaviorCurrent) {
      this.behaviorCurrent[k] = THREE.MathUtils.lerp(
        this.behaviorCurrent[k],
        this.behaviorTarget[k],
        blendSpeed
      );
    }
  }

  update(delta) {
    if (!this.vrm) return;

    this.updateBehavior(delta);
    this.updateBreathing(delta);
    this.updateBlinking(delta);
    this.updateSaccades(delta);
    this.updateGaze(delta);
  }

  updateBreathing(delta) {
    const freq = this.breatheFreq * (this.behaviorCurrent.breatheFreqMult || 1.0);
    const amp = this.breatheChestAmp * (this.behaviorCurrent.breatheAmpMult || 1.0);
    this.breatheTime += delta * freq * Math.PI * 2;
    const breatheSin = Math.sin(this.breatheTime);

    if (this.vrm.humanoid) {
      const chest = this.vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        // Natural gentle chest pitch + breathing amplitude + emotional posture pitch
        chest.rotation.x += breatheSin * amp + (this.behaviorCurrent.chestPitch || 0);
      }
      const spine = this.vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        spine.rotation.x += (this.behaviorCurrent.spinePitch || 0);
        spine.rotation.z += (this.behaviorCurrent.spineRoll || 0);
      }
      const leftShoulder = this.vrm.humanoid.getNormalizedBoneNode('leftShoulder');
      if (leftShoulder) {
        leftShoulder.rotation.z += (this.behaviorCurrent.leftShoulderZ || 0);
      }
      const rightShoulder = this.vrm.humanoid.getNormalizedBoneNode('rightShoulder');
      if (rightShoulder) {
        rightShoulder.rotation.z += (this.behaviorCurrent.rightShoulderZ || 0);
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

      // Target position in world space = Camera position + cursor micro-offset + natural saccade jitter + emotional behavioral offset
      this._camTargetPos.copy(camera.position);
      this._camTargetPos.x += (this.smoothedGaze.x * 0.28) + this.saccadeOffset.x + (this.behaviorCurrent.gazeOffsetX || 0);
      this._camTargetPos.y += (this.smoothedGaze.y * 0.18) + this.saccadeOffset.y + (this.behaviorCurrent.gazeOffsetY || 0);

      // Direction from head to camera in world space (reusing scratch vector)
      this._toCamWorld.copy(this._camTargetPos).sub(this._headWorldPos).normalize();

      // Transform to the avatar's body/scene space (reusing scratch quaternion and vector)
      this._invSceneQuat.copy(this.vrm.scene.quaternion).invert();
      this._toCamLocal.copy(this._toCamWorld).applyQuaternion(this._invSceneQuat);

      // In avatar's local coordinates, facing direction is -Z.
      const localYaw = -Math.atan2(this._toCamLocal.x, -this._toCamLocal.z);
      const horizDist = Math.hypot(this._toCamLocal.x, this._toCamLocal.z);
      const localPitch = Math.atan2(this._toCamLocal.y, Math.max(horizDist, 0.001));

      // Realistic human cervical spine turning limits:
      const MAX_YAW = 68 * (Math.PI / 180); // 68 degrees anatomical limit
      const CEASE_YAW = 95 * (Math.PI / 180); // 95 degrees cease threshold

      const absYaw = Math.abs(localYaw);
      const signYaw = Math.sign(localYaw) || 1;
      let targetYaw = 0;

      if (absYaw <= MAX_YAW) {
        targetYaw = localYaw;
      } else if (absYaw <= CEASE_YAW) {
        targetYaw = signYaw * MAX_YAW;
      } else {
        const returnFactor = Math.max(0, 1 - (absYaw - CEASE_YAW) / (Math.PI - CEASE_YAW));
        targetYaw = signYaw * MAX_YAW * returnFactor;
      }

      // Vertical pitch limits (~20° up / down)
      const targetPitch = THREE.MathUtils.clamp(localPitch, -0.35, 0.35);

      // Smooth interpolation using frame delta
      const lerpSpeed = THREE.MathUtils.clamp(delta * 5.5, 0, 1);
      this.currentHeadYaw = THREE.MathUtils.lerp(this.currentHeadYaw, targetYaw, lerpSpeed);
      this.currentHeadPitch = THREE.MathUtils.lerp(this.currentHeadPitch, targetPitch, lerpSpeed);

      // Biomechanical distribution: 35% cervical neck, 65% head + behavioral head & neck tilts
      neck.rotation.y = this.currentHeadYaw * 0.35 + (this.behaviorCurrent.headYaw * 0.35);
      neck.rotation.x = this.currentHeadPitch * 0.35 + (this.behaviorCurrent.headPitch * 0.35);
      neck.rotation.z = (this.behaviorCurrent.neckRoll || 0);

      head.rotation.y = this.currentHeadYaw * 0.65 + (this.behaviorCurrent.headYaw * 0.65);
      head.rotation.x = this.currentHeadPitch * 0.65 + (this.behaviorCurrent.headPitch * 0.65);
      head.rotation.z = (this.behaviorCurrent.headRoll || 0);

      // Eye Tracking: keep eyes fixed on the target throughout line of sight
      if (this.vrm.lookAt) {
        if (absYaw <= 88 * (Math.PI / 180)) {
          this.vrm.lookAt.lookAt(this._camTargetPos);
        } else {
          this._bodyFwdWorld.set(0, 0, -1).applyQuaternion(this.vrm.scene.quaternion).multiplyScalar(3.0);
          this._eyeTargetWorld.copy(this._headWorldPos).add(this._bodyFwdWorld);
          this.vrm.lookAt.lookAt(this._eyeTargetWorld);
        }
      }
    } else {
      // Fallback if no camera
      const headX = THREE.MathUtils.clamp(-this.smoothedGaze.y * 0.22, -0.25, 0.25);
      const headY = THREE.MathUtils.clamp(-this.smoothedGaze.x * 0.35, -0.35, 0.35);
      neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, headX * 0.4 + (this.behaviorCurrent.headPitch * 0.35), 0.1);
      neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, headY * 0.4 + (this.behaviorCurrent.headYaw * 0.35), 0.1);
      neck.rotation.z = (this.behaviorCurrent.neckRoll || 0);
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headX * 0.6 + (this.behaviorCurrent.headPitch * 0.65), 0.1);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headY * 0.6 + (this.behaviorCurrent.headYaw * 0.65), 0.1);
      head.rotation.z = (this.behaviorCurrent.headRoll || 0);
    }
  }
}
