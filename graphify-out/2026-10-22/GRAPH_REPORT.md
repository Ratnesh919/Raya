# Graph Report - raya ai assistant  (2026-09-24)

## Corpus Check
- 23 files · ~26,722 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .fbx 15, .vrm 4, (none) 2)

## Summary
- 268 nodes · 467 edges · 17 communities (9 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b384ffe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- VoiceService
- main.js
- LLMService
- bootstrap
- VRMManager
- ChatUI
- AnimationEngine
- SettingsModal.js
- LoaderAnimation
- KokoroService
- PersonalityEngine
- ✨ Key Features
- LipSyncEngine
- LifeSimulator
- vercel.json
- AGENTS.md — Raya AI Assistant

## God Nodes (most connected - your core abstractions)
1. `bootstrap()` - 30 edges
2. `LLMService` - 21 edges
3. `VRMManager` - 21 edges
4. `VoiceService` - 17 edges
5. `ChatUI` - 17 edges
6. `KokoroService` - 13 edges
7. `PersonalityEngine` - 13 edges
8. `AnimationEngine` - 13 edges
9. `LoaderAnimation` - 12 edges
10. `ExpressionManager` - 12 edges

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

## Communities (17 total, 8 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.07
Nodes (26): config, DEFAULT_MEMORY, UserMemory, dependencies, animejs, kokoro-js, @netlify/blobs, @netlify/functions (+18 more)

### Community 1 - "VoiceService"
Cohesion: 0.14
Nodes (8): KOKORO_SUPPORTED_LANGS, KOKORO_VOICES, detectLanguage(), getNativeScriptForTTS(), isFemaleVoice(), isMobileDevice(), transliterateDevanagari(), VoiceService

### Community 2 - "main.js"
Cohesion: 0.16
Nodes (7): three, EXCLUDED_NAME_WORDS, PERSONALITY_MODES, PERSONALITY_PROFILES, ChestPhysics, EXPR_ALIASES, VISEME_ALIASES

### Community 4 - "bootstrap"
Cohesion: 0.19
Nodes (3): MemoryService, bootstrap(), ExpressionManager

### Community 7 - "AnimationEngine"
Cohesion: 0.25
Nodes (4): AnimationEngine, findRigNode(), getRigNodeMap(), MIXAMO_VRM_RIG_MAP

### Community 8 - "SettingsModal.js"
Cohesion: 0.26
Nodes (6): DEFAULT_MODELS, PROVIDERS, DEFAULT_SYSTEM_PROMPT, parseRayaResponse(), isRealisticVoice(), SettingsModal

### Community 9 - "LoaderAnimation"
Cohesion: 0.18
Nodes (3): animejs, ControlsHUD, LoaderAnimation

### Community 12 - "✨ Key Features"
Cohesion: 0.10
Nodes (20): 1. Clone & Install Dependencies, 2. Run Local Development Server, 3. Connect Your AI Provider, 🎮 3D Viewport & Interactive Controls, 4. Talk to Raya!, 🕹️ Controls Guide, 🎭 Flexible Multi-Personality System, 🌀 Holographic Cyberpunk Boot Sequence (Anime.js & Design Spells) (+12 more)

### Community 16 - "AGENTS.md — Raya AI Assistant"
Cohesion: 0.33
Nodes (5): AGENTS.md — Raya AI Assistant, Directories & Files to Avoid, Essential Commands, Feature-to-File Map, Knowledge Graph Workflow (Mandatory)

## Knowledge Gaps
- **46 isolated node(s):** `UserMemory`, `DEFAULT_MEMORY`, `config`, `name`, `private` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 79 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bootstrap()` connect `bootstrap` to `VoiceService`, `main.js`, `LLMService`, `VRMManager`, `ChatUI`, `AnimationEngine`, `SettingsModal.js`, `LoaderAnimation`, `PersonalityEngine`, `LipSyncEngine`, `LifeSimulator`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **Why does `three` connect `main.js` to `package.json`, `AnimationEngine`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `LLMService` connect `LLMService` to `SettingsModal.js`, `main.js`, `bootstrap`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `bootstrap()` (e.g. with `main.js` and `.setMemoryService()`) actually correct?**
  _`bootstrap()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `UserMemory`, `DEFAULT_MEMORY`, `config` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `VoiceService` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._