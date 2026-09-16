import * as THREE from 'three';

const EXPR_ALIASES = {
  happy: ['happy', 'joy', 'Joy', 'HAPPY', 'JOY'],
  surprised: ['surprised', 'fun', 'Fun', 'SURPRISED'],
  sad: ['sad', 'sorrow', 'Sorrow', 'SAD', 'SORROW'],
  angry: ['angry', 'Angry', 'ANGRY'],
  relaxed: ['relaxed', 'fun', 'Fun', 'RELAXED'],
  think: ['neutral', 'Neutral', 'NEUTRAL'],
  wink: ['blinkLeft', 'blink_l', 'Blink_L', 'BLINK_L'],
  blink: ['blink', 'Blink', 'BLINK'],
  neutral: ['neutral', 'Neutral', 'NEUTRAL'],
  aa: ['aa', 'a', 'A', 'AA'],
  ee: ['ee', 'e', 'E', 'EE'],
  ih: ['ih', 'i', 'I', 'IH'],
  oh: ['oh', 'o', 'O', 'OH'],
  ou: ['ou', 'u', 'U', 'OU']
};

export class ExpressionManager {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

    this.currentEmotion = 'neutral';
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.blendDuration = 0.3; // seconds

    this.currentValues = new Map();
    this.targetValues = new Map();
    this.resetTimer = null;

    this.emotionPresets = {
      // Core base emotions
      neutral: {},
      happy: { happy: 0.95, relaxed: 0.25, aa: 0.06 },
      surprised: { surprised: 0.88, oh: 0.25 },
      sad: { sad: 0.82, oh: 0.08 },
      angry: { angry: 0.85, ee: 0.15 },
      relaxed: { relaxed: 0.85, happy: 0.35 },
      think: { relaxed: 0.35, surprised: 0.18, wink: 0.15 },
      wink: { wink: 1.0, happy: 0.75, relaxed: 0.25 },

      // SillyTavern Extension-VRM 28-Emotion Taxonomy:
      joy: { happy: 1.0, relaxed: 0.3, aa: 0.1 },
      amusement: { happy: 0.85, relaxed: 0.4, aa: 0.08 },
      admiration: { relaxed: 0.75, happy: 0.45, surprised: 0.15 },
      approval: { happy: 0.65, relaxed: 0.45 },
      caring: { relaxed: 0.85, happy: 0.4 },
      love: { relaxed: 0.9, happy: 0.55, aa: 0.05 },
      gratitude: { relaxed: 0.8, happy: 0.5 },
      optimism: { happy: 0.8, relaxed: 0.3 },
      pride: { happy: 0.7, relaxed: 0.2 },
      relief: { relaxed: 0.95, happy: 0.2 },

      curiosity: { surprised: 0.35, relaxed: 0.25, wink: 0.1 },
      confusion: { surprised: 0.5, angry: 0.15 },
      realization: { surprised: 0.75, oh: 0.2 },
      excitement: { surprised: 0.8, happy: 0.85, aa: 0.15 },
      surprise: { surprised: 0.95, oh: 0.3 },

      desire: { wink: 0.65, relaxed: 0.5, happy: 0.4 },
      embarrassment: { wink: 0.45, happy: 0.5, relaxed: 0.2 },
      nervousness: { sad: 0.4, surprised: 0.25 },

      disappointment: { sad: 0.65, angry: 0.25 },
      disapproval: { angry: 0.6, sad: 0.2 },
      annoyance: { angry: 0.75, ee: 0.1 },
      disgust: { angry: 0.8, sad: 0.3, ee: 0.2 },
      anger: { angry: 0.95, ee: 0.25 },
      fear: { sad: 0.7, surprised: 0.55, oh: 0.15 },
      grief: { sad: 0.95, oh: 0.12 },
      remorse: { sad: 0.8, relaxed: 0.1 },
      sadness: { sad: 0.85, oh: 0.08 }
    };

    // Listen to model loaded event
    this.vrmManager.addModelLoadedListener((vrm) => {
      this.bindModel(vrm);
    });
  }

  bindModel(vrm) {
    this.vrm = vrm;
    this.currentValues.clear();
    this.targetValues.clear();

    const manager = this.getManager();
    if (manager?.expressions) {
      const names = manager.expressions.map((e) => e.expressionName || e.name);
      console.log('[ExpressionManager] Registered expressions on avatar:', names);
    }

    this.setEmotion('neutral');
  }

  getManager() {
    return this.vrm?.expressionManager || this.vrm?.blendShapeProxy;
  }

  setExpressionValue(name, value) {
    const manager = this.getManager();
    if (!manager) return;

    const targets = EXPR_ALIASES[name] || [name];
    let applied = false;

    for (const target of targets) {
      if (typeof manager.getExpression === 'function') {
        const expr = manager.getExpression(target);
        if (expr) {
          manager.setValue(target, value);
          applied = true;
          break;
        }
      } else {
        try {
          manager.setValue(target, value);
          applied = true;
          break;
        } catch (e) {}
      }
    }

    // Fallback: try direct name if not already matched
    if (!applied) {
      try {
        manager.setValue(name, value);
      } catch (e) {}
    }

    // Push immediate update to morph targets
    if (typeof manager.update === 'function') {
      manager.update();
    }
  }

  getExpressionValue(name) {
    const manager = this.getManager();
    if (!manager) return 0;

    const targets = EXPR_ALIASES[name] || [name];
    for (const target of targets) {
      try {
        if (typeof manager.getExpression === 'function') {
          if (!manager.getExpression(target)) continue;
        }
        const val = manager.getValue(target);
        if (typeof val === 'number') return val;
      } catch (e) {}
    }
    return 0;
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  setEmotion(name, intensity = 1.0) {
    const manager = this.getManager();
    if (!manager) return;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    const preset = this.emotionPresets[name] || this.emotionPresets.neutral;
    this.currentEmotion = name;
    this.isTransitioning = true;
    this.transitionProgress = 0;

    this.currentValues.clear();
    this.targetValues.clear();

    const allKeys = ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'wink', 'aa', 'oh', 'ee'];

    allKeys.forEach((key) => {
      const currentVal = this.getExpressionValue(key);
      this.currentValues.set(key, currentVal);
      const targetVal = preset[key] !== undefined ? preset[key] * THREE.MathUtils.clamp(intensity, 0, 1) : 0;
      this.targetValues.set(key, targetVal);
    });
  }

  setEmotionWithAutoReset(name, resetAfterMs = 4500, intensity = 1.0) {
    this.setEmotion(name, intensity);
    this.resetTimer = setTimeout(() => {
      this.setEmotion('neutral');
      this.resetTimer = null;
    }, resetAfterMs);
  }

  update(delta) {
    if (!this.isTransitioning || !this.getManager()) return;

    this.transitionProgress += delta / this.blendDuration;
    if (this.transitionProgress >= 1.0) {
      this.transitionProgress = 1.0;
      this.isTransitioning = false;
    }

    const ease = this.easeInOutCubic(this.transitionProgress);

    for (const [key, target] of this.targetValues.entries()) {
      const start = this.currentValues.get(key) || 0;
      const val = THREE.MathUtils.lerp(start, target, ease);
      this.setExpressionValue(key, val);
    }
  }
}
