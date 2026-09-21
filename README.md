# Raya AI Assistant — 3D Interactive VRM Companion

[![Live Demo](https://img.shields.io/badge/Live_Demo-rayaai919.netlify.app-00f2fe?style=for-the-badge&logo=netlify)](https://rayaai919.netlify.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Ratnesh919%2FRaya-a855f7?style=for-the-badge&logo=github)](https://github.com/Ratnesh919/Raya)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

An expressive, ultra-responsive 3D AI companion web application featuring real-time conversational chat, voice interaction (STT & TTS), facial emotion blending, procedural life simulation, audio-synchronized phonetic lip-sync, full 3D orbital camera controls, and persistent companion memory powered by **Netlify Blobs Database**.

---

## 🌐 Live Access & Repository
- **Live Application**: [https://rayaai919.netlify.app](https://rayaai919.netlify.app)
- **GitHub Repository**: [https://github.com/Ratnesh919/Raya](https://github.com/Ratnesh919/Raya)

---

## ✨ Key Features

### 🎮 3D Viewport & Interactive Controls
- **Full 3D Orbital Camera (Right-Click Drag)**:
  - **Horizontal Drag (`deltaX`)**: Orbits the camera 360° around the avatar (azimuth $\theta$).
  - **Vertical Drag (`deltaY`)**: Tilts the camera angle vertically (pitch / polar elevation $\phi$) to view Raya from dramatic high angles (overhead, face, hair) or low angles (waist, legs, feet).
  - **Safe Gimbal Clamping**: Constrained between $\sim 7^\circ$ and $\sim 115^\circ$ to prevent camera flipping or clipping through the ground.
- **Avatar Rotation (Left-Click Drag)**:
  - Rotates the character model horizontally in place around her vertical axis.
- **Line-of-Sight Zoom (Mouse Wheel & Pinch)**:
  - Zooms directly along the 3D camera's active line of sight towards the character focal point (clamped between $0.7\text{m}$ and $6.5\text{m}$).
- **Camera Mode Presets**:
  - One-click toggle between **Portrait Close-Up** and **Full Body** framing with smooth interpolated transitions.

### 🎭 Realistic Human Life Simulation & Gaze Tracking
- **Anatomical Gaze & Head Tracking**:
  - Head and eyes track cursor movement and follow the 3D camera in real time.
  - Realistic cervical spine turning limit ($\sim 68^\circ$ active range; ceases naturally without spinning $360^\circ$, smoothly relaxing forward when turned away).
- **Subconscious Micro-Animations**:
  - Procedural chest and spine respiration oscillation.
  - Natural blinking with randomized timing intervals.
  - Micro-saccadic eye movement preventing stare stiffness.
- **Facial Emotion Blending**:
  - Smooth cubic interpolation across emotional expressions: **Happy**, **Joy**, **Surprised**, **Sad**, **Angry**, **Relaxed**, **Think**, **Wink**, **Blush**, **Caring**, and **Neutral**.

### 🗣️ Phonetic Word-Synchronized Lip-Sync
- **TTS Word Boundary Synchronization**:
  - Listens directly to speech synthesis `utterance.onboundary` events to drive viseme shapes in exact synchrony with vocalized words.
- **Multilingual Phonetic Mapping (English & Hindi)**:
  - Maps spoken words and Devanagari Hindi characters to anatomical VRM visemes:
    - `a` / `अ` / `आ` $\to$ wide open jaw (`aa`)
    - `e` / `ए` / `ऐ` $\to$ stretched smile (`ee`)
    - `i` / `y` / `इ` / `ई` $\to$ teeth show (`ih`)
    - `o` / `ओ` $\to$ rounded mouth (`oh`)
    - `u` / `w` / `उ` / `ऊ` $\to$ puckered lips (`ou`)
- **Conversational Syllable Cadence**:
  - Calmed speech carrier to natural human cadence ($\approx 3.0\text{ Hz}$ / ~3 syllables/sec).
  - Organic jaw aperture ($0.25 - 0.88$) that remains active throughout speech without mid-sentence freezing or abrupt zero-clamping.
  - Soft-tissue damping (`attack: 18.0`, `release: 14.0`) giving human facial elasticity.

### ⚡ Zero-Lag High Performance Architecture
- **0 Garbage Collection Allocations per Frame**: Pre-allocated scratch vectors and quaternions in the 60 FPS animation loop eliminate GC stuttering.
- **$O(1)$ Animation Retargeting**: Fast bone lookup map avoids recursive scene hierarchy traversals.
- **Mixamo FBX Retargeting with Finger Bones**: Retargets humanoid animations with full finger posing and zero T-pose startup glitches.
- **Hardware-Accelerated Web Speech**: Instant-start, zero-RAM native TTS/STT, with optional neural Kokoro-82M ONNX model in Settings.

### 🧠 Persistent Companion Memory
- **Netlify Blobs Database**:
  - Built with `@netlify/blobs` and serverless `@netlify/functions`.
  - Automatically remembers the user's name, interests, and conversational context across sessions without external database setup.
  - Seamless fallback to browser `localStorage` when developing locally or offline.

### 🔒 Privacy-First AI Integration
- **Direct LLM Connections**: Connects directly to **Google Gemini** (Gemini 2.0 Flash / 1.5 Flash), **Groq** (Llama 3.3 70B), **OpenAI** (GPT-4o Mini), or **OpenRouter**.
- **Zero Secrets in Repository**: API keys are saved exclusively in client-side `localStorage`.

---

## 🕹️ Controls Guide

| Action | Desktop Interaction | Mobile / Touch Interaction |
| :--- | :--- | :--- |
| **Rotate Avatar** | Left-Click and drag horizontally | 1-Finger drag horizontally |
| **3D Camera Orbit & Tilt** | Right-Click and drag in any direction | — |
| **Zoom In / Out** | Mouse scroll wheel | 2-Finger pinch |
| **Toggle Portrait / Full Body** | Click camera icon (top bar) | Tap camera icon (top bar) |
| **Voice Chat** | Click microphone button (bottom dock) | Tap microphone button (bottom dock) |
| **Appearance Popover** | Click palette icon (top bar) | Tap palette icon (top bar) |
| **Settings & AI Keys** | Click gear icon (top bar) | Tap gear icon (top bar) |

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
3. Enter your API key:
   - **Google Gemini**: [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **Groq**: [Groq Console](https://console.groq.com/keys)
   - **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
   - **OpenRouter**: [OpenRouter Keys](https://openrouter.ai/keys)
4. Click **Save Settings**.

### 4. Talk to Raya!
- **Type**: Enter text in the bottom chat dock and press Enter.
- **Voice**: Click the circular microphone icon and speak naturally. Raya will listen, reply, emote, lip-sync, and remember facts about you in her database!

---

## 📁 Project Structure

```
Raya/
├── index.html                 # Main web shell with glassmorphic viewport
├── netlify.toml               # Netlify build, redirects, and serverless functions config
├── vite.config.js             # Vite build & asset bundling configuration
├── package.json               # Three.js, @pixiv/three-vrm, @netlify/blobs dependencies
├── netlify/
│   └── functions/
│       └── memory.mts         # Netlify Serverless Function managing Blobs Database
├── public/
│   ├── animations/            # Mixamo FBX animations (Idle, Happy, Wave, Dance, etc.)
│   └── models/                # VRM character models (Changli, Camellya, Yinlin, Yangyang)
└── src/
    ├── main.js                # App bootstrap, render loop, and memory initialization
    ├── ai/
    │   ├── MemoryService.js   # Netlify Database client with local-storage fallback
    │   ├── LLMService.js      # Direct AI client (Gemini, Groq, OpenAI, OpenRouter)
    │   ├── PromptEngine.js    # System persona and memory context injection
    │   ├── VoiceService.js    # Web Speech API voice synthesis & boundary tracking
    │   └── KokoroService.js   # Optional Kokoro-82M neural TTS engine
    ├── vrm/
    │   ├── VRMManager.js      # Three.js scene, lighting, 3D orbit camera, and VRM loader
    │   ├── AnimationEngine.js # Humanoid bone retargeting & finger poses
    │   ├── ExpressionManager.js # Emotion blendshape state interpolator
    │   ├── LipSyncEngine.js   # Word-synchronized audio & viseme synthesizer
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
- **Database Privacy**: Data stored via Netlify Blobs is scoped to the companion memory store for user personalization and can be cleared at any time via the "Reset" button in the conversation drawer.

---

## 📜 License

MIT License © 2026 Ratnesh
