# Raya AI Assistant — 3D Interactive VRM Chatbot

An interactive, responsive 3D AI companion web application featuring real-time conversational chat, voice interaction (STT & TTS), facial emotion blending, procedural life simulation, audio-reactive lip-sync, and Mixamo humanoid animation retargeting.

---

## ✨ Features

- **3D VRM Avatars**:
  - Integrated with `@pixiv/three-vrm` supporting both VRM 0.0 & VRM 1.0 standards.
  - Preloaded Wuwa characters (`Changli`, `Jinshi`, `Kid Changli`) and `Xavier Model`.
  - **Drag & Drop Custom VRMs**: Drop any `.vrm` or `.glb` character model directly into the browser to load it on the fly!
- **Animation & Pose Retargeting**:
  - Full bone retargeting mapping Mixamo humanoid FBX files to VRM bones with coordinate normalization.
  - Gestures included: **Wave**, **Happy**, **Excited**, **Yawn**, **Angry**, **No**, **Sitting**, **Sad**, and **Idle**.
  - Procedural finger curls & spreads (`idle`, `pointing`, `wave`, `excited`, `angry`, `happy`).
- **Life Simulation & Expressions (AIRI-Inspired)**:
  - Procedural spine/chest breathing oscillation.
  - Natural blinking with randomized intervals.
  - Micro eye saccades and smooth cursor gaze tracking.
  - Cubic smooth expression blending: **Happy**, **Surprised**, **Sad**, **Angry**, **Think**, **Wink**, and **Neutral**.
- **Real-Time Audio Lip-Sync**:
  - Dynamic vowel blendshapes (`aa`, `ee`, `ih`, `oh`, `ou`) synchronized with voice output.
  - Syllable rhythm synthesizer during Speech Synthesis.
- **Direct Online AI Chat ("Just talk using API key")**:
  - Supports **Google Gemini** (Gemini 2.0 Flash / 1.5 Flash), **Groq** (Llama 3.3 70B), **OpenAI** (GPT-4o Mini), and **OpenRouter**.
  - **Zero Server Setup Needed**: Browser connects directly to the AI provider using your API key.
  - **Privacy First**: All keys are stored client-side in `localStorage`.
- **Hands-Free Voice Mode**:
  - Tap the glowing microphone button or speak directly to talk back and forth with Raya.

---

## 🚀 Quick Start

### 1. Install Dependencies & Start Local Dev Server
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Connect Your API Key
1. Click the **⚙️ Settings** icon in the top right.
2. Select your AI provider (e.g., **Google Gemini** or **Groq**).
3. Paste your API key:
   - **Google Gemini**: Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey).
   - **Groq**: Get a free API key at [Groq Console](https://console.groq.com/keys).
   - **OpenAI**: Get a key at [OpenAI Platform](https://platform.openai.com/api-keys).
   - **OpenRouter**: Get a key at [OpenRouter](https://openrouter.ai/keys).
4. Click **Save Settings**.

### 3. Talk to Raya!
- **Type**: Enter a message in the bottom dock and press Enter.
- **Speak**: Click the glowing circular microphone button and speak naturally. Raya will listen, reply, speak back, emote, and move her lips in sync with her voice!

---

## 📁 Project Structure

```
raya ai assistant/
├── index.html                 # Main web shell with glassmorphic layout
├── vite.config.js             # Vite development & asset configuration
├── package.json               # Three.js & @pixiv/three-vrm dependencies
├── public/
│   ├── animations/            # Mixamo FBX animations (Idle, Wave, Happy, etc.)
│   └── models/                # VRM character models (Changli, Jinshi, Xavier, etc.)
└── src/
    ├── main.js                # Application bootstrapper and render loop
    ├── vrm/
    │   ├── VRMManager.js      # Three.js scene, camera, lighting, and VRM loader
    │   ├── AnimationEngine.js # Mixamo FBX retargeter and procedural finger poses
    │   ├── ExpressionManager.js # Emotion states and smooth cubic lerp
    │   ├── LipSyncEngine.js   # Real-time audio and vowel viseme generator
    │   └── LifeSimulator.js   # Breathing, blinking, saccades, and gaze tracking
    ├── ai/
    │   ├── LLMService.js      # Direct API client (Gemini, Groq, OpenAI, OpenRouter)
    │   ├── PromptEngine.js    # Persona prompt and [emotion] / [action] tag parser
    │   └── VoiceService.js    # Web Speech API STT/TTS voice driver
    ├── ui/
    │   ├── ChatUI.js          # Speech bubble, chat drawer, and typewriter effect
    │   ├── ControlsHUD.js     # Character switcher, animation triggers, and camera
    │   └── SettingsModal.js   # API key input, model picker, and voice tuning
    └── styles/
        └── main.css           # Futuristic cyberpunk glassmorphic UI stylesheet
```

---

## 🌐 Online Deployment

Since the entire application runs client-side:
- **Netlify**: Run `npm run build` and publish the `dist` folder, or connect to GitHub.
- **Vercel**: Deploy the folder directly with Vite preset.
- **GitHub Pages**: Deploy the `dist` folder to GitHub Pages.
