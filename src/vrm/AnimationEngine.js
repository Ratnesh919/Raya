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
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
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
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
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

    // Gesture cooldown state (10 seconds between non-idle gestures to prevent rapid jarring animations)
    this.lastGestureTime = 0;
    this.gestureCooldownMs = 10000;
    this.isIdlePreloaded = false;

    // Root elevation tracking to keep avatar centered
    this.targetRootY = 0.0;
    this.currentRootY = 0.0;

    // Sequential One-by-One Background Downloader state
    // Ensures all animations are downloaded one at a time, never concurrently or all at once
    this.sequentialQueue = [
      'happyIdle',
      'think',
      'happy',
      'wave',
      'excited',
      'no',
      'sad',
      'yawn',
      'angry',
      'wave2',
      'sad2'
    ];
    this.isSequentialRunning = false;
    this.sequentialDelayMs = 2000; // 2.0s rate-limiting delay between downloads
    this.sequentialTimer = null;
    this.currentDownload = null;

    // Visibility listener: pause background downloads when tab is hidden, resume when active
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isSequentialRunning && this.sequentialQueue.length > 0) {
          if (!this.sequentialTimer) {
            this.sequentialTimer = setTimeout(() => this._downloadNextInSequence(), 1000);
          }
        }
      });
    }

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
          console.log('[AnimationEngine] Preloaded base idle animation successfully.');
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

    // Immediately start idle animation and force first frame calculation so bones lock into idle
    // posture BEFORE the loading overlay disappears (100% eliminates the 2-second T-pose glitch)
    await this.playAnimation('idle', 0.0);
    if (this.mixer) {
      this.mixer.update(0.016);
    }

    // Start downloading remaining animations strictly ONE BY ONE in the background
    this.startSequentialBackgroundDownload();
  }

  /**
   * Non-blocking sequential animation loader.
   * Ensures only ONE animation file is downloaded & parsed at a time (strict concurrency = 1),
   * deduplicates concurrent requests, and yields to the browser frame loop.
   */
  enqueueLoadMixamoClip(name, url) {
    if (this.loadedClips.has(name)) {
      return Promise.resolve(this.loadedClips.get(name));
    }

    // Deduplicate: Check if another alias already downloaded the exact same file URL (e.g. think / thinking)
    for (const [loadedName, clipData] of this.loadedClips.entries()) {
      if (clipData && clipData.url === url) {
        this.loadedClips.set(name, clipData);
        return Promise.resolve(clipData);
      }
    }

    // If this animation is in the pending sequential queue, remove it so it won't be re-fetched later
    const qIdx = this.sequentialQueue.indexOf(name);
    if (qIdx !== -1) {
      this.sequentialQueue.splice(qIdx, 1);
    }

    if (this.inFlightLoads.has(name)) {
      return this.inFlightLoads.get(name);
    }

    const loadTask = this.loadQueue.then(async () => {
      // Check if loaded while waiting in queue
      if (this.loadedClips.has(name)) {
        return this.loadedClips.get(name);
      }

      this.currentDownload = name;

      // Cooperative yield before network/parsing to keep Three.js rendering silky smooth
      await new Promise((resolve) => setTimeout(resolve, 16));

      try {
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

        // Alias any other animation keys that point to this exact URL
        for (const [otherName, otherUrl] of Object.entries(this.animations)) {
          if (otherUrl === url && !this.loadedClips.has(otherName)) {
            this.loadedClips.set(otherName, result);
            const otherIdx = this.sequentialQueue.indexOf(otherName);
            if (otherIdx !== -1) this.sequentialQueue.splice(otherIdx, 1);
          }
        }

        return result;
      } finally {
        this.currentDownload = null;
      }
    });

    this.inFlightLoads.set(name, loadTask);
    this.loadQueue = loadTask.catch(() => {}).then(() => {});

    return loadTask.finally(() => {
      this.inFlightLoads.delete(name);
    });
  }

  /**
   * Starts sequential background downloading of all animations strictly ONE BY ONE.
   * - Never downloads more than one animation at any time (concurrency = 1).
   * - Waits 2000ms between each download to ensure zero impact on render loop & network.
   * - Yields whenever the tab is hidden or user interactions take priority.
   */
  startSequentialBackgroundDownload() {
    if (this.isSequentialRunning) return;
    this.isSequentialRunning = true;

    if (this.sequentialTimer) clearTimeout(this.sequentialTimer);
    this.sequentialTimer = setTimeout(() => {
      this._downloadNextInSequence();
    }, 2500);
  }

  async _downloadNextInSequence() {
    if (!this.isSequentialRunning) return;

    // Prune items already downloaded
    while (this.sequentialQueue.length > 0 && this.loadedClips.has(this.sequentialQueue[0])) {
      this.sequentialQueue.shift();
    }

    if (this.sequentialQueue.length === 0) {
      console.log('[AnimationEngine] 🏁 All animations downloaded one by one. Cache fully ready!');
      this.isSequentialRunning = false;
      return;
    }

    // Pause if document is hidden (user switched tabs or locked phone)
    if (document.hidden) {
      this.sequentialTimer = setTimeout(() => this._downloadNextInSequence(), 2000);
      return;
    }

    const nextAnim = this.sequentialQueue.shift();
    const url = this.animations[nextAnim];

    if (url && !this.loadedClips.has(nextAnim)) {
      try {
        console.log(`[AnimationEngine] 📥 Downloading animation 1-by-1: "${nextAnim}" (${this.sequentialQueue.length} remaining in queue)...`);
        await this.enqueueLoadMixamoClip(nextAnim, url);
        console.log(`[AnimationEngine] ✅ Completed download: "${nextAnim}". Pausing ${this.sequentialDelayMs}ms before next...`);
      } catch (err) {
        console.warn(`[AnimationEngine] Sequential load failed for "${nextAnim}":`, err);
      }
    }

    // Schedule next animation download with rate-limiting delay
    this.sequentialTimer = setTimeout(() => {
      this._downloadNextInSequence();
    }, this.sequentialDelayMs);
  }

  getDownloadStatus() {
    return {
      loadedCount: this.loadedClips.size,
      totalCount: Object.keys(this.animations).length,
      currentDownload: this.currentDownload,
      loadedList: Array.from(this.loadedClips.keys()),
      remainingQueue: [...this.sequentialQueue],
      isSequentialRunning: this.isSequentialRunning
    };
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

    const isThinking =
      name === 'think' ||
      name === 'thinking' ||
      (url && /think/i.test(url)) ||
      (rawClip?.name && /think/i.test(rawClip.name));

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

      const isFinger = /thumb|index|middle|ring|little|pinky/i.test(vrmBone);
      if (isThinking && isFinger) {
        // Discard flat Mixamo finger tracks for thinking animation.
        // We will inject the tailored, natural anime thinking hand pose tracks below.
        return;
      }

      let vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(vrmBone)?.name;
      if (!vrmNode && vrmBone.includes('ThumbMetacarpal')) {
        vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(vrmBone.replace('Metacarpal', 'Proximal'))?.name;
      } else if (!vrmNode && vrmBone.includes('ThumbProximal')) {
        vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(vrmBone.replace('Proximal', 'Intermediate'))?.name;
      }
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
            // Invert coordinate frame for body bones only; finger bones are local to the hand and must NOT be flipped
            if (isVrm0 && !isFinger) {
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

    if (isThinking) {
      // High-precision, tailored anime thinking pose:
      // Right hand is brought up to the chin/jawline:
      // - Index finger is gently curved along the jaw/chin
      // - Middle finger is comfortably curled
      // - Ring and Little (pinky) fingers are curled snugly into the palm
      // - Thumb rests gracefully supporting the jawline
      // Left hand is relaxed naturally down at the side
      const thinkingPoses = [
        // Right hand (thinking chin rest)
        { bone: 'rightIndexProximal', angle: -0.28 },
        { bone: 'rightIndexIntermediate', angle: -0.42 },
        { bone: 'rightIndexDistal', angle: -0.24 },
        { bone: 'rightMiddleProximal', angle: -0.55 },
        { bone: 'rightMiddleIntermediate', angle: -0.75 },
        { bone: 'rightMiddleDistal', angle: -0.38 },
        { bone: 'rightRingProximal', angle: -0.70 },
        { bone: 'rightRingIntermediate', angle: -0.95 },
        { bone: 'rightRingDistal', angle: -0.48 },
        { bone: 'rightLittleProximal', angle: -0.75 },
        { bone: 'rightLittleIntermediate', angle: -1.05 },
        { bone: 'rightLittleDistal', angle: -0.52 },
        { bone: 'rightThumbMetacarpal', angle: -0.20 },
        { bone: 'rightThumbProximal', angle: -0.30 },
        { bone: 'rightThumbDistal', angle: -0.18 },

        // Left hand (natural relaxed posture at side)
        { bone: 'leftIndexProximal', angle: 0.28 },
        { bone: 'leftIndexIntermediate', angle: 0.38 },
        { bone: 'leftIndexDistal', angle: 0.20 },
        { bone: 'leftMiddleProximal', angle: 0.32 },
        { bone: 'leftMiddleIntermediate', angle: 0.42 },
        { bone: 'leftMiddleDistal', angle: 0.22 },
        { bone: 'leftRingProximal', angle: 0.35 },
        { bone: 'leftRingIntermediate', angle: 0.45 },
        { bone: 'leftRingDistal', angle: 0.24 },
        { bone: 'leftLittleProximal', angle: 0.38 },
        { bone: 'leftLittleIntermediate', angle: 0.48 },
        { bone: 'leftLittleDistal', angle: 0.26 },
        { bone: 'leftThumbMetacarpal', angle: 0.15 },
        { bone: 'leftThumbProximal', angle: 0.20 },
        { bone: 'leftThumbDistal', angle: 0.15 }
      ];

      thinkingPoses.forEach(({ bone, angle }) => {
        let vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(bone)?.name;
        if (!vrmNode && bone.includes('ThumbMetacarpal')) {
          vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(bone.replace('Metacarpal', 'Proximal'))?.name;
        } else if (!vrmNode && bone.includes('ThumbProximal')) {
          vrmNode = this.vrm.humanoid?.getNormalizedBoneNode(bone.replace('Proximal', 'Intermediate'))?.name;
        }
        if (vrmNode) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${vrmNode}.quaternion`,
              [0, rawClip.duration],
              [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]
            )
          );
        }
      });
    } else {
      // Ensure all 5 fingers have natural relaxed resting tracks if omitted in the FBX animation
      const animatedVrmNodes = new Set(tracks.map((t) => t.name.split('.')[0]));
      const fingerDefs = [
        { name: 'Index', prox: 0.28, inter: 0.38, dist: 0.20 },
        { name: 'Middle', prox: 0.32, inter: 0.42, dist: 0.22 },
        { name: 'Ring', prox: 0.35, inter: 0.45, dist: 0.24 },
        { name: 'Little', prox: 0.38, inter: 0.48, dist: 0.26 }
      ];

      ['left', 'right'].forEach((side) => {
        const isLeft = side === 'left';
        // In normalized VRM space: Left hand curls with +Z, Right hand curls with -Z
        const curlSign = isLeft ? 1 : -1;

        fingerDefs.forEach((f) => {
          const pBone = `${side}${f.name}Proximal`;
          const iBone = `${side}${f.name}Intermediate`;
          const dBone = `${side}${f.name}Distal`;

          const pNode = this.vrm.humanoid?.getNormalizedBoneNode(pBone)?.name;
          const iNode = this.vrm.humanoid?.getNormalizedBoneNode(iBone)?.name;
          const dNode = this.vrm.humanoid?.getNormalizedBoneNode(dBone)?.name;

          if (pNode && !animatedVrmNodes.has(pNode)) {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.prox * curlSign);
            tracks.push(new THREE.QuaternionKeyframeTrack(`${pNode}.quaternion`, [0, rawClip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
          }
          if (iNode && !animatedVrmNodes.has(iNode)) {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.inter * curlSign);
            tracks.push(new THREE.QuaternionKeyframeTrack(`${iNode}.quaternion`, [0, rawClip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
          }
          if (dNode && !animatedVrmNodes.has(dNode)) {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.dist * curlSign);
            tracks.push(new THREE.QuaternionKeyframeTrack(`${dNode}.quaternion`, [0, rawClip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
          }
        });

        // Thumb
        const t1 = this.vrm.humanoid?.getNormalizedBoneNode(`${side}ThumbMetacarpal`)?.name || this.vrm.humanoid?.getNormalizedBoneNode(`${side}ThumbProximal`)?.name;
        const t2 = this.vrm.humanoid?.getNormalizedBoneNode(`${side}ThumbProximal`)?.name || this.vrm.humanoid?.getNormalizedBoneNode(`${side}ThumbIntermediate`)?.name;
        const t3 = this.vrm.humanoid?.getNormalizedBoneNode(`${side}ThumbDistal`)?.name;

        if (t1 && !animatedVrmNodes.has(t1)) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.15 * curlSign);
          tracks.push(new THREE.QuaternionKeyframeTrack(`${t1}.quaternion`, [0, rawClip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
        }
        if (t2 && !animatedVrmNodes.has(t2)) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.20 * curlSign);
          tracks.push(new THREE.QuaternionKeyframeTrack(`${t2}.quaternion`, [0, rawClip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
        }
        if (t3 && !animatedVrmNodes.has(t3)) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.15 * curlSign);
          tracks.push(new THREE.QuaternionKeyframeTrack(`${t3}.quaternion`, [0, rawClip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
        }
      });
    }

    console.log(`[AnimationEngine] Retargeted ${rawClip.name || url}: created ${tracks.length} tracks`);
    if (tracks.length === 0) return null;
    const clip = new THREE.AnimationClip(rawClip.name, rawClip.duration, tracks);
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

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

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
