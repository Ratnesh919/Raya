# Graph Report - raya ai assistant  (2026-10-23)

## Corpus Check
- 32 files · ~3,438,693 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: .fbx 16, .vrm 5, (none) 2)

## Summary
- 329 nodes · 532 edges · 23 communities (10 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f4248beb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- VoiceService
- main.js
- LLMService
- ExpressionManager
- bootstrap
- ChatUI
- AnimationEngine
- SettingsModal.js
- LoaderAnimation
- compilerOptions
- PersonalityEngine
- ✨ Key Features
- LipSyncEngine
- LifeSimulator
- vercel.json
- AGENTS.md — Raya AI Assistant
- components.json
- dependencies
- MemoryService
- KokoroService

## God Nodes (most connected - your core abstractions)
1. `bootstrap()` - 31 edges
2. `LLMService` - 21 edges
3. `VRMManager` - 21 edges
4. `VoiceService` - 17 edges
5. `ChatUI` - 17 edges
6. `compilerOptions` - 15 edges
7. `LifeSimulator` - 14 edges
8. `KokoroService` - 13 edges
9. `PersonalityEngine` - 13 edges
10. `AnimationEngine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `LLMService`  [EXTRACTED]
  src/main.js → src/ai/LLMService.js
- `bootstrap()` --calls--> `MemoryService`  [EXTRACTED]
  src/main.js → src/ai/MemoryService.js
- `bootstrap()` --calls--> `PersonalityEngine`  [EXTRACTED]
  src/main.js → src/ai/PersonalityEngine.js
- `bootstrap()` --calls--> `VoiceService`  [EXTRACTED]
  src/main.js → src/ai/VoiceService.js
- `bootstrap()` --calls--> `ChatUI`  [EXTRACTED]
  src/main.js → src/ui/ChatUI.js

## Import Cycles
- None detected.

## Communities (23 total, 13 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.06
Nodes (22): config, DEFAULT_MEMORY, UserMemory, devDependencies, vite, name, private, scripts (+14 more)

### Community 1 - "VoiceService"
Cohesion: 0.14
Nodes (8): KOKORO_SUPPORTED_LANGS, KOKORO_VOICES, detectLanguage(), getNativeScriptForTTS(), isFemaleVoice(), isMobileDevice(), transliterateDevanagari(), VoiceService

### Community 2 - "main.js"
Cohesion: 0.12
Nodes (10): @pixiv/three-vrm, three, PERSONALITY_MODES, PERSONALITY_PROFILES, ChestPhysics, EXPR_ALIASES, BONE_CANDIDATES, FBXAvatarLoader (+2 more)

### Community 7 - "AnimationEngine"
Cohesion: 0.25
Nodes (4): AnimationEngine, findRigNode(), getRigNodeMap(), MIXAMO_VRM_RIG_MAP

### Community 8 - "SettingsModal.js"
Cohesion: 0.26
Nodes (6): DEFAULT_MODELS, PROVIDERS, DEFAULT_SYSTEM_PROMPT, parseRayaResponse(), isRealisticVoice(), SettingsModal

### Community 10 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+8 more)

### Community 12 - "✨ Key Features"
Cohesion: 0.10
Nodes (20): 1. Clone & Install Dependencies, 2. Run Local Development Server, 3. Connect Your AI Provider, 🎮 3D Viewport & Interactive Controls, 4. Talk to Raya!, 🕹️ Controls Guide, 🎭 Flexible Multi-Personality System, 🌀 Holographic Cyberpunk Boot Sequence (Anime.js & Design Spells) (+12 more)

### Community 16 - "AGENTS.md — Raya AI Assistant"
Cohesion: 0.33
Nodes (5): AGENTS.md — Raya AI Assistant, Directories & Files to Avoid, Essential Commands, Feature-to-File Map, Knowledge Graph Workflow (Mandatory)

### Community 17 - "components.json"
Cohesion: 0.14
Nodes (13): aliases, components, ui, utils, rsc, $schema, style, tailwind (+5 more)

### Community 18 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, animejs, kokoro-js, @netlify/blobs, @netlify/functions, @pixiv/three-vrm, @pixiv/three-vrm-animation, react (+3 more)

## Knowledge Gaps
- **4 isolated node(s):** `@pixiv/three-vrm-animation`, `animejs`, `react`, `react-dom`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 123 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `main.js` to `package.json`, `AnimationEngine`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `bootstrap()` (e.g. with `main.js` and `.setMemoryService()`) actually correct?**
  _`bootstrap()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@pixiv/three-vrm-animation`, `animejs`, `react` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.062388591800356503 - nodes in this community are weakly interconnected._
- **Why does `bootstrap()` connect `bootstrap` to `VoiceService`, `main.js`, `LLMService`, `ExpressionManager`, `ChatUI`, `AnimationEngine`, `SettingsModal.js`, `LoaderAnimation`, `PersonalityEngine`, `LipSyncEngine`, `LifeSimulator`, `MemoryService`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Should `VoiceService` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._
- **Why does `LLMService` connect `LLMService` to `SettingsModal.js`, `main.js`, `bootstrap`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._