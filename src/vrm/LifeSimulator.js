import * as THREE from 'three';

export class LifeSimulator {
  constructor(vrmManager, expressionManager = null) {
    this.vrmManager = vrmManager;
    this.expressionManager = expressionManager || vrmManager?.expressionManager || null;
    this.lipSyncEngine = null; // Connected in bootstrap/main.js
    this.vrm = null;

    // 1. Guaranteed Motion Floor (open-annie floor.js)
    this.floorTime = 0;
    this.swayHipsAmp = 0.006; // Organic weight shifting (~0.35 deg)
    this.swaySpineAmp = 0.004;

    // 2. Breathing parameters (organic human respiration cycle)
    this.breatheTime = 0;
    this.breatheFreq = 0.75; // Calm, relaxed resting respiratory rate (~12-14 breaths/min)
    this.breatheSpineAmp = 0.0;
    this.breatheChestAmp = 0.018; // Natural chest pitch breathing motion (~1.0 deg)

    // 3. Natural Blinking
    this.isBlinking = false;
    this.blinkProgress = 0;
    this.blinkDuration = 0.18;
    this.timeSinceLastBlink = 0;
    this.nextBlinkInterval = 2.5;

    // 4. Eye Saccades
    this.saccadeTimer = 0;
    this.nextSaccadeInterval = 1.8;
    this.saccadeOffset = new THREE.Vector2(0, 0);
    this.saccadeTarget = new THREE.Vector2(0, 0);

    // 5. Cursor / Gaze Tracking & Camera Head Tracking
    this.cursorNorm = new THREE.Vector2(0, 0);
    this.smoothedGaze = new THREE.Vector2(0, 0);

    // 6. Active Listening "Instinct" Mode (open-annie instinct.js)
    this.isListening = false;
    this.listeningNodTimer = 0;
    this.listeningNodInterval = 2.6; // Rhythmic receptive nod every 2.6s
    this.listeningCurrent = {
      spinePitch: 0,
      headRoll: 0,
      nodPitch: 0
    };

    // 7. Co-Speech Gestures & Syllable Stress Accents (open-annie gestures.js)
    this.speechNodCurrent = 0;
    this.speechChestCurrent = 0;

    // 8. Emotional Behavioral Movement & Gaze Aversion Engine
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
      breatheAmpMult: 1.0,
      handsJoinedWeight: 0
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
      breatheAmpMult: 1.0,
      handsJoinedWeight: 0
    };

    // Humanoid arm, elbow, hand & finger bone caches for full-body postures
    this.leftUpperArm = null;
    this.rightUpperArm = null;
    this.leftLowerArm = null;
    this.rightLowerArm = null;
    this.leftHand = null;
    this.rightHand = null;
    this.leftFingers = [];
    this.rightFingers = [];

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
      this.bindModel(vrm);
    });
  }

  bindModel(vrm) {
    this.vrm = vrm;
    if (!vrm?.humanoid) return;

    this.leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    this.rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    this.leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    this.rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
    this.leftHand = vrm.humanoid.getNormalizedBoneNode('leftHand');
    this.rightHand = vrm.humanoid.getNormalizedBoneNode('rightHand');

    this.leftFingers = this.cacheFingerBones('left');
    this.rightFingers = this.cacheFingerBones('right');
  }

  cacheFingerBones(side) {
    if (!this.vrm?.humanoid) return [];
    const fingers = [];
    const seen = new Set();
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];

    fingerNames.forEach((fname) => {
      const isThumb = fname === 'Thumb';
      const b1 = this.vrm.humanoid.getNormalizedBoneNode(`${side}${fname}Proximal`) ||
                 this.vrm.humanoid.getNormalizedBoneNode(`${side}${fname}Metacarpal`);
      const b2 = this.vrm.humanoid.getNormalizedBoneNode(`${side}${fname}Intermediate`);
      const b3 = this.vrm.humanoid.getNormalizedBoneNode(`${side}${fname}Distal`);

      [b1, b2, b3].forEach((node, idx) => {
        if (node && !seen.has(node)) {
          seen.add(node);
          fingers.push({
            node,
            isThumb,
            isIndex: fname === 'Index',
            seg: idx === 0 ? 'prox' : idx === 1 ? 'inter' : 'dist',
            side
          });
        }
      });
    });
    return fingers;
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

  /**
   * Active Listening Mode:
   * Called when the user starts speaking (mic active or user typing)
   */
  startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.listeningNodTimer = 0.5; // Start with a brief welcoming acknowledgment nod
    // Attentive soft blink
    if (!this.isBlinking) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }
  }

  stopListening() {
    this.isListening = false;
    this.listeningNodTimer = 0;
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
    this.behaviorTarget.handsJoinedWeight = 0;
  }

  updateBehavior(delta) {
    if (!this.activeBehavior) {
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
      // 1. SHY SEQUENCE (User-specified multi-phase behavior):
      // - Head tilts slightly down to her left
      // - Eyes look directly at the user
      // - Eyes look down away while KEEPING THE HEAD AT THE SAME PLACE
      // - Moving her eyes back towards the user while KEEPING THE HEAD AT THE SAME PLACE
      // - Hands kept joined to the front with proper elbow and finger movement
      const tTilt = 0.9;
      const tLookDown = 2.4;
      const tLookUp = 4.2;

      const headPitchTarget = -0.18;
      const headRollTarget = -0.16; // Tilted slightly down to her left
      const headYawTarget = -0.10;  // Turned slightly to her left
      const neckRollTarget = -0.08;
      const spinePitchTarget = -0.04;
      const shoulderZTarget = 0.04;

      if (t < tTilt) {
        // Step 1: Head tilts slightly down to her left, hands join in front, eyes lock onto user
        const p = t / tTilt;
        const ease = p * p * (3 - 2 * p);
        this.behaviorTarget.headPitch = headPitchTarget * ease;
        this.behaviorTarget.headRoll = headRollTarget * ease;
        this.behaviorTarget.headYaw = headYawTarget * ease;
        this.behaviorTarget.neckRoll = neckRollTarget * ease;
        this.behaviorTarget.spinePitch = spinePitchTarget * ease;
        this.behaviorTarget.leftShoulderZ = shoulderZTarget * ease;
        this.behaviorTarget.handsJoinedWeight = ease;

        // Eyes look at the user (+0.22 upward offset counteracts the -0.18 downward head tilt)
        this.behaviorTarget.gazeOffsetY = 0.22 * ease;
        this.behaviorTarget.gazeOffsetX = 0;
        this.behaviorTarget.breatheFreqMult = 1.0 + 0.25 * ease;
      } else if (t < tLookDown) {
        // Step 2: KEEP HEAD AT EXACT SAME PLACE, while eyes break gaze and look down away bashfully
        this.behaviorTarget.headPitch = headPitchTarget;
        this.behaviorTarget.headRoll = headRollTarget;
        this.behaviorTarget.headYaw = headYawTarget;
        this.behaviorTarget.neckRoll = neckRollTarget;
        this.behaviorTarget.spinePitch = spinePitchTarget;
        this.behaviorTarget.leftShoulderZ = shoulderZTarget;
        this.behaviorTarget.handsJoinedWeight = 1.0;

        const pDown = Math.min(1.0, (t - tTilt) / 0.55);
        const easeDown = pDown * pDown * (3 - 2 * pDown);
        this.behaviorTarget.gazeOffsetY = THREE.MathUtils.lerp(0.22, -0.65, easeDown);
        this.behaviorTarget.gazeOffsetX = THREE.MathUtils.lerp(0.0, 0.24, easeDown);
        this.behaviorTarget.breatheFreqMult = 1.25;

        // Gentle bashful blink mid-way down
        if (pDown > 0.35 && pDown < 0.65 && !this.isBlinking && this.timeSinceLastBlink > 0.8) {
          this.isBlinking = true;
          this.blinkProgress = 0;
        }
      } else if (t < tLookUp) {
        // Step 3: KEEP HEAD AT EXACT SAME PLACE, while moving eyes back towards the user
        this.behaviorTarget.headPitch = headPitchTarget;
        this.behaviorTarget.headRoll = headRollTarget;
        this.behaviorTarget.headYaw = headYawTarget;
        this.behaviorTarget.neckRoll = neckRollTarget;
        this.behaviorTarget.spinePitch = spinePitchTarget;
        this.behaviorTarget.leftShoulderZ = shoulderZTarget;
        this.behaviorTarget.handsJoinedWeight = 1.0;

        const pUp = Math.min(1.0, (t - tLookDown) / 0.70);
        const easeUp = pUp * pUp * (3 - 2 * pUp);
        this.behaviorTarget.gazeOffsetY = THREE.MathUtils.lerp(-0.65, 0.22, easeUp);
        this.behaviorTarget.gazeOffsetX = THREE.MathUtils.lerp(0.24, 0.0, easeUp);
        this.behaviorTarget.breatheFreqMult = 1.15;
      } else {
        // Step 4: Gracefully ease back to neutral posture
        const pTotal = (t - tLookUp) / Math.max(0.001, dur - tLookUp);
        const easeOut = pTotal * pTotal * (3 - 2 * pTotal);
        const remain = 1.0 - easeOut;

        this.behaviorTarget.headPitch = headPitchTarget * remain;
        this.behaviorTarget.headRoll = headRollTarget * remain;
        this.behaviorTarget.headYaw = headYawTarget * remain;
        this.behaviorTarget.neckRoll = neckRollTarget * remain;
        this.behaviorTarget.spinePitch = spinePitchTarget * remain;
        this.behaviorTarget.leftShoulderZ = shoulderZTarget * remain;
        this.behaviorTarget.handsJoinedWeight = remain;

        this.behaviorTarget.gazeOffsetY = 0.22 * remain;
        this.behaviorTarget.gazeOffsetX = 0;
        this.behaviorTarget.breatheFreqMult = 1.0 + 0.15 * remain;
      }
    } else if (name === 'concern' || name === 'caring' || name === 'empathy' || name === 'console') {
      // 2. CONCERN SEQUENCE (Empathetic lateral head tilt, forward body lean, focused gaze)
      let p = Math.min(1.0, t / 0.8);
      if (t > dur - 1.0) {
        p = Math.max(0, (dur - t) / 1.0);
      }
      const ease = p * p * (3 - 2 * p);

      this.behaviorTarget.headRoll = -0.20 * ease;
      this.behaviorTarget.neckRoll = -0.08 * ease;
      this.behaviorTarget.headPitch = 0.04 * ease;
      this.behaviorTarget.headYaw = 0.02 * ease;

      this.behaviorTarget.spinePitch = 0.08 * ease;
      this.behaviorTarget.chestPitch = 0.04 * ease;

      if (t >= 1.8 && t <= 2.6) {
        const nodSin = Math.sin((t - 1.8) * Math.PI * 2.5);
        this.behaviorTarget.headPitch += nodSin * 0.05;
      }

      this.behaviorTarget.gazeOffsetX = 0;
      this.behaviorTarget.gazeOffsetY = 0;
    } else if (name === 'love' || name === 'admiration') {
      // 3. LOVE / FONDNESS SEQUENCE (Warm head tilt exposing neck, relaxed chest expansion)
      let p = Math.min(1.0, t / 0.9);
      if (t > dur - 1.1) {
        p = Math.max(0, (dur - t) / 1.1);
      }
      const ease = p * p * (3 - 2 * p);

      this.behaviorTarget.headRoll = 0.14 * ease;
      this.behaviorTarget.neckRoll = 0.06 * ease;
      this.behaviorTarget.headPitch = -0.03 * ease;
      this.behaviorTarget.headYaw = -0.04 * ease;

      this.behaviorTarget.breatheFreqMult = 1.0 - (0.35 * ease);
      this.behaviorTarget.breatheAmpMult = 1.0 + (0.55 * ease);
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

      this.behaviorTarget.headPitch = 0.14 * ease;
      this.behaviorTarget.headYaw = -0.20 * ease;
      this.behaviorTarget.headRoll = -0.06 * ease;
      this.behaviorTarget.gazeOffsetY = 0.38 * ease;
      this.behaviorTarget.gazeOffsetX = -0.28 * ease;
      this.behaviorTarget.spinePitch = -0.03 * ease;
    }

    const blendSpeed = THREE.MathUtils.clamp(delta * 6.0, 0, 1);
    for (const k in this.behaviorCurrent) {
      this.behaviorCurrent[k] = THREE.MathUtils.lerp(
        this.behaviorCurrent[k],
        this.behaviorTarget[k],
        blendSpeed
      );
    }
  }

  /**
   * Updates Active Listening Instinct Mode & Co-Speech Gestures
   */
  updateInstinctAndGestures(delta) {
    // 1. Active Listening Mode
    const targetSpinePitch = this.isListening ? 0.065 : 0; // ~3.7 deg forward attentive lean
    const targetHeadRoll = this.isListening ? 0.075 : 0; // ~4.3 deg curious lateral tilt

    const listenLerp = THREE.MathUtils.clamp(delta * 4.5, 0, 1);
    this.listeningCurrent.spinePitch = THREE.MathUtils.lerp(this.listeningCurrent.spinePitch, targetSpinePitch, listenLerp);
    this.listeningCurrent.headRoll = THREE.MathUtils.lerp(this.listeningCurrent.headRoll, targetHeadRoll, listenLerp);

    if (this.isListening) {
      this.listeningNodTimer += delta;
      if (this.listeningNodTimer >= this.listeningNodInterval) {
        this.listeningNodTimer = 0;
      }
      // Gentle receptive micro-nod over 0.5s window
      if (this.listeningNodTimer < 0.5) {
        const nodPhase = (this.listeningNodTimer / 0.5) * Math.PI * 2;
        this.listeningCurrent.nodPitch = Math.sin(nodPhase) * 0.035; // ~2.0 deg nod
      } else {
        this.listeningCurrent.nodPitch = 0;
      }
    } else {
      this.listeningCurrent.nodPitch = THREE.MathUtils.lerp(this.listeningCurrent.nodPitch, 0, listenLerp);
    }

    // 2. Co-Speech Gestures & Syllable Stress Timing
    let targetSpeechNod = 0;
    let targetSpeechChest = 0;

    if (this.lipSyncEngine?.isSpeaking) {
      if (this.lipSyncEngine.isStressedSyllable) {
        targetSpeechNod = 0.028; // ~1.6 deg downward speech nod accent
        targetSpeechChest = 0.015;
      }
    }

    const speechLerp = THREE.MathUtils.clamp(delta * 12.0, 0, 1);
    this.speechNodCurrent = THREE.MathUtils.lerp(this.speechNodCurrent, targetSpeechNod, speechLerp);
    this.speechChestCurrent = THREE.MathUtils.lerp(this.speechChestCurrent, targetSpeechChest, speechLerp);
  }

  update(delta) {
    if (!this.vrm) return;

    this.floorTime += delta;
    this.updateBehavior(delta);
    this.updateInstinctAndGestures(delta);
    this.updateBreathing(delta);
    this.updateBlinking(delta);
    this.updateSaccades(delta);
    this.updateGaze(delta);
    this.updateHandsAndFingers(delta);
  }

  updateHandsAndFingers(delta) {
    if (!this.vrm?.humanoid) return;

    // Smooth handsJoinedWeight
    const targetW = this.behaviorTarget.handsJoinedWeight || 0;
    const lerpSpeed = THREE.MathUtils.clamp(delta * 6.0, 0, 1);
    this.behaviorCurrent.handsJoinedWeight = THREE.MathUtils.lerp(
      this.behaviorCurrent.handsJoinedWeight || 0,
      targetW,
      lerpSpeed
    );
    const w = this.behaviorCurrent.handsJoinedWeight;

    // 1. Arm and Elbow Kinematics (gentle natural posture without twisting arms behind the hips)
    if (w > 0.0005) {
      if (this.leftUpperArm) {
        this.leftUpperArm.rotation.x += 0.12 * w; // Soft forward pitch
        this.leftUpperArm.rotation.z -= 0.06 * w; // Bring arms gently closer to body
      }
      if (this.rightUpperArm) {
        this.rightUpperArm.rotation.x += 0.12 * w; // Soft forward pitch
        this.rightUpperArm.rotation.z += 0.06 * w; // Bring arms gently closer to body
      }

      if (this.leftLowerArm) {
        this.leftLowerArm.rotation.x += 0.18 * w; // Gentle forward elbow bend
      }
      if (this.rightLowerArm) {
        this.rightLowerArm.rotation.x += 0.18 * w; // Gentle forward elbow bend
      }

      if (this.leftHand) {
        this.leftHand.rotation.x -= 0.08 * w; // Natural soft wrist relax
      }
      if (this.rightHand) {
        this.rightHand.rotation.x -= 0.08 * w; // Natural soft wrist relax
      }
    }

    // 2. All 10 Finger Bones: Gentle Clasp during shy/joined hand postures without unbounded accumulation
    // Left hand in VRM humanoid curls inward with -Z; Right hand curls inward with +Z
    if (w > 0.001) {
      if (this.leftFingers && this.leftFingers.length > 0) {
        for (let i = 0; i < this.leftFingers.length; i++) {
          const f = this.leftFingers[i];
          const angle = f.isThumb ? 0.16 * w : f.isIndex ? 0.24 * w : 0.30 * w;
          f.node.rotation.z = -angle; // -Z curls inward towards palm on Left hand
        }
      }

      if (this.rightFingers && this.rightFingers.length > 0) {
        for (let i = 0; i < this.rightFingers.length; i++) {
          const f = this.rightFingers[i];
          const angle = f.isThumb ? 0.16 * w : f.isIndex ? 0.24 * w : 0.30 * w;
          f.node.rotation.z = angle; // +Z curls inward towards palm on Right hand
        }
      }
    }
  }

  updateBreathing(delta) {
    // Breathing rate slightly increases during vocalization
    const vocalRateMult = (this.lipSyncEngine?.isSpeaking) ? 1.15 : 1.0;
    const freq = this.breatheFreq * (this.behaviorCurrent.breatheFreqMult || 1.0) * vocalRateMult;
    const amp = this.breatheChestAmp * (this.behaviorCurrent.breatheAmpMult || 1.0);
    this.breatheTime += delta * freq * Math.PI * 2;
    const breatheSin = Math.sin(this.breatheTime);

    // Guaranteed Motion Floor: subtle biological sway
    const swayYaw = Math.sin(this.floorTime * 0.45) * this.swayHipsAmp;
    const swayRoll = Math.cos(this.floorTime * 0.25) * this.swaySpineAmp;

    if (this.vrm.humanoid) {
      const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
      if (hips) {
        hips.rotation.y += swayYaw;
      }

      const chest = this.vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        chest.rotation.x += breatheSin * amp + (this.behaviorCurrent.chestPitch || 0) + this.speechChestCurrent;
      }
      const spine = this.vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        spine.rotation.x += (this.behaviorCurrent.spinePitch || 0) + this.listeningCurrent.spinePitch;
        spine.rotation.z += (this.behaviorCurrent.spineRoll || 0) + swayRoll;
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
        // In active listening mode, blinks are slightly calmer and more frequent
        const baseInterval = this.isListening ? 1.5 : 2.0;
        this.nextBlinkInterval = baseInterval + Math.random() * 2.2;
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
      // In active listening mode, eyes lock tighter on user with 50% reduced wander
      const saccadeMult = this.isListening ? 0.05 : 0.12;
      this.saccadeTarget.set(
        (Math.random() - 0.5) * saccadeMult,
        (Math.random() - 0.5) * (saccadeMult * 0.7)
      );
    }

    this.saccadeOffset.lerp(this.saccadeTarget, THREE.MathUtils.clamp(delta * 12, 0, 1));
  }

  updateGaze(delta) {
    if (!this.vrm?.humanoid) return;

    const head = this.vrm.humanoid.getNormalizedBoneNode('head');
    const neck = this.vrm.humanoid.getNormalizedBoneNode('neck');
    if (!head || !neck) return;

    this.smoothedGaze.lerp(this.cursorNorm, THREE.MathUtils.clamp(delta * 4, 0, 1));

    const camera = this.vrmManager?.camera;
    if (camera && this.vrm.scene) {
      head.getWorldPosition(this._headWorldPos);

      this._camTargetPos.copy(camera.position);
      this._camTargetPos.x += (this.smoothedGaze.x * 0.28) + this.saccadeOffset.x + (this.behaviorCurrent.gazeOffsetX || 0);
      this._camTargetPos.y += (this.smoothedGaze.y * 0.18) + this.saccadeOffset.y + (this.behaviorCurrent.gazeOffsetY || 0);

      this._toCamWorld.copy(this._camTargetPos).sub(this._headWorldPos).normalize();

      this._invSceneQuat.copy(this.vrm.scene.quaternion).invert();
      this._toCamLocal.copy(this._toCamWorld).applyQuaternion(this._invSceneQuat);

      const localYaw = -Math.atan2(this._toCamLocal.x, -this._toCamLocal.z);
      const horizDist = Math.hypot(this._toCamLocal.x, this._toCamLocal.z);
      const localPitch = Math.atan2(this._toCamLocal.y, Math.max(horizDist, 0.001));

      const MAX_YAW = 68 * (Math.PI / 180);
      const CEASE_YAW = 95 * (Math.PI / 180);

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

      const targetPitch = THREE.MathUtils.clamp(localPitch, -0.35, 0.35);

      const lerpSpeed = THREE.MathUtils.clamp(delta * 5.5, 0, 1);
      this.currentHeadYaw = THREE.MathUtils.lerp(this.currentHeadYaw, targetYaw, lerpSpeed);
      this.currentHeadPitch = THREE.MathUtils.lerp(this.currentHeadPitch, targetPitch, lerpSpeed);

      // Biomechanical distribution + Instinct Listening Nods & Co-Speech Nod Accents + Phone Gyroscope
      const totalNodPitch = this.listeningCurrent.nodPitch + this.speechNodCurrent;
      const totalRoll = (this.behaviorCurrent.headRoll || 0) + this.listeningCurrent.headRoll;

      // Phone Gyroscope Head/Gaze tilt (clamped safely to human anatomical limits)
      const gyroYaw = this.vrmManager?.currentGyroYaw || 0;
      const gyroPitch = this.vrmManager?.currentGyroPitch || 0;

      neck.rotation.y = this.currentHeadYaw * 0.35 + (this.behaviorCurrent.headYaw * 0.35) + (gyroYaw * 0.35);
      neck.rotation.x = this.currentHeadPitch * 0.35 + (this.behaviorCurrent.headPitch * 0.35) + totalNodPitch * 0.35 + (gyroPitch * 0.35);
      neck.rotation.z = (this.behaviorCurrent.neckRoll || 0) + totalRoll * 0.35;

      head.rotation.y = this.currentHeadYaw * 0.65 + (this.behaviorCurrent.headYaw * 0.65) + (gyroYaw * 0.65);
      head.rotation.x = this.currentHeadPitch * 0.65 + (this.behaviorCurrent.headPitch * 0.65) + totalNodPitch * 0.65 + (gyroPitch * 0.65);
      head.rotation.z = totalRoll * 0.65;

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
      const headX = THREE.MathUtils.clamp(-this.smoothedGaze.y * 0.22, -0.25, 0.25);
      const headY = THREE.MathUtils.clamp(-this.smoothedGaze.x * 0.35, -0.35, 0.35);
      const totalNodPitch = this.listeningCurrent.nodPitch + this.speechNodCurrent;
      const totalRoll = (this.behaviorCurrent.headRoll || 0) + this.listeningCurrent.headRoll;
      const gyroYaw = this.vrmManager?.currentGyroYaw || 0;
      const gyroPitch = this.vrmManager?.currentGyroPitch || 0;

      neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, headX * 0.4 + (this.behaviorCurrent.headPitch * 0.35) + totalNodPitch * 0.35 + (gyroPitch * 0.35), 0.1);
      neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, headY * 0.4 + (this.behaviorCurrent.headYaw * 0.35) + (gyroYaw * 0.35), 0.1);
      neck.rotation.z = (this.behaviorCurrent.neckRoll || 0) + totalRoll * 0.35;
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headX * 0.6 + (this.behaviorCurrent.headPitch * 0.65) + totalNodPitch * 0.65 + (gyroPitch * 0.65), 0.1);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headY * 0.6 + (this.behaviorCurrent.headYaw * 0.65) + (gyroYaw * 0.65), 0.1);
      head.rotation.z = totalRoll * 0.65;
    }
  }
}
