export class ChatUI {
  constructor({ llmService, voiceService, expressionManager, animationEngine, vrmManager, memoryService }) {
    this.llmService = llmService;
    this.voiceService = voiceService;
    this.expressionManager = expressionManager;
    this.animationEngine = animationEngine;
    this.vrmManager = vrmManager;
    this.memoryService = memoryService;

    this.chatDrawerEl = document.getElementById('chat-drawer');
    this.messagesListEl = document.getElementById('messages-list');
    this.chatInputEl = document.getElementById('chat-input');
    this.sendBtnEl = document.getElementById('btn-send');
    this.micBtnEl = document.getElementById('btn-mic');
    this.drawerToggleBtn = document.getElementById('btn-toggle-drawer');
    this.drawerCloseBtn = document.getElementById('btn-close-drawer');

    // Memory status elements (Netlify Blobs DB)
    this.memoryUserNameEl = document.getElementById('memory-user-name');
    this.memoryFactsSummaryEl = document.getElementById('memory-facts-summary');
    this.btnResetMemoryEl = document.getElementById('btn-reset-memory');

    this.thinkingItemEl = null;
    this.isProcessing = false;

    this.setupListeners();
    this.setupMemoryUI();
  }

  setupListeners() {
    // Send message on Enter or Click
    this.sendBtnEl?.addEventListener('click', () => this.handleSendMessage());
    this.chatInputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Drawer toggle state synchronization
    const updateDrawerState = (isOpen) => {
      document.body.classList.toggle('drawer-open', isOpen);
      document.getElementById('app-overlay')?.classList.toggle('drawer-open', isOpen);
    };

    if (this.chatDrawerEl?.classList.contains('open')) {
      updateDrawerState(true);
    }

    this.drawerToggleBtn?.addEventListener('click', () => {
      const isOpen = this.chatDrawerEl?.classList.toggle('open');
      updateDrawerState(!!isOpen);
      if (isOpen) {
        this.drawerToggleBtn?.classList.remove('has-unread');
      }
    });
    this.drawerCloseBtn?.addEventListener('click', () => {
      this.chatDrawerEl?.classList.remove('open');
      updateDrawerState(false);
    });

    // Mic button
    this.micBtnEl?.addEventListener('click', () => {
      this.voiceService.toggleListening(true);
    });

    // Voice recognition hooks
    this.voiceService.onSpeechStatus = (status) => {
      if (status === 'listening') {
        this.micBtnEl?.classList.add('listening');
      } else {
        this.micBtnEl?.classList.remove('listening');
      }
    };

    this.voiceService.onInterimTranscript = (text) => {
      if (text) {
        this.chatInputEl.value = text;
      }
    };

    this.voiceService.onSpeechResult = (query) => {
      this.chatInputEl.value = query;
      this.handleSendMessage();
    };
  }

  async handleSendMessage() {
    const text = this.chatInputEl.value.trim();
    if (!text || this.isProcessing) return;

    this.isProcessing = true;
    this.chatInputEl.value = '';

    // Automatically detect and remember user facts in Netlify Blobs Database
    if (this.memoryService) {
      this.memoryService.detectAndStoreLearnedFacts(text);
    }

    // Append to chat drawer history (drawer remains closed unless message icon is clicked)
    this.addMessageToDrawer('user', text);

    // Strict chat-only guard: prevent coding requests
    const isCodingRequest =
      /\b(write|generate|debug|fix|create|solve|implement)\b.*\b(code|script|program|function|class|algorithm|regex|sql|python|javascript|typescript|c\+\+|java|html|css|bug)\b/i.test(text) ||
      /\b(print\(|console\.log|function\s*\(|def\s+[a-zA-Z]|public\s+static\s+void|void\s+main|import\s+sys|#include)\b/i.test(text);

    if (isCodingRequest) {
      const declineMsg = "I'm strictly your companion for casual chats and company, not for writing code or programming! Tell me how your day went, what games or anime you love, or anything on your mind instead! ✨";
      this.expressionManager.setEmotionWithAutoReset('happy', 4500);
      this.voiceService.speak(declineMsg);
      this.addMessageToDrawer('assistant', declineMsg);
      this.isProcessing = false;
      return;
    }

    // Show thinking indicator in drawer
    this.showThinkingIndicator();

    // Instant empathetic facial reaction to the user's message tone while waiting for LLM
    const userIntent = this.analyzeUserIntentEmotion(text);
    this.expressionManager.setEmotion(userIntent.emotion, userIntent.intensity || 0.8);
    if (this.animationEngine && (userIntent.emotion === 'curiosity' || userIntent.emotion === 'think' || userIntent.emotion === 'advice')) {
      this.animationEngine.playAnimation('think', 0.5);
    }

    try {
      const response = await this.llmService.sendMessage(text);

      // Analyze conversational sentiment across user query and assistant response
      const sentiment = this.analyzeChatSentiment(text, response.speechText);
      let finalEmotion = response.emotion || sentiment.emotion || 'caring';

      // Guard against inappropriate happy/joy smiles when the user expresses distress/sadness/upset
      const isUserDistressed = /\b(upset|sad|depressed|cry|crying|tears|unhappy|lonely|alone|heartbreak|heartbroken|loss|hurt|hurting|pain|painful|tired|exhausted|burnout|overwhelmed|failed|fail|lost|bad day|terrible|horrible|hopeless|anxious|anxiety|scared|dukh|dard|pareshan|rona|udas|heavy heart|miserable)\b/i.test(text);
      if (isUserDistressed && (finalEmotion === 'happy' || finalEmotion === 'joy' || finalEmotion === 'wink')) {
        finalEmotion = sentiment.emotion || 'caring';
      }

      // Clean speech text
      const cleanSpeech = (response.speechText || '').replace(/\[.*?\]/g, '').replace(/[*_#~`]/g, '').trim();

      // Dynamically calculate speech duration for smooth auto-reset matching the spoken duration
      const wordCount = cleanSpeech.split(/\s+/).length;
      const speechDurationMs = Math.max(5000, (wordCount / 2.6) * 1000 + 2500);

      // Trigger facial emotion with smooth auto-reset
      this.expressionManager.setEmotionWithAutoReset(finalEmotion, speechDurationMs);

      // Trigger communicative gesture animation (avoiding any sitting animation)
      if (this.animationEngine) {
        let actionToPlay = response.action || sentiment.action;
        if (actionToPlay && typeof actionToPlay === 'string' && actionToPlay.toLowerCase().includes('sit')) {
          actionToPlay = null; // Strictly avoid sitting
        }

        if (actionToPlay) {
          this.animationEngine.playAnimation(actionToPlay, 0.4);
        } else if (finalEmotion === 'think' || finalEmotion === 'advice' || finalEmotion === 'curiosity') {
          this.animationEngine.playAnimation('think', 0.4);
        } else if (finalEmotion === 'joy' || finalEmotion === 'excited') {
          this.animationEngine.playAnimation('happy', 0.4);
        } else if (finalEmotion === 'sad') {
          this.animationEngine.playAnimation('sad', 0.4);
        } else if (finalEmotion === 'angry') {
          this.animationEngine.playAnimation('angry', 0.4);
        }
      }

      // Remove thinking indicator, speak voice synthesis, and display in drawer
      this.removeThinkingIndicator();
      this.voiceService.speak(cleanSpeech);
      this.addMessageToDrawer('assistant', cleanSpeech);
      if (!this.chatDrawerEl?.classList.contains('open')) {
        this.drawerToggleBtn?.classList.add('has-unread');
      }
    } catch (err) {
      console.error('[ChatUI] Message error:', err);
      this.removeThinkingIndicator();
      const errMsg = err.message || 'Something went wrong.';
      this.expressionManager.setEmotionWithAutoReset('sad', 4000);
      this.addMessageToDrawer('assistant', `⚠️ ${errMsg}`);
      if (!this.chatDrawerEl?.classList.contains('open')) {
        this.drawerToggleBtn?.classList.add('has-unread');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Instantly detect user's emotional state from their message so Raya reacts before LLM generation
   */
  analyzeUserIntentEmotion(userText = '') {
    const text = userText.toLowerCase();

    // 1. Distress / Sadness / Loneliness / Venting / Upset (Instant Caring / Empathy)
    // Priority: Even if user says "hi i am upset", emotional distress takes precedence over greeting!
    if (/\b(upset|sad|depressed|cry|crying|tears|unhappy|lonely|alone|heartbreak|heartbroken|died|loss|hurt|hurting|pain|painful|tired|exhausted|burnout|overwhelmed|failed|fail|lost|bad day|terrible|horrible|hopeless|anxious|anxiety|scared|scary|dar|dukh|dard|pareshan|rona|udas|thak gaya|heavy heart|miserable|down|troubled)\b/i.test(text)) {
      return { emotion: 'caring', intensity: 0.95 };
    }

    // 2. Flirting / Compliments / Sweetness (Instant Blush)
    if (/\b(cute|pretty|beautiful|gorgeous|attractive|marry|love you|pyar|pyaar|sundar|sweetheart|babe|darling|crush|hot|sexy|blush|kiss)\b/i.test(text)) {
      return { emotion: 'blush', intensity: 0.95 };
    }

    // 3. Seeking Advice / Help / Decision (Thoughtful & Attentive)
    if (/\b(advice|suggest|suggestion|help me|what should i do|confused|decide|decision|guidance|opinion|what do you think|kaise karu|kya karu|salaah|upay)\b/i.test(text)) {
      return { emotion: 'advice', intensity: 0.85 };
    }

    // 4. Excitement / Joy / Good News / Win (Radiant Joy)
    if (/\b(yay|hurray|awesome|won|passed|promoted|success|great news|good news|celebrate|happy|excited|omg|wow|badhiya|maza|party)\b/i.test(text)) {
      return { emotion: 'joy', intensity: 0.95 };
    }

    // 5. Questions / Curiosity
    if (/\?|\b(why|how|what|tell me|who|when|where|kyun|kaise|kya)\b/i.test(text)) {
      return { emotion: 'curiosity', intensity: 0.8 };
    }

    // 6. Bedtime / Calming
    if (/\b(sleep|sleepy|yawn|good night|so jao|neend|shubh ratri)\b/i.test(text)) {
      return { emotion: 'relaxed', intensity: 0.85 };
    }

    return { emotion: 'think', intensity: 0.75 };
  }

  /**
   * Intelligently deduce facial expression and body gesture from conversational sentiment
   */
  analyzeChatSentiment(userText = '', assistantText = '') {
    const uText = userText.toLowerCase();
    const aText = assistantText.toLowerCase();
    const combined = `${uText} ${aText}`;

    // 1. Relax / Calm (Avoiding sitting animation per user instruction)
    if (/\b(sit|sitting|sit down|chair|baitho|baith ja|relax on chair|sofa)\b/i.test(combined)) {
      return { emotion: 'relaxed', action: null };
    }

    // 2. USER DISTRESS / UPSET / SAD (Top Priority over generic greetings)
    // If the user expressed sadness or distress, always console them with open-eyed caring!
    if (/\b(upset|sad|depressed|cry|crying|tears|unhappy|lonely|alone|heartbreak|heartbroken|loss|hurt|hurting|pain|painful|tired|exhausted|burnout|overwhelmed|failed|fail|lost|bad day|terrible|horrible|hopeless|anxious|anxiety|scared|dukh|dard|pareshan|rona|udas|heavy heart|miserable)\b/i.test(uText)) {
      return { emotion: 'caring', action: null };
    }

    // 3. Consoling & Comforting in Assistant response
    if (/\b(here for you|it will be okay|it's okay|take a deep breath|don't worry|i'm so sorry|gentle hug|so sorry|be alright|i understand|proud of you|you're strong|right here with you|with you|chinta mat|sab theek|mat ro|main hoon na|weighing heavily|all ears|listen|won't judge)\b/i.test(combined)) {
      return { emotion: 'console', action: null };
    }

    // 4. Caring / Deep Empathy / Listening
    if (/\b(feel you|hear you|listening|care about you|exhausting|overwhelming|difficult|tough|vent|let it out|safe with me|take your time|meri jaan|dost)\b/i.test(combined)) {
      return { emotion: 'caring', action: null };
    }

    // 5. Giving Advice / Suggestions / Perspective
    if (/\b(suggest|recommend|advice|try this|first step|step by step|focus on|break it down|perspective|start by|consider|solution|salaah|upay|raasta)\b/i.test(combined)) {
      return { emotion: 'advice', action: null };
    }

    // 6. Compliments / Flirting / Blushing
    if (/\b(blush|flattered|thank you so much|sweet of you|you're sweet|making me blush|shy|flirt|giggle|aww|awww|sharma)\b/i.test(combined)) {
      return { emotion: 'blush', action: 'happy' };
    }

    // 7. Surprise / Wonder / Amazement
    if (/\b(wow|whoa|omg|really\?|unbelievable|astonishing|incredible|shocking|amazing|no way|sach|sach mein)\b/i.test(combined)) {
      return { emotion: 'surprised', action: 'excited' };
    }

    // 8. Joy / Laughter / Excitement
    if (/\b(haha|lmao|lol|funny|yay|hurray|awesome|great|super|fantastic|party|excited|khushi|badhiya|maza|dhamaka)\b/i.test(combined)) {
      return { emotion: 'joy', action: 'happy' };
    }

    // 9. Greetings & Warmth (Only if NOT in distress)
    if (/\b(namaste|pranam|hello|hi|hey|greet|welcome|kemon acho|kaise ho|kaisi ho)\b/i.test(combined)) {
      return { emotion: 'happy', action: 'wave' };
    }

    // 10. Deep Thought / Curiosity / Inquiry
    if (/\b(\?|why|how|what if|reason|wonder|ponder|think|curious|kyun|kaise|kya|socho|batao)\b/i.test(combined)) {
      return { emotion: 'curiosity', action: null };
    }

    // 11. Sleepy / Night / Yawn
    if (/\b(sleep|sleepy|yawn|good night|so jao|neend|shubh ratri)\b/i.test(combined)) {
      return { emotion: 'relaxed', action: 'yawn' };
    }

    return { emotion: 'caring', action: null };

    // 11. Anger / Refusal
    if (/\b(no|never|stop|hate|angry|mad|gussa|nahi|mat karo)\b/i.test(combined)) {
      return { emotion: 'angry', action: 'no' };
    }

    return { emotion: 'happy', action: null };
  }

  showThinkingIndicator() {
    this.removeThinkingIndicator();
    if (!this.messagesListEl) return;
    const item = document.createElement('div');
    item.className = 'message-item assistant thinking';
    item.id = 'chat-thinking-indicator';
    item.innerHTML = '<span style="opacity: 0.7; font-style: italic;">Raya is thinking...</span>';
    this.messagesListEl.appendChild(item);
    this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
    this.thinkingItemEl = item;
  }

  removeThinkingIndicator() {
    if (this.thinkingItemEl && this.thinkingItemEl.parentNode) {
      this.thinkingItemEl.parentNode.removeChild(this.thinkingItemEl);
    }
    this.thinkingItemEl = null;
  }

  // Safe backwards-compatible method (forwards message to conversation drawer)
  showSpeechBubble(fullText, emotion = 'neutral') {
    if (fullText && fullText !== 'thinking...') {
      this.addMessageToDrawer('assistant', fullText);
    }
  }

  addMessageToDrawer(role, text) {
    if (!this.messagesListEl || !text) return;
    const item = document.createElement('div');
    item.className = `message-item ${role}`;
    item.textContent = text;
    this.messagesListEl.appendChild(item);
    this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
  }

  setupMemoryUI() {
    if (!this.memoryService) return;

    this.memoryService.onMemoryUpdate = (mem) => {
      this.renderMemoryStatus(mem);
    };

    // Initial render
    this.renderMemoryStatus(this.memoryService.getMemory());

    // Reset memory button listener
    this.btnResetMemoryEl?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm("Reset Raya's Netlify database memory? She will forget personal facts across visits.")) {
        await this.memoryService.resetMemory();
        this.addMessageToDrawer('assistant', "I've reset my database memory. Let's start fresh! ✨");
      }
    });
  }

  renderMemoryStatus(mem) {
    if (!mem) return;
    if (this.memoryUserNameEl) {
      this.memoryUserNameEl.textContent = mem.userName || 'Friend';
    }
    if (this.memoryFactsSummaryEl) {
      const factCount = mem.facts?.length || 0;
      const interests = (mem.userInterests || []).slice(0, 3).join(', ');
      if (interests) {
        this.memoryFactsSummaryEl.textContent = `Interests: ${interests} (${factCount} facts stored)`;
      } else if (factCount > 0) {
        this.memoryFactsSummaryEl.textContent = `Stored ${factCount} companion memories in database.`;
      } else {
        this.memoryFactsSummaryEl.textContent = 'Persistent storage active via Netlify Blobs.';
      }
    }
  }
}
