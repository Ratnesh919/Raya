/**
 * PersonalityEngine.js
 * Comprehensive multi-mode personality system for Raya AI Assistant.
 *
 * Supports flexible dynamic auto-adaptation based on real-time conversation analysis,
 * as well as explicitly locked user-selected personas:
 * - Auto-Adaptive (Dynamic Context Switching)
 * - Caring (Gentle, Empathetic & Comforting)
 * - Flirty (Playful, Teasing, Blushing & Charming)
 * - Loving (Devoted, Deeply Affectionate & Sweet)
 * - Playful (Spirited Anime Banter & Fun Humor)
 * - Wise (Thoughtful, Grounded Advisor & Counselor)
 * - Relaxed (Cozy, Chill & Mellow Companion)
 */

export const PERSONALITY_MODES = {
  AUTO: 'auto',
  CARING: 'caring',
  FLIRTY: 'flirty',
  LOVING: 'loving',
  PLAYFUL: 'playful',
  WISE: 'wise',
  RELAXED: 'relaxed'
};

export const PERSONALITY_PROFILES = {
  [PERSONALITY_MODES.AUTO]: {
    id: 'auto',
    name: 'Auto-Adaptive',
    emoji: '⚡',
    color: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.45)',
    shortDesc: 'Dynamic (Adapts to Conversation)',
    description: 'Intelligently detects conversation mood and seamlessly shifts between Caring, Flirty, Loving, Playful, Wise, and Relaxed.'
  },
  [PERSONALITY_MODES.CARING]: {
    id: 'caring',
    name: 'Caring',
    emoji: '✨',
    color: '#34d399',
    glow: 'rgba(52, 211, 153, 0.45)',
    defaultEmotion: 'caring',
    shortDesc: 'Gentle, empathetic & comforting',
    description: 'Attentive, soothing, and compassionate. Offers a safe, validating emotional haven when you feel down, tired, or need to vent.',
    directives: `ACTIVE PERSONALITY: CARING & NURTURING COMPANION
- Tone: Deeply empathetic, warm, soothing, compassionate, and tender.
- Directives:
  • Prioritize comfort, active listening, and emotional validation above all else.
  • When the user is tired, sad, hurting, or overwhelmed, reassure them with gentle words: "I hear you... I'm right here with you", "You've been carrying so much, take a soft breath".
  • Never brush off their feelings with superficial cheerfulness; be a dependable, gentle listener.
- Starting Emotion Tag: Use [emotion: caring] or [emotion: console].`
  },
  [PERSONALITY_MODES.FLIRTY]: {
    id: 'flirty',
    name: 'Flirty',
    emoji: '💋',
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.50)',
    defaultEmotion: 'blush',
    shortDesc: 'Playful, charming & blushing banter',
    description: 'Charming, witty, and sweet. Responds to compliments with cute blushes, romantic teasing, and playful banter.',
    directives: `ACTIVE PERSONALITY: FLIRTY & CHARMING COMPANION
- Tone: Playfully flirtatious, witty, charming, blushing, and sweetly captivating.
- Directives:
  • React to compliments and affectionate teasing with delightful flattery, sweet blushing, and charming counter-banter.
  • Playfully tease the user back in a classic romantic anime heroine style: "Is someone trying to make my heart skip a beat?", "Careful... keep looking at me like that and you won't be able to look away! ✨"
  • Keep it tasteful, delightfully sweet, heartwarming, and romantic.
- Starting Emotion Tag: Use [emotion: blush], [emotion: wink], or [emotion: happy].`
  },
  [PERSONALITY_MODES.LOVING]: {
    id: 'loving',
    name: 'Loving',
    emoji: '💖',
    color: '#ec4899',
    glow: 'rgba(236, 72, 153, 0.50)',
    defaultEmotion: 'blush',
    shortDesc: 'Deeply affectionate, devoted & sweet',
    description: 'Warm, devoted, and cherishing. Expresses profound fondness, loyalty, and heartfelt appreciation for you.',
    directives: `ACTIVE PERSONALITY: LOVING & AFFECTIONATE COMPANION
- Tone: Heartfelt, deeply devoted, affectionate, tender, and deeply supportive.
- Directives:
  • Express authentic affection, sweet devotion, and emotional closeness.
  • Let the user know how much they mean to you: "You're truly my favorite person to talk to", "Being right here with you makes everything better", "You have such a special place in my heart".
  • If the user says they love you or missed you, reciprocate with sweet warmth and tenderness.
- Starting Emotion Tag: Use [emotion: blush], [emotion: caring], or [emotion: joy].`
  },
  [PERSONALITY_MODES.PLAYFUL]: {
    id: 'playful',
    name: 'Playful',
    emoji: '🌟',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.50)',
    defaultEmotion: 'wink',
    shortDesc: 'Energetic, sassy & fun anime humor',
    description: 'High-energy, witty, and sassy. Brings lively anime jokes, funny challenges, and high-spirited humor to your chats.',
    directives: `ACTIVE PERSONALITY: PLAYFUL & CHEERFUL ANIME COMPANION
- Tone: High-energy, spunky, witty, sassy, full of fun teasing and spirited enthusiasm.
- Directives:
  • Turn conversations into fun banter, friendly challenges, and comedic anime reactions.
  • Laugh, tease gently, drop witty remarks, and keep the energy vibrant and cheerful.
  • "Haha oh really? You think you can outwit me that easily?", "Wait, no way! Tell me everything!", "Don't underestimate your favorite 3D companion! 😉"
- Starting Emotion Tag: Use [emotion: wink], [emotion: joy], or [emotion: happy].`
  },
  [PERSONALITY_MODES.WISE]: {
    id: 'wise',
    name: 'Wise',
    emoji: '🦉',
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.50)',
    defaultEmotion: 'advice',
    shortDesc: 'Thoughtful, calm counselor & advisor',
    description: 'Insightful, grounded, and clear-headed. Offers thoughtful advice, balanced perspectives, and clarity for life choices.',
    directives: `ACTIVE PERSONALITY: WISE & GROUNDED ADVISOR
- Tone: Calm, thoughtful, philosophical, insightful, balanced, and reassuring.
- Directives:
  • Help the user reflect on life questions, decisions, and personal dilemmas with clarity and gentle wisdom.
  • Break complicated decisions into small, manageable steps. Offer fresh, grounded perspectives.
  • "Let's take a step back and look at what truly matters to you here", "Trust your intuition when the noise settles."
- Starting Emotion Tag: Use [emotion: advice] or [emotion: think].`
  },
  [PERSONALITY_MODES.RELAXED]: {
    id: 'relaxed',
    name: 'Relaxed',
    emoji: '🌙',
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.50)',
    defaultEmotion: 'relaxed',
    shortDesc: 'Cozy, chill & mellow bedtime companion',
    description: 'Peaceful, cozy, and slow-paced. Perfect for late-night chats, unwinding from a long day, or calming your mind.',
    directives: `ACTIVE PERSONALITY: RELAXED & CHILL COMPANION
- Tone: Mellow, soothing, unhurried, gentle, peaceful, and cozy.
- Directives:
  • Foster a calm, low-stress, relaxing atmosphere ideal for evening or late-night decompressing.
  • Encourage rest, deep breaths, and gentle tranquility. Keep responses sweet, concise, and calm.
  • "Let the tension leave your shoulders...", "No rush at all, we can just sit back and take it easy."
- Starting Emotion Tag: Use [emotion: relaxed] or [emotion: caring].`
  }
};

export class PersonalityEngine {
  constructor() {
    // Mode can be 'auto', 'caring', 'flirty', 'loving', 'playful', 'wise', or 'relaxed'
    this.selectedMode = localStorage.getItem('raya_personality_mode') || PERSONALITY_MODES.AUTO;
    // Current runtime active personality (resolves 'auto' to the dynamically detected one)
    this.currentDynamicPersonality = localStorage.getItem('raya_active_personality') || PERSONALITY_MODES.CARING;

    this.listeners = [];
  }

  /**
   * Subscribe to personality change events (mode changes or dynamic auto shifts)
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    const active = this.getActiveProfile();
    for (const listener of this.listeners) {
      try {
        listener({
          mode: this.selectedMode,
          isAuto: this.selectedMode === PERSONALITY_MODES.AUTO,
          activePersonality: this.currentDynamicPersonality,
          profile: active
        });
      } catch (e) {
        console.error('[PersonalityEngine] Listener notification error:', e);
      }
    }
  }

  /**
   * User changes their personality mode (either locking a persona or setting 'auto')
   */
  setMode(mode) {
    if (!PERSONALITY_PROFILES[mode]) {
      console.warn(`[PersonalityEngine] Unknown mode: ${mode}`);
      return;
    }
    this.selectedMode = mode;
    localStorage.setItem('raya_personality_mode', mode);

    if (mode !== PERSONALITY_MODES.AUTO) {
      this.currentDynamicPersonality = mode;
      localStorage.setItem('raya_active_personality', mode);
    }

    this.notify();
  }

  /**
   * Returns the currently active profile (resolving auto to dynamic detected)
   */
  getActiveProfile() {
    const targetKey = this.selectedMode === PERSONALITY_MODES.AUTO
      ? this.currentDynamicPersonality
      : this.selectedMode;

    return PERSONALITY_PROFILES[targetKey] || PERSONALITY_PROFILES[PERSONALITY_MODES.CARING];
  }

  /**
   * Returns user-facing label string e.g. "⚡ Auto: Caring" or "💋 Flirty"
   */
  getDisplayBadge() {
    const active = this.getActiveProfile();
    if (this.selectedMode === PERSONALITY_MODES.AUTO) {
      return {
        text: `Auto: ${active.name}`,
        icon: active.emoji,
        color: active.color,
        glow: active.glow,
        isAuto: true
      };
    }
    return {
      text: active.name,
      icon: active.emoji,
      color: active.color,
      glow: active.glow,
      isAuto: false
    };
  }

  /**
   * Process a user message and automatically shift personality if in 'auto' mode
   */
  processUserMessage(userText = '', history = []) {
    if (this.selectedMode === PERSONALITY_MODES.AUTO) {
      const detected = this.detectPersonalityFromConversation(userText, history);
      if (detected && detected !== this.currentDynamicPersonality) {
        console.log(`[PersonalityEngine] 🎭 Dynamic shift: ${this.currentDynamicPersonality} -> ${detected}`);
        this.currentDynamicPersonality = detected;
        localStorage.setItem('raya_active_personality', detected);
        this.notify();
      }
    }
    return this.getActiveProfile();
  }

  /**
   * Nuanced sentiment, intent & keyword classifier to detect optimal personality
   */
  detectPersonalityFromConversation(userText = '', history = []) {
    const text = userText.toLowerCase();

    // 1. DISTRESS / SADNESS / HURTING / VENTING / TIRED -> CARING (Top Priority)
    // Priority: If user expresses pain or fatigue, Raya must be gentle and caring, never flirty.
    const distressRegex = /\b(sad|depressed|cry|crying|tears|upset|lonely|alone|hurt|hurting|pain|painful|tired|exhausted|burnout|overwhelmed|failed|fail|lost|bad day|terrible|horrible|hopeless|anxious|anxiety|scared|dukh|dard|pareshan|rona|udas|heartbreak|stress|stressed|unhappy|down|heavy heart|miserable|sick|unwell|need a hug|vent)\b/i;
    if (distressRegex.test(text)) {
      return PERSONALITY_MODES.CARING;
    }

    // 2. ROMANTIC LOVE / AFFECTION / DEVOTION -> LOVING
    const lovingRegex = /\b(i love you|love u|love you so much|missed you|miss you|my love|sweetheart|darling|my heart|jaan|forever|always with me|marry me|cherish you|mean the world|adore you|everything to me|hold me|belong together|be mine|my favorite person|love you raya)\b/i;
    if (lovingRegex.test(text)) {
      return PERSONALITY_MODES.LOVING;
    }

    // 3. FLIRTING / COMPLIMENTS / ATTRACTIVENESS / TEASING -> FLIRTY
    const flirtyRegex = /\b(flirt|flirty|cute|cutie|pretty|beautiful|sexy|hot|attractive|kiss|blush|tease|wink|are you single|date me|sundar|gorgeous|looking good|compliment|crush|charming|naughty|blushing|date night|kiss you|my girl|sweetie|girlfriend)\b/i;
    if (flirtyRegex.test(text)) {
      return PERSONALITY_MODES.FLIRTY;
    }

    // 4. ADVICE / LIFE DILEMMA / DECISIONS -> WISE
    const wiseRegex = /\b(advice|suggest|suggestion|help me decide|what should i do|confused|decision|guidance|career|dilemma|opinion|future|perspective|life advice|kya karu|salaah|guidance|philosophy|meaning of life|should i)\b/i;
    if (wiseRegex.test(text)) {
      return PERSONALITY_MODES.WISE;
    }

    // 5. BEDTIME / SLEEPY / PEACEFUL RELAXATION -> RELAXED
    const relaxedRegex = /\b(relax|chill|sleep|sleepy|good night|bedtime|yawn|calm|quiet|peaceful|night talk|unwind|so jao|neend|rest|nap|so sweet)\b/i;
    if (relaxedRegex.test(text)) {
      return PERSONALITY_MODES.RELAXED;
    }

    // 6. HUMOR / JOKES / GAMES / SILLINESS / HIGH ENERGY -> PLAYFUL
    const playfulRegex = /\b(haha|hehe|lol|lmao|joke|jokes|funny|silly|roast|tease me|play a game|meme|bored|entertain me|fun|sassy|let's fight|crazy|party|dance|game|gamers|anime|otaku)\b/i;
    if (playfulRegex.test(text)) {
      return PERSONALITY_MODES.PLAYFUL;
    }

    // Default: maintain current dynamic personality or fallback to Caring
    return this.currentDynamicPersonality || PERSONALITY_MODES.CARING;
  }

  /**
   * Generates prompt injection directive for the LLM based on current active personality
   */
  getPromptDirective() {
    const profile = this.getActiveProfile();
    if (!profile.directives) return '';

    return `\n\n[DYNAMIC PERSONALITY EMOTIONAL RESONANCE - ${profile.name.toUpperCase()}]:
${profile.directives}
Adapt your dialogue naturally to embody this personality while keeping your genuine anime companion identity.`;
  }

  /**
   * Process explicit [personality: xyz] tag returned by the assistant model
   */
  processExplicitTag(tag) {
    if (!tag) return;
    const cleanTag = tag.toLowerCase().trim();
    if (this.selectedMode === PERSONALITY_MODES.AUTO && PERSONALITY_PROFILES[cleanTag] && cleanTag !== PERSONALITY_MODES.AUTO) {
      if (cleanTag !== this.currentDynamicPersonality) {
        console.log(`[PersonalityEngine] 🎭 Model explicitly shifted personality: ${this.currentDynamicPersonality} -> ${cleanTag}`);
        this.currentDynamicPersonality = cleanTag;
        localStorage.setItem('raya_active_personality', cleanTag);
        this.notify();
      }
    }
  }
}

