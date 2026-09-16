/**
 * Helper to identify high-fidelity / realistic cloud & neural voices
 * Supported across Microsoft Edge (Azure Natural), Google Chrome (Cloud TTS), and Apple (Enhanced Siri).
 */
export function isRealisticVoice(voice) {
  if (!voice) return false;
  const name = voice.name || '';
  return (
    /Online \(Natural\)|Natural|Enhanced|Premium|Neural|Siri/i.test(name) ||
    /^Google\s/i.test(name)
  );
}

/**
 * Detect language from text (Devanagari Hindi, Bengali script, Romanized Hinglish / Indian English, Japanese, or Global English).
 */
export function detectLanguage(text) {
  if (!text) return 'en-US';

  // 1. Devanagari script (Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi-IN';
  }

  // 2. Bengali script
  if (/[\u0980-\u09FF]/.test(text)) {
    return 'bn-IN';
  }

  // 3. Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return 'ja-JP';
  }

  // 4. Romanized Hinglish / Indian English cues
  const hinglishPatterns = /\b(namaste|shukriya|dhanyavaad|kaise|kaisa|kaisi|theek|badhiya|haan|nahi|accha|achha|bhai|yaar|dost|sab|kuch|mera|meri|hum|tum|aap|karenge|batao|bolo|chalo|maza|samajh|raha|rahi|hain|kya|kyun|bahut|shukriya)\b/i;
  if (hinglishPatterns.test(text)) {
    return 'en-IN';
  }

  return 'en-US';
}

/**
 * Phonetically transliterates Devanagari Hindi text to Roman Latin characters
 * so that English/Indian-English TTS voices on phones and PCs can speak it aloud without failing.
 */
export function transliterateDevanagari(text) {
  if (!text || !/[\u0900-\u097F]/.test(text)) return text;
  const wordMap = {
    'नमस्ते': 'Namaste', 'नमस्ते!': 'Namaste!', 'प्रणाम': 'Pranam', 'हैलो': 'Hello', 'हाय': 'Hi',
    'हाँ': 'Haan', 'नहीं': 'Nahi', 'धन्यवाद': 'Dhanyavaad', 'शुक्रिया': 'Shukriya', 'अलविदा': 'Alvida',
    'बहुत': 'bahut', 'अच्छा': 'achha', 'अच्छी': 'achhi', 'अच्छे': 'achhe', 'बढ़िया': 'badhiya',
    'कैसे': 'kaise', 'कैसा': 'kaisa', 'कैसी': 'kaisi', 'हो': 'ho', 'हैं': 'hain', 'है': 'hai', 'हूँ': 'hoon',
    'आप': 'aap', 'तुम': 'tum', 'मैं': 'main', 'हम': 'hum', 'क्या': 'kya', 'क्यों': 'kyun', 'कहाँ': 'kahan',
    'बताओ': 'batao', 'बोलो': 'bolo', 'दिन': 'din', 'बात': 'baat', 'दोस्त': 'dost', 'प्यार': 'pyaar',
    'सुप्रभात': 'Shuprabhat', 'शुभ रात्रि': 'Shubh raatri', 'सब': 'sab', 'ठीक': 'theek'
  };
  let res = text;
  for (const [hi, en] of Object.entries(wordMap)) {
    res = res.replace(new RegExp(hi, 'g'), en);
  }
  if (/[\u0900-\u097F]/.test(res)) {
    const chars = {
      'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ए':'e','ऐ':'ai','ओ':'o','औ':'au','अं':'am','अः':'ah',
      'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng',
      'च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
      'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
      'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
      'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
      'य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
      'ा':'a','ि':'i','ी':'ee','ु':'u','ू':'oo','े':'e','ै':'ai','ो':'o','ौ':'au','्':'','ं':'n','ः':'h','ँ':'n'
    };
    res = res.replace(/[\u0900-\u097F]/g, (c) => chars[c] || '');
  }
  return res;
}

/**
 * Helper to check if a voice is female (strictly excluding male voices)
 */
export function isFemaleVoice(voice) {
  if (!voice) return false;
  const name = (voice.name || '').toLowerCase();

  // Explicit male blacklist
  const isMale = /\b(male|david|george|mark|ravi|bashkar|madhur|prabhat|guy|pradeep|rishi|stefan|james|richard|sean|paul|alex|brian|daniel|tom|oliver|arthur|fred)\b/i.test(name);
  if (isMale) return false;

  // Explicit female whitelist or indicators
  const isExplicitlyFemale =
    /\b(female|woman|girl)\b/i.test(name) ||
    /zira|jenny|aria|sonia|maisie|swara|neerja|tanishaa|nabanita|veena|heera|samantha|karen|lekha|kalpana|ananya|aditi|sunita|sheetal|victoria|hazel|susan|catherine|linda|heather|stephanie|ayumi|haruka|nanami|aoi|kyoko/i.test(name);
  if (isExplicitlyFemale) return true;

  // Google Chrome voices
  if (/^Google\s/i.test(name)) {
    return !/male/i.test(name);
  }

  return true;
}

export class VoiceService {
  constructor(lipSyncEngine) {
    this.lipSyncEngine = lipSyncEngine;

    // TTS state
    this.synth = window.speechSynthesis;
    this.selectedVoiceURI = localStorage.getItem('raya_voice_uri') || 'auto';
    this.selectedVoice = null;
    this.pitch = parseFloat(localStorage.getItem('raya_voice_pitch') || '1.05');
    this.rate = parseFloat(localStorage.getItem('raya_voice_rate') || '1.0');
    this.autoSpeak = localStorage.getItem('raya_auto_speak') !== 'false';
    this.isSpeaking = false;
    this.currentUtterance = null;

    // Multilingual STT state
    this.recognitionLang = localStorage.getItem('raya_stt_lang') || 'en-IN';
    this.recognition = null;
    this.isListening = false;
    this.continuousMode = false;
    this.onSpeechResult = null;
    this.onSpeechStatus = null;
    this.onInterimTranscript = null;

    // Browser autoplay policy / audio wake-up listeners
    const unlockSynth = () => {
      if (this.synth && this.synth.paused) {
        this.synth.resume();
      }
    };
    ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((evt) => {
      window.addEventListener(evt, unlockSynth, { passive: true });
    });

    this.initVoices();
    this.initRecognition();
  }

  initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.getAvailableVoices();
      if (!voices || voices.length === 0) return;

      if (this.selectedVoiceURI && this.selectedVoiceURI !== 'auto') {
        this.selectedVoice = voices.find((v) => v.voiceURI === this.selectedVoiceURI) || null;
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Return voices strictly filtered to female voices
   */
  getAvailableVoices() {
    if (!this.synth) return [];
    const all = this.synth.getVoices();
    const femaleOnly = all.filter((v) => isFemaleVoice(v));
    return femaleOnly.length > 0 ? femaleOnly : all;
  }

  /**
   * Find highest fidelity realistic female voice for target language
   */
  getBestRealisticVoice(targetLang = 'en-US') {
    const voices = this.getAvailableVoices();
    if (!voices || voices.length === 0) return null;

    const langLower = targetLang.toLowerCase();

    // 1. Hindi (hi-IN) - strictly female
    if (langLower.startsWith('hi')) {
      return (
        voices.find((v) => /Swara.*Online \(Natural\)/i.test(v.name)) ||
        voices.find((v) => /Google.*(हिन्दी|Hindi)/i.test(v.name) && isFemaleVoice(v)) ||
        voices.find((v) => /Lekha|Kalpana|Ananya|Aditi/i.test(v.name)) ||
        voices.find((v) => isFemaleVoice(v) && (v.lang.startsWith('hi') || v.lang.includes('hi_IN'))) ||
        // Fallback to female Indian English
        voices.find((v) => /Neerja.*Online \(Natural\)/i.test(v.name)) ||
        voices.find((v) => /Veena|Heera/i.test(v.name)) ||
        voices.find((v) => /Google.*(India|Indian)/i.test(v.name) && isFemaleVoice(v)) ||
        voices.find((v) => isFemaleVoice(v) && v.lang === 'en-IN')
      );
    }

    // 2. Bengali (bn-IN / bn-BD) - strictly female (Tanishaa, Nabanita)
    if (langLower.startsWith('bn')) {
      return (
        voices.find((v) => /Tanishaa.*Online \(Natural\)|Nabanita.*Online \(Natural\)/i.test(v.name)) ||
        voices.find((v) => /Google.*(বাংলা|Bengali)/i.test(v.name) && isFemaleVoice(v)) ||
        voices.find((v) => isFemaleVoice(v) && v.lang.startsWith('bn')) ||
        // Fallback to female Indian English
        voices.find((v) => /Neerja.*Online \(Natural\)/i.test(v.name)) ||
        voices.find((v) => /Veena|Heera/i.test(v.name)) ||
        voices.find((v) => isFemaleVoice(v) && v.lang === 'en-IN')
      );
    }

    // 3. Indian English (en-IN) / Hinglish - strictly female (Neerja, Veena)
    if (langLower === 'en-in' || langLower.startsWith('en-in')) {
      return (
        voices.find((v) => /Neerja.*Online \(Natural\)/i.test(v.name)) ||
        voices.find((v) => /Google.*(India|Indian)/i.test(v.name) && isFemaleVoice(v)) ||
        voices.find((v) => /Veena|Heera/i.test(v.name)) ||
        voices.find((v) => isRealisticVoice(v) && isFemaleVoice(v) && v.lang === 'en-IN') ||
        voices.find((v) => isFemaleVoice(v) && v.lang === 'en-IN')
      );
    }

    // 4. Japanese (ja-JP) - strictly female
    if (langLower.startsWith('ja')) {
      return (
        voices.find((v) => /Nanami.*Online \(Natural\)|Aoi.*Online \(Natural\)/i.test(v.name)) ||
        voices.find((v) => /Google.*日本語/i.test(v.name) && isFemaleVoice(v)) ||
        voices.find((v) => isFemaleVoice(v) && v.lang.startsWith('ja'))
      );
    }

    // 5. Global English (en-US / en-GB / general) - strictly female
    return (
      voices.find((v) => /Jenny.*Online \(Natural\)|Aria.*Online \(Natural\)|Sonia.*Online \(Natural\)|Maisie.*Online \(Natural\)/i.test(v.name)) ||
      voices.find((v) => /Google UK English Female/i.test(v.name)) ||
      voices.find((v) => /Google US English/i.test(v.name) && isFemaleVoice(v)) ||
      voices.find((v) => /Samantha|Victoria|Karen|Zira/i.test(v.name) && isFemaleVoice(v)) ||
      voices.find((v) => isRealisticVoice(v) && isFemaleVoice(v) && v.lang.startsWith('en')) ||
      voices.find((v) => isFemaleVoice(v) && v.lang.startsWith('en')) ||
      voices.find((v) => isFemaleVoice(v)) ||
      voices[0]
    );
  }

  setVoice(voiceURI) {
    this.selectedVoiceURI = voiceURI;
    localStorage.setItem('raya_voice_uri', voiceURI);

    if (voiceURI === 'auto') {
      this.selectedVoice = null;
    } else {
      const voices = this.getAvailableVoices();
      this.selectedVoice = voices.find((v) => v.voiceURI === voiceURI) || null;
    }
  }

  setVoiceParams(pitch, rate, autoSpeak) {
    this.pitch = pitch;
    this.rate = rate;
    this.autoSpeak = autoSpeak;
    localStorage.setItem('raya_voice_pitch', pitch.toString());
    localStorage.setItem('raya_voice_rate', rate.toString());
    localStorage.setItem('raya_auto_speak', autoSpeak.toString());
  }

  setRecognitionLanguage(lang) {
    this.recognitionLang = lang;
    localStorage.setItem('raya_stt_lang', lang);
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  speak(text) {
    if (!this.synth || !this.autoSpeak || !text) return;

    // Stop ongoing speech and unpause synth if frozen
    this.stopSpeaking();
    if (this.synth.paused) {
      this.synth.resume();
    }

    let cleanText = text.replace(/\[.*?\]/g, '').replace(/[*_#~`]/g, '').trim();
    if (!cleanText) return;

    const detectedLang = detectLanguage(cleanText);

    // Determine the optimal realistic voice for this specific utterance
    let voiceToUse = null;

    if (this.selectedVoiceURI === 'auto' || !this.selectedVoice) {
      voiceToUse = this.getBestRealisticVoice(detectedLang);
    } else {
      // If user selected a specific voice, check if it can speak this script
      const isDevanagari = /[\u0900-\u097F]/.test(cleanText);
      const isBengali = /[\u0980-\u09FF]/.test(cleanText);

      if ((isDevanagari && !this.selectedVoice.lang.startsWith('hi')) ||
          (isBengali && !this.selectedVoice.lang.startsWith('bn'))) {
        voiceToUse = this.getBestRealisticVoice(detectedLang);
      } else {
        voiceToUse = this.selectedVoice;
      }
    }

    // CRITICAL: If text contains Devanagari Hindi but chosen voice does not natively speak Hindi,
    // transliterate into phonetic Latin Roman text so English / Indian English voices speak it aloud.
    const isDevanagari = /[\u0900-\u097F]/.test(cleanText);
    const voiceLang = (voiceToUse?.lang || '').toLowerCase();
    if (isDevanagari && !voiceLang.startsWith('hi')) {
      cleanText = transliterateDevanagari(cleanText);
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (voiceToUse) {
      utterance.voice = voiceToUse;
      utterance.lang = voiceToUse.lang || detectedLang;
    } else {
      utterance.lang = detectedLang;
    }

    // Speech parameters
    utterance.volume = 1.0;
    utterance.pitch = this.pitch || 1.05;
    utterance.rate = this.rate || 1.0;

    // CRITICAL: Prevent Chromium garbage collection bug by pinning reference
    window._currentRayaUtterance = utterance;
    this.currentUtterance = utterance;

    let watchdogTimer = null;

    const cleanup = () => {
      if (watchdogTimer) clearInterval(watchdogTimer);
      window._currentRayaUtterance = null;
      this.currentUtterance = null;
      this.isSpeaking = false;
      if (this.lipSyncEngine) {
        this.lipSyncEngine.stopSyntheticSpeech();
      }
      if (this.onSpeechStatus) this.onSpeechStatus('idle');
    };

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.lipSyncEngine) {
        this.lipSyncEngine.startSyntheticSpeech();
      }
      if (this.onSpeechStatus) this.onSpeechStatus('speaking');

      // Watchdog: Chrome long-speech pause bug workaround
      watchdogTimer = setInterval(() => {
        if (!this.isSpeaking) {
          clearInterval(watchdogTimer);
          return;
        }
        if (this.synth && this.synth.paused) {
          this.synth.resume();
        }
      }, 2500);
    };

    utterance.onend = () => {
      cleanup();
    };

    utterance.onerror = (e) => {
      console.warn('[VoiceService] Speech error:', e);
      cleanup();
    };

    try {
      this.synth.speak(utterance);
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch (e) {
      console.warn('[VoiceService] synth.speak threw error:', e);
      cleanup();
    }
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      if (this.synth.paused) {
        this.synth.resume();
      }
    }
    window._currentRayaUtterance = null;
    this.currentUtterance = null;
    this.isSpeaking = false;
    if (this.lipSyncEngine) {
      this.lipSyncEngine.stopSyntheticSpeech();
    }
    if (this.onSpeechStatus) this.onSpeechStatus('idle');
  }

  initRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('[VoiceService] Speech Recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.recognitionLang;

    let finalTranscript = '';
    let speechTimer = null;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onSpeechStatus) this.onSpeechStatus('listening');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text + ' ';
        } else {
          interim += text;
        }
      }

      if (this.onInterimTranscript) {
        this.onInterimTranscript(interim || finalTranscript);
      }

      // Auto-submit after 1.2s pause in speech
      if (speechTimer) clearTimeout(speechTimer);
      speechTimer = setTimeout(() => {
        const query = (finalTranscript + interim).trim();
        if (query.length > 1) {
          if (this.onSpeechResult) this.onSpeechResult(query);
          finalTranscript = '';
        }
      }, 1200);
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[VoiceService] Recognition error:', event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.continuousMode) {
        // Auto-restart in hands-free mode
        try {
          this.recognition.start();
        } catch (e) {}
      } else {
        if (this.onSpeechStatus) this.onSpeechStatus('idle');
      }
    };
  }

  toggleListening(continuous = false) {
    if (!this.recognition) {
      alert('Speech Recognition is not supported by your browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    if (this.isListening) {
      this.continuousMode = false;
      this.recognition.stop();
    } else {
      this.continuousMode = continuous;
      this.recognition.lang = this.recognitionLang;
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Recognition already started:', e);
      }
    }
  }
}
