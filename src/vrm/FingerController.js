import * as THREE from 'three';

/**
 * Realtime Finger Controller for VRM Avatars.
 * Provides high-precision procedural finger posing, individual knuckle control,
 * animated gesture presets, and smooth real-time interpolation for both hands.
 * Compatible with both VRM 0.0 and VRM 1.0 specifications.
 */

export const FINGER_PRESETS = {
  relaxed: {
    thumb: 0.22,
    index: 0.32,
    middle: 0.38,
    ring: 0.42,
    little: 0.46,
    spread: 0.12,
    thumbSpread: 0.20
  },
  open: {
    thumb: 0.0,
    index: 0.0,
    middle: 0.0,
    ring: 0.0,
    little: 0.0,
    spread: 0.38,
    thumbSpread: 0.45
  },
  fist: {
    thumb: 0.92,
    index: 0.98,
    middle: 0.98,
    ring: 0.98,
    little: 0.98,
    spread: 0.0,
    thumbSpread: -0.15
  },
  peace: {
    thumb: 0.88,
    index: 0.02,
    middle: 0.02,
    ring: 0.95,
    little: 0.95,
    spread: 0.42,
    thumbSpread: -0.10
  },
  pointing: {
    thumb: 0.80,
    index: 0.0,
    middle: 0.96,
    ring: 0.96,
    little: 0.96,
    spread: 0.02,
    thumbSpread: 0.05
  },
  thumbsUp: {
    thumb: -0.18,
    index: 0.98,
    middle: 0.98,
    ring: 0.98,
    little: 0.98,
    spread: 0.0,
    thumbSpread: 0.65
  },
  rock: {
    thumb: 0.85,
    index: 0.02,
    middle: 0.98,
    ring: 0.98,
    little: 0.02,
    spread: 0.35,
    thumbSpread: -0.05
  },
  heart: {
    thumb: 0.42,
    index: 0.48,
    middle: 0.88,
    ring: 0.92,
    little: 0.92,
    spread: 0.10,
    thumbSpread: 0.32
  },
  ok: {
    thumb: 0.62,
    index: 0.68,
    middle: 0.05,
    ring: 0.10,
    little: 0.15,
    spread: 0.22,
    thumbSpread: 0.38
  }
};

const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'little'];

export class FingerController {
  constructor(vrm) {
    this.vrm = vrm;
    this.enabled = true;

    // Bone nodes cache
    this.bones = {
      left: {},
      right: {}
    };

    // Current and target pose state for smooth interpolation
    this.state = {
      left: { ...FINGER_PRESETS.relaxed },
      right: { ...FINGER_PRESETS.relaxed }
    };
    this.targetState = {
      left: { ...FINGER_PRESETS.relaxed },
      right: { ...FINGER_PRESETS.relaxed }
    };

    // Interpolation parameters
    this.transitionSpeed = 10.0; // Responsive lerp speed
    this.isWaving = false;
    this.waveTime = 0;

    if (vrm) {
      this.initBones(vrm);
    }
  }

  /**
   * Resolve and cache finger humanoid bone references
   */
  initBones(vrm) {
    this.vrm = vrm;
    if (!vrm?.humanoid) return;

    const humanoid = vrm.humanoid;

    ['left', 'right'].forEach((side) => {
      const capSide = side.charAt(0).toUpperCase() + side.slice(1);

      // Thumb (handles both VRM 0.0 and VRM 1.0 specs)
      const t1 = humanoid.getNormalizedBoneNode(`${side}ThumbMetacarpal`) || humanoid.getNormalizedBoneNode(`${side}ThumbProximal`);
      const t2 = humanoid.getNormalizedBoneNode(`${side}ThumbProximal`) || humanoid.getNormalizedBoneNode(`${side}ThumbIntermediate`);
      const t3 = humanoid.getNormalizedBoneNode(`${side}ThumbDistal`);

      this.bones[side].thumb = [t1, t2, t3].filter(Boolean);

      // 4 Fingers
      ['Index', 'Middle', 'Ring', 'Little'].forEach((finger) => {
        const fLower = finger.toLowerCase();
        const p = humanoid.getNormalizedBoneNode(`${side}${finger}Proximal`);
        const i = humanoid.getNormalizedBoneNode(`${side}${finger}Intermediate`);
        const d = humanoid.getNormalizedBoneNode(`${side}${finger}Distal`);
        this.bones[side][fLower] = [p, i, d].filter(Boolean);
      });
    });
  }

  /**
   * Set pose preset for one or both hands
   * @param {string} presetName - e.g. 'fist', 'peace', 'pointing', 'relaxed', 'thumbsUp', 'open', 'rock', 'heart'
   * @param {'both'|'left'|'right'} hand
   * @param {number} speed - Lerp transition speed (default 10)
   */
  setPose(presetName, hand = 'both', speed = 10.0) {
    const preset = FINGER_PRESETS[presetName];
    if (!preset) {
      console.warn(`[FingerController] Unknown pose preset: "${presetName}". Available:`, Object.keys(FINGER_PRESETS));
      return false;
    }

    this.transitionSpeed = speed;
    this.isWaving = presetName === 'wave';

    if (hand === 'both' || hand === 'left') {
      this.targetState.left = { ...preset };
    }
    if (hand === 'both' || hand === 'right') {
      this.targetState.right = { ...preset };
    }

    return true;
  }

  /**
   * Fine-grained control over individual finger curl (0.0 straight -> 1.0 curled)
   * @param {'left'|'right'|'both'} hand
   * @param {'thumb'|'index'|'middle'|'ring'|'little'} finger
   * @param {number} curlAmount - 0.0 to 1.0
   */
  setFingerCurl(hand, finger, curlAmount) {
    const clamped = Math.max(-0.3, Math.min(1.2, curlAmount));
    if (hand === 'both' || hand === 'left') {
      this.targetState.left[finger] = clamped;
    }
    if (hand === 'both' || hand === 'right') {
      this.targetState.right[finger] = clamped;
    }
  }

  /**
   * Fine-grained control over finger spread (splay outward)
   * @param {'left'|'right'|'both'} hand
   * @param {number} spreadAmount - 0.0 to 0.5
   */
  setSpread(hand, spreadAmount) {
    const clamped = Math.max(-0.2, Math.min(0.6, spreadAmount));
    if (hand === 'both' || hand === 'left') {
      this.targetState.left.spread = clamped;
    }
    if (hand === 'both' || hand === 'right') {
      this.targetState.right.spread = clamped;
    }
  }

  /**
   * Reset hands to natural relaxed resting pose
   */
  resetToRelaxed(speed = 8.0) {
    this.setPose('relaxed', 'both', speed);
  }

  /**
   * Get available preset names
   */
  getAvailablePresets() {
    return Object.keys(FINGER_PRESETS);
  }

  /**
   * Per-frame update loop called from AnimationEngine
   * @param {number} delta - Frame delta time in seconds
   */
  update(delta) {
    if (!this.enabled || !this.vrm?.humanoid) return;

    // Handle dynamic waving motion
    if (this.isWaving) {
      this.waveTime += delta * 6;
      const waveOffset = Math.sin(this.waveTime) * 0.15;
      this.targetState.right.index = 0.05 + waveOffset;
      this.targetState.right.middle = 0.05 + Math.sin(this.waveTime + 0.5) * 0.15;
      this.targetState.right.ring = 0.05 + Math.sin(this.waveTime + 1.0) * 0.15;
      this.targetState.right.little = 0.05 + Math.sin(this.waveTime + 1.5) * 0.15;
    }

    const t = THREE.MathUtils.clamp(delta * this.transitionSpeed, 0, 1);

    // Apply rotations to left and right hands
    ['left', 'right'].forEach((side) => {
      const isLeft = side === 'left';
      const cur = this.state[side];
      const tgt = this.targetState[side];

      // Lerp finger state
      for (const k in tgt) {
        cur[k] = THREE.MathUtils.lerp(cur[k], tgt[k], t);
      }

      // 1. 4 Fingers (Index, Middle, Ring, Little)
      const fourFingers = ['index', 'middle', 'ring', 'little'];
      const spreadSign = isLeft ? 1 : -1;
      const curlSign = isLeft ? -1 : 1; // Left hand bends on -Z, Right hand on +Z

      fourFingers.forEach((fName, fIdx) => {
        const chain = this.bones[side][fName];
        if (!chain || chain.length === 0) return;

        const curl = cur[fName];
        // Spread offset relative to hand centerline
        const spreadOffset = (fIdx - 1.5) * cur.spread * spreadSign;

        // Knuckle curl distribution: proximal 40%, intermediate 45%, distal 25%
        const proxCurl = curl * 1.35 * curlSign;
        const interCurl = curl * 1.55 * curlSign;
        const distCurl = curl * 1.05 * curlSign;

        // Proximal bone (knuckle)
        if (chain[0]) {
          chain[0].rotation.z = proxCurl;
          chain[0].rotation.y = spreadOffset;
        }
        // Intermediate bone
        if (chain[1]) {
          chain[1].rotation.z = interCurl;
        }
        // Distal bone (tip)
        if (chain[2]) {
          chain[2].rotation.z = distCurl;
        }
      });

      // 2. Thumb
      const thumb = this.bones[side].thumb;
      if (thumb && thumb.length > 0) {
        const tCurl = cur.thumb;
        const tSpread = cur.thumbSpread;

        if (thumb[0]) {
          // Thumb root
          thumb[0].rotation.z = (tCurl * 0.6) * curlSign;
          thumb[0].rotation.y = tSpread * spreadSign;
          thumb[0].rotation.x = -tCurl * 0.35;
        }
        if (thumb[1]) {
          // Thumb middle
          thumb[1].rotation.z = (tCurl * 0.8) * curlSign;
          thumb[1].rotation.x = -tCurl * 0.45;
        }
        if (thumb[2]) {
          // Thumb tip
          thumb[2].rotation.z = (tCurl * 0.7) * curlSign;
        }
      }
    });
  }
}
