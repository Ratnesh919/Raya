# AGENTS.md — Raya AI Assistant

Raya is a real-time 3D AI companion with expressive VRM animations, voice synthesis, lip-sync, and adaptive emotional personas.

## Essential Commands
- `npm run dev`: Launch local Vite dev server
- `npm run build`: Production build to `dist/`
- `npm run preview`: Preview production build
- Pushing to GitHub: `git push origin main` (triggers Netlify auto-deploy; DO NOT deploy via Netlify CLI directly)

## Feature-to-File Map
- **3D Avatar & Scene**: `src/vrm/VRMManager.js` (Three.js scene, camera orbit, lighting, controls)
- **FBX/VRM Animations**: `src/vrm/AnimationLoader.js` (sequential FBX loading, bone retargeting)
- **Facial Expressions**: `src/vrm/ExpressionManager.js` (blendshapes, emotion mapping, zero-bind fallbacks)
- **Lip Sync Engine**: `src/vrm/LipSyncEngine.js` (sustained speech mouth articulation, vowel blendshapes)
- **Life Simulation & Physics**: `src/vrm/LifeSimulator.js` (breathing, blinks, micro-sway), `src/vrm/ChestPhysics.js`, `src/vrm/HairPhysics.js`
- **Personality System**: `src/ai/PersonalityEngine.js` (Auto-adaptive & 7 personas: caring, flirty, loving, playful, wise, relaxed)
- **LLM & Reasoning**: `src/ai/LLMService.js`, `src/ai/PromptEngine.js`, `src/ai/MemoryEngine.js`
- **Voice & Speech**: `src/ai/VoiceService.js` (Kokoro TTS, Web Speech fallback), `src/ai/STTService.js`
- **Vision**: `src/ai/VisionService.js`
- **UI & Controls**: `src/ui/ChatUI.js` (drawer, mic, text input, personality chip), `src/ui/SettingsModal.js`
- **App Entry & Wiring**: `src/main.js`, `index.html`, `src/styles/main.css`

## Knowledge Graph Workflow (Mandatory)
- **Before modifying any feature**: Query the graph first using `graphify query "<feature or task description>"` to locate caller/callee relationships, imports, and affected flows without scanning files.
- **After code changes**: Run `graphify update .` to keep the dependency graph in sync.
- **Visual inspection**: Open `graphify-out/graph.html` or `graphify-out/GRAPH_TREE.html` for architecture overviews.

## Directories & Files to Avoid
- `public/models/`, `public/animations/`, `public/audio/` (heavy binary assets: .vrm, .fbx, audio)
- `node_modules/`, `dist/`, `graphify-out/cache/`
- NEVER read 3D model binaries (`.vrm`, `.fbx`, `.glb`) directly

