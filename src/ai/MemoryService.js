/**
 * MemoryService - Manages persistent data storage for Raya using Netlify Blobs Database
 * with fallback to client-side localStorage for offline resilience.
 */
export class MemoryService {
  constructor() {
    this.storageKey = 'raya_companion_memory';
    this.apiEndpoint = '/api/memory';
    this.memory = {
      userName: '',
      userInterests: [],
      facts: [
        'Companion Raya initialized with persistent database.',
        'Raya prefers warm, casual, friendly chats and companionship.'
      ],
      notes: 'Persistent companion memory managed by Netlify Blobs database.',
      conversationHighlights: [],
      updatedAt: new Date().toISOString()
    };

    this.isLoaded = false;
    this.onMemoryUpdate = null;
  }

  /**
   * Fetch memory from Netlify Database endpoint with localStorage fallback
   */
  async loadMemory() {
    // 1. First seed with local cache for instantaneous rendering
    try {
      const cached = localStorage.getItem(this.storageKey);
      if (cached) {
        this.memory = { ...this.memory, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('[MemoryService] Local cache read error:', e);
    }

    // 2. Fetch fresh synchronized state from Netlify Blobs Database
    try {
      const res = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: { credentials: 'omit' }
      });

      if (res.ok) {
        const remoteData = await res.json();
        if (remoteData && !remoteData.error) {
          this.memory = {
            ...this.memory,
            ...remoteData,
            userInterests: Array.from(new Set([...this.memory.userInterests, ...(remoteData.userInterests || [])])),
            facts: Array.from(new Set([...this.memory.facts, ...(remoteData.facts || [])]))
          };
          // Update local cache
          localStorage.setItem(this.storageKey, JSON.stringify(this.memory));
          console.log('[MemoryService] Loaded from Netlify Database:', this.memory);
        }
      }
    } catch (err) {
      console.log('[MemoryService] Netlify endpoint unavailable, operating in local-cache mode:', err.message);
    }

    this.isLoaded = true;
    if (this.onMemoryUpdate) this.onMemoryUpdate(this.memory);
    return this.memory;
  }

  getMemory() {
    return this.memory;
  }

  /**
   * Save or update memory in Netlify Blobs Database
   */
  async saveMemory(partial) {
    if (!partial || typeof partial !== 'object') return this.memory;

    // Merge in-memory
    this.memory = {
      ...this.memory,
      ...partial,
      userName: typeof partial.userName === 'string' ? partial.userName.trim() : this.memory.userName,
      userInterests: Array.isArray(partial.userInterests)
        ? Array.from(new Set([...this.memory.userInterests, ...partial.userInterests]))
        : this.memory.userInterests,
      facts: Array.isArray(partial.facts)
        ? Array.from(new Set([...this.memory.facts, ...partial.facts]))
        : this.memory.facts,
      updatedAt: new Date().toISOString()
    };

    // Save to local cache immediately
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.memory));
    } catch (e) {}

    // Persist to Netlify Blobs Database
    try {
      const res = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.memory) {
          this.memory = { ...this.memory, ...result.memory };
          localStorage.setItem(this.storageKey, JSON.stringify(this.memory));
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to sync to Netlify DB (saved locally):', err.message);
    }

    if (this.onMemoryUpdate) this.onMemoryUpdate(this.memory);
    return this.memory;
  }

  /**
   * Store a newly learned fact about the user
   */
  async addFact(fact) {
    if (!fact || typeof fact !== 'string') return;
    const trimmed = fact.trim();
    if (!trimmed || this.memory.facts.includes(trimmed)) return;

    return this.saveMemory({
      facts: [trimmed]
    });
  }

  /**
   * Set user preferred name
   */
  async setUserName(name) {
    if (!name || typeof name !== 'string') return;
    return this.saveMemory({ userName: name.trim() });
  }

  /**
   * Reset database memory
   */
  async resetMemory() {
    this.memory = {
      userName: '',
      userInterests: [],
      facts: [
        'Companion Raya initialized with Netlify Blobs persistent database.',
        'Raya prefers warm, casual, friendly chats and companionship.'
      ],
      notes: 'Persistent companion memory managed by Netlify Blobs database.',
      conversationHighlights: [],
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}

    try {
      await fetch(this.apiEndpoint, { method: 'DELETE' });
    } catch (err) {
      console.warn('[MemoryService] Failed to reset Netlify DB remotely:', err.message);
    }

    if (this.onMemoryUpdate) this.onMemoryUpdate(this.memory);
    return this.memory;
  }

  /**
   * Intelligently analyze user text to extract personal details
   */
  detectAndStoreLearnedFacts(userText = '') {
    if (!userText || typeof userText !== 'string') return;

    const trimmed = userText.trim();

    // 1. Detect User Name: "My name is X", "I'm X", "Mera naam X hai", "Call me X"
    const nameMatch =
      trimmed.match(/\b(?:my name is|i am|call me|mera naam|naam)\s+([A-Z][a-zA-Z]{1,15})\b/i) ||
      trimmed.match(/\b(?:main|mein)\s+([A-Z][a-zA-Z]{1,15})\s+hoon\b/i);

    if (nameMatch && nameMatch[1]) {
      const detectedName = nameMatch[1];
      const excludedWords = ['here', 'fine', 'good', 'happy', 'sad', 'ready', 'back', 'raya', 'doing', 'tired', 'bored', 'busy'];
      if (!excludedWords.includes(detectedName.toLowerCase()) && detectedName !== this.memory.userName) {
        console.log('[MemoryService] Discovered user name:', detectedName);
        this.setUserName(detectedName);
      }
    }

    // 2. Detect User Likes / Interests: "I like X", "I love X", "Mujhe X pasand hai"
    const likeMatch =
      trimmed.match(/\b(?:i really like|i like|i love|mujhe|mera favourite|my favorite)\s+([a-zA-Z0-9\s]{3,35})(?:\.|!|\?|$|,)/i);

    if (likeMatch && likeMatch[1]) {
      const interest = likeMatch[1].trim();
      const skipTerms = ['you', 'talking', 'this', 'chatting', 'it', 'to talk', 'that'];
      if (interest.length > 2 && interest.length < 35 && !skipTerms.includes(interest.toLowerCase())) {
        if (!this.memory.userInterests.includes(interest)) {
          console.log('[MemoryService] Discovered user interest:', interest);
          this.saveMemory({ userInterests: [interest] });
        }
      }
    }
  }
}
