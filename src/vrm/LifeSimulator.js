import * as THREE from 'three';

export class LifeSimulator {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

    // 1. Breathing parameters
    this.breatheTime = 0;
    this.breatheFreq = 0.9;
    this.breatheSpineAmp = 0.015;
    this.breatheChestAmp = 0.022;

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

    // 4. Cursor / Gaze Tracking
    this.cursorNorm = new THREE.Vector2(0, 0);
    this.smoothedGaze = new THREE.Vector2(0, 0);

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
    const dSin = breatheSin - (this.prevBreatheSin || 0);
    this.prevBreatheSin = breatheSin;

    if (this.vrm.humanoid) {
      const chest = this.vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        chest.rotation.x += dSin * this.breatheChestAmp;
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
    if (!this.vrm.humanoid) return;

    this.smoothedGaze.lerp(this.cursorNorm, THREE.MathUtils.clamp(delta * 4, 0, 1));

    const headX = THREE.MathUtils.clamp(-this.smoothedGaze.y * 0.22, -0.25, 0.25);
    const headY = THREE.MathUtils.clamp(-this.smoothedGaze.x * 0.35, -0.35, 0.35);

    const neck = this.vrm.humanoid.getNormalizedBoneNode('neck');
    const head = this.vrm.humanoid.getNormalizedBoneNode('head');

    if (neck) {
      neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, headX * 0.4, 0.1);
      neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, headY * 0.4, 0.1);
    }
    if (head) {
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headX * 0.6, 0.1);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headY * 0.6, 0.1);
    }

    if (this.vrm.lookAt) {
      const gazeTarget = new THREE.Vector3(
        this.smoothedGaze.x * 2 + this.saccadeOffset.x,
        1.25 + this.smoothedGaze.y * 1.5 + this.saccadeOffset.y,
        3.0
      );
      this.vrm.lookAt.lookAt(gazeTarget);
    }
  }
}
