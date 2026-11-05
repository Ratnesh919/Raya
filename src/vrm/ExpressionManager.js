import * as THREE from 'three';

const EXPR_ALIASES = {
  happy: ['happy', 'relaxed', 'Joy', 'fun', 'joy', 'Fun', 'HAPPY', 'JOY'],
  surprised: ['surprised', 'Surprised', 'SURPRISED', 'oh', 'O', 'happy', 'Fun'],
  sad: ['sad', 'Sorrow', 'sorrow', 'SAD', 'SORROW'],
  angry: ['angry', 'Angry', 'ANGRY'],
  relaxed: ['relaxed', 'fun', 'Fun', 'happy', 'Joy', 'RELAXED'],
  think: ['confused', 'Confused', 'neutral', 'Neutral', 'NEUTRAL'],
  wink: ['blinkLeft', 'blink_l', 'Blink_L', 'BLINK_L', 'blinkRight', 'blink_r', 'Blink_R', 'BLINK_R', 'blink', 'Blink'],
  blink: ['blink', 'Blink', 'BLINK'],
  neutral: ['neutral', 'Neutral', 'NEUTRAL'],
  shy: ['shy', 'Shy', 'blush', 'Blush', 'fun', 'relaxed', 'joy', 'happy'],
  blush: ['blush', 'Blush', 'heart eyes', 'Heart Eyes', 'fun', 'relaxed', 'joy', 'happy', 'Fun'],
  aa: ['aa', 'A', 'a', 'AA'],
  ee: ['ee', 'E', 'e', 'EE'],
  ih: ['ih', 'I', 'i', 'IH'],
  oh: ['oh', 'O', 'o', 'OH'],
  ou: ['ou', 'U', 'u', 'OU']
};

// Universal raw morph target mappings across anime models (Changli, Yinlin, Yangyang, Camellya, Iuno, etc.)
const RAW_MORPH_ALIASES = {
  happy: ['にこり', '笑い', '笑い目', 'にこり２', 'にこりL', 'にこりR', 'にこり左', 'にこり右', 'smile', 'happy', 'joy'],
  wink: ['ウィンク', 'ウィンク右', 'ウィンク２', 'wink', 'wink_l', 'wink_r'],
  blush: ['照れ', 'FaceRed', '照れ2', 'はぁと', 'はぁと2', 'blush'],
  shy: ['照れ', 'FaceRed', '照れ2', 'blush'],
  sad: ['困る', '困る2', '悲しい目', '困るL', '困るR', '困る左', '困る右', 'sad', 'sorrow'],
  concern: ['困る', '困る2', '悲しい目', '困る左', '困る右', 'sad'],
  angry: ['怒り', '怒りL', '怒りR', '怒り左', '怒り右', 'angry'],
  surprised: ['びっくり', 'びっくり左', 'びっくり右', '惊', '！', 'surprised'],
  think: ['怪訝左', '怪訝右', 'じと目', 'じと目2', '……', '？', 'confused']
};

// Emotion families inspired by open-annie faces.js
export const EMOTION_FAMILIES = {
  warm: ['happy', 'joy', 'relaxed', 'caring', 'love', 'gratitude', 'optimism', 'amusement'],
  down: ['sad', 'concern', 'empathy', 'console', 'disappointment'],
  alert: ['surprised', 'curiosity', 'think', 'confusion'],
  hot: ['angry', 'embarrassment', 'shy'],
  calm: ['neutral', 'advice']
};

// Mouth-influencing emotion blendshapes that must be ducked during speech to avoid viseme fighting
const MOUTH_AFFECTING_EMOTIONS = new Set(['happy', 'relaxed']);

export class ExpressionManager {
  constructor(vrmManager) {
    this.vrmManager = vrmManager;
    this.vrm = null;

    this.currentEmotion = 'neutral';
    this.targetEmotion = 'neutral';
    this.currentIntensity = 1.0;
    this.targetIntensity = 1.0;

    // Expression Director & Envelope (open-annie faces.js)
    this.minDwellTime = 1.1; // Minimum dwell gating (seconds) to prevent high-frequency emotional flicker
    this.lastEmotionChangeTime = -10.0;
    this.envelopePhase = 'idle'; // 'attack', 'hold', 'release', 'idle'
    this.attackDuration = 0.30;
    this.releaseDuration = 0.75;
    this.envelopeTimer = 0;
    this.holdDuration = 0;

    // Talking-Face Splitter (open-annie mouth.js)
    this.lipSyncEngine = null;
    this.mouthDuckFactor = 0.0; // 0 = full emotion smile, 1 = mouth freed 100% for phonemes
    this.speechDuckingSpeed = 16.0;

    // Living micro-flutter (subtle biological micro-expressions)
    this.flutterTime = 0;

    this.lifeSimulator = null;
    this.morphMeshes = [];
    this.boundRawMorphs = new Map(); // key -> Array of { mesh, index, name }
    this.currentValues = new Map();
    this.targetValues = new Map();
    this.resetTimer = null;

    this.emotionPresets = {
      // Core companion emotions (Upper face brow/eyes distinct from mouth)
      neutral: {},
      happy: { happy: 0.85, relaxed: 0.85 },
      joy: { happy: 0.95, relaxed: 0.95 },
      caring: { sad: 0.50, relaxed: 0.45 },
      concern: { sad: 0.65, relaxed: 0.25, angry: 0.15 },
      shy: { blush: 0.90, fun: 0.35, relaxed: 0.30 },
      console: { sad: 0.55, relaxed: 0.35 },
      empathy: { sad: 0.50, relaxed: 0.35 },
      advice: { relaxed: 0.50, surprised: 0.25 },
      surprised: { surprised: 0.85 },
      sad: { sad: 0.85 },
      angry: { angry: 0.85 },
      relaxed: { relaxed: 0.75, happy: 0.40 },
      think: { relaxed: 0.35, surprised: 0.25 },
      wink: { wink: 1.0, happy: 0.60, relaxed: 0.60 },
      blush: { blush: 0.95, happy: 0.60, relaxed: 0.60 },
      curiosity: { surprised: 0.65, relaxed: 0.35 },
      amusement: { happy: 0.80, relaxed: 0.80 },
      admiration: { relaxed: 0.50, happy: 0.50, surprised: 0.20 },
      love: { blush: 0.85, happy: 0.75, relaxed: 0.70 },
      gratitude: { relaxed: 0.60, happy: 0.70 },
      optimism: { happy: 0.75, relaxed: 0.75 },
      embarrassment: { blush: 0.95, happy: 0.40, relaxed: 0.40 },
      disappointment: { sad: 0.65, angry: 0.20 },
      confusion: { surprised: 0.50, angry: 0.15 }
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
    this.boundRawMorphs.clear();
    this.morphMeshes = [];

    // 1. Traverse scene to index all character SkinnedMeshes with morph targets
    if (vrm?.scene) {
      vrm.scene.traverse((node) => {
        if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
          this.morphMeshes.push(node);
        }
      });
    }

    // 2. Discover and bind raw Japanese/MMD morph targets across all anime models (Changli, Yinlin, Yangyang, Camellya, Iuno)
    for (const [emotionKey, candidates] of Object.entries(RAW_MORPH_ALIASES)) {
      const matched = [];
      for (const mesh of this.morphMeshes) {
        const dict = mesh.morphTargetDictionary;
        for (const candidate of candidates) {
          for (const [mName, mIdx] of Object.entries(dict)) {
            const cleanMName = mName.toLowerCase();
            const cleanCand = candidate.toLowerCase();
            if (cleanMName.includes(cleanCand) || mName.endsWith(candidate) || (mName.includes('.') && mName.split('.')[1] === candidate)) {
              if (!matched.some((item) => item.mesh === mesh && item.index === mIdx)) {
                matched.push({ mesh, index: mIdx, name: mName });
              }
            }
          }
        }
      }
      if (matched.length > 0) {
        this.boundRawMorphs.set(emotionKey, matched);
      }
    }

    const manager = this.getManager();
    if (manager?.expressions) {
      const names = manager.expressions.map((e) => `${e.expressionName || e.name} (${e.binds ? e.binds.length : 'unknown'} binds)`);
      console.log('[ExpressionManager] Registered expressions on avatar:', names);
    }
    console.log('[ExpressionManager] Cached raw morphs for emotions:', Array.from(this.boundRawMorphs.keys()));

    this.setEmotion('neutral');
  }

  getManager() {
    return this.vrm?.expressionManager || this.vrm?.blendShapeProxy;
  }

  getEmotionFamily(emotionName) {
    const clean = (emotionName || '').toLowerCase().trim();
    for (const [family, list] of Object.entries(EMOTION_FAMILIES)) {
      if (list.includes(clean)) return family;
    }
    return 'calm';
  }

  setExpressionValue(name, value) {
    const manager = this.getManager();
    const targets = EXPR_ALIASES[name] || [name];
    let applied = false;

    if (manager) {
      for (const target of targets) {
        if (typeof manager.getExpression === 'function') {
          const expr = manager.getExpression(target);
          if (expr) {
            // If this expression exists but has zero binds, skip to next candidate (e.g. Joy with 0 binds -> Fun/relaxed)
            if (expr.binds && expr.binds.length === 0) {
              continue;
            }
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

      if (typeof manager.update === 'function') {
        manager.update();
      }
    }

    // Direct SkinnedMesh morph target integration (for Changli, Yinlin, Yangyang, Camellya, Iuno, and custom models)
    const rawMatches = this.boundRawMorphs.get(name) || this.boundRawMorphs.get(name.toLowerCase());
    if (rawMatches && rawMatches.length > 0) {
      for (let i = 0; i < rawMatches.length; i++) {
        const item = rawMatches[i];
        if (item.mesh?.morphTargetInfluences) {
          item.mesh.morphTargetInfluences[item.index] = value;
        }
      }
    }
  }

  getExpressionValue(name) {
    const manager = this.getManager();
    if (manager) {
      const targets = EXPR_ALIASES[name] || [name];
      for (const target of targets) {
        try {
          if (typeof manager.getExpression === 'function') {
            const expr = manager.getExpression(target);
            if (!expr || (expr.binds && expr.binds.length === 0)) continue;
          }
          const val = manager.getValue(target);
          if (typeof val === 'number') return val;
        } catch (e) {}
      }
    }

    const rawMatches = this.boundRawMorphs.get(name) || this.boundRawMorphs.get(name.toLowerCase());
    if (rawMatches && rawMatches.length > 0) {
      const item = rawMatches[0];
      if (item.mesh?.morphTargetInfluences) {
        return item.mesh.morphTargetInfluences[item.index] || 0;
      }
    }
    return 0;
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Expression Director setEmotion:
   * Enforces dwell gating, sets attack envelope, and dispatches bodily behaviors
   */
  setEmotion(name, intensity = 1.0, syncBehavior = true) {
    const manager = this.getManager();
    if (!manager) return;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    const now = performance.now() / 1000;
    const timeSinceLastChange = now - this.lastEmotionChangeTime;

    // Dwell Gating: if less than minDwellTime has elapsed, allow transition only if moving to neutral or high priority
    if (timeSinceLastChange < this.minDwellTime && name !== 'neutral' && name !== this.currentEmotion) {
      // Smoothly queue or blend into the target without sudden jerking
      this.attackDuration = Math.max(0.4, this.minDwellTime - timeSinceLastChange);
    } else {
      this.attackDuration = 0.30;
    }
    this.lastEmotionChangeTime = now;

    const preset = this.emotionPresets[name] || this.emotionPresets.neutral;
    this.currentEmotion = name;
    this.targetEmotion = name;
    this.targetIntensity = THREE.MathUtils.clamp(intensity, 0, 1);

    this.envelopePhase = 'attack';
    this.envelopeTimer = 0;

    // Snapshot current values as envelope starting baseline
    const allKeys = ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'wink', 'blush'];
    allKeys.forEach((key) => {
      const currentVal = this.getExpressionValue(key);
      this.currentValues.set(key, currentVal);
      const targetVal = preset[key] !== undefined ? preset[key] * this.targetIntensity : 0;
      this.targetValues.set(key, targetVal);
    });

    if (syncBehavior && this.lifeSimulator && typeof this.lifeSimulator.triggerBehavior === 'function') {
      const cleanName = (name || '').toLowerCase().trim();
      if (['shy', 'concern', 'caring', 'empathy', 'console', 'love', 'admiration', 'think', 'curiosity', 'happy', 'joy', 'wink', 'amusement'].includes(cleanName)) {
        this.lifeSimulator.triggerBehavior(cleanName, 5.0);
      } else if (cleanName === 'neutral') {
        this.lifeSimulator.clearBehavior();
      }
    }
  }

  setEmotionWithAutoReset(name, resetAfterMs = 4500, intensity = 1.0) {
    this.setEmotion(name, intensity, true);
    if (this.lifeSimulator && typeof this.lifeSimulator.triggerBehavior === 'function') {
      this.lifeSimulator.triggerBehavior(name, resetAfterMs / 1000);
    }
    this.resetTimer = setTimeout(() => {
      this.releaseEmotion();
      this.resetTimer = null;
    }, resetAfterMs);
  }

  /**
   * Smoothly releases current emotion back to neutral via organic decay
   */
  releaseEmotion() {
    this.envelopePhase = 'release';
    this.envelopeTimer = 0;
    this.targetEmotion = 'neutral';
    this.targetIntensity = 0;

    const allKeys = ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'wink', 'blush'];
    allKeys.forEach((key) => {
      this.currentValues.set(key, this.getExpressionValue(key));
      this.targetValues.set(key, 0);
    });
  }

  /**
   * Main per-frame expression director update:
   * 1. Evaluates envelope progress (attack -> hold -> release)
   * 2. Talking-Face Split: ducks mouth morphs when speech is active so visemes articulate cleanly
   * 3. Micro-flutter: subtle organic living twitches in brows/cheeks
   */
  update(delta) {
    const manager = this.getManager();
    if (!manager) return;

    this.flutterTime += delta;

    // 1. Talking-Face Splitter: Check if LipSyncEngine is speaking
    const isSpeaking = this.lipSyncEngine?.isSyntheticSpeaking || this.lipSyncEngine?.isAudioActive || false;
    const targetMouthDuck = isSpeaking ? 0.85 : 0.0;
    const duckSpeed = 1.0 - Math.exp(-this.speechDuckingSpeed * delta);
    this.mouthDuckFactor += (targetMouthDuck - this.mouthDuckFactor) * duckSpeed;

    // 2. Expression Envelope Processing
    let envelopeWeight = 1.0;
    if (this.envelopePhase === 'attack') {
      this.envelopeTimer += delta;
      const progress = Math.min(1.0, this.envelopeTimer / this.attackDuration);
      envelopeWeight = this.easeInOutCubic(progress);
      if (progress >= 1.0) {
        this.envelopePhase = 'hold';
        this.envelopeTimer = 0;
      }
    } else if (this.envelopePhase === 'release') {
      this.envelopeTimer += delta;
      const progress = Math.min(1.0, this.envelopeTimer / this.releaseDuration);
      envelopeWeight = 1.0 - this.easeInOutCubic(progress);
      if (progress >= 1.0) {
        this.envelopePhase = 'idle';
        this.currentEmotion = 'neutral';
      }
    } else if (this.envelopePhase === 'idle') {
      envelopeWeight = 0.0;
    }

    // 3. Subtle organic micro-flutter during holds (subconscious living breathing in face)
    const microFlutter = this.envelopePhase === 'hold' && this.currentEmotion !== 'neutral'
      ? Math.sin(this.flutterTime * 1.6) * 0.025
      : 0;

    // 4. Apply blended values with Talking-Face Split
    for (const [key, targetVal] of this.targetValues.entries()) {
      const startVal = this.currentValues.get(key) || 0;
      let blended = THREE.MathUtils.lerp(startVal, targetVal, envelopeWeight);

      // Talking-Face Splitter: If this morph affects mouth corners/lips, duck it during speech
      if (MOUTH_AFFECTING_EMOTIONS.has(key) && this.mouthDuckFactor > 0.01) {
        blended *= (1.0 - this.mouthDuckFactor * 0.82);
      }

      // Add gentle micro-flutter to upper face (sad, angry, surprised, blush)
      if (!MOUTH_AFFECTING_EMOTIONS.has(key) && blended > 0.1) {
        blended = THREE.MathUtils.clamp(blended + microFlutter, 0, 1);
      }

      this.setExpressionValue(key, blended);
    }
  }
}
