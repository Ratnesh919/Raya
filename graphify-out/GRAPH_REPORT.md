# Graph Report - raya ai assistant  (2026-11-05)

## Corpus Check
- 34 files · ~37,612 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 25 file(s) not represented in the graph (top: .fbx 15, .vrm 5, (none) 2)

## Summary
- 370 nodes · 613 edges · 23 communities (10 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5cddd79e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- VoiceService
- main.js
- SettingsModal.js
- LLMService
- bootstrap
- ChatUI
- AnimationEngine
- KokoroService
- LoaderAnimation
- compilerOptions
- FBXAvatarLoader
- ✨ Key Features
- LipSyncEngine
- LifeSimulator
- vercel.json
- AGENTS.md — Raya AI Assistant
- components.json
- thinking-orbs
- ExpressionManager
- PersonalityEngine

## God Nodes (most connected - your core abstractions)
1. `bootstrap()` - 32 edges
2. `LLMService` - 25 edges
3. `VRMManager` - 24 edges
4. `VoiceService` - 22 edges
5. `ChatUI` - 20 edges
6. `LifeSimulator` - 20 edges
7. `compilerOptions` - 15 edges
8. `ExpressionManager` - 14 edges
9. `KokoroService` - 13 edges
10. `PersonalityEngine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `LLMService`  [EXTRACTED]
  src/main.js → src/ai/LLMService.js
- `bootstrap()` --calls--> `PersonalityEngine`  [EXTRACTED]
  src/main.js → src/ai/PersonalityEngine.js
- `bootstrap()` --calls--> `VoiceService`  [EXTRACTED]
  src/main.js → src/ai/VoiceService.js
- `bootstrap()` --calls--> `ChatUI`  [EXTRACTED]
  src/main.js → src/ui/ChatUI.js
- `bootstrap()` --calls--> `ControlsHUD`  [EXTRACTED]
  src/main.js → src/ui/ControlsHUD.js

## Import Cycles
- None detected.

## Communities (23 total, 13 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.06
Nodes (32): config, DEFAULT_MEMORY, UserMemory, dependencies, animejs, kokoro-js, @netlify/blobs, @netlify/functions (+24 more)

### Community 1 - "VoiceService"
Cohesion: 0.13
Nodes (8): KOKORO_SUPPORTED_LANGS, KOKORO_VOICES, detectLanguage(), getNativeScriptForTTS(), isFemaleVoice(), isMobileDevice(), transliterateDevanagari(), VoiceService

### Community 2 - "main.js"
Cohesion: 0.08
Nodes (14): three, PERSONALITY_MODES, PERSONALITY_PROFILES, findRigNode(), getRigNodeMap(), MIXAMO_VRM_RIG_MAP, BodyCollisionGuard, ChestPhysics (+6 more)

### Community 3 - "SettingsModal.js"
Cohesion: 0.26
Nodes (6): DEFAULT_MODELS, PROVIDERS, DEFAULT_SYSTEM_PROMPT, parseRayaResponse(), isRealisticVoice(), SettingsModal

### Community 5 - "bootstrap"
Cohesion: 0.09
Nodes (4): EXCLUDED_NAME_WORDS, MemoryService, bootstrap(), VRMManager

### Community 10 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+8 more)

### Community 11 - "FBXAvatarLoader"
Cohesion: 0.29
Nodes (4): @pixiv/three-vrm, BONE_CANDIDATES, FBXAvatarLoader, MORPH_TARGET_PRESETS

### Community 12 - "✨ Key Features"
Cohesion: 0.10
Nodes (20): 1. Clone & Install Dependencies, 2. Run Local Development Server, 3. Connect Your AI Provider, 🎮 3D Viewport & Interactive Controls, 4. Talk to Raya!, 🕹️ Controls Guide, 🎭 Flexible Multi-Personality System, 🌀 Holographic Cyberpunk Boot Sequence (Anime.js & Design Spells) (+12 more)

### Community 16 - "AGENTS.md — Raya AI Assistant"
Cohesion: 0.33
Nodes (5): AGENTS.md — Raya AI Assistant, Directories & Files to Avoid, Essential Commands, Feature-to-File Map, Knowledge Graph Workflow (Mandatory)

### Community 17 - "components.json"
Cohesion: 0.14
Nodes (13): aliases, components, ui, utils, rsc, $schema, style, tailwind (+5 more)

## Knowledge Gaps
- **4 isolated node(s):** `@pixiv/three-vrm-animation`, `animejs`, `react`, `react-dom`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 134 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bootstrap()` connect `bootstrap` to `VoiceService`, `main.js`, `SettingsModal.js`, `LLMService`, `PersonalityEngine`, `ChatUI`, `AnimationEngine`, `LoaderAnimation`, `LipSyncEngine`, `LifeSimulator`, `ExpressionManager`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `bootstrap()` (e.g. with `main.js` and `.setMemoryService()`) actually correct?**
  _`bootstrap()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@pixiv/three-vrm-animation`, `animejs`, `react` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Why does `three` connect `main.js` to `package.json`, `FBXAvatarLoader`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Should `VoiceService` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._
- **Why does `LLMService` connect `LLMService` to `main.js`, `SettingsModal.js`, `bootstrap`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._