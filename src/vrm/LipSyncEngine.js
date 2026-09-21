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

    // Audio context analyzer state
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isAudioActive = false;

    // Procedural fallback state (for Web Speech API TTS)
    this.isSyntheticSpeaking = false;
    this.syntheticTime = 0;
    this.syntheticCadence = 14; // syllables speed

    // Smoothed blendshape weights
    this.weights = {
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0
    };

    // Attack & Release factors
    this.attack = 40.0;
    this.release = 22.0;

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

  startSyntheticSpeech() {
    this.isSyntheticSpeaking = true;
    this.syntheticTime = 0;
  }

  stopSyntheticSpeech() {
    this.isSyntheticSpeaking = false;
    this.isAudioActive = false;
    this.weights.aa = 0;
    this.weights.ee = 0;
    this.weights.ih = 0;
    this.weights.oh = 0;
    this.weights.ou = 0;
    ['aa', 'ee', 'ih', 'oh', 'ou'].forEach((k) => this.setBlendshape(k, 0));
    const manager = this.getManager();
    if (typeof manager?.update === 'function') {
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

        targetAa = Math.min(low * 1.5, 0.95);
        targetOh = Math.min(low * 0.8 + mid * 0.4, 0.75);
        targetEe = Math.min(mid * 1.2 + high * 0.5, 0.85);
        targetIh = Math.min(mid * 0.8, 0.65);
        targetOu = Math.min(high * 0.9 + low * 0.3, 0.7);
      }
    }

    // Procedural synthetic speech runs when active and either Web Speech is speaking or audio volume is low
    if (!hasAudioVolume && this.isSyntheticSpeaking) {
      this.syntheticTime += delta * this.syntheticCadence;
      const t = this.syntheticTime;

      // Organic speech wave: continuous dynamic modulation between consonants and open vowels
      // Guarantees mouth NEVER collapses or freezes mid-speech
      const rawPulse = Math.sin(t * 1.6);
      const open = 0.20 + 0.65 * (0.5 + 0.5 * rawPulse) * (0.8 + 0.2 * Math.sin(t * 0.7));

      const cycle = (t * 2.2) % (Math.PI * 2);
      const wAa = Math.max(0, Math.sin(cycle));
      const wEe = Math.max(0, Math.sin(cycle + 1.25));
      const wIh = Math.max(0, Math.sin(cycle + 2.5));
      const wOh = Math.max(0, Math.sin(cycle + 3.75));
      const wOu = Math.max(0, Math.sin(cycle + 5.0));
      const sum = wAa + wEe + wIh + wOh + wOu || 1.0;

      targetAa = open * (wAa / sum) * 1.1;
      targetEe = open * (wEe / sum) * 0.95;
      targetIh = open * (wIh / sum) * 0.75;
      targetOh = open * (wOh / sum) * 0.85;
      targetOu = open * (wOu / sum) * 0.75;
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
