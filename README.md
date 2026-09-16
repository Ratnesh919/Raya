# Raya AI Assistant — 3D Interactive VRM Companion

[![Live Demo](https://img.shields.io/badge/Live_Demo-rayaai919.netlify.app-00f2fe?style=for-the-badge&logo=netlify)](https://rayaai919.netlify.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Ratnesh919%2FRaya-a855f7?style=for-the-badge&logo=github)](https://github.com/Ratnesh919/Raya)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

An expressive, responsive 3D AI companion web application featuring real-time conversational chat, voice interaction (STT & TTS), facial emotion blending, procedural life simulation, audio-reactive lip-sync, and persistent memory powered by **Netlify Blobs Database**.

---

## 🌐 Live Access & Repository
- **Live Application**: [https://rayaai919.netlify.app](https://rayaai919.netlify.app)
- **GitHub Repository**: [https://github.com/Ratnesh919/Raya](https://github.com/Ratnesh919/Raya)

---

## ✨ Key Features

- **3D VRM Avatars**:
  - Integrated with `@pixiv/three-vrm` supporting both VRM 0.0 & VRM 1.0 standards.
  - Preloaded roster: **Changli (Default)**, **Camellya**, **Yinlin**, and **Yangyang**.
  - **Drag & Drop Custom VRMs**: Drop any `.vrm` or `.glb` model directly into the browser to load your own avatar on the fly!
- **🧠 Netlify Database Memory**:
  - Powered by **Netlify Blobs** (`@netlify/blobs`) and **Netlify Functions** (`@netlify/functions`).
  - Persistent serverless data store: Raya remembers your name, interests, and conversational facts across visits.
  - Zero external database configuration needed — automatically connects to Netlify platform storage.
  - Client-side fallback to `localStorage` when running offline or in local development.
- **Natural Voice & Lip-Sync**:
  - Web Speech API speech synthesis with automatic browser autoplay unpausing and Chromium GC safeguards.
  - Natural multilingual phonetic pronunciation for English and Romanized Hinglish.
  - Audio-reactive viseme synthesizer generating dynamic mouth shapes (`aa`, `ee`, `ih`, `oh`, `ou`) in sync with voice output.
- **Life Simulation & Expressions (AIRI-Inspired)**:
  - Procedural spine/chest breathing oscillation.
  - Natural blinking with randomized intervals.
  - Micro eye saccades and smooth cursor gaze tracking.
  - Cubic smooth expression blending: **Happy**, **Surprised**, **Sad**, **Angry**, **Think**, **Wink**, and **Neutral**.
- **Privacy First & Secure AI Connections**:
  - Direct connection to **Google Gemini** (Gemini 2.0 Flash / 1.5 Flash), **Groq** (Llama 3.3 70B), **OpenAI** (GPT-4o Mini), or **OpenRouter**.
  - **Zero Keys in Repo**: All API keys are stored strictly in client-side `localStorage` or inputted via the Settings modal. No secrets or credentials are ever tracked or committed.
- **Modern Cyberpunk UI**:
  - Glassmorphic interface with floating chat dock, appearance adjustments popover (skin/hair/lighting brightness), and conversation history drawer.

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Ratnesh919/Raya.git
cd Raya
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Connect Your AI Provider
1. Click the **⚙️ Settings** icon in the top right.
2. Select your AI provider (e.g. **Google Gemini** or **Groq**).
3. Paste your free API key:
   - **Google Gemini**: [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **Groq**: [Groq Console](https://console.groq.com/keys)
   - **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
   - **OpenRouter**: [OpenRouter Keys](https://openrouter.ai/keys)
4. Click **Save Settings**.

### 4. Talk to Raya!
- **Type**: Type in the bottom floating dock and press Enter.
- **Voice**: Click the circular microphone icon and speak naturally. Raya will listen, reply, speak back, emote, and remember details about you in her database!

---

## 📁 Project Architecture

```
Raya/
├── index.html                 # Main web shell with glassmorphic viewport
├── netlify.toml               # Netlify build, redirects, and serverless functions config
├── vite.config.js             # Vite development & asset bundling configuration
├── package.json               # Three.js, @pixiv/three-vrm, @netlify/blobs dependencies
├── netlify/
│   └── functions/
│       └── memory.mts         # Netlify Serverless Function managing Blobs Database
├── public/
│   ├── animations/            # Mixamo FBX animations (Idle, Happy, Wave, etc.)
│   └── models/                # VRM character models (Changli, Camellya, Yinlin, Yangyang)
└── src/
    ├── main.js                # App bootstrap, render loop, and memory initialization
    ├── ai/
    │   ├── MemoryService.js   # Netlify Database client with local-storage fallback
    │   ├── LLMService.js      # Direct AI client (Gemini, Groq, OpenAI, OpenRouter)
    │   ├── PromptEngine.js    # System persona and memory context injection
    │   └── VoiceService.js    # Web Speech API voice synthesis & recognition
    ├── vrm/
    │   ├── VRMManager.js      # Three.js scene, lighting, camera, and VRM loader
    │   ├── AnimationEngine.js # Humanoid bone retargeting & finger poses
    │   ├── ExpressionManager.js # Emotion blendshape state interpolator
    │   ├── LipSyncEngine.js   # Audio viseme analyzer and mouth sync
    │   └── LifeSimulator.js   # Breathing, blinking, saccades, and gaze tracking
    ├── ui/
    │   ├── ChatUI.js          # Chat dock, conversation drawer, and memory widget
    │   ├── ControlsHUD.js     # Model switcher and camera toggles
    │   └── SettingsModal.js   # API key input and voice tuning
    └── styles/
        └── main.css           # Futuristic glassmorphic stylesheet
```

---

## 🔒 Security & Privacy Statement

- **No Secrets in Repo**: No API keys, credentials, or personal tokens are stored in the codebase or git history.
- **Local Key Storage**: API keys entered in the browser are kept exclusively in the user's private browser `localStorage`.
- **Database Privacy**: Data stored via Netlify Blobs is scoped to the companion memory store for user personalization and can be reset at any time via the "Reset" button in the conversation drawer.

---

## 📜 License

MIT License © 2026 Ratnesh
