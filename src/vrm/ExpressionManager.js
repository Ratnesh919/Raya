import * as THREE from 'three';

const EXPR_ALIASES = {
  happy: ['happy', 'Joy', 'joy', 'HAPPY', 'JOY'],
  surprised: ['surprised', 'Surprised', 'SURPRISED'],
  sad: ['sad', 'Sorrow', 'sorrow', 'SAD', 'SORROW'],
  angry: ['angry', 'Angry', 'ANGRY'],
  relaxed: ['relaxed', 'Fun', 'fun', 'RELAXED'],
  think: ['neutral', 'Neutral', 'NEUTRAL', 'confused'],
  wink: ['blinkLeft', 'blink_l', 'Blink_L', 'BLINK_L', 'blinkRight'],
  blink: ['blink', 'Blink', 'BLINK'],
  neutral: ['neutral', 'Neutral', 'NEUTRAL'],
  blush: ['blush', 'Blush', 'heart eyes'],
  aa: ['aa', 'A', 'a', 'AA'],
  ee: ['ee', 'E', 'e', 'EE'],
  ih: ['ih', 'I', 'i', 'IH'],
  oh: ['oh', 'O', 'o', 'OH'],
  ou: ['ou', 'U', 'u', 'OU']
};

export class ExpressionManager {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

    this.currentEmotion = 'neutral';
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.blendDuration = 0.35; // smooth natural transition in seconds

    this.currentValues = new Map();
    this.targetValues = new Map();
    this.resetTimer = null;

    this.emotionPresets = {
      // Core companion emotions (Pure facial emotions; mouth blendshapes left free for LipSync)
      neutral: {},
      happy: { happy: 0.85, relaxed: 0.3 },
      joy: { happy: 1.0, relaxed: 0.35 },
      caring: { relaxed: 0.75, happy: 0.35, sad: 0.1 },
      console: { sad: 0.25, relaxed: 0.75, happy: 0.15 },
      empathy: { sad: 0.35, relaxed: 0.65, happy: 0.1 },
      advice: { relaxed: 0.65, happy: 0.3, surprised: 0.1 },
      surprised: { surprised: 0.85 },
      sad: { sad: 0.85 },
      angry: { angry: 0.85 },
      relaxed: { relaxed: 0.85, happy: 0.25 },
      think: { relaxed: 0.35, surprised: 0.18 },
      wink: { wink: 1.0, happy: 0.7, relaxed: 0.2 },
      blush: { blush: 0.95, happy: 0.65, wink: 0.2 },
      curiosity: { surprised: 0.4, relaxed: 0.3 },
      amusement: { happy: 0.85, relaxed: 0.4 },
      admiration: { relaxed: 0.75, happy: 0.45, surprised: 0.15 },
      love: { relaxed: 0.85, happy: 0.55, blush: 0.8 },
      gratitude: { relaxed: 0.8, happy: 0.5 },
      optimism: { happy: 0.8, relaxed: 0.3 },
      embarrassment: { blush: 0.85, wink: 0.4, happy: 0.45 },
      disappointment: { sad: 0.65, angry: 0.2 },
      confusion: { surprised: 0.45, angry: 0.1 }
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

    const allKeys = ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'wink', 'blush'];

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
