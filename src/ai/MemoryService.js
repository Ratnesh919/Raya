/**
 * MemoryService - Manages persistent data storage for Raya using Netlify Blobs Database
 * with fallback to client-side localStorage for offline resilience.
 */
const EXCLUDED_NAME_WORDS = [
  'upset', 'sad', 'happy', 'tired', 'hungry', 'bored', 'fine', 'good', 'sick',
  'here', 'back', 'ready', 'sorry', 'okay', 'alright', 'busy', 'doing', 'feeling',
  'getting', 'lonely', 'excited', 'angry', 'confused', 'stressed', 'depressed',
  'not', 'just', 'still', 'always', 'also', 'really', 'very', 'a', 'an', 'the',
  'raya', 'crying', 'hurt', 'hurting', 'exhausted', 'hopeless', 'broken', 'lost',
  'unhappy', 'overwhelmed', 'down', 'dead', 'alive', 'well', 'bad', 'great', 'cool'
];

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

    // Sanitize any false emotion words mistakenly saved as userName (e.g. "upset")
    if (this.memory.userName && EXCLUDED_NAME_WORDS.includes(this.memory.userName.toLowerCase())) {
      console.log(`[MemoryService] Purged invalid stored name: "${this.memory.userName}"`);
      this.memory.userName = '';
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memory));
      } catch (e) {}
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

    // 1. Detect User Name: explicit name introductions ONLY
    let detectedName = null;

    // Explicit name introduction phrases
    const explicitMatch =
      trimmed.match(/\b(?:my name is|call me|you can call me|mera naam|naam hai)\s+([A-Za-z]{2,20})\b/i) ||
      trimmed.match(/\b(?:main|mein)\s+([A-Za-z]{2,20})\s+hoon\b/i);

    if (explicitMatch && explicitMatch[1]) {
      detectedName = explicitMatch[1];
    } else {
      // Secondary: "I am [Name]" or "I'm [Name]" - only if explicitly capitalized and NOT an emotion/status adjective
      const iamMatch = trimmed.match(/\b(?:i am|i'm)\s+([A-Z][a-zA-Z]{1,20})\b/);
      if (iamMatch && iamMatch[1]) {
        detectedName = iamMatch[1];
      }
    }

    if (detectedName) {
      const lower = detectedName.toLowerCase();
      if (!EXCLUDED_NAME_WORDS.includes(lower) && detectedName !== this.memory.userName) {
        console.log('[MemoryService] Discovered valid user name:', detectedName);
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
