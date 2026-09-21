import { KokoroService, KOKORO_VOICES, KOKORO_SUPPORTED_LANGS } from './KokoroService.js';

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
 * Helper to detect mobile devices (phones & tablets)
 */
export function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
}

/**
 * Strict male filter to guarantee ONLY female voices are ever used for Raya
 * Based on PROJECT_DOCUMENTATION.md & chatbot.js specifications
 */
const MALE_FILTER = /\b(male|boy|man|guy|masculine|homme|hombre|mann)\b|bashkar|madhur|hemant|ojas|niranjan|manohar|valluvar|mohan|gagan|midhun|keita|david|mark|george|james|ravi|ryan|christopher|eric|andrew|brian|roger|steffan|prabhat|pradeep|rishi|richard|sean|paul|alex|daniel|tom|oliver|arthur|fred|adam|echo|liam|michael|onyx|puck|santa|lewis|fable|yunxi|yunjian|yunyang|yunxia|kumo|nicola|omega|psi/i;

/**
 * Helper to check if a voice is female (strictly excluding male voices)
 */
export function isFemaleVoice(voice) {
  if (!voice) return false;
  const name = (voice.name || '').toLowerCase();

  // 1. Explicit male blacklist: if male filter matches, reject immediately
  if (MALE_FILTER.test(name)) return false;

  // 2. Explicit female whitelist
  const isExplicitlyFemale =
    /\b(female|woman|girl|feminine|femme|mujer|frau)\b/i.test(name) ||
    /zira|jenny|aria|ava|sonia|maisie|swara|neerja|tanishaa|nabanita|nabami|veena|heera|samantha|karen|moira|tessa|lekha|kalpana|ananya|aditi|sunita|sheetal|victoria|hazel|susan|catherine|linda|heather|stephanie|ayumi|haruka|nanami|aoi|kyoko|gurpreet|dhwani|libby|alice|emma|isabella|sarah|nicole|bella|heart/i.test(name);
  if (isExplicitlyFemale) return true;

  // 3. Google Chrome voices
  if (/^Google\s/i.test(name)) {
    return !/\bmale\b/i.test(name);
  }

  // 4. Fallback: only accept if not matching any male filter
  return !MALE_FILTER.test(name);
}

/**
 * Detect language from text (Devanagari Hindi, Bengali script, Romanized Hinglish / Indian English, Japanese, or Global English).
 * Grounded in PROJECT_DOCUMENTATION.md Section 4.2 Language Voice Mapping & Dialect Matrix.
 */
export function detectLanguage(text) {
  if (!text) return 'en-US';

  const cleanText = text.toLowerCase();

  // 1. Scripts: direct Unicode ranges
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja-JP';

  // 2. Punjabi Romanized phrases
  if (/\b(kidda|sat sri akal|kive|haal|changa|tussi|saade|punjabi|bol sakdi|paaji|veere|soniye|kiven|santa banta)\b/i.test(cleanText)) {
    return 'pa-IN';
  }

  // 3. Gujarati Romanized phrases
  if (/\b(kem cho|majama|tamaru|gujarati|aaje|tame|aavde|vaat kari|bachavani|puchi shako|tamaro)\b/i.test(cleanText)) {
    return 'gu-IN';
  }

  // 4. Bengali Romanized phrases
  if (/\b(kemon acho|bhalo achi|khobor|bhalo|amar naam|tomar naam|bangla|bengali|ami|obosshoi|korcho|shuncho|kheyecho|jigyesh)\b/i.test(cleanText)) {
    return 'bn-IN';
  }

  // 5. Hindi / Hinglish Romanized phrases
  if (/\b(namaste|kaise ho|kaisi ho|aap kaise|kaisa hai|chutkula|hindi mein|baat kar sakti|badhiya hoon|dhanyavaad|shukriya|theek hoon|bataiye|aap batao|sunao|kya hal)\b/i.test(cleanText)) {
    return 'hi-IN';
  }

  // 6. UK English dialect cues
  if (/\b(colour|flavour|favour|honour|neighbour|theatre|centre|metre|cheers mate|bloke|proper|splendid|sorted|quid|rubbish|trousers|flat|postcode|lorry|biscuit)\b/i.test(cleanText)) {
    return 'en-GB';
  }

  // 7. Indian English dialect cues
  if (/\b(ratnesh|svist|makaut|syncpulse|pak converter|btech|ece|kolkata|yaar|bhai|pass out|prepone|revert back|good name|do the needful)\b/i.test(cleanText)) {
    return 'en-IN';
  }

  return 'en-US';
}

/**
 * Real-Time Phonetic Transliteration Engine (getNativeScriptForTTS)
 * Specifications from PROJECT_DOCUMENTATION.md Section 4.3:
 * Writing native scripts directly in UI bubbles clashes with modern design, but reading Romanized English
 * with Edge/Google native TTS engines creates awkward pronunciation.
 * getNativeScriptForTTS converts Romanized words into authentic native Unicode characters right before speech synthesis.
 */
export function getNativeScriptForTTS(textStr, lang) {
  if (!textStr) return textStr;

  // Bengali transliteration
  if (lang.startsWith('bn')) {
    if (/[\u0980-\u09FF]/.test(textStr)) return textStr;
    const bnPhrases = [
      [/\bhaa\s+obosshoi\b/gi, 'হ্যাঁ অবশ্যই'],
      [/\bami\s+bangla\s+bolte\s+pari\b/gi, 'আমি বাংলা বলতে পারি'],
      [/\bami\s+khub\s+bhalo\s+achi\b/gi, 'আমি খুব ভালো আছি'],
      [/\btumi\s+kemon\s+acho\b/gi, 'তুমি কেমন আছো'],
      [/\btumi\s+ki\s+korcho\b/gi, 'তুমি কি করছো'],
      [/\bki\s+korcho\b/gi, 'কি করছো'],
      [/\bki\s+korchis\b/gi, 'কি করছিস'],
      [/\bamar\s+naam\s+raya\b/gi, 'আমার নাম রায়া'],
      [/\bami\s+ratnesh-?er\s+portfolio\s+guide\s+korchi\b/gi, 'আমি রত্নেশের পোর্টফোলিও গাইড করছি'],
      [/\btumi\s+bolo\s+ki\s+sahajyo\s+korte\s+pari\b/gi, 'তুমি বলো কি সাহায্য করতে পারি'],
      [/\bratnesh-?er\s+projects?\s+ba\s+skills?\s+niye\s+ja\s+icche\s+jigyesh\s+korte\s+paro\b/gi, 'রত্নেশের প্রজেক্টস বা স্কিলস নিয়ে যা ইচ্ছে জিজ্ঞেস করতে পারো']
    ];
    let res = textStr;
    for (const [re, val] of bnPhrases) res = res.replace(re, val);
    const bnDict = {
      'ami': 'আমি', 'tumi': 'তুমি', 'bhalo': 'ভালো', 'kemon': 'কেমন', 'acho': 'আছো', 'achi': 'আছি',
      'naam': 'নাম', 'nam': 'নাম', 'tomar': 'তোমার', 'amar': 'আমার', 'bolte': 'বলতে', 'pari': 'পারি',
      'paro': 'পারো', 'obosshoi': 'অবশ্যই', 'haan': 'হ্যাঁ', 'haa': 'হ্যাঁ', 'korcho': 'করছো', 'koro': 'করো',
      'kichu': 'কিছু', 'jante': 'জানতে', 'chao': 'চাও', 'bolo': 'বলো', 'sahajyo': 'সাহায্য', 'korte': 'করতে',
      'jigyesh': 'জিজ্ঞেস', 'ratnesh': 'রত্নেশ', 'bangla': 'বাংলা', 'bengali': 'বাংলা', 'shonao': 'শোনাও',
      'chutkula': 'কৌতুক', 'bol': 'বল', 'shuncho': 'শুনছো', 'dada': 'দাদা', 'didi': 'দিদি', 'khabar': 'খাবার',
      'kheyecho': 'খেয়েছো', 'shob': 'সব', 'ki': 'কি'
    };
    return res.replace(/\b[a-zA-Z]+\b/g, (w) => bnDict[w.toLowerCase()] || w);
  }

  // Punjabi transliteration
  if (lang.startsWith('pa')) {
    if (/[\u0A00-\u0A7F]/.test(textStr)) return textStr;
    const paDict = {
      'haanji': 'ਹਾਂਜੀ', 'bilkul': 'ਬਿਲਕੁਲ', 'main': 'ਮੈਂ', 'punjabi': 'ਪੰਜਾਬੀ', 'bol': 'ਬੋਲ',
      'sakdi': 'ਸਕਦੀ', 'aan': 'ਆਂ', 'tussi': 'ਤੁਸੀਂ', 'daso': 'ਦੱਸੋ', 'sab': 'ਸਭ', 'theek': 'ਠੀਕ',
      'kive': 'ਕਿਵੇਂ', 'ho': 'ਹੋ', 'kidda': 'ਕਿੱਦਾਂ', 'changa': 'ਚੰਗਾ', 'veere': 'ਵੀਰੇ', 'paaji': 'ਭਾਜੀ',
      'santa': 'ਸੰਤਾ', 'banta': 'ਬੰਤਾ', 'baraf': 'ਬਰਫ਼', 'tukda': 'ਟੁਕੜਾ', 'hath': 'ਹੱਥ', 'ch': 'ਚ',
      'phad': 'ਫੜ', 'ke': 'ਕੇ', 'gaur': 'ਗ਼ੌਰ', 'naal': 'ਨਾਲ', 'dekh': 'ਦੇਖ', 'reha': 'ਰਿਹਾ', 'si': 'ਸੀ',
      'ki': 'ਕੀ', 'leak': 'ਲੀਕ', 'kithon': 'ਕਿੱਥੋਂ', 'hai': 'ਹੈ', 'paise': 'ਪੈਸੇ', 'kaddan': 'ਕੱਢਣ',
      'da': 'ਦਾ', 'hisab': 'ਹਿਸਾਬ', 'pehla': 'ਪਹਿਲਾਂ', 'sign': 'ਦਸਤਖਤ', 'meri': 'ਮੇਰੀ', 'rashi': 'ਰਾਸ਼ੀ',
      'singh': 'ਸਿੰਘ', 'kyu': 'ਕਿਉਂ', 'karaan': 'ਕਰਾਂ', 'ratnesh': 'ਰਤਨੇਸ਼', 'baare': 'ਬਾਰੇ', 'jo': 'ਜੋ',
      'marzi': 'ਮਰਜ਼ੀ', 'puch': 'ਪੁੱਛ', 'sakde': 'ਸਕਦੇ', 'ji': 'ਜੀ'
    };
    return textStr.replace(/\b[a-zA-Z]+\b/g, (w) => paDict[w.toLowerCase()] || w);
  }

  // Gujarati transliteration
  if (lang.startsWith('gu')) {
    if (/[\u0A80-\u0AFF]/.test(textStr)) return textStr;
    const guDict = {
      'haan': 'હા', 'bilkul': 'બિલકੁલ', 'hu': 'હું', 'gujarati': 'ગુજરાતી', 'ma': 'માં', 'vaat': 'વાત',
      'kari': 'કરી', 'saku': 'શકું', 'chu': 'છું', 'ekdam': 'એકદમ', 'majama': 'મજામાં', 'tame': 'તમે',
      'bolo': 'બોલો', 'kem': 'કેમ', 'cho': 'છો', 'ratnesh': 'રત્નેશ', 'na': 'ના', 'projects': 'પ્રોજેક્ટ્સ',
      'vishe': 'વિશે', 'mane': 'મને', 'kai': 'કંઈ', 'pan': 'પણ', 'puchi': 'પૂછી', 'shako': 'શકો',
      'su': 'શું', 'janva': 'જાણવા', 'mango': 'માંગો', 'che': 'છે', 'bapu': 'બાપુ', 'pappu': 'પપ્પુ'
    };
    return textStr.replace(/\b[a-zA-Z]+\b/g, (w) => guDict[w.toLowerCase()] || w);
  }

  // Hindi / Hinglish transliteration
  if (lang.startsWith('hi')) {
    if (/[\u0900-\u097F]/.test(textStr)) return textStr;
    const hiPhrases = [
      [/\bhaan\s+bilkul\b/gi, 'हाँ बिल्कुल'],
      [/\bmain\s+hindi\s+mein\s+baat\s+kar\s+sakti\s+hoon\b/gi, 'मैं हिंदी में बात कर सकती हूँ'],
      [/\bmain\s+ekdam\s+badhiya\s+hoon\b/gi, 'मैं एकदम बढ़िया हूँ'],
      [/\baap\s+kaise\s+hain\b/gi, 'आप कैसे हैं'],
      [/\baap\s+bataiye\b/gi, 'आप बताइए'],
      [/\bkya\s+jaanna\s+chahte\s+hain\b/gi, 'क्या जानना चाहते हैं'],
      [/\bmain\s+ratnesh\s+ke\s+portfolio\s+mein\s+aapko\s+guide\s+kar\s+rahi\s+hoon\b/gi, 'मैं रत्नेश के पोर्टफोलियो में आपको गाइड कर रही हूँ'],
      [/\baap\s+mujhse\s+koi\s+bhi\s+sawal\s+pooch\s+sakte\s+hain\b/gi, 'आप मुझसे कोई भी सवाल पूछ सकते हैं'],
      [/\bnamaste\s+dosto\b/gi, 'नमस्ते दोस्तों'],
      [/\bek\s+baar\s+teacher\s+ne\s+pappu\s+se\s+pucha\b/gi, 'एक बार टीचर ने पप्पू से पूछा'],
      [/\bagar\s+ped\s+par\s+10\s+chidiya\s+baithi\s+hain\b/gi, 'अगर पेड़ पर १० चिड़िया बैठी हैं'],
      [/\baur\s+1\s+ko\s+goli\s+maar\s+di\s+jaye\b/gi, 'और एक को गोली मार दी जाये'],
      [/\bto\s+kitni\s+bachengi\b/gi, 'तो कितनी बचेंगी'],
      [/\bpappu\s+bola\s+ek\s+bhi\s+nahi\b/gi, 'पप्पू बोला एक भी नहीं'],
      [/\bkyunki\s+goli\s+ki\s+aawaz\s+se\s+baki\s+sab\s+udd\s+jayengi\b/gi, 'क्योंकि गोली की आवाज़ से बाकी सब उड़ जाएँगी'],
      [/\bdoctor\s+sahab\s+roz\s+raat\s+ko\s+sapne\s+mein\s+dawat\s+khata\s+hoon\b/gi, 'डॉक्टर साहब रोज़ रात को सपने में दावत खाता हूँ']
    ];
    let res = textStr;
    for (const [re, val] of hiPhrases) res = res.replace(re, val);
    const hiDict = {
      'haan': 'हाँ', 'bilkul': 'बिल्कुल', 'main': 'मैं', 'hindi': 'हिंदी', 'mein': 'में', 'baat': 'बात',
      'kar': 'कर', 'sakti': 'सकती', 'sakte': 'सकते', 'sakta': 'सकता', 'hoon': 'हूँ', 'aap': 'आप', 'mujhse': 'मुझसे',
      'ratnesh': 'रत्नेश', 'ke': 'के', 'ki': 'की', 'ka': 'का', 'ko': 'को', 'projects': 'प्रोजेक्ट्स', 'ya': 'या',
      'kisi': 'किसी', 'bhi': 'भी', 'baare': 'बारे', 'pooch': 'पूछ', 'hain': 'हैं', 'hai': 'है', 'ekdam': 'एकदम',
      'badhiya': 'बढ़िया', 'bataiye': 'बताइए', 'kaise': 'कैसे', 'kaisi': 'कैसी', 'kya': 'क्या', 'rahi': 'रही',
      'rahe': 'रहे', 'raha': 'रहा', 'guide': 'गाइड', 'namaste': 'नमस्ते', 'theek': 'ठीक', 'sab': 'सब',
      'karo': 'करो', 'batao': 'बताओ', 'chutkula': 'चुटकुला', 'hasao': 'हंसाओ', 'pappu': 'पप्पू', 'dost': 'दोस्त',
      'doctor': 'डॉक्टर', 'sapne': 'सपने', 'chidiya': 'चिड़िया', 'ped': 'पेड़', 'goli': 'गोली', 'aawaz': 'आवाज़',
      'nahi': 'नहीं', 'kuch': 'कुछ', 'bata': 'बता', 'bolo': 'बोलो', 'sunao': 'सुनाओ', 'shukriya': 'शुक्रिया',
      'dhanyawad': 'धन्यवाद', 'achha': 'अच्छा', 'suno': 'सुनो', 'samjhe': 'समझे'
    };
    return res.replace(/\b[a-zA-Z]+\b/g, (w) => hiDict[w.toLowerCase()] || w);
  }

  return textStr;
}

/**
 * Phonetically transliterates Devanagari Hindi text to Roman Latin characters
 * Fallback so that English/Western TTS voices on devices without Hindi voice packs can speak it.
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

export class VoiceService {
  constructor(lipSyncEngine) {
    this.lipSyncEngine = lipSyncEngine;

    // Automatic performance optimization: default to 'webspeech' (zero RAM, instant native OS speech, zero lag)
    // Kokoro neural voice is available on-demand in Settings without forcing background WASM overhead
    if (!localStorage.getItem('raya_tts_engine_v3')) {
      localStorage.setItem('raya_tts_engine_v3', 'true');
      localStorage.setItem('raya_tts_engine', 'webspeech');
    }

    this.ttsEngine = localStorage.getItem('raya_tts_engine') || 'webspeech';
    this.kokoroService = new KokoroService(lipSyncEngine);

    // TTS state
    this.synth = window.speechSynthesis;
    this.selectedVoiceURI = localStorage.getItem('raya_voice_uri') || 'auto';
    this.selectedVoice = null;
    // Tuned defaults: Pitch 1.35 (sweet, companion tone), Rate 1.10 (~165 WPM natural pace)
    this.pitch = parseFloat(localStorage.getItem('raya_voice_pitch') || '1.35');
    this.rate = parseFloat(localStorage.getItem('raya_voice_rate') || '1.10');
    this.autoSpeak = localStorage.getItem('raya_auto_speak') !== 'false';
    this.isSpeaking = false;
    this.currentUtterance = null;
    this._wakeWordCooldown = false;
    this._cooldownTimeoutId = null;

    // Multilingual STT state
    this.recognitionLang = localStorage.getItem('raya_stt_lang') || 'en-IN';
    this.recognition = null;
    this.isListening = false;
    this.continuousMode = false;
    this.onSpeechResult = null;
    this.onSpeechStatus = null;
    this.onInterimTranscript = null;

    // Browser audio unlock & selective Kokoro background preload on first user gesture
    const unlockAndPreload = () => {
      if (this.synth) {
        if (this.synth.paused) {
          try { this.synth.resume(); } catch (e) {}
        }
        // Prime synthesis with silent utterance to unlock audio policies on mobile Safari / Chrome Android
        try {
          const silentUtterance = new SpeechSynthesisUtterance('');
          silentUtterance.volume = 0;
          this.synth.speak(silentUtterance);
        } catch (e) {}
      }
      // Preload Kokoro-82M in the background ONLY on desktop devices when kokoro engine is active.
      // On mobile devices, avoid allocating 80MB+ WASM memory on touch gestures to prevent thread lag.
      if (!isMobileDevice() && this.ttsEngine === 'kokoro' && this.kokoroService.status === 'idle') {
        this.kokoroService.init().catch((err) => {
          console.warn('[VoiceService] Kokoro background preload deferred:', err);
        });
      }
    };
    ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((evt) => {
      window.addEventListener(evt, unlockAndPreload, { once: true, passive: true });
    });

    this.initVoices();
    this.initRecognition();
  }

  /**
   * Cross-browser voice initialization with polling fallback for Edge, Chrome, Safari
   */
  initVoices(retryCount = 0) {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.getAvailableVoices();
      if (!voices || voices.length === 0) {
        if (retryCount < 20) {
          setTimeout(() => this.initVoices(retryCount + 1), 250);
        }
        return;
      }

      if (this.selectedVoiceURI && this.selectedVoiceURI !== 'auto') {
        this.selectedVoice = voices.find((v) => v.voiceURI === this.selectedVoiceURI) || null;
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => loadVoices();
    }
  }

  /**
   * Return voices strictly filtered to female voices
   */
  getAvailableVoices() {
    if (!this.synth) return [];
    const all = this.synth.getVoices();
    const femaleOnly = all.filter((v) => isFemaleVoice(v));
    return femaleOnly;
  }

  /**
   * Find highest fidelity realistic female voice for target language
   * Implements the exact Voice Selection Hierarchy from PROJECT_DOCUMENTATION.md Section 4.1 & 4.2
   */
  getBestRealisticVoice(targetLang = 'en-US') {
    const candidateVoices = this.getAvailableVoices();
    if (!candidateVoices || candidateVoices.length === 0) return null;

    const langLower = targetLang.toLowerCase();

    // 1. Bengali (bn-IN) - Edge Natural (Tanishaa, Nabami) / Google Bengali
    if (langLower.startsWith('bn')) {
      return (
        candidateVoices.find((v) => /Tanishaa.*Natural/i.test(v.name) || /Nabami.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Tanishaa/i.test(v.name) || /Nabami/i.test(v.name)) ||
        candidateVoices.find((v) => /Google.*(?:বাংলা|Bengali)/i.test(v.name)) ||
        candidateVoices.find((v) => (v.lang.startsWith('bn') || v.lang.replace('_', '-').startsWith('bn'))) ||
        candidateVoices.find((v) => v.name.includes('বাংলা') || v.name.includes('Bengali')) ||
        candidateVoices.find((v) => /Neerja.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Heera|Veena/i.test(v.name)) ||
        null
      );
    }

    // 2. Punjabi (pa-IN) - Edge Natural (Gurpreet) / Google Punjabi
    if (langLower.startsWith('pa')) {
      return (
        candidateVoices.find((v) => /Gurpreet.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Gurpreet/i.test(v.name)) ||
        candidateVoices.find((v) => /Google.*(?:ਪੰਜਾਬੀ|Punjabi)/i.test(v.name)) ||
        candidateVoices.find((v) => (v.lang.startsWith('pa') || v.lang.replace('_', '-').startsWith('pa'))) ||
        candidateVoices.find((v) => v.name.includes('ਪੰਜਾਬੀ') || v.name.includes('Punjabi')) ||
        candidateVoices.find((v) => /Neerja.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Heera|Veena/i.test(v.name)) ||
        null
      );
    }

    // 3. Gujarati (gu-IN) - Edge Natural (Dhwani) / Google Gujarati
    if (langLower.startsWith('gu')) {
      return (
        candidateVoices.find((v) => /Dhwani.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Dhwani/i.test(v.name)) ||
        candidateVoices.find((v) => /Google.*(?:ગુજરાતી|Gujarati)/i.test(v.name)) ||
        candidateVoices.find((v) => (v.lang.startsWith('gu') || v.lang.replace('_', '-').startsWith('gu'))) ||
        candidateVoices.find((v) => v.name.includes('ગુજરાતી') || v.name.includes('Gujarati')) ||
        candidateVoices.find((v) => /Neerja.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Heera|Veena/i.test(v.name)) ||
        null
      );
    }

    // 4. Hindi / Hinglish (hi-IN) - Edge Natural (Swara, Kalpana) / Google Hindi / Neerja
    if (langLower.startsWith('hi')) {
      return (
        candidateVoices.find((v) => /Swara.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Swara/i.test(v.name)) ||
        candidateVoices.find((v) => /Google.*(?:हिन्दी|Hindi)/i.test(v.name)) ||
        candidateVoices.find((v) => (v.lang.startsWith('hi') || v.lang.replace('_', '-').startsWith('hi'))) ||
        candidateVoices.find((v) => v.name.includes('हिन्दी') || v.name.includes('Hindi')) ||
        candidateVoices.find((v) => /Kalpana/i.test(v.name)) ||
        candidateVoices.find((v) => /Neerja.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Neerja/i.test(v.name)) ||
        candidateVoices.find((v) => /Heera|Veena/i.test(v.name)) ||
        null
      );
    }

    // 5. UK English (en-GB) - Edge Natural (Sonia, Libby, Maisie) / Google UK English Female
    if (langLower === 'en-gb' || langLower.startsWith('en-gb')) {
      return (
        candidateVoices.find((v) => /Sonia.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Libby.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Maisie.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Serena/i.test(v.name)) ||
        candidateVoices.find((v) => v.name === 'Google UK English Female') ||
        candidateVoices.find((v) => v.lang.startsWith('en-GB') || v.lang.startsWith('en_GB')) ||
        candidateVoices.find((v) => /Ava.*Natural/i.test(v.name)) ||
        null
      );
    }

    // 6. Indian English (en-IN) - Edge Natural (Neerja) / Heera / Veena / Google India
    if (langLower === 'en-in' || langLower.startsWith('en-in')) {
      return (
        candidateVoices.find((v) => /Neerja.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Neerja/i.test(v.name)) ||
        candidateVoices.find((v) => /Veena/i.test(v.name)) ||
        candidateVoices.find((v) => /Heera/i.test(v.name)) ||
        candidateVoices.find((v) => /Google.*(?:India|English)/i.test(v.name) && (v.lang.startsWith('en-IN') || v.lang.startsWith('en_IN'))) ||
        candidateVoices.find((v) => v.lang.startsWith('en-IN') || v.lang.startsWith('en_IN')) ||
        candidateVoices.find((v) => /Ava.*Natural/i.test(v.name)) ||
        null
      );
    }

    // 7. Japanese (ja-JP)
    if (langLower.startsWith('ja')) {
      return (
        candidateVoices.find((v) => /Nanami.*Natural|Aoi.*Natural/i.test(v.name)) ||
        candidateVoices.find((v) => /Google.*日本語/i.test(v.name)) ||
        candidateVoices.find((v) => v.lang.startsWith('ja')) ||
        null
      );
    }

    // 8. Default US English & International fallback
    // Priority 1: Edge Natural Female Voices
    // Priority 2: Indian English Neural Female Voices
    // Priority 3: Google Cloud Female Voices
    // Priority 4: Apple Natural Voices (Samantha, Karen, Moira, Tessa)
    // Priority 5: Any English Female Voice
    return (
      candidateVoices.find((v) => /Ava.*Natural/i.test(v.name) && v.lang.startsWith('en')) ||
      candidateVoices.find((v) => /Jenny.*Natural/i.test(v.name) && v.lang.startsWith('en')) ||
      candidateVoices.find((v) => /Aria.*Natural/i.test(v.name) && v.lang.startsWith('en')) ||
      candidateVoices.find((v) => /Neerja.*Natural/i.test(v.name)) ||
      candidateVoices.find((v) => /Neerja/i.test(v.name)) ||
      candidateVoices.find((v) => /Heera/i.test(v.name)) ||
      candidateVoices.find((v) => v.name === 'Google UK English Female') ||
      candidateVoices.find((v) => v.name === 'Google US English') ||
      candidateVoices.find((v) => v.name.startsWith('Google') && v.lang.startsWith('en')) ||
      candidateVoices.find((v) => /Samantha/i.test(v.name)) ||
      candidateVoices.find((v) => /Karen/i.test(v.name)) ||
      candidateVoices.find((v) => /Moira/i.test(v.name)) ||
      candidateVoices.find((v) => /Tessa/i.test(v.name)) ||
      candidateVoices.find((v) => /Zira/i.test(v.name)) ||
      candidateVoices.find((v) => /Hazel/i.test(v.name)) ||
      candidateVoices.find((v) => /Emma/i.test(v.name) && v.lang.startsWith('en')) ||
      candidateVoices.find((v) => v.lang.startsWith('en') && isFemaleVoice(v)) ||
      candidateVoices.find((v) => isFemaleVoice(v)) ||
      null
    );
  }

  setTTSEngine(engine) {
    this.ttsEngine = engine;
    localStorage.setItem('raya_tts_engine', engine);
    if (engine === 'kokoro' && this.kokoroService && this.kokoroService.status === 'idle') {
      this.kokoroService.init().catch(() => {});
    }
  }

  setKokoroVoice(voiceId) {
    if (this.kokoroService) {
      this.kokoroService.setVoice(voiceId);
    }
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

  /**
   * Primary Speech Entrypoint
   * Seamlessly routes between Kokoro Neural AI (studio-grade default for English)
   * and Web Speech API (Edge Natural / Chrome Cloud / Safari Enhanced) for
   * Bengali, Hindi, Punjabi, Gujarati, etc., with zero-latency fallback during loading.
   */
  speak(text) {
    if (!this.autoSpeak || !text) return;

    // Comprehensive emoji cleaner
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

    const cleanText = text
      .replace(/\[.*?\]/g, '')
      .replace(/\{"action".*?\}/g, '')
      .replace(emojiRegex, '')
      .replace(/[*_#~`\\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!cleanText) return;

    // Stop ongoing speech across both Kokoro and Web Speech
    this.stopSpeaking();

    const detectedLang = detectLanguage(cleanText);

    // KOKORO ROUTING & RESILIENT FALLBACK:
    // 1. If engine is 'kokoro' (default), check if Kokoro can speak this language.
    //    Kokoro 82M supports English ('en-US', 'en-GB', 'en-IN').
    // 2. If language is Bengali, Hindi, Punjabi, Gujarati:
    //    Kokoro cannot pronounce these authentically. The system automatically
    //    routes to the authentic Web Speech Natural Voice (Tanishaa, Swara, Gurpreet, Dhwani).
    // 3. If language is English:
    //    - If Kokoro is ready: speaks with Kokoro. If an error occurs, instantly falls back to Web Speech.
    //    - If Kokoro is loading or idle: kicks off init() in background, and speaks via Web Speech
    //      immediately so user never experiences silence!
    const shouldUseKokoro =
      this.ttsEngine === 'kokoro' &&
      this.kokoroService &&
      this.kokoroService.isSupported() &&
      this.kokoroService.isLanguageSupported(detectedLang);

    if (shouldUseKokoro) {
      if (this.kokoroService.status === 'ready') {
        this.isSpeaking = true;
        if (this.onSpeechStatus) this.onSpeechStatus('speaking');

        this.kokoroService
          .speak(
            cleanText,
            detectedLang,
            () => {
              this.isSpeaking = true;
              if (this.onSpeechStatus) this.onSpeechStatus('speaking');
            },
            () => {
              this.isSpeaking = false;
              if (this.onSpeechStatus) this.onSpeechStatus('idle');
            }
          )
          .catch((err) => {
            console.warn('[VoiceService] Kokoro playback failed, falling back to Web Speech:', err);
            this.speakWebSpeech(cleanText, detectedLang);
          });
        return;
      } else {
        console.log('[VoiceService] Kokoro is loading in background, falling back to Web Speech for zero-delay response...');
        if (!isMobileDevice()) {
          this.kokoroService.init().catch(() => {});
        }
        this.speakWebSpeech(cleanText, detectedLang);
        return;
      }
    }

    // Default Web Speech API for Hindi, Bengali, Punjabi, Gujarati or when Web Speech is chosen
    this.speakWebSpeech(cleanText, detectedLang);
  }

  /**
   * Speak synthesized voice via Web Speech API across all browsers with Edge Natural fallback recovery,
   * phonetic transliteration, Chrome GC shielding, continuous sentence chaining, and resilient lip sync.
   */
  speakWebSpeech(cleanText, detectedLang) {
    if (!this.synth) return;

    // Invalidate any previous ongoing speech session
    this._speechSessionId = (this._speechSessionId || 0) + 1;
    const sessionId = this._speechSessionId;

    if (this.synth.paused) {
      try { this.synth.resume(); } catch (e) {}
    }

    // Determine the optimal realistic voice for this specific utterance
    let voiceToUse = null;
    if (this.selectedVoiceURI === 'auto' || !this.selectedVoice) {
      voiceToUse = this.getBestRealisticVoice(detectedLang);
    } else {
      const isDevanagari = /[\u0900-\u097F]/.test(cleanText);
      const isBengali = /[\u0980-\u09FF]/.test(cleanText);
      if (
        (isDevanagari && !this.selectedVoice.lang.startsWith('hi')) ||
        (isBengali && !this.selectedVoice.lang.startsWith('bn'))
      ) {
        voiceToUse = this.getBestRealisticVoice(detectedLang);
      } else {
        voiceToUse = this.selectedVoice;
      }
    }

    // Transliterate Romanized speech text into native script for authentic Edge Natural TTS synthesis
    let spokenScriptText = getNativeScriptForTTS(cleanText, detectedLang);

    // Fallback: If text contains Devanagari Hindi but chosen voice is English-only, transliterate to Roman Latin
    const isDevanagari = /[\u0900-\u097F]/.test(spokenScriptText);
    const voiceLang = (voiceToUse?.lang || '').toLowerCase();
    if (isDevanagari && !voiceLang.startsWith('hi')) {
      spokenScriptText = transliterateDevanagari(spokenScriptText);
    }

    // Natural sentence splitting: divides text by punctuation so each utterance is short (2-5s),
    // 100% avoiding the 15-second Chromium engine crash/stall and keeping lip sync perfectly continuous.
    const rawSentences = spokenScriptText.match(/[^.!?\n]+[.!?\n]*/g) || [spokenScriptText];
    const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);
    if (sentences.length === 0) return;

    let currentIndex = 0;
    let keepAliveTimer = null;
    let speechEnded = false;

    const cleanup = () => {
      if (speechEnded || sessionId !== this._speechSessionId) return;
      speechEnded = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      window._currentRayaUtterance = null;
      this.currentUtterance = null;
      this.isSpeaking = false;
      if (this.lipSyncEngine) {
        this.lipSyncEngine.stopSyntheticSpeech();
      }
      if (this.onSpeechStatus) this.onSpeechStatus('idle');

      // Cooldown timer to prevent mic feedback echo
      if (this._cooldownTimeoutId) clearTimeout(this._cooldownTimeoutId);
      this._cooldownTimeoutId = setTimeout(() => {
        this._wakeWordCooldown = false;
        this._cooldownTimeoutId = null;
      }, 1200);
    };

    const speakSentence = () => {
      if (sessionId !== this._speechSessionId || speechEnded) return;
      if (currentIndex >= sentences.length) {
        cleanup();
        return;
      }

      const sentenceText = sentences[currentIndex];
      const utterance = new SpeechSynthesisUtterance(sentenceText);

      if (voiceToUse) {
        utterance.voice = voiceToUse;
        utterance.lang = voiceToUse.lang || detectedLang;
      } else {
        utterance.lang = detectedLang;
      }

      // Edge Natural voice pitch protection
      const isEdgeNatural = voiceToUse && /Natural/i.test(voiceToUse.name);
      utterance.pitch = isEdgeNatural ? 1.0 : (this.pitch || 1.35);
      utterance.rate = this.rate || 1.10;
      utterance.volume = 1.0;

      // Retain strong reference on window to prevent Chrome garbage collecting active utterance
      window._currentRayaUtterance = utterance;
      this.currentUtterance = utterance;

      utterance.onstart = () => {
        if (sessionId !== this._speechSessionId) return;
        this.isSpeaking = true;
        if (this.lipSyncEngine) {
          this.lipSyncEngine.startSyntheticSpeech();
        }
        if (this.onSpeechStatus) this.onSpeechStatus('speaking');
      };

      // Built-in boundary hook: word events keep lip-sync synchronized and continuously active
      utterance.onboundary = () => {
        if (sessionId !== this._speechSessionId) return;
        if (this.lipSyncEngine && !this.lipSyncEngine.isSyntheticSpeaking) {
          this.lipSyncEngine.startSyntheticSpeech();
        }
      };

      utterance.onend = () => {
        if (sessionId !== this._speechSessionId) return;
        currentIndex++;
        if (currentIndex < sentences.length) {
          speakSentence();
        } else {
          cleanup();
        }
      };

      utterance.onerror = (e) => {
        if (sessionId !== this._speechSessionId) return;
        if (e.error === 'interrupted' || e.error === 'canceled') {
          cleanup();
          return;
        }
        console.warn('[VoiceService] Sentence speech error:', e.error);
        currentIndex++;
        if (currentIndex < sentences.length) {
          speakSentence();
        } else {
          cleanup();
        }
      };

      try {
        this.synth.speak(utterance);
        if (this.synth.paused) {
          try { this.synth.resume(); } catch (e) {}
        }
      } catch (e) {
        console.error('[VoiceService] synth.speak threw error:', e);
        currentIndex++;
        if (currentIndex < sentences.length) {
          speakSentence();
        } else {
          cleanup();
        }
      }
    };

    // Chromium keep-alive: prevents Chromium background audio worker pause bug
    keepAliveTimer = setInterval(() => {
      if (sessionId === this._speechSessionId && this.isSpeaking && this.synth.speaking) {
        try {
          this.synth.pause();
          this.synth.resume();
        } catch (e) {}
      }
    }, 4500);

    // Generous fallback safety timeout in case of an unhandled browser audio hang
    const wordCount = cleanText.split(/\s+/).length;
    const maxSafetyMs = Math.max(60000, wordCount * 1800 + 30000);
    setTimeout(() => {
      if (sessionId === this._speechSessionId && this.isSpeaking && !speechEnded) {
        console.warn('[VoiceService] Maximum safety timeout reached, closing speech session.');
        cleanup();
      }
    }, maxSafetyMs);

    // Cancel previous and start cleanly
    const isEdge = /Edg\//.test(navigator.userAgent);
    if (this.synth.speaking || this.synth.pending) {
      try { this.synth.cancel(); } catch (e) {}
      if (isEdge) {
        setTimeout(() => speakSentence(), 120);
      } else {
        speakSentence();
      }
    } else {
      speakSentence();
    }
  }

  stopSpeaking() {
    this._speechSessionId = (this._speechSessionId || 0) + 1;
    if (this.kokoroService) {
      try { this.kokoroService.stop(); } catch (e) {}
    }
    if (this.synth) {
      try { this.synth.cancel(); } catch (e) {}
      if (this.synth.paused) {
        try { this.synth.resume(); } catch (e) {}
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
