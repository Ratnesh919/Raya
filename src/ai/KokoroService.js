/**
 * Kokoro Neural TTS Service (100% In-Browser Local AI Voice)
 * Powered by hexgrad/Kokoro-82M via kokoro-js (Transformers.js + ONNX Runtime Web)
 * $0 cost, unlimited synthesis, human-grade studio quality speech.
 */

// Mapping of supported languages in kokoro-js v1.2.1
// kokoro-js in-browser engine currently supports English ('en-US', 'en-GB', 'en-IN').
// Hindi, Bengali, Punjabi, Gujarati, etc. are automatically routed to the Web Speech Natural voice engine.
export const KOKORO_SUPPORTED_LANGS = ['en'];

export const KOKORO_VOICES = {
  // English Female Voices (Verified Grade A/B in kokoro-js)
  'af_heart': { name: 'Heart (American Warm & Lively — Grade A Studio Quality)', lang: 'en-US', gender: 'female' },
  'af_bella': { name: 'Bella (American Energetic — Grade A-)', lang: 'en-US', gender: 'female' },
  'af_sarah': { name: 'Sarah (American Natural Soft)', lang: 'en-US', gender: 'female' },
  'af_nicole': { name: 'Nicole (American Expressive)', lang: 'en-US', gender: 'female' },
  'bf_emma': { name: 'Emma (British Natural)', lang: 'en-GB', gender: 'female' },
  'bf_isabella': { name: 'Isabella (British Soft)', lang: 'en-GB', gender: 'female' }
};

export class KokoroService {
  constructor(lipSyncEngine) {
    this.lipSyncEngine = lipSyncEngine;
    this.tts = null;
    this.status = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
    this.loadPromise = null;
    this.currentAudioEl = null;
    this.currentBlobUrl = null;
    this.isSpeaking = false;
    this.speed = parseFloat(localStorage.getItem('raya_kokoro_speed') || '1.05');
    this.selectedVoice = localStorage.getItem('raya_kokoro_voice') || 'af_heart';
    this.loadProgress = 0;
  }

  /**
   * Check if browser environment supports WebAssembly and audio
   */
  isSupported() {
    return typeof window !== 'undefined' && typeof window.WebAssembly !== 'undefined';
  }

  /**
   * Check if Kokoro natively supports the given language code
   */
  isLanguageSupported(langCode = 'en-US') {
    if (!langCode) return false;
    const prefix = langCode.toLowerCase().split('-')[0];
    return KOKORO_SUPPORTED_LANGS.includes(prefix);
  }

  /**
   * Initialize KokoroTTS in the background
   */
  async init() {
    if (this.status === 'ready' && this.tts) return this.tts;
    if (this.loadPromise) return this.loadPromise;

    if (!this.isSupported()) {
      this.status = 'error';
      throw new Error('WebAssembly is not supported in this browser.');
    }

    this.status = 'loading';
    console.log('[KokoroService] Initializing Kokoro-82M in browser...');

    this.loadPromise = (async () => {
      try {
        const { KokoroTTS } = await import('kokoro-js');

        const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
        let ttsInstance = null;

        if (hasWebGPU) {
          try {
            console.log('[KokoroService] Attempting WebGPU acceleration with fp32...');
            ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
              dtype: 'fp32',
              device: 'webgpu'
            });
            console.log('[KokoroService] Successfully loaded Kokoro via WebGPU!');
          } catch (gpuErr) {
            console.warn('[KokoroService] WebGPU init failed or unsupported, falling back to WASM q8:', gpuErr);
          }
        }

        if (!ttsInstance) {
          console.log('[KokoroService] Loading Kokoro with WASM device and q8 quantized model (~80MB)...');
          ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
            dtype: 'q8',
            device: 'wasm'
          });
          console.log('[KokoroService] Successfully loaded Kokoro via WASM (q8)!');
        }

        this.tts = ttsInstance;
        this.status = 'ready';
        return this.tts;
      } catch (err) {
        console.warn('[KokoroService] Failed to load Kokoro model:', err);
        this.status = 'error';
        this.tts = null;
        throw err;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Get the best voice ID for target language
   */
  getVoiceForLanguage(lang = 'en-US') {
    const langLower = (lang || 'en-US').toLowerCase();

    // British English
    if (langLower === 'en-gb' || langLower.startsWith('en-gb')) {
      return 'bf_emma';
    }

    // Default US English (Heart is Grade A Studio Quality)
    if (this.selectedVoice && KOKORO_VOICES[this.selectedVoice]) {
      return this.selectedVoice;
    }
    return 'af_heart';
  }

  setVoice(voiceId) {
    if (KOKORO_VOICES[voiceId]) {
      this.selectedVoice = voiceId;
      localStorage.setItem('raya_kokoro_voice', voiceId);
    }
  }

  setSpeed(speed) {
    this.speed = speed;
    localStorage.setItem('raya_kokoro_speed', speed.toString());
  }

  /**
   * Synthesize and play speech using Kokoro-82M
   */
  async speak(text, targetLang = 'en-US', onStart = null, onEnd = null) {
    if (!text || !text.trim()) return;

    // Ensure model is ready
    if (!this.tts) {
      await this.init();
    }

    this.stop();

    const voice = this.getVoiceForLanguage(targetLang);
    console.log(`[KokoroService] Synthesizing speech with Kokoro-82M (voice: ${voice}, speed: ${this.speed})...`);

    const rawAudio = await this.tts.generate(text, {
      voice,
      speed: this.speed
    });

    if (!rawAudio) throw new Error('Kokoro returned empty audio.');

    const blob = rawAudio.toBlob();
    this.currentBlobUrl = URL.createObjectURL(blob);
    const audioEl = new Audio(this.currentBlobUrl);
    this.currentAudioEl = audioEl;

    return new Promise((resolve, reject) => {
      audioEl.onplay = () => {
        this.isSpeaking = true;
        if (onStart) onStart();
        if (this.lipSyncEngine) {
          try {
            this.lipSyncEngine.connectMediaElement(audioEl);
          } catch (e) {}
          // Also start synthetic viseme cadence for reliable lip movement across all browsers
          this.lipSyncEngine.startSyntheticSpeech();
        }
      };

      audioEl.onended = () => {
        this._cleanup();
        if (onEnd) onEnd();
        resolve();
      };

      audioEl.onerror = (e) => {
        console.warn('[KokoroService] Audio element playback error:', e);
        this._cleanup();
        if (onEnd) onEnd();
        reject(new Error('Audio playback failed'));
      };

      audioEl.play().catch((err) => {
        console.warn('[KokoroService] audioEl.play() blocked or failed:', err);
        this._cleanup();
        if (onEnd) onEnd();
        reject(err);
      });
    });
  }

  /**
   * Stop ongoing Kokoro speech
   */
  stop() {
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.pause();
        this.currentAudioEl.currentTime = 0;
      } catch (e) {}
      this.currentAudioEl = null;
    }
    this._cleanup();
  }

  _cleanup() {
    this.isSpeaking = false;
    if (this.currentBlobUrl) {
      try { URL.revokeObjectURL(this.currentBlobUrl); } catch (e) {}
      this.currentBlobUrl = null;
    }
    if (this.lipSyncEngine) {
      this.lipSyncEngine.stopSyntheticSpeech();
    }
  }
}
