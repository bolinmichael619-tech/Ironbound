# Ironbound

Browser-based campaign simulation prototype for Ironbound with modular world generation, systemic day ticks, and multi-screen campaign UI.

## Run

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open `http://127.0.0.1:4173`.

## Build scope (semi-complete vertical slice)

- 384x384 world pipeline with tectonics, hydrology, climate, provinces, factions, settlements, trade graph, actors, wars, and event chains.
- Province model includes economy, politics, religion/arcane pressure, danger, travel, and live state arrays.
- Day simulation systems split by domain: provinces, factions, wars, trade, actors, event chains, contracts, rumors, proclamations, narrative, bestiary, obituary, world-age.
- Contract lifecycle includes causes, accept/abandon, deterministic resolution outcomes, and province/economy consequences.
- Multi-screen campaign shell with tabs for map, rumors, contracts, proclamations, chronicle, inventory, camp, bestiary, obituary, settlement, shopkeeper, shop, wars, and actors.
- Overlay map rendering supports terrain/elevation/rivers/political/warfront/danger/faith/arcane/trade/contracts, trade edge drawing, and accepted-contract markers.
- Snapshot export/import allows preserving and restoring full simulation state.

## Notes

This build is aimed at a broad “semi-complete” systems prototype and intentionally favors simulation/content scaffolding over polished UX.
