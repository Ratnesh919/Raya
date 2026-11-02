import { DEFAULT_SYSTEM_PROMPT, parseRayaResponse } from './PromptEngine.js';

export const PROVIDERS = {
  NVIDIA: 'nvidia',
  GEMINI: 'gemini',
  GROQ: 'groq',
  OPENAI: 'openai',
  OPENROUTER: 'openrouter'
};

export const DEFAULT_MODELS = {
  [PROVIDERS.NVIDIA]: 'meta/llama-3.2-11b-vision-instruct',
  [PROVIDERS.GEMINI]: 'gemini-2.0-flash',
  [PROVIDERS.GROQ]: 'llama-3.3-70b-versatile',
  [PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [PROVIDERS.OPENROUTER]: 'meta-llama/llama-3.3-70b-instruct'
};

export class LLMService {
  constructor() {
    // Check .env defaults
    const envProvider = import.meta.env?.VITE_DEFAULT_PROVIDER || PROVIDERS.NVIDIA;
    this.provider = localStorage.getItem('raya_provider') || envProvider;

    // Seed localStorage from .env if empty
    this.seedDefaultKeys();

    this.apiKey = this.getApiKey(this.provider);
    this.model = localStorage.getItem(`raya_model_${this.provider}`) || DEFAULT_MODELS[this.provider];
    const savedPrompt = localStorage.getItem('raya_system_prompt');
    if (!savedPrompt || !localStorage.getItem('raya_prompt_v4')) {
      localStorage.setItem('raya_prompt_v4', 'true');
      localStorage.setItem('raya_system_prompt', DEFAULT_SYSTEM_PROMPT);
      this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    } else {
      this.systemPrompt = savedPrompt;
    }

    this.personalityEngine = null;
    this.memoryService = null;
    this.messages = [];
  }

  setPersonalityEngine(personalityEngine) {
    this.personalityEngine = personalityEngine;
  }

  setMemoryService(memoryService) {
    this.memoryService = memoryService;
  }

  getEffectiveSystemPrompt() {
    let base = this.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    if (this.personalityEngine) {
      base += this.personalityEngine.getPromptDirective();
    }
    if (this.memoryService) {
      const mem = this.memoryService.getMemory();
      if (mem) {
        const memParts = [];
        if (mem.userName) {
          memParts.push(`- User's Name: "${mem.userName}" (Address them warmly by name)`);
        }
        if (mem.userInterests && mem.userInterests.length > 0) {
          memParts.push(`- User's Favorite Topics/Interests: ${mem.userInterests.join(', ')}`);
        }
        if (mem.facts && mem.facts.length > 0) {
          memParts.push(`- Stored Facts & Past Memories:\n  • ${mem.facts.join('\n  • ')}`);
        }
        if (memParts.length > 0) {
          base += `\n\n[PERSISTENT COMPANION MEMORY (STORED IN NETLIFY DATABASE)]:\n${memParts.join('\n')}\nUse these stored details naturally so the user feels truly remembered across visits!`;
        }
      }
    }
    return base;
  }

  seedDefaultKeys() {
    const env = import.meta.env || {};
    if (!localStorage.getItem(`raya_key_${PROVIDERS.NVIDIA}`) && env.VITE_NVIDIA_API_KEY) {
      localStorage.setItem(`raya_key_${PROVIDERS.NVIDIA}`, env.VITE_NVIDIA_API_KEY);
    }
    if (!localStorage.getItem(`raya_key_${PROVIDERS.GROQ}`) && env.VITE_GROQ_API_KEY) {
      localStorage.setItem(`raya_key_${PROVIDERS.GROQ}`, env.VITE_GROQ_API_KEY);
    }
    if (!localStorage.getItem(`raya_key_${PROVIDERS.GEMINI}`) && env.VITE_GEMINI_API_KEY) {
      localStorage.setItem(`raya_key_${PROVIDERS.GEMINI}`, env.VITE_GEMINI_API_KEY);
    }
    if (!localStorage.getItem(`raya_key_${PROVIDERS.OPENROUTER}`) && env.VITE_OPENROUTER_API_KEY) {
      localStorage.setItem(`raya_key_${PROVIDERS.OPENROUTER}`, env.VITE_OPENROUTER_API_KEY);
    }
  }

  setProvider(provider) {
    this.provider = provider;
    this.apiKey = this.getApiKey(provider);
    this.model = localStorage.getItem(`raya_model_${provider}`) || DEFAULT_MODELS[provider];
    localStorage.setItem('raya_provider', provider);
  }

  setApiKey(key, provider = this.provider) {
    localStorage.setItem(`raya_key_${provider}`, key);
    if (provider === this.provider) {
      this.apiKey = key;
    }
  }

  getApiKey(provider = this.provider) {
    const env = import.meta.env || {};
    const envMap = {
      [PROVIDERS.NVIDIA]: env.VITE_NVIDIA_API_KEY,
      [PROVIDERS.GROQ]: env.VITE_GROQ_API_KEY,
      [PROVIDERS.GEMINI]: env.VITE_GEMINI_API_KEY,
      [PROVIDERS.OPENROUTER]: env.VITE_OPENROUTER_API_KEY,
      [PROVIDERS.OPENAI]: env.VITE_OPENAI_API_KEY
    };
    return envMap[provider] || localStorage.getItem(`raya_key_${provider}`) || '';
  }

  setModel(model, provider = this.provider) {
    localStorage.setItem(`raya_model_${provider}`, model);
    if (provider === this.provider) {
      this.model = model;
    }
  }

  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
    localStorage.setItem('raya_system_prompt', prompt);
  }

  clearHistory() {
    this.messages = [];
  }

  async sendMessage(userText) {
    if (!this.apiKey) {
      throw new Error(`Please enter your ${this.provider.toUpperCase()} API key in Settings to chat with Raya.`);
    }

    // Adapt dynamic personality to the user's message before calling the LLM
    if (this.personalityEngine) {
      this.personalityEngine.processUserMessage(userText, this.messages);
    }

    // Append user message
    this.messages.push({ role: 'user', content: userText });

    // Keep history bounded to last 14 turns
    if (this.messages.length > 14) {
      this.messages = this.messages.slice(-14);
    }

    let replyText = '';

    if (this.provider === PROVIDERS.NVIDIA) {
      replyText = await this.callNvidia();
    } else if (this.provider === PROVIDERS.GEMINI) {
      replyText = await this.callGemini();
    } else if (this.provider === PROVIDERS.GROQ) {
      replyText = await this.callGroq();
    } else if (this.provider === PROVIDERS.OPENAI) {
      replyText = await this.callOpenAI();
    } else if (this.provider === PROVIDERS.OPENROUTER) {
      replyText = await this.callOpenRouter();
    } else {
      throw new Error(`Unsupported provider: ${this.provider}`);
    }

    // Append assistant reply
    this.messages.push({ role: 'assistant', content: replyText });

    // Parse actions, emotions, personality tags and clean speech text
    const parsed = parseRayaResponse(replyText);
    if (parsed.personality && this.personalityEngine) {
      this.personalityEngine.processExplicitTag(parsed.personality);
    }
    return parsed;
  }

  /**
   * Calling AI Agent Streaming Pipeline:
   * Streams tokens in real-time, buffering them into clean spoken sentence chunks.
   * Dispatches the first sentence within ~300ms so TTS begins speaking with zero awkward silence.
   */
  async sendMessageStream(userText, onSentenceChunk, onFullResponse) {
    if (!this.apiKey) {
      throw new Error(`Please enter your ${this.provider.toUpperCase()} API key in Settings to chat with Raya.`);
    }

    if (this.personalityEngine) {
      this.personalityEngine.processUserMessage(userText, this.messages);
    }

    this.messages.push({ role: 'user', content: userText });
    if (this.messages.length > 14) {
      this.messages = this.messages.slice(-14);
    }

    let fullAccumulated = '';
    let sentenceBuffer = '';
    let isFirstChunk = true;
    let extractedEmotion = null;
    let extractedAction = null;

    const dispatchSentence = (rawSentence, isFirst) => {
      let clean = rawSentence
        .replace(/\[emotion:\s*([a-zA-Z0-9_-]+)\]/gi, (m, em) => {
          if (!extractedEmotion) extractedEmotion = em.toLowerCase();
          return '';
        })
        .replace(/\[action:\s*([a-zA-Z0-9_-]+)\]/gi, (m, ac) => {
          if (!extractedAction) extractedAction = ac.toLowerCase();
          return '';
        })
        .replace(/\[personality:\s*[a-zA-Z0-9_-]+\]/gi, '')
        .replace(/\[.*?\]/g, '')
        .replace(/[*_#~`\\]/g, '')
        .trim();

      if (clean && clean.length > 1) {
        if (onSentenceChunk) {
          onSentenceChunk(clean, isFirst, { emotion: extractedEmotion, action: extractedAction });
        }
      }
    };

    const handleToken = (token) => {
      fullAccumulated += token;
      sentenceBuffer += token;

      const emoMatch = /\[emotion:\s*([a-zA-Z0-9_-]+)\]/i.exec(sentenceBuffer);
      if (emoMatch && !extractedEmotion) {
        extractedEmotion = emoMatch[1].toLowerCase();
      }
      const actMatch = /\[action:\s*([a-zA-Z0-9_-]+)\]/i.exec(sentenceBuffer);
      if (actMatch && !extractedAction) {
        extractedAction = actMatch[1].toLowerCase();
      }

      // Check for sentence boundary: punctuation (. ! ? \n) followed by whitespace or boundary
      const punctMatch = sentenceBuffer.match(/([.!?]+(\s+|$))|(\n+)/);
      if (punctMatch) {
        const endPos = punctMatch.index + punctMatch[0].length;
        const sentence = sentenceBuffer.slice(0, endPos).trim();
        sentenceBuffer = sentenceBuffer.slice(endPos);
        if (sentence) {
          dispatchSentence(sentence, isFirstChunk);
          isFirstChunk = false;
        }
      } else if (sentenceBuffer.length > 90) {
        // Soft pause boundary for natural pacing on long compound sentences
        const clauseMatch = sentenceBuffer.match(/([,;:]\s+)/);
        if (clauseMatch && clauseMatch.index > 35) {
          const endPos = clauseMatch.index + clauseMatch[0].length;
          const clause = sentenceBuffer.slice(0, endPos).trim();
          sentenceBuffer = sentenceBuffer.slice(endPos);
          if (clause) {
            dispatchSentence(clause, isFirstChunk);
            isFirstChunk = false;
          }
        }
      }
    };

    try {
      if (this.provider === PROVIDERS.NVIDIA) {
        await this.callNvidiaStream(handleToken);
      } else if (this.provider === PROVIDERS.GEMINI) {
        await this.callGeminiStream(handleToken);
      } else if (this.provider === PROVIDERS.GROQ) {
        await this.callOpenAICompatibleStream('https://api.groq.com/openai/v1/chat/completions', {}, handleToken);
      } else if (this.provider === PROVIDERS.OPENAI) {
        await this.callOpenAICompatibleStream('https://api.openai.com/v1/chat/completions', {}, handleToken);
      } else if (this.provider === PROVIDERS.OPENROUTER) {
        await this.callOpenAICompatibleStream('https://openrouter.ai/api/v1/chat/completions', {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Raya AI Assistant'
        }, handleToken);
      } else {
        throw new Error(`Unsupported stream provider: ${this.provider}`);
      }
    } catch (streamErr) {
      console.warn('[LLMService] Stream failed, falling back to batch sendMessage:', streamErr);
      if (!fullAccumulated) {
        const batchParsed = await this.sendMessage(userText);
        if (onSentenceChunk) {
          onSentenceChunk(batchParsed.speechText, true, { emotion: batchParsed.emotion, action: batchParsed.action });
        }
        if (onFullResponse) {
          onFullResponse(batchParsed);
        }
        return batchParsed;
      }
    }

    // Flush any leftover text in sentenceBuffer
    if (sentenceBuffer.trim()) {
      dispatchSentence(sentenceBuffer.trim(), isFirstChunk);
    }

    this.messages.push({ role: 'assistant', content: fullAccumulated });

    const parsed = parseRayaResponse(fullAccumulated);
    if (extractedEmotion && !parsed.emotion) parsed.emotion = extractedEmotion;
    if (extractedAction && !parsed.action) parsed.action = extractedAction;

    if (parsed.personality && this.personalityEngine) {
      this.personalityEngine.processExplicitTag(parsed.personality);
    }

    if (onFullResponse) {
      onFullResponse(parsed);
    }

    return parsed;
  }

  async callNvidia() {
    // Model candidates in case primary hits 404 or 410 EOL
    const modelsToTry = [
      this.model,
      'meta/llama-3.2-11b-vision-instruct',
      'meta/llama-3.2-90b-vision-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-large-2-instruct'
    ];

    // Try proxy endpoint first to bypass browser CORS, fallback to direct
    const endpoints = ['/api/nvidia/chat/completions', 'https://integrate.api.nvidia.com/v1/chat/completions'];
    let lastErr = null;

    for (const endpoint of endpoints) {
      for (const m of [...new Set(modelsToTry)]) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              model: m,
              messages: [
                { role: 'system', content: this.getEffectiveSystemPrompt() },
                ...this.messages
              ],
              temperature: 0.75,
              max_tokens: 350
            })
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.detail || errJson.message || `HTTP ${res.status}`);
          }

          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            this.model = m;
            return text;
          }
        } catch (err) {
          lastErr = err;
          console.warn(`[NVIDIA NIM] Failed on ${endpoint} (${m}):`, err.message);
        }
      }
    }

    throw lastErr || new Error('NVIDIA NIM API failed to generate response.');
  }

  async callGemini() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const contents = [];
    const systemInstruction = {
      role: 'user',
      parts: [{ text: this.getEffectiveSystemPrompt() }]
    };

    this.messages.forEach((msg) => {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    });

    const body = {
      system_instruction: systemInstruction,
      contents,
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 350
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `Gemini API error (${res.status})`;
      throw new Error(msg);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Received empty response from Gemini.');
    }
    return text;
  }

  async callOpenAICompatible(baseUrl, defaultHeaders = {}) {
    const messages = [
      { role: 'system', content: this.getEffectiveSystemPrompt() },
      ...this.messages
    ];

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...defaultHeaders
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.75,
        max_tokens: 350
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `API error (${res.status})`;
      throw new Error(msg);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Empty response from AI provider.');
    }
    return text;
  }

  async callGroq() {
    return this.callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions');
  }

  async callOpenAI() {
    return this.callOpenAICompatible('https://api.openai.com/v1/chat/completions');
  }

  async callOpenRouter() {
    return this.callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', {
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Raya AI Assistant'
    });
  }

  async callOpenAICompatibleStream(baseUrl, defaultHeaders = {}, onToken) {
    const messages = [
      { role: 'system', content: this.getEffectiveSystemPrompt() },
      ...this.messages
    ];

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...defaultHeaders
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.75,
        max_tokens: 350,
        stream: true
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || errJson.detail || `API error (${res.status})`;
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') return;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const text = json.choices?.[0]?.delta?.content;
              if (text) {
                onToken(text);
              }
            } catch (e) {}
          }
        }
      }
    }
  }

  async callNvidiaStream(onToken) {
    const modelsToTry = [
      this.model,
      'meta/llama-3.2-11b-vision-instruct',
      'meta/llama-3.2-90b-vision-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-large-2-instruct'
    ];
    const endpoints = ['/api/nvidia/chat/completions', 'https://integrate.api.nvidia.com/v1/chat/completions'];
    let lastErr = null;

    for (const endpoint of endpoints) {
      for (const m of [...new Set(modelsToTry)]) {
        try {
          this.model = m;
          await this.callOpenAICompatibleStream(endpoint, {}, onToken);
          return;
        } catch (err) {
          lastErr = err;
          console.warn(`[NVIDIA NIM Stream] Failed on ${endpoint} (${m}):`, err.message);
        }
      }
    }
    throw lastErr || new Error('NVIDIA NIM Stream failed.');
  }

  async callGeminiStream(onToken) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const contents = [];
    const systemInstruction = {
      role: 'user',
      parts: [{ text: this.getEffectiveSystemPrompt() }]
    };

    this.messages.forEach((msg) => {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    });

    const body = {
      system_instruction: systemInstruction,
      contents,
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 350
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `Gemini API error (${res.status})`;
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                onToken(text);
              }
            } catch (e) {}
          }
        }
      }
    }
  }
}
