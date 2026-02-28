import {
  BIOMES,
  PROVINCE_CLASSES,
  RESOURCES,
  DEITIES,
  RACES_WORLD,
  CULTURE_NAMES,
  CONTRACT_TYPES,
  EVENT_TYPES,
  APEX_ROSTER,
  EXTENDED_TEMPLATES,
  RUMOR_SOURCES
} from './content.js';


export const WORLDGEN_DEFAULTS = {
  plateCount: 7,
  seaLevel: 0.28,
  ruggedness: 0.52,
  hydrologyStrength: 0.58,
  moistureBias: 0,
  tempBias: 0,
  forestDensity: 0.55,
  swampDensity: 0.35,
  desertHarshness: 0.4,
  provinceTarget: 110,
  factionCount: 7,
  actorTarget: 180,
  campaignName: 'Age of Ironbound',
  skirmish: false
};
export function createRng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function generateWorld(seed = 1337, size = 384, settings = {}) {
  const cfg = { ...WORLDGEN_DEFAULTS, ...settings };
  const rng = createRng(seed);
  const timings = {};
  const t0 = performance.now();

  const tectonics = genTectonics(size, rng, cfg);
  timings.tectonics = performance.now() - t0;

  const t1 = performance.now();
  const hydrology = genHydrology(size, tectonics.height, tectonics.moisture, rng, cfg);
  timings.hydrology = performance.now() - t1;

  const t2 = performance.now();
  const climate = genClimate(size, tectonics.height, tectonics.moisture, hydrology, rng, cfg);
  timings.climate = performance.now() - t2;

  const t3 = performance.now();
  const provinces = genProvinces(size, tectonics, climate, hydrology, rng, cfg);
  timings.provinces = performance.now() - t3;

  const t4 = performance.now();
  const factions = genFactions(provinces, rng, cfg);
  const settlements = genSettlements(provinces, rng);
  const tradeGraph = genTradeGraph(provinces, settlements, hydrology, rng);
  const wars = seedWars(factions, provinces, rng);
  const actors = seedActors(provinces, factions, rng, cfg);
  const eventChains = seedEventChains(provinces, factions, actors, rng);
  const contracts = seedContracts(provinces, factions, actors, eventChains, rng, 1);
  const rumors = seedRumors(provinces, actors, rng, 1);
  const proclamations = seedProclamations(provinces, factions, rng, 1);
  timings.political = performance.now() - t4;

  const generationTimeMs = Object.values(timings).reduce((s, v) => s + v, 0);

  return {
    seed,
    size,
    day: 1,
    age: 'Young',
    mode: 'Map',
    paused: false,
    speed: 2,
    overlay: 'terrain',
    randState: (seed ^ 0x9e3779b9) >>> 0,
    generation: { timings, totalMs: generationTimeMs, settings: cfg },
    maps: {
      height: tectonics.height,
      waterMask: tectonics.waterMask,
      moistureBase: tectonics.moisture,
      flow: hydrology.flow,
      riverMask: hydrology.riverMask,
      lakeMask: hydrology.lakeMask,
      floodplainMask: hydrology.floodplainMask,
      temp: climate.temp,
      moisture: climate.moisture,
      biome: climate.biome
    },
    provinces,
    factions,
    settlements,
    tradeGraph,
    wars,
    actors,
    eventChains,
    rumors,
    contracts,
    proclamations,
    chronicle: ['A new age dawns over Ironbound.'],
    inventory: seedInventory(rng),
    shopStock: seedShopStock(rng),
    campRoles: seedCampRoles(),
    bestiary: seedBestiary(rng),
    obituary: [],
    selectedProvince: 0,
    selectedSettlement: settlements[0]?.id ?? 0,
    pulseProvince: 0,
    pulseUntil: 0,
    tracked: new Set()
  };
}

function genTectonics(size, rng, cfg) {
  const n = size * size;
  const height = new Float32Array(n);
  const moisture = new Float32Array(n);
  const waterMask = new Uint8Array(n);

  const plateCount = Math.max(5, Math.min(12, Math.floor(cfg.plateCount)));
  const plates = Array.from({ length: plateCount }, () => ({
    x: rng() * size,
    y: rng() * size,
    driftX: rng() * 2 - 1,
    driftY: rng() * 2 - 1
  }));

  for (let y = 0; y < size; y++) {
    const lat = Math.abs((y / (size - 1)) * 2 - 1);
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let minA = 1e9;
      let minB = 1e9;
      let push = 0;

      for (const p of plates) {
        const dx = x - p.x;
        const dy = y - p.y;
        const d = dx * dx + dy * dy;
        if (d < minA) {
          minB = minA;
          minA = d;
        } else if (d < minB) {
          minB = d;
        }
        push += ((dx * p.driftX + dy * p.driftY) > 0 ? 1 : -1) * 0.002;
      }

      const boundary = Math.max(0, 1 - Math.sqrt(Math.max(0, minB - minA)) / 24);
      const shelf = Math.min(Math.min(x, y), Math.min(size - 1 - x, size - 1 - y)) / (size * 0.23);
      const noise = fbm(x / size, y / size, rng);
      const rugged = cfg.ruggedness * 0.8 + 0.2;
      const h = clamp((0.52 * noise + 0.31 * shelf + 0.33 * boundary + push - 0.12 * lat) * rugged + noise * (1 - rugged) * 0.35, 0, 1);
      height[i] = h;
      moisture[i] = clamp(0.58 * (1 - lat) + 0.36 * (1 - h) + (rng() - 0.5) * 0.12, 0, 1);
      waterMask[i] = h < cfg.seaLevel ? 1 : 0;
    }
  }

  return { height, moisture, waterMask };
}

function genHydrology(size, height, moisture, rng, cfg) {
  const n = size * size;
  const flow = new Float32Array(n);
  const riverMask = new Uint8Array(n);
  const lakeMask = new Uint8Array(n);
  const floodplainMask = new Uint8Array(n);

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => height[b] - height[a]);

  for (const i of order) {
    if (height[i] < cfg.seaLevel) continue;
    flow[i] += 1;
    const x = i % size;
    const y = Math.floor(i / size);

    let best = i;
    let bestH = height[i];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) continue;
        const ni = ny * size + nx;
        if (height[ni] < bestH) {
          bestH = height[ni];
          best = ni;
        }
      }
    }

    if (best !== i) {
      flow[best] += flow[i] * 0.98;
      if (flow[i] > (26 - cfg.hydrologyStrength * 20) && height[i] > cfg.seaLevel + 0.03) riverMask[i] = 1;
    } else {
      if (height[i] > cfg.seaLevel + 0.02 && flow[i] > (18 - cfg.hydrologyStrength * 10)) lakeMask[i] = 1;
    }

    if (riverMask[i] && height[i] < 0.52) floodplainMask[i] = 1;
    if (!riverMask[i] && moisture[i] > (0.67 - cfg.swampDensity * 0.2) && height[i] < 0.48 && rng() < 0.02 + cfg.hydrologyStrength * 0.03) lakeMask[i] = 1;
  }

  return { flow, riverMask, lakeMask, floodplainMask };
}

function genClimate(size, height, moistureBase, hydrology, rng, cfg) {
  const n = size * size;
  const temp = new Float32Array(n);
  const moisture = new Float32Array(n);
  const biome = new Uint8Array(n);

  for (let y = 0; y < size; y++) {
    const lat = Math.abs((y / (size - 1)) * 2 - 1);
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const elevCool = Math.max(0, height[i] - 0.35) * 0.55;
      temp[i] = clamp(1 - lat - elevCool + cfg.tempBias * 0.25 + (rng() - 0.5) * 0.08, 0, 1);

      const riverBonus = hydrology.riverMask[i] ? 0.2 : 0;
      const lakeBonus = hydrology.lakeMask[i] ? 0.15 : 0;
      const inlandDry = Math.max(0, height[i] - 0.62) * 0.28;
      moisture[i] = clamp(moistureBase[i] + riverBonus + lakeBonus - inlandDry + cfg.moistureBias * 0.25, 0, 1);

      biome[i] = biomeBand(height[i], temp[i], moisture[i], cfg);
    }
  }

  return { temp, moisture, biome };
}

function biomeBand(h, t, m, cfg) {
  if (h < cfg.seaLevel) return BIOMES.indexOf('ocean');
  if (h < cfg.seaLevel + 0.05) return BIOMES.indexOf('coast');
  if (h > 0.85) return BIOMES.indexOf('peaks');
  if (h > 0.72) return BIOMES.indexOf('mountains');
  if (h > 0.55) return BIOMES.indexOf('hills');
  if (m < 0.22 + cfg.desertHarshness * 0.2 && t > 0.45) return BIOMES.indexOf('desert');
  if (m < 0.36) return BIOMES.indexOf('steppe');
  if (m > 0.72 - cfg.swampDensity * 0.18) return BIOMES.indexOf('swamp');
  if (m > 0.52 - cfg.forestDensity * 0.18) return BIOMES.indexOf('forest');
  return BIOMES.indexOf('lowland');
}

function genProvinces(size, tectonics, climate, hydrology, rng, cfg) {
  const target = Math.max(80, Math.min(160, Math.floor(cfg.provinceTarget)));
  const seeds = [];
  while (seeds.length < target) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const i = y * size + x;
    if (tectonics.height[i] < cfg.seaLevel) continue;
    if (tectonics.height[i] > 0.9) continue;
    if (climate.biome[i] === BIOMES.indexOf('desert') && rng() < 0.7) continue;
    seeds.push({ id: seeds.length, x, y });
  }

  const provinces = seeds.map((s) => ({
    id: s.id,
    name: `Province ${s.id + 1}`,
    centerX: s.x,
    centerY: s.y,
    neighborIds: [],
    classification: pick(PROVINCE_CLASSES, rng),
    biomeType: 'lowland',
    avgElevation: 0,
    elevationVar: 0,
    avgTemp: 0,
    avgMoisture: 0,
    riverDensity: 0,
    lakePresence: false,
    coastal: false,
    primaryResource: pick(RESOURCES, rng),
    secondaryResources: [pick(RESOURCES, rng), pick(RESOURCES, rng)],
    population: 1800 + Math.floor(rng() * 38000),
    settlementTier: Math.floor(rng() * 6),
    settlements: [],
    infrastructure: 20 + Math.floor(rng() * 70),
    prosperity: 25 + Math.floor(rng() * 70),
    tradeValue: 10 + Math.floor(rng() * 90),
    portNode: false,
    tradeNode: false,
    roadFactor: 10 + Math.floor(rng() * 90),
    factionOwnerId: -1,
    stability: 35 + Math.floor(rng() * 60),
    unrest: 5 + Math.floor(rng() * 40),
    contested: false,
    contestedDays: 0,
    occupied: false,
    lawless: false,
    garrisonStrength: 10 + Math.floor(rng() * 90),
    militiaPotential: 10 + Math.floor(rng() * 90),
    faithStrength: Math.floor(rng() * 100),
    divineAlignment: pick(Object.keys(DEITIES), rng),
    arcaneSaturation: Math.floor(rng() * 100),
    danger: Math.floor(rng() * 70),
    monsterPresence: false,
    travelCostBase: 8 + Math.floor(rng() * 28),
    activeEvents: [],
    stationedActors: [],
    availableContracts: [],
    cells: 0
  }));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (tectonics.height[i] < cfg.seaLevel) continue;
      let best = 0;
      let bestD = 1e9;
      for (const s of seeds) {
        const d = (x - s.x) ** 2 + (y - s.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = s.id;
        }
      }

      const p = provinces[best];
      p.cells += 1;
      p.avgElevation += tectonics.height[i];
      p.avgTemp += climate.temp[i];
      p.avgMoisture += climate.moisture[i];
      p.riverDensity += hydrology.riverMask[i];
      p.lakePresence ||= !!hydrology.lakeMask[i];
      p.coastal ||= tectonics.height[i] < 0.33;
      p.biomeType = BIOMES[climate.biome[i]];
      if (p.coastal) p.portNode = true;
      if (hydrology.riverMask[i]) p.tradeNode = true;
    }
  }

  for (const p of provinces) {
    p.avgElevation /= Math.max(1, p.cells);
    p.avgTemp /= Math.max(1, p.cells);
    p.avgMoisture /= Math.max(1, p.cells);
    p.riverDensity /= Math.max(1, p.cells);
    p.elevationVar = Math.max(0.01, 0.3 * p.avgElevation * (1 - p.avgElevation));
  }

  return provinces;
}

function genFactions(provinces, rng, cfg) {
  const names = ['Crown', 'League', 'Synod', 'Host', 'Compact', 'March', 'Order', 'Conclave'];
  const archetypes = ['militant', 'mercantile', 'religious', 'arcane', 'tribal'];
  const keys = Object.keys(DEITIES);
  const factions = Array.from({ length: Math.max(5, Math.min(10, Math.floor(cfg.factionCount))) }, (_, id) => ({
    id,
    name: names[id],
    cultureId: pick(Object.keys(RACES_WORLD), rng),
    color: `hsl(${(id * 57) % 360} 60% 50%)`,
    archetype: pick(archetypes, rng),
    capitalProvinceId: provinces[Math.floor(rng() * provinces.length)].id,
    controlledProvinces: [],
    legitimacy: 35 + Math.floor(rng() * 65),
    wealth: 35 + Math.floor(rng() * 65),
    manpower: 35 + Math.floor(rng() * 65),
    supply: 35 + Math.floor(rng() * 65),
    techLevel: Math.floor(rng() * 6),
    faithAlignment: pick(keys, rng),
    arcaneTolerance: Math.floor(rng() * 101),
    diplomacy: {},
    warExhaustion: Math.floor(rng() * 20),
    expansionPressure: 10 + Math.floor(rng() * 50),
    strategicGoals: ['hold front', 'secure trade', 'control passes']
  }));

  for (const p of provinces) {
    const f = factions[Math.floor(rng() * factions.length)];
    p.factionOwnerId = f.id;
    f.controlledProvinces.push(p.id);
  }

  for (const f of factions) {
    for (const g of factions) {
      if (f.id === g.id) continue;
      f.diplomacy[g.id] = -45 + Math.floor(rng() * 91);
    }
  }

  return factions;
}

function genSettlements(provinces, rng) {
  const types = ['hamlet', 'village', 'town', 'city', 'capital', 'fortress', 'monastery', 'port', 'ruin'];
  const settlements = [];
  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i];
    const count = 1 + Math.floor(rng() * 3);
    for (let n = 0; n < count; n++) {
      const type = types[Math.min(types.length - 1, Math.floor((p.settlementTier + rng() * 2) % types.length))];
      const name = `${p.name} ${['Hold', 'Gate', 'Haven', 'Crossing', 'Hearth', 'Market'][Math.floor(rng() * 6)]}`;
      const settlement = { id: settlements.length, provinceId: p.id, name, type, prosperity: 15 + Math.floor(rng() * 80) };
      settlements.push(settlement);
      p.settlements.push(settlement.id);
    }
  }
  return settlements;
}

function genTradeGraph(provinces, settlements, hydrology, rng) {
  const nodes = provinces.slice(0, 120).map((p) => ({ provinceId: p.id, type: p.portNode ? 'port' : p.tradeNode ? 'market' : 'capital' }));
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[Math.min(nodes.length - 1, i + 1 + Math.floor(rng() * 4))];
    edges.push({
      from: a.provinceId,
      to: b.provinceId,
      type: hydrology.riverMask[(provinces[a.provinceId].centerY * 384) + provinces[a.provinceId].centerX] ? 'river' : 'road',
      reliability: 0.45 + rng() * 0.5
    });
  }
  return { nodes, edges };
}

function seedWars(factions, provinces, rng) {
  const wars = [];
  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const a = factions[Math.floor(rng() * factions.length)];
    const b = factions[Math.floor(rng() * factions.length)];
    if (a.id === b.id) continue;
    wars.push({
      id: i,
      factions: [a.id, b.id],
      goals: [pick(['take_capital', 'seize_pass', 'cut_trade', 'capture_port'], rng)],
      frontlineProvinces: provinces.filter((p) => p.factionOwnerId === a.id || p.factionOwnerId === b.id).slice(0, 6).map((p) => p.id),
      supplyA: 50 + Math.floor(rng() * 40),
      supplyB: 50 + Math.floor(rng() * 40),
      moraleA: 50 + Math.floor(rng() * 40),
      moraleB: 50 + Math.floor(rng() * 40),
      warExhaustionA: Math.floor(rng() * 20),
      warExhaustionB: Math.floor(rng() * 20),
      activeCommanders: [],
      battles: []
    });
  }
  return wars;
}

function seedActors(provinces, factions, rng, cfg) {
  const actors = [];
  const races = Object.keys(RACES_WORLD);
  const cultureKeys = Object.keys(CULTURE_NAMES);
  const types = ['ruler', 'general', 'hero', 'villain', 'prophet', 'monster'];
  for (let i = 0; i < Math.max(120, Math.min(260, Math.floor(cfg.actorTarget))); i++) {
    const faction = factions[Math.floor(rng() * factions.length)];
    const culture = pick(cultureKeys, rng);
    const names = CULTURE_NAMES[culture] ?? CULTURE_NAMES.imperial;
    const first = pick(names.first, rng);
    const house = pick(names.house, rng);
    const province = provinces[Math.floor(rng() * provinces.length)];
    actors.push({
      id: i,
      name: `${first} ${house}`,
      epithet: pick(['the Stern', 'the Ashen', 'of the Ford', 'Oathbound', 'the Red', 'the Pale'], rng),
      type: pick(types, rng),
      tier: i < 20 ? 1 : i < 90 ? 2 : 3,
      raceId: pick(races, rng),
      cultureId: culture,
      factionId: faction.id,
      provinceId: province.id,
      alive: true,
      deathDay: null,
      deathCause: null,
      power: 20 + Math.floor(rng() * 81),
      reputation: -40 + Math.floor(rng() * 81),
      fear: Math.floor(rng() * 100),
      legitimacy: Math.floor(rng() * 100),
      resources: 10 + Math.floor(rng() * 200),
      traits: ['driven', 'ambitious'],
      goalShort: 'Secure position',
      ambitionLong: 'Shape the age',
      riskTolerance: Math.floor(rng() * 100),
      relationships: {},
      history: [],
      wanderPath: [],
      lairProvinceId: province.id,
      age: 10 + Math.floor(rng() * 300),
      territorySize: 1 + Math.floor(rng() * 10),
      notoriety: Math.floor(rng() * 100),
      hunger: Math.floor(rng() * 100),
      satellites: 0
    });
  }
  return actors;
}

function seedEventChains(provinces, factions, actors, rng) {
  const chains = [];
  for (let i = 0; i < 3; i++) {
    const province = provinces[Math.floor(rng() * provinces.length)];
    const faction = factions[Math.floor(rng() * factions.length)];
    const actor = actors[Math.floor(rng() * actors.length)];
    chains.push({
      id: i,
      type: pick(EVENT_TYPES, rng),
      stage: 1,
      maxStage: 4,
      provinceId: province.id,
      factionId: faction.id,
      actorId: actor.id,
      progress: 0,
      active: true,
      eventId: `chain-${i}`
    });
  }
  return chains;
}

function seedContracts(provinces, factions, actors, chains, rng, day) {
  const allTypes = Object.values(CONTRACT_TYPES).flat();
  const contracts = [];
  for (let i = 0; i < 16; i++) {
    const province = provinces[Math.floor(rng() * provinces.length)];
    const faction = factions[Math.floor(rng() * factions.length)];
    const actor = actors[Math.floor(rng() * actors.length)];
    const chain = chains[Math.floor(rng() * chains.length)];
    contracts.push({
      id: i,
      type: pick(allTypes, rng),
      category: pick(Object.keys(CONTRACT_TYPES), rng),
      issuerActorId: actor.id,
      issuerFactionId: faction.id,
      targetProvinceIds: [province.id],
      causeRefs: { eventId: chain.eventId, actorId: actor.id, warId: null, monsterId: null },
      objectives: ['Reach area', 'Resolve threat', 'Report outcome'],
      timeWindow: 12 + Math.floor(rng() * 12),
      riskRating: 1 + Math.floor(rng() * 5),
      payout: { gold: 30 + Math.floor(rng() * 80), gear: rng() < 0.3 ? 'Relic Fragment' : null, influence: 1 + Math.floor(rng() * 6), repEffects: 1 + Math.floor(rng() * 4) },
      factionRelationEffects: {},
      successConsequences: ['Province stability rises'],
      failureConsequences: ['Province danger rises'],
      provinceId: province.id,
      title: `${pick(allTypes, rng)} in ${province.name}`,
      issuedDay: day,
      expiresDay: day + 8 + Math.floor(rng() * 16),
      status: 'open'
    });
  }
  return contracts;
}

function seedRumors(provinces, actors, rng, day) {
  const rumors = [];
  for (let i = 0; i < 18; i++) {
    const province = provinces[Math.floor(rng() * provinces.length)];
    const actor = actors[Math.floor(rng() * actors.length)];
    rumors.push({
      id: i,
      title: `Whispers of ${province.name}`,
      text: fillTemplate(pick(EXTENDED_TEMPLATES.rumors, rng), { province: province.name, actor: actor.name, event: pick(EVENT_TYPES, rng) }),
      source: pick(RUMOR_SOURCES, rng),
      credibility: 30 + Math.floor(rng() * 70),
      provinceId: province.id,
      expiresDay: day + 10 + Math.floor(rng() * 16)
    });
  }
  return rumors;
}

function seedProclamations(provinces, factions, rng, day) {
  const proclamations = [];
  for (let i = 0; i < 10; i++) {
    const province = provinces[Math.floor(rng() * provinces.length)];
    const faction = factions[Math.floor(rng() * factions.length)];
    proclamations.push({
      id: i,
      title: `Proclamation of ${faction.name}`,
      text: fillTemplate(pick(EXTENDED_TEMPLATES.proclamations, rng), { province: province.name, faction: faction.name }),
      provinceId: province.id,
      day
    });
  }
  return proclamations;
}

function seedInventory(rng) {
  return [
    { name: 'Salted Rations', qty: 22, slot: 'Supply' },
    { name: 'Iron Spear', qty: 8, slot: 'Weapon' },
    { name: 'Mail Shirt', qty: 6, slot: 'Armor' },
    { name: 'Bandage Roll', qty: 14, slot: 'Medical' },
    { name: 'Lamp Oil', qty: 9, slot: 'Utility' },
    { name: 'Coin Chest', qty: 120 + Math.floor(rng() * 80), slot: 'Treasury' }
  ];
}

function seedShopStock(rng) {
  return [
    { id: 0, name: 'Dried Meat', slot: 'Supply', price: 6, qty: 22 },
    { id: 1, name: 'Boiled Leather', slot: 'Armor', price: 24, qty: 8 },
    { id: 2, name: 'Pike', slot: 'Weapon', price: 34, qty: 7 },
    { id: 3, name: 'Lantern Wick', slot: 'Utility', price: 5, qty: 20 },
    { id: 4, name: 'Field Tonic', slot: 'Medical', price: 14, qty: 10 + Math.floor(rng() * 6) }
  ];
}

function seedCampRoles() {
  return [
    { role: 'Quartermaster', assignee: 'Helm Toren', effect: '+supply efficiency' },
    { role: 'Scout Captain', assignee: 'Mara Voss', effect: '+rumor credibility' },
    { role: 'Chirurgeon', assignee: 'Brother Cal', effect: '+injury recovery' },
    { role: 'Marshal', assignee: 'Darik Hound', effect: '+contract success chance' },
    { role: 'Chaplain', assignee: 'Sister Nalia', effect: '+stability recovery' }
  ];
}

function seedBestiary(rng) {
  const all = [
    ...APEX_ROSTER.map((a) => a.type),
    ...Object.values(RACES_WORLD).map((r) => r.name),
    ...Object.values(DEITIES).map((d) => d.name)
  ];
  return all.slice(0, 36).map((name, id) => ({
    id,
    name,
    lastSeen: `P${1 + Math.floor(rng() * 120)}`,
    completeness: 20 + Math.floor(rng() * 75)
  }));
}

function fbm(x, y, rng) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 4; i++) {
    const nx = (x * freq + i * 0.31) * 11.3;
    const ny = (y * freq + i * 0.17) * 17.1;
    const v = Math.sin(nx + ny + rng() * 6.28) * 0.5 + 0.5;
    sum += v * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function fillTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? key);
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
