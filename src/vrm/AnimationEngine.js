import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Mixamo to VRM normalized bone mapping
const MIXAMO_VRM_RIG_MAP = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',

  // Left Hand Fingers (Mixamo -> VRM Humanoid)
  mixamorigLeftHandThumb1: 'leftThumbProximal',
  mixamorigLeftHandThumb2: 'leftThumbIntermediate',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigLeftHandLittle1: 'leftLittleProximal',
  mixamorigLeftHandLittle2: 'leftLittleIntermediate',
  mixamorigLeftHandLittle3: 'leftLittleDistal',

  // Right Hand Fingers (Mixamo -> VRM Humanoid)
  mixamorigRightHandThumb1: 'rightThumbProximal',
  mixamorigRightHandThumb2: 'rightThumbIntermediate',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandLittle1: 'rightLittleProximal',
  mixamorigRightHandLittle2: 'rightLittleIntermediate',
  mixamorigRightHandLittle3: 'rightLittleDistal'
};

// Procedural finger curls & spreads
export const FINGER_POSES = {
  idle: {
    proximal: 0.38,
    intermediate: 0.48,
    distal: 0.28,
    spread: 0.04,
    thumbCurl: 0.28,
    thumbSpread: 0.18
  },
  wave: {
    proximal: 0.10,
    intermediate: 0.14,
    distal: 0.08,
    spread: -0.02,
    thumbCurl: 0.10,
    thumbSpread: 0.12
  },
  happy: {
    proximal: 0.22,
    intermediate: 0.28,
    distal: 0.15,
    spread: 0.08,
    thumbCurl: 0.18,
    thumbSpread: 0.22
  },
  excited: {
    proximal: 0.12,
    intermediate: 0.16,
    distal: 0.08,
    spread: 0.12,
    thumbCurl: 0.08,
    thumbSpread: 0.28
  },
  angry: {
    proximal: 0.52,
    intermediate: 0.62,
    distal: 0.42,
    spread: -0.06,
    thumbCurl: 0.38,
    thumbSpread: 0.08
  },
  sad: {
    proximal: 0.50,
    intermediate: 0.60,
    distal: 0.40,
    spread: 0.02,
    thumbCurl: 0.35,
    thumbSpread: 0.05
  },
  pointing: {
    proximal: 0.88,
    intermediate: 1.02,
    distal: 0.85,
    spread: -0.06,
    thumbCurl: 0.85,
    thumbSpread: -0.10,
    indexMult: 0.04
  }
};

const FINGER_CHAINS_L = [
  ['leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal'],
  ['leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal'],
  ['leftRingProximal', 'leftRingIntermediate', 'leftRingDistal'],
  ['leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal']
];
const THUMB_L = ['leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal'];
const FINGER_CHAINS_R = FINGER_CHAINS_L.map((c) => c.map((n) => n.replace('left', 'right')));
const THUMB_R = THUMB_L.map((n) => n.replace('left', 'right'));

// Build a fast lookup map for all nodes in the FBX asset (O(N) once instead of traversing per track)
function getRigNodeMap(asset) {
  if (asset._rigNodeMap) return asset._rigNodeMap;
  const map = new Map();
  asset.traverse((child) => {
    if (child.name) {
      map.set(child.name, child);
      map.set(child.name.toLowerCase(), child);
      const clean = child.name.replace(/^mixamorig:?_?/i, '');
      map.set(clean.toLowerCase(), child);
      map.set('mixamorig' + clean.toLowerCase(), child);
      map.set('mixamorig:' + clean.toLowerCase(), child);
    }
  });
  asset._rigNodeMap = map;
  return map;
}

// Helper to locate rig node across FBX naming conventions with O(1) Map lookup
function findRigNode(asset, boneName, rawTrackName, rigName) {
  const map = getRigNodeMap(asset);
  return (
    map.get(rawTrackName) ||
    map.get(boneName) ||
    map.get(rigName) ||
    map.get((rawTrackName || '').toLowerCase()) ||
    map.get((boneName || '').toLowerCase()) ||
    map.get((rigName || '').toLowerCase()) ||
    null
  );
}

export class AnimationEngine {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;
    this.mixer = null;
    this.fbxLoader = new FBXLoader();

    this.animations = {
      idle: '/animations/Idle.fbx',
      happyIdle: '/animations/Happy Idle.fbx',
      wave: '/animations/Waving1.fbx',
      wave2: '/animations/Waving2.fbx',
      happy: '/animations/Happy.fbx',
      excited: '/animations/Excited.fbx',
      think: '/animations/Thinking.fbx',
      thinking: '/animations/Thinking.fbx',
      yawn: '/animations/Yawn.fbx',
      angry: '/animations/Angry.fbx',
      no: '/animations/No.fbx',
      sad: '/animations/Sad Idle1.fbx',
      sad2: '/animations/Sad Idle2.fbx'
    };

    this.loadedClips = new Map();
    this.inFlightLoads = new Map();
    this.retargetedClipsCache = new Map();
    this.loadQueue = Promise.resolve();
    this.requestedAnimName = 'idle';

    this.actions = new Map();
    this.currentAction = null;
    this.currentAnimName = null;

    this.currentFingerPose = { ...FINGER_POSES.idle };
    this.targetFingerPose = { ...FINGER_POSES.idle };

    // Gesture cooldown state (10 seconds between non-idle gestures to prevent rapid jarring animations)
    this.lastGestureTime = 0;
    this.gestureCooldownMs = 10000;
    this.isIdlePreloaded = false;

    // Root elevation tracking to keep avatar centered
    this.targetRootY = 0.0;
    this.currentRootY = 0.0;

    // Preload ONLY the base idle animation in background so it is ready immediately when model loads
    this.preloadIdle();

    // Register with VRMManager multi-listener
    this.vrmManager.addModelLoadedListener((vrm) => this.bindModel(vrm));
  }

  /**
   * Preload ONLY the base idle animation in the background so the avatar never appears in a T-pose.
   * Other animations remain on-demand streaming to conserve mobile memory and bandwidth.
   */
  preloadIdle() {
    if (this.isIdlePreloaded) return;
    this.isIdlePreloaded = true;
    // Defer slightly so browser paints initial HTML and starts WebGL context with zero friction
    setTimeout(() => {
      this.enqueueLoadMixamoClip('idle', this.animations.idle)
        .then(() => {
          console.log('[AnimationEngine] Preloaded idle animation successfully.');
        })
        .catch((err) => {
          console.warn('[AnimationEngine] Preload idle failed (will retry on demand):', err);
        });
    }, 200);
  }

  async bindModel(vrm) {
    console.log('[AnimationEngine] Binding model & synchronizing idle motion...');
    this.vrm = vrm;
    this.targetRootY = 0.0;
    this.currentRootY = 0.0;
    this.targetRootZ = 0.0;
    this.currentRootZ = 0.0;
    this.requestedAnimName = 'idle';
    if (this.vrmManager?.setChairVisible) {
      this.vrmManager.setChairVisible(false);
    }

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }

    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.actions.clear();
    this.retargetedClipsCache.clear();

    this.mixer.addEventListener('finished', (e) => {
      // Loop back to idle when a one-shot animation finishes
      if (
        this.currentAnimName !== 'idle' &&
        this.currentAnimName !== 'happyIdle'
      ) {
        this.playAnimation('idle', 0.5);
      }
    });

    // Cache finger bone node references for fast per-frame access
    this.fingerNodes = {
      leftChains: FINGER_CHAINS_L.map((chain) =>
        chain.map((name) => this.vrm.humanoid.getNormalizedBoneNode(name))
      ),
      leftThumb: THUMB_L.map((name) => this.vrm.humanoid.getNormalizedBoneNode(name)),
      rightChains: FINGER_CHAINS_R.map((chain) =>
        chain.map((name) => this.vrm.humanoid.getNormalizedBoneNode(name))
      ),
      rightThumb: THUMB_R.map((name) => this.vrm.humanoid.getNormalizedBoneNode(name))
    };

    // Immediately start idle animation and force first frame calculation so bones lock into idle
    // posture BEFORE the loading overlay disappears (100% eliminates the 2-second T-pose glitch)
    await this.playAnimation('idle', 0.0);
    if (this.mixer) {
      this.mixer.update(0.016);
      this.applyFingerPose(0.016);
    }
  }

  /**
   * Non-blocking sequential animation loader.
   * Ensures only ONE animation file is downloaded & parsed at a time,
   * deduplicates concurrent requests, and yields to the browser frame loop.
   */
  enqueueLoadMixamoClip(name, url) {
    if (this.loadedClips.has(name)) {
      return Promise.resolve(this.loadedClips.get(name));
    }

    if (this.inFlightLoads.has(name)) {
      return this.inFlightLoads.get(name);
    }

    const loadTask = this.loadQueue.then(async () => {
      // Check if loaded while waiting in queue
      if (this.loadedClips.has(name)) {
        return this.loadedClips.get(name);
      }

      // Cooperative yield before network/parsing to keep Three.js rendering silky smooth
      await new Promise((resolve) => setTimeout(resolve, 16));

      const asset = await new Promise((resolve, reject) => {
        this.fbxLoader.load(url, resolve, undefined, reject);
      });

      const rawClip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') || asset.animations[0];
      if (!rawClip) {
        throw new Error(`No animation found in ${url}`);
      }

      // Cooperative yield after heavy parsing
      await new Promise((resolve) => setTimeout(resolve, 8));

      const result = { asset, rawClip, url };
      this.loadedClips.set(name, result);
      return result;
    });

    this.inFlightLoads.set(name, loadTask);
    this.loadQueue = loadTask.catch(() => {}).then(() => {});

    return loadTask.finally(() => {
      this.inFlightLoads.delete(name);
    });
  }

  retargetClip(asset, rawClip, url, name = null) {
    if (!this.vrm) return null;
    if (name && this.retargetedClipsCache.has(name)) {
      return this.retargetedClipsCache.get(name);
    }

    const tracks = [];
    const rRI = new THREE.Quaternion();
    const pRWR = new THREE.Quaternion();
    const _qA = new THREE.Quaternion();

    const hipsNode = findRigNode(asset, 'Hips', 'mixamorig:Hips', 'mixamorigHips');
    const hMotion = hipsNode ? hipsNode.position.y : 100;
    const hVRM = this.vrm.humanoid?.normalizedRestPose?.hips?.position?.[1] || 1.0;
    const hScale = hVRM / (hMotion || 100);

    rawClip.tracks.forEach((track) => {
      const parts = track.name.split('.');
      let rawBone = parts[0];
      if (rawBone.includes(':')) rawBone = rawBone.split(':').pop();
      if (rawBone.includes('|')) rawBone = rawBone.split('|').pop();

      let rigName = rawBone;
      if (!MIXAMO_VRM_RIG_MAP[rigName] && !rigName.startsWith('mixamorig')) {
        rigName = 'mixamorig' + rigName.charAt(0).toUpperCase() + rigName.slice(1);
      }

      const vrmBone = MIXAMO_VRM_RIG_MAP[rigName];
      if (!vrmBone) return;

      const vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(vrmBone)?.name;
      const rigNode = findRigNode(asset, rawBone, parts[0], rigName);

      if (vrmNode != null && rigNode != null && rigNode.parent != null) {
        const prop = parts[1];
        rigNode.getWorldQuaternion(rRI).invert();
        rigNode.parent.getWorldQuaternion(pRWR);

        if (track instanceof THREE.QuaternionKeyframeTrack) {
          const values = track.values.slice();
          const isVrm0 = this.vrm.meta?.metaVersion === '0';
          for (let i = 0; i < values.length; i += 4) {
            _qA.fromArray(values, i).premultiply(pRWR).multiply(rRI).toArray(values, i);
            if (isVrm0) {
              values[i] = -values[i];
              values[i + 2] = -values[i + 2];
            }
          }
          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${vrmNode}.${prop}`,
              track.times,
              values
            )
          );
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          const isVrm0 = this.vrm.meta?.metaVersion === '0';
          const values = new Float32Array(track.values.length);
          for (let i = 0; i < track.values.length; i += 3) {
            values[i] = (isVrm0 ? -track.values[i] : track.values[i]) * hScale;
            values[i + 1] = track.values[i + 1] * hScale;
            values[i + 2] = (isVrm0 ? -track.values[i + 2] : track.values[i + 2]) * hScale;
          }
          tracks.push(
            new THREE.VectorKeyframeTrack(
              `${vrmNode}.${prop}`,
              track.times,
              values
            )
          );
        }
      }
    });

    console.log(`[AnimationEngine] Retargeted ${rawClip.name || url}: created ${tracks.length} tracks`);
    if (tracks.length === 0) return null;
    const clip = new THREE.AnimationClip(rawClip.name, rawClip.duration, tracks);
    const animatedBoneNodes = new Set(tracks.map((t) => t.name.split('.')[0]));
    clip.userData = { animatedBones: animatedBoneNodes };
    if (name) {
      this.retargetedClipsCache.set(name, clip);
    }
    return clip;
  }

  async playAnimation(animName = 'idle', fadeDuration = 0.4) {
    if (!this.vrm || !this.mixer) return;

    // Strict requirement: Avoid using any sitting animation
    if (typeof animName === 'string' && animName.toLowerCase().includes('sit')) {
      console.log('[AnimationEngine] Sitting animation avoided; defaulting to idle.');
      animName = 'idle';
    }

    let targetAnim = animName || 'idle';
    if (targetAnim === 'thinking') targetAnim = 'think';
    if (targetAnim === 'sadIdle' || targetAnim === 'sad1') targetAnim = 'sad';
    if (!this.animations[targetAnim]) {
      console.warn(`[AnimationEngine] Unknown animation "${targetAnim}", falling back to idle`);
      targetAnim = 'idle';
    }

    const url = this.animations[targetAnim];
    this.requestedAnimName = targetAnim;

    // 10-second cooldown for non-idle gestures to prevent rapid/frequent animation switching
    const isIdle = targetAnim === 'idle' || targetAnim === 'happyIdle';
    const now = Date.now();
    if (!isIdle) {
      const elapsed = now - this.lastGestureTime;
      if (elapsed < this.gestureCooldownMs) {
        console.log(
          `[AnimationEngine] Gesture "${targetAnim}" held by 10s cooldown (${Math.ceil(
            (this.gestureCooldownMs - elapsed) / 1000
          )}s left). Maintaining idle posture.`
        );
        return;
      }
      this.lastGestureTime = now;
    }

    try {
      let action = this.actions.get(targetAnim);

      if (!action) {
        // Enqueue sequential non-blocking download (never hangs or freezes site)
        const { asset, rawClip, url: clipUrl } = await this.enqueueLoadMixamoClip(targetAnim, url);
        if (!this.vrm || !this.mixer) return;

        const retargetedClip = this.retargetClip(asset, rawClip, clipUrl, targetAnim);
        if (!retargetedClip) {
          console.warn(`[AnimationEngine] Failed to retarget clip ${targetAnim}`);
          return;
        }

        action = this.mixer.clipAction(retargetedClip);

        // Continuous ambient idles loop indefinitely; communicative gestures are one-shot
        const isContinuous = targetAnim === 'idle' || targetAnim === 'happyIdle';
        if (isContinuous) {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
        } else {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }

        this.actions.set(targetAnim, action);
      }

      // Update procedural finger pose target based on gesture
      if (FINGER_POSES[targetAnim]) {
        this.targetFingerPose = { ...FINGER_POSES[targetAnim] };
      } else {
        this.targetFingerPose = { ...FINGER_POSES.idle };
      }

      // Avatar remains naturally grounded at origin
      this.targetRootY = 0.0;
      this.targetRootZ = 0.0;

      if (this.currentAction === action && action.isRunning()) return;

      action.reset();
      action.fadeIn(fadeDuration);
      action.play();

      if (this.currentAction && this.currentAction !== action) {
        this.currentAction.fadeOut(fadeDuration);
      }

      this.currentAction = action;
      this.currentAnimName = targetAnim;
    } catch (err) {
      console.warn(`[AnimationEngine] Could not play ${targetAnim}:`, err);
    }
  }

  applyFingerPose(delta) {
    if (!this.vrm?.humanoid || !this.fingerNodes) return;

    // Check which finger bones are actively driven by the retargeted animation keyframes
    const animatedBones = this.currentAction?.getClip()?.userData?.animatedBones;
    if (animatedBones && animatedBones.size >= 10) return;

    const t = THREE.MathUtils.clamp(delta * 8, 0, 1);
    for (const k in this.targetFingerPose) {
      this.currentFingerPose[k] = THREE.MathUtils.lerp(
        this.currentFingerPose[k],
        this.targetFingerPose[k],
        t
      );
    }

    const pose = this.currentFingerPose;

    const applyHand = (chains, thumb, isLeft) => {
      const spreadSign = isLeft ? 1 : -1;
      chains.forEach((chain, fIdx) => {
        const spreadOffset = (fIdx - 1.5) * pose.spread * spreadSign;
        const indexMult = fIdx === 0 && pose.indexMult !== undefined ? pose.indexMult : 1.0;

        const pNode = chain[0];
        if (pNode && (!animatedBones || !animatedBones.has(pNode.name))) {
          pNode.rotation.x = pose.proximal * indexMult;
          pNode.rotation.y = spreadOffset;
        }
        const iNode = chain[1];
        if (iNode && (!animatedBones || !animatedBones.has(iNode.name))) {
          iNode.rotation.x = pose.intermediate * indexMult;
        }
        const dNode = chain[2];
        if (dNode && (!animatedBones || !animatedBones.has(dNode.name))) {
          dNode.rotation.x = pose.distal * indexMult;
        }
      });

      // Thumb
      const t1 = thumb[0];
      if (t1 && (!animatedBones || !animatedBones.has(t1.name))) {
        t1.rotation.y = pose.thumbSpread * spreadSign;
      }
      const t2 = thumb[1];
      if (t2 && (!animatedBones || !animatedBones.has(t2.name))) {
        t2.rotation.x = pose.thumbCurl;
      }
      const t3 = thumb[2];
      if (t3 && (!animatedBones || !animatedBones.has(t3.name))) {
        t3.rotation.x = pose.thumbCurl * 0.8;
      }
    };

    applyHand(this.fingerNodes.leftChains, this.fingerNodes.leftThumb, true);
    applyHand(this.fingerNodes.rightChains, this.fingerNodes.rightThumb, false);
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
    this.applyFingerPose(delta);

    // Smoothly maintain avatar root alignment (gated by epsilon threshold to avoid invalidating scene matrix every frame)
    if (this.vrm?.scene) {
      const targetY = this.targetRootY ?? 0;
      const targetZ = this.targetRootZ ?? 0;
      const curY = this.currentRootY ?? 0;
      const curZ = this.currentRootZ ?? 0;
      if (Math.abs(curY - targetY) > 0.0005 || Math.abs(curZ - targetZ) > 0.0005) {
        const lerpSpeed = Math.min(delta * 4.5, 1);
        this.currentRootY = THREE.MathUtils.lerp(curY, targetY, lerpSpeed);
        this.currentRootZ = THREE.MathUtils.lerp(curZ, targetZ, lerpSpeed);
        this.vrm.scene.position.y = this.currentRootY;
        this.vrm.scene.position.z = this.currentRootZ;
      }
    }
  }
}
