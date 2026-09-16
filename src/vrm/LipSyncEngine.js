import * as THREE from 'three';

const VISEME_ALIASES = {
  aa: ['aa', 'a', 'A', 'AA'],
  ee: ['ee', 'e', 'E', 'EE'],
  ih: ['ih', 'i', 'I', 'IH'],
  oh: ['oh', 'o', 'O', 'OH'],
  ou: ['ou', 'u', 'U', 'OU']
};

export class LipSyncEngine {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

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
    });
  }

  getManager() {
    return this.vrm?.expressionManager || this.vrm?.blendShapeProxy;
  }

  setBlendshape(viseme, value) {
    const manager = this.getManager();
    if (!manager) return;

    const targets = VISEME_ALIASES[viseme] || [viseme];
    for (const t of targets) {
      if (typeof manager.getExpression === 'function') {
        const expr = manager.getExpression(t);
        if (expr) {
          manager.setValue(t, value);
          break;
        }
      } else {
        try {
          manager.setValue(t, value);
          break;
        } catch (e) {}
      }
    }
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
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.isAudioActive = true;
    } catch (e) {
      console.warn('[LipSyncEngine] Could not connect media element:', e);
    }
  }

  startSyntheticSpeech() {
    this.isSyntheticSpeaking = true;
    this.syntheticTime = 0;
  }

  stopSyntheticSpeech() {
    this.isSyntheticSpeaking = false;
    // Hard reset mouth
    ['aa', 'ee', 'ih', 'oh', 'ou'].forEach((k) => this.setBlendshape(k, 0));
  }

  update(delta) {
    const manager = this.getManager();
    if (!manager) return;

    let targetAa = 0;
    let targetEe = 0;
    let targetIh = 0;
    let targetOh = 0;
    let targetOu = 0;

    if (this.isAudioActive && this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);

      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      const vol = THREE.MathUtils.clamp(avg / 128, 0, 1);

      if (vol > 0.05) {
        let lowSum = 0;
        for (let i = 2; i < 18; i++) lowSum += this.dataArray[i];
        const low = lowSum / 16 / 255;

        let midSum = 0;
        for (let i = 18; i < 48; i++) midSum += this.dataArray[i];
        const mid = midSum / 30 / 255;

        let highSum = 0;
        for (let i = 48; i < 90; i++) highSum += this.dataArray[i];
        const high = highSum / 42 / 255;

        targetAa = Math.min(low * 1.4, 0.9);
        targetOh = Math.min(low * 0.7 + mid * 0.4, 0.7);
        targetEe = Math.min(mid * 1.1 + high * 0.5, 0.8);
        targetIh = Math.min(mid * 0.8, 0.6);
        targetOu = Math.min(high * 0.9 + low * 0.3, 0.65);
      }
    } else if (this.isSyntheticSpeaking) {
      this.syntheticTime += delta * this.syntheticCadence;
      const t = this.syntheticTime;

      const pulse = Math.max(0, Math.sin(t) * 0.65 + Math.sin(t * 0.5 + 0.3) * 0.35);
      const open = Math.pow(pulse, 1.2);
      const shapeIdx = Math.floor(t / Math.PI) % 4;

      if (shapeIdx === 0) {
        targetAa = open * 0.85;
        targetOh = open * 0.2;
      } else if (shapeIdx === 1) {
        targetEe = open * 0.75;
        targetIh = open * 0.4;
      } else if (shapeIdx === 2) {
        targetOh = open * 0.8;
        targetOu = open * 0.5;
      } else {
        targetAa = open * 0.6;
        targetEe = open * 0.5;
      }
    }

    const smoothViseme = (curr, target) => {
      const rate = target > curr ? this.attack : this.release;
      const factor = 1 - Math.exp(-rate * delta);
      return curr + (target - curr) * factor;
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
  }
}
