# Graph Report - raya ai assistant  (2026-10-29)

## Corpus Check
- 221 files · ~3,485,239 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 29 file(s) not represented in the graph (top: .fbx 16, .vrm 8, (none) 2)

## Summary
- 667 nodes · 1027 edges · 48 communities (12 shown, 36 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9a1b65e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- VoiceService
- main.js
- LLMService
- math
- bootstrap
- ChatUI
- numpy
- LoaderAnimation
- compilerOptions
- ✨ Key Features
- LipSyncEngine
- LifeSimulator
- vercel.json
- AGENTS.md — Raya AI Assistant
- components.json
- blender_live_bridge.py
- generate_batch_17_22.py
- AnimationEngine
- generate_batch_23_30.py
- generate_batch_31_40.py
- generate_batch_41_50.py
- generate_batch_51_60.py
- generate_batch_07_10.py
- json
- scratch_map_vrm1_bones.py
- generate_batch_03_06.py
- generate_batch_11_16.py
- map_hair_and_cloth_chains.py
- PersonalityEngine
- traverse
- get_linear_chains

## God Nodes (most connected - your core abstractions)
1. `bootstrap()` - 32 edges
2. `LLMService` - 21 edges
3. `VRMManager` - 21 edges
4. `LifeSimulator` - 20 edges
5. `VoiceService` - 17 edges
6. `ChatUI` - 17 edges
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

## Communities (48 total, 36 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.06
Nodes (32): config, DEFAULT_MEMORY, UserMemory, dependencies, animejs, kokoro-js, @netlify/blobs, @netlify/functions (+24 more)

### Community 1 - "VoiceService"
Cohesion: 0.09
Nodes (10): kokoro-js, KOKORO_SUPPORTED_LANGS, KOKORO_VOICES, KokoroService, detectLanguage(), getNativeScriptForTTS(), isFemaleVoice(), isMobileDevice() (+2 more)

### Community 2 - "main.js"
Cohesion: 0.07
Nodes (19): @pixiv/three-vrm, three, DEFAULT_MODELS, PROVIDERS, PERSONALITY_MODES, PERSONALITY_PROFILES, DEFAULT_SYSTEM_PROMPT, parseRayaResponse() (+11 more)

### Community 5 - "bootstrap"
Cohesion: 0.09
Nodes (5): EXCLUDED_NAME_WORDS, MemoryService, bootstrap(), ExpressionManager, VRMManager

### Community 9 - "LoaderAnimation"
Cohesion: 0.12
Nodes (3): thinking-orbs, ControlsHUD, LoaderAnimation

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

### Community 18 - "blender_live_bridge.py"
Cohesion: 0.16
Nodes (5): BlenderBridgeHandler, ExecutionRequest, process_blender_main_thread_queue(), start_server(), ThreadingHTTPServer

### Community 23 - "AnimationEngine"
Cohesion: 0.16
Nodes (5): AnimationEngine, findRigNode(), getRigNodeMap(), MIXAMO_VRM_RIG_MAP, InertiaBlender

### Community 30 - "json"
Cohesion: 0.09
Nodes (4): get_gradient_bgr(), run_script(), parse_vrm(), run_code()

## Knowledge Gaps
- **4 isolated node(s):** `@pixiv/three-vrm-animation`, `animejs`, `react`, `react-dom`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 323 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `main.js` to `package.json`, `AnimationEngine`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `bootstrap()` (e.g. with `main.js` and `.setMemoryService()`) actually correct?**
  _`bootstrap()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@pixiv/three-vrm-animation`, `animejs`, `react` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Why does `bootstrap()` connect `bootstrap` to `VoiceService`, `main.js`, `LLMService`, `PersonalityEngine`, `ChatUI`, `LoaderAnimation`, `LipSyncEngine`, `LifeSimulator`, `AnimationEngine`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `VoiceService` be split into smaller, more focused modules?**
  _Cohesion score 0.0915915915915916 - nodes in this community are weakly interconnected._
- **Why does `LLMService` connect `LLMService` to `main.js`, `bootstrap`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._