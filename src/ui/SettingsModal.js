import { PROVIDERS, DEFAULT_MODELS } from '../ai/LLMService.js';
import { DEFAULT_SYSTEM_PROMPT } from '../ai/PromptEngine.js';
import { isRealisticVoice } from '../ai/VoiceService.js';

export class SettingsModal {
  constructor({ llmService, voiceService }) {
    this.llmService = llmService;
    this.voiceService = voiceService;

    this.modalEl = document.getElementById('settings-modal');
    this.btnOpenEl = document.getElementById('btn-open-settings');
    this.btnCloseEl = document.getElementById('btn-close-settings');
    this.btnSaveEl = document.getElementById('btn-save-settings');

    this.providerSelectEl = document.getElementById('setting-provider');
    this.apiKeyInputEl = document.getElementById('setting-api-key');
    this.modelInputEl = document.getElementById('setting-model');
    this.ttsEngineSelectEl = document.getElementById('setting-tts-engine');
    this.kokoroVoiceSelectEl = document.getElementById('setting-kokoro-voice');
    this.kokoroVoiceGroupEl = document.getElementById('kokoro-voice-group');
    this.webspeechVoiceGroupEl = document.getElementById('webspeech-voice-group');
    this.voiceSelectEl = document.getElementById('setting-voice');
    this.sttLangSelectEl = document.getElementById('setting-stt-lang');
    this.pitchSliderEl = document.getElementById('setting-pitch');
    this.rateSliderEl = document.getElementById('setting-rate');
    this.autoSpeakCheckEl = document.getElementById('setting-auto-speak');
    this.systemPromptEl = document.getElementById('setting-system-prompt');
    this.btnResetPromptEl = document.getElementById('btn-reset-prompt');
    this.btnClearChatEl = document.getElementById('btn-clear-chat');

    this.setupListeners();
  }

  setupListeners() {
    this.btnOpenEl?.addEventListener('click', () => this.open());
    this.btnCloseEl?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.ttsEngineSelectEl?.addEventListener('change', (e) => {
      const eng = e.target.value;
      if (this.kokoroVoiceGroupEl) this.kokoroVoiceGroupEl.style.display = eng === 'kokoro' ? 'block' : 'none';
      if (this.webspeechVoiceGroupEl) this.webspeechVoiceGroupEl.style.display = eng === 'webspeech' ? 'block' : 'none';
    });

    this.providerSelectEl.addEventListener('change', (e) => {
      const prov = e.target.value;
      if (this.apiKeyInputEl) {
        this.apiKeyInputEl.value = this.llmService.getApiKey(prov);
      }
      this.modelInputEl.value = localStorage.getItem(`raya_model_${prov}`) || DEFAULT_MODELS[prov];
    });

    this.btnResetPromptEl.addEventListener('click', () => {
      this.systemPromptEl.value = DEFAULT_SYSTEM_PROMPT;
    });

    this.btnClearChatEl.addEventListener('click', () => {
      this.llmService.clearHistory();
      const list = document.getElementById('messages-list');
      if (list) list.innerHTML = '';
      alert('Chat history cleared!');
    });

    this.btnSaveEl.addEventListener('click', () => {
      this.save();
    });
  }

  open() {
    // Populate form values
    const currentProv = this.llmService.provider;
    this.providerSelectEl.value = currentProv;
    if (this.apiKeyInputEl) {
      this.apiKeyInputEl.value = this.llmService.getApiKey(currentProv);
    }
    this.modelInputEl.value = this.llmService.model;

    // TTS Engine & Voice configuration
    const currentEngine = this.voiceService.ttsEngine || 'kokoro';
    if (this.ttsEngineSelectEl) {
      this.ttsEngineSelectEl.value = currentEngine;
    }
    if (this.kokoroVoiceSelectEl && this.voiceService.kokoroService) {
      this.kokoroVoiceSelectEl.value = this.voiceService.kokoroService.selectedVoice || 'af_heart';
    }
    if (this.kokoroVoiceGroupEl) {
      this.kokoroVoiceGroupEl.style.display = currentEngine === 'kokoro' ? 'block' : 'none';
    }
    if (this.webspeechVoiceGroupEl) {
      this.webspeechVoiceGroupEl.style.display = currentEngine === 'webspeech' ? 'block' : 'none';
    }

    // Populate voices with Auto-Detect as top option, realistic voices highlighted
    this.voiceSelectEl.innerHTML = '';

    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = '✨ Auto-Detect Language (Female AI Voices) — Recommended';
    if (!this.voiceService.selectedVoiceURI || this.voiceService.selectedVoiceURI === 'auto') {
      autoOpt.selected = true;
    }
    this.voiceSelectEl.appendChild(autoOpt);

    const voices = this.voiceService.getAvailableVoices();
    // Sort: realistic voices first, then by language
    const sortedVoices = [...voices].sort((a, b) => {
      const aReal = isRealisticVoice(a) ? 1 : 0;
      const bReal = isRealisticVoice(b) ? 1 : 0;
      if (aReal !== bReal) return bReal - aReal;
      return a.lang.localeCompare(b.lang);
    });

    sortedVoices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      const isReal = isRealisticVoice(v);
      opt.textContent = `${isReal ? '✨ ' : ''}${v.name} (${v.lang})`;
      if (this.voiceService.selectedVoiceURI === v.voiceURI) {
        opt.selected = true;
      }
      this.voiceSelectEl.appendChild(opt);
    });

    if (this.sttLangSelectEl) {
      this.sttLangSelectEl.value = this.voiceService.recognitionLang || 'en-IN';
    }

    this.pitchSliderEl.value = this.voiceService.pitch;
    this.rateSliderEl.value = this.voiceService.rate;
    this.autoSpeakCheckEl.checked = this.voiceService.autoSpeak;
    this.systemPromptEl.value = this.llmService.systemPrompt;

    this.modalEl.classList.add('active');
  }

  close() {
    this.modalEl.classList.remove('active');
  }

  save() {
    const prov = this.providerSelectEl.value;
    const key = this.apiKeyInputEl ? this.apiKeyInputEl.value.trim() : this.llmService.getApiKey(prov);
    const model = this.modelInputEl.value.trim() || DEFAULT_MODELS[prov];

    this.llmService.setProvider(prov);
    if (key) {
      this.llmService.setApiKey(key, prov);
    }
    this.llmService.setModel(model, prov);
    this.llmService.setSystemPrompt(this.systemPromptEl.value);

    // Save TTS Engine & Voice configuration
    if (this.ttsEngineSelectEl) {
      this.voiceService.setTTSEngine(this.ttsEngineSelectEl.value);
    }
    if (this.kokoroVoiceSelectEl) {
      this.voiceService.setKokoroVoice(this.kokoroVoiceSelectEl.value);
    }
    this.voiceService.setVoice(this.voiceSelectEl.value);
    if (this.sttLangSelectEl) {
      this.voiceService.setRecognitionLanguage(this.sttLangSelectEl.value);
    }

    this.voiceService.setVoiceParams(
      parseFloat(this.pitchSliderEl.value),
      parseFloat(this.rateSliderEl.value),
      this.autoSpeakCheckEl.checked
    );

    this.close();

    // Friendly greeting or confirmation
    const speechEl = document.getElementById('speech-text');
    if (speechEl) speechEl.textContent = 'Settings saved! Ready whenever you are.';
  }
}
