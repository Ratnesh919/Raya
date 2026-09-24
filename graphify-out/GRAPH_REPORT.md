# Graph Report - raya ai assistant  (2026-09-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 241 nodes · 442 edges · 16 communities (6 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `33c4b2c4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15

## God Nodes (most connected - your core abstractions)
1. `bootstrap()` - 30 edges
2. `LLMService` - 21 edges
3. `VRMManager` - 21 edges
4. `VoiceService` - 17 edges
5. `ChatUI` - 17 edges
6. `KokoroService` - 13 edges
7. `PersonalityEngine` - 13 edges
8. `AnimationEngine` - 13 edges
9. `ExpressionManager` - 12 edges
10. `LipSyncEngine` - 12 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `VoiceService`  [EXTRACTED]
  src/main.js → src/ai/VoiceService.js
- `bootstrap()` --calls--> `PersonalityEngine`  [EXTRACTED]
  src/main.js → src/ai/PersonalityEngine.js
- `bootstrap()` --calls--> `ExpressionManager`  [EXTRACTED]
  src/main.js → src/vrm/ExpressionManager.js
- `bootstrap()` --calls--> `LipSyncEngine`  [EXTRACTED]
  src/main.js → src/vrm/LipSyncEngine.js
- `bootstrap()` --calls--> `LifeSimulator`  [EXTRACTED]
  src/main.js → src/vrm/LifeSimulator.js

## Import Cycles
- None detected.

## Communities (16 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (26): config, DEFAULT_MEMORY, UserMemory, dependencies, animejs, kokoro-js, @netlify/blobs, @netlify/functions (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (8): KOKORO_SUPPORTED_LANGS, KOKORO_VOICES, detectLanguage(), getNativeScriptForTTS(), isFemaleVoice(), isMobileDevice(), transliterateDevanagari(), VoiceService

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (7): three, EXCLUDED_NAME_WORDS, PERSONALITY_MODES, PERSONALITY_PROFILES, ChestPhysics, EXPR_ALIASES, VISEME_ALIASES

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (3): MemoryService, bootstrap(), ControlsHUD

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (4): AnimationEngine, findRigNode(), getRigNodeMap(), MIXAMO_VRM_RIG_MAP

### Community 8 - "Community 8"
Cohesion: 0.26
Nodes (6): DEFAULT_MODELS, PROVIDERS, DEFAULT_SYSTEM_PROMPT, parseRayaResponse(), isRealisticVoice(), SettingsModal

## Knowledge Gaps
- **25 isolated node(s):** `UserMemory`, `config`, `DEFAULT_MEMORY`, `animejs`, `kokoro-js` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 56 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bootstrap()` connect `Community 4` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.251) - this node is a cross-community bridge._
- **Why does `three` connect `Community 2` to `Community 0`, `Community 7`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Why does `LLMService` connect `Community 3` to `Community 8`, `Community 2`, `Community 4`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `bootstrap()` (e.g. with `main.js` and `.setMemoryService()`) actually correct?**
  _`bootstrap()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `UserMemory`, `config`, `DEFAULT_MEMORY` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._