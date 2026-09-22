import * as THREE from 'three';

const VISEME_ALIASES = {
  aa: ['aa', 'a', 'A', 'AA', 'vrc.v_aa', 'viseme_aa', 'Fcl_MTH_A', 'mouth_a', 'Mouth_A', 'mouthOpen'],
  ee: ['ee', 'e', 'E', 'EE', 'vrc.v_ee', 'viseme_ee', 'Fcl_MTH_E', 'mouth_e', 'Mouth_E'],
  ih: ['ih', 'i', 'I', 'IH', 'vrc.v_ih', 'viseme_ih', 'Fcl_MTH_I', 'mouth_i', 'Mouth_I'],
  oh: ['oh', 'o', 'O', 'OH', 'vrc.v_oh', 'viseme_oh', 'Fcl_MTH_O', 'mouth_o', 'Mouth_O'],
  ou: ['ou', 'u', 'U', 'OU', 'vrc.v_ou', 'viseme_ou', 'Fcl_MTH_U', 'mouth_u', 'Mouth_U']
};

export class LipSyncEngine {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;
    this._cachedTargets = null;

    // Audio context analyzer state (for Kokoro / MP3 media playback)
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isAudioActive = false;

    // Word-synchronized speech state (driven directly by TTS onboundary events)
    this.isSyntheticSpeaking = false;
    this.targetVowels = { aa: 0.45, ee: 0.25, ih: 0.15, oh: 0.20, ou: 0.15 };
    this.speechPhase = 0;
    this.speechCadence = 19.0; // ~3.0 Hz natural conversational syllable rhythm
    this.lastWordTime = 0;

    // Smoothed blendshape weights
    this.weights = {
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0
    };

    // Soft-tissue lip damping parameters (calm, organic, realistic)
    this.attack = 18.0;
    this.release = 14.0;

    this.vrmManager.addModelLoadedListener((vrm) => {
      this.vrm = vrm;
      this._cachedTargets = null;
    });
  }

  getManager() {
    return this.vrm?.expressionManager || this.vrm?.blendShapeProxy;
  }

  setBlendshape(viseme, value) {
    const manager = this.getManager();
    if (!manager) return;

    if (!this._cachedTargets) this._cachedTargets = {};

    let target = this._cachedTargets[viseme];
    if (!target) {
      const candidates = VISEME_ALIASES[viseme] || [viseme];
      for (const t of candidates) {
        if (typeof manager.getExpression === 'function') {
          if (manager.getExpression(t)) {
            target = t;
            break;
          }
        } else if (manager.getValue) {
          try {
            if (manager.getValue(t) !== undefined) {
              target = t;
              break;
            }
          } catch (e) {}
        }
      }
      if (!target) target = candidates[0];
      this._cachedTargets[viseme] = target;
    }

    try {
      manager.setValue(target, value);
    } catch (e) {}
  }

  initAudioContext() {
    if (this.audioContext) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.45;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('[LipSyncEngine] AudioContext initialization not supported:', e);
    }
  }

  connectMediaElement(audioElement) {
    this.initAudioContext();
    if (!this.audioContext || !audioElement) return;

    try {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      if (!audioElement._lipSyncConnected) {
        const source = this.audioContext.createMediaElementSource(audioElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        audioElement._lipSyncConnected = true;
      }
      this.isAudioActive = true;

      const onStop = () => {
        this.isAudioActive = false;
        audioElement.removeEventListener('ended', onStop);
        audioElement.removeEventListener('pause', onStop);
      };
      audioElement.addEventListener('ended', onStop);
      audioElement.addEventListener('pause', onStop);
    } catch (e) {
      console.warn('[LipSyncEngine] Could not connect media element:', e);
      this.isAudioActive = false;
    }
  }

  /**
   * Called on every spoken word from TTS onboundary events.
   * Matches mouth vowel shapes and timings directly to the actual words being voiced.
   */
  onWord(word = '') {
    this.isSyntheticSpeaking = true;
    this.lastWordTime = performance.now();

    const clean = (word || '').toLowerCase();
    if (!clean) return;

    let aa = 0, ee = 0, ih = 0, oh = 0, ou = 0;

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      // Latin phonetic mapping
      if (ch === 'a') aa += 1.4;
      else if (ch === 'e') ee += 1.1;
      else if (ch === 'i' || ch === 'y') ih += 1.0;
      else if (ch === 'o') oh += 1.3;
      else if (ch === 'u' || ch === 'w') ou += 1.2;
      // Devanagari Hindi phonetic mapping
      else if (/[\u0905\u0906\u093E]/.test(ch)) aa += 1.5;
      else if (/[\u090F\u0910\u0947\u0948]/.test(ch)) ee += 1.2;
      else if (/[\u0907\u0908\u093F\u0940]/.test(ch)) ih += 1.0;
      else if (/[\u0913\u094B]/.test(ch)) oh += 1.3;
      else if (/[\u0909\u090A\u0941\u0942\u0914\u094C]/.test(ch)) ou += 1.2;
    }

    const total = aa + ee + ih + oh + ou;
    if (total === 0) {
      // Consonants or short function words: natural open jaw balance
      this.targetVowels = {
        aa: 0.40,
        ee: 0.25,
        ih: 0.15,
        oh: 0.15,
        ou: 0.10
      };
    } else {
      // Normalized vowel weighting tailored to the spoken word
      this.targetVowels = {
        aa: (aa / total) * 0.85,
        ee: (ee / total) * 0.70,
        ih: (ih / total) * 0.60,
        oh: (oh / total) * 0.80,
        ou: (ou / total) * 0.65
      };
    }
  }

  startSyntheticSpeech() {
    this.isSyntheticSpeaking = true;
    this.lastWordTime = performance.now();
    if (!this.targetVowels) {
      this.targetVowels = { aa: 0.45, ee: 0.25, ih: 0.15, oh: 0.20, ou: 0.15 };
    }
  }

  stopSyntheticSpeech() {
    this.isSyntheticSpeaking = false;
    this.isAudioActive = false;
    this.lastWordTime = 0;
    this.targetVowels = null;
    this.weights.aa = 0;
    this.weights.ee = 0;
    this.weights.ih = 0;
    this.weights.oh = 0;
    this.weights.ou = 0;
    this.setBlendshape('aa', 0);
    this.setBlendshape('ee', 0);
    this.setBlendshape('ih', 0);
    this.setBlendshape('oh', 0);
    this.setBlendshape('ou', 0);
    const manager = this.getManager();
    if (manager && typeof manager.update === 'function') {
      try { manager.update(); } catch (e) {}
    }
  }

  update(delta) {
    const manager = this.getManager();
    if (!manager) return;

    // Early exit when completely silent and mouth is fully closed (saves ~300 blendshape lookups/sec)
    if (!this.isAudioActive && !this.isSyntheticSpeaking) {
      if (
        this.weights.aa === 0 &&
        this.weights.ee === 0 &&
        this.weights.ih === 0 &&
        this.weights.oh === 0 &&
        this.weights.ou === 0
      ) {
        return;
      }
    }

    let targetAa = 0;
    let targetEe = 0;
    let targetIh = 0;
    let targetOh = 0;
    let targetOu = 0;
    let hasAudioVolume = false;

    // 1. Audio Element Analysis (Kokoro / MP3 / Media stream)
    if (this.isAudioActive && this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);

      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      const vol = THREE.MathUtils.clamp(avg / 128, 0, 1);

      if (vol > 0.04) {
        hasAudioVolume = true;
        let lowSum = 0;
        for (let i = 2; i < 18; i++) lowSum += this.dataArray[i];
        const low = lowSum / 16 / 255;

        let midSum = 0;
        for (let i = 18; i < 48; i++) midSum += this.dataArray[i];
        const mid = midSum / 30 / 255;

        let highSum = 0;
        for (let i = 48; i < 90; i++) highSum += this.dataArray[i];
        const high = highSum / 42 / 255;

        targetAa = Math.min(low * 1.4, 0.85);
        targetOh = Math.min(low * 0.7 + mid * 0.35, 0.70);
        targetEe = Math.min(mid * 1.0 + high * 0.4, 0.75);
        targetIh = Math.min(mid * 0.7, 0.55);
        targetOu = Math.min(high * 0.8 + low * 0.25, 0.60);
      }
    }

    // 2. Synthetic Speech Mode (Web Speech API & continuous phonation fallback)
    if (!hasAudioVolume && this.isSyntheticSpeaking) {
      const timeSinceWord = performance.now() - (this.lastWordTime || 0);

      // Strict silence cutoff: if no word event or voice activity for > 850ms, auto-terminate synthetic speaking
      if (timeSinceWord > 850) {
        this.isSyntheticSpeaking = false;
        this.lastWordTime = 0;
        targetAa = 0;
        targetEe = 0;
        targetIh = 0;
        targetOh = 0;
        targetOu = 0;
      } else if (timeSinceWord > 360) {
        // Natural speech pause between words: mouth smoothly decays shut to neutral resting pose
        const pauseDecay = Math.max(0, 1 - (timeSinceWord - 360) / 240);
        const jawAperture = 0.22 * pauseDecay;
        if (this.targetVowels) {
          targetAa = this.targetVowels.aa * jawAperture;
          targetEe = this.targetVowels.ee * jawAperture;
          targetIh = this.targetVowels.ih * jawAperture;
          targetOh = this.targetVowels.oh * jawAperture;
          targetOu = this.targetVowels.ou * jawAperture;
        }
      } else {
        // Active speaking: drive vowels by syllable cadence and word phonemes
        this.speechPhase += delta * this.speechCadence;
        const jawCycle = 0.5 + 0.5 * Math.sin(this.speechPhase);
        const harmonic = 0.10 * Math.sin(this.speechPhase * 0.4 + 0.8);
        const jawAperture = THREE.MathUtils.clamp(0.24 + 0.54 * jawCycle + harmonic, 0.18, 0.85);

        if (this.targetVowels) {
          targetAa = this.targetVowels.aa * jawAperture;
          targetEe = this.targetVowels.ee * jawAperture;
          targetIh = this.targetVowels.ih * jawAperture;
          targetOh = this.targetVowels.oh * jawAperture;
          targetOu = this.targetVowels.ou * jawAperture;
        } else {
          targetAa = 0.40 * jawAperture;
          targetEe = 0.25 * jawAperture;
          targetOh = 0.20 * jawAperture;
        }
      }
    }

    const smoothViseme = (curr, target) => {
      const rate = target > curr ? this.attack : this.release;
      const factor = 1 - Math.exp(-rate * delta);
      const val = curr + (target - curr) * factor;
      return val < 0.005 ? 0 : val;
    };

    this.weights.aa = smoothViseme(this.weights.aa, targetAa);
    this.weights.ee = smoothViseme(this.weights.ee, targetEe);
    this.weights.ih = smoothViseme(this.weights.ih, targetIh);
    this.weights.oh = smoothViseme(this.weights.oh, targetOh);
    this.weights.ou = smoothViseme(this.weights.ou, targetOu);

    this.setBlendshape('aa', this.weights.aa > 0.01 ? this.weights.aa : 0);
    this.setBlendshape('ee', this.weights.ee > 0.01 ? this.weights.ee : 0);
    this.setBlendshape('ih', this.weights.ih > 0.01 ? this.weights.ih : 0);
    this.setBlendshape('oh', this.weights.oh > 0.01 ? this.weights.oh : 0);
    this.setBlendshape('ou', this.weights.ou > 0.01 ? this.weights.ou : 0);

    if (typeof manager.update === 'function') {
      try { manager.update(); } catch (e) {}
    }
  }
}
