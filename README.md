# Ironbound

Single-file prototype is in `index.html`.

## Run (Web)
- Open `index.html` directly in your browser, or
- Serve locally:
  - `python3 -m http.server 4173`
  - open `http://127.0.0.1:4173/index.html`

## Run (Desktop / EXE path)
1. Install dependencies:
   - `npm install`
2. Start desktop shell:
   - `npm run start`
3. Build Windows installer/exe (NSIS):
   - `npm run dist`
   - output is written to `release/`

## Current build focus
- 384×384 deterministic world generation pipeline (tectonics → hydrology → climate → provinces)
- Expanded province/faction/actor/contract simulation fields aligned to the master build plan
- Narrative delivery surfaces: chronicle, proclamations, rumors, travel encounters, province atmosphere
- Daily simulation with anti-blob pressure, war progression, trade reliability drift, apex ecology, event chains, and world-age scoring
- Dynamic contract lifecycle (cause-driven spawning + expiry), actor-count governor, and claim-pressure war governor
- Multi-overlay map + zoom-based strategic/regional/local LOD coloring
- Build controls for deterministic iteration: direct seed input/apply and +30-day simulation stepping
- Snapshot workflow for deterministic replay (export/import seed/day JSON) plus generation-phase timing telemetry
- Desktop wrapper + file-based snapshot save/load when running under Electron
