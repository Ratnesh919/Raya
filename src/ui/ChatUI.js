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
    this.expressionManager.setEmotion('think', 0.8);

    try {
      const response = await this.llmService.sendMessage(text);

      // Analyze conversational sentiment across user query and assistant response
      const sentiment = this.analyzeChatSentiment(text, response.speechText);
      const finalEmotion = response.emotion || sentiment.emotion || 'happy';

      // Trigger facial emotion with smooth auto-reset (avatar stays in natural fluid idle)
      this.expressionManager.setEmotionWithAutoReset(finalEmotion, 5500);

      // Clean speech text
      const cleanSpeech = (response.speechText || '').replace(/\[.*?\]/g, '').replace(/[*_#~`]/g, '').trim();

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
   * Intelligently deduce facial expression and body gesture from conversational sentiment
   */
  analyzeChatSentiment(userText = '', assistantText = '') {
    const combined = `${userText} ${assistantText}`.toLowerCase();

    // 1. Sitting gesture
    if (/\b(sit|sitting|sit down|chair|baitho|baith ja|relax on chair|sofa)\b/i.test(combined)) {
      return { emotion: 'relaxed', action: 'sitting' };
    }

    // 2. Greetings & Warmth
    if (/\b(namaste|pranam|hello|hi|hey|greet|welcome|kemon acho|kaise ho|kaisi ho)\b/i.test(combined)) {
      return { emotion: 'relaxed', action: 'wave' };
    }

    // 3. Playful / Flirty / Tease / Wink
    if (/\b(cute|pretty|beautiful|flirt|wink|tease|smart|gorgeous|sweetheart|sundar|shh|secret|chalo|naughty)\b/i.test(combined)) {
      return { emotion: 'wink', action: 'happy' };
    }

    // 4. Surprise / Wonder / Amazement
    if (/\b(wow|whoa|omg|really\?|unbelievable|astonishing|incredible|shocking|amazing|no way|sach|sach mein)\b/i.test(combined)) {
      return { emotion: 'surprised', action: 'excited' };
    }

    // 5. Joy / Laughter / Excitement
    if (/\b(haha|lmao|lol|funny|yay|hurray|awesome|great|super|fantastic|party|excited|khushi|badhiya|maza|dhamaka)\b/i.test(combined)) {
      return { emotion: 'happy', action: 'happy' };
    }

    // 6. Deep Thought / Curious / Inquiry
    if (/\b(\?|why|how|what if|reason|wonder|ponder|think|curious|kyun|kaise|kya|socho|batao)\b/i.test(combined)) {
      return { emotion: 'think', action: null };
    }

    // 7. Sadness / Comfort / Empathy
    if (/\b(sad|sorry|cry|crying|upset|heartbroken|lonely|alone|exhausted|tired|depressed|dukh|dard|pareshan|thak gaya)\b/i.test(combined)) {
      return { emotion: 'sad', action: 'sad' };
    }

    // 8. Sleepy / Night / Yawn
    if (/\b(sleep|sleepy|yawn|good night|so jao|neend|shubh ratri)\b/i.test(combined)) {
      return { emotion: 'relaxed', action: 'yawn' };
    }

    // 9. Anger / Refusal
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
