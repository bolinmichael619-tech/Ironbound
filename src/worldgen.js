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
  erosionPasses: 2,
  coastalShelfWidth: 0.24,
  hydrologyStrength: 0.58,
  riverSinuosity: 0.35,
  moistureBias: 0,
  tempBias: 0,
  forestDensity: 0.55,
  swampDensity: 0.35,
  desertHarshness: 0.4,
  rainShadowStrength: 0.22,
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
  const hydrology = genHydrology(size, tectonics, rng, cfg);
  timings.hydrology = performance.now() - t1;

  const t2 = performance.now();
  const climate = genClimate(size, tectonics, hydrology, rng, cfg);
  timings.climate = performance.now() - t2;

  const t3 = performance.now();
  const provinces = genProvinces(size, tectonics, climate, hydrology, rng, cfg);
  timings.provinces = performance.now() - t3;

  const t4 = performance.now();
  const factions = genFactions(provinces, rng, cfg);
  const settlements = genSettlements(provinces, rng);
  const tradeGraph = genTradeGraph(size, provinces, settlements, hydrology, rng);
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
    generation: {
      timings,
      totalMs: generationTimeMs,
      settings: cfg,
      plateCount: tectonics.plates.length,
      basinCount: hydrology.basinCount,
      riverSegments: hydrology.riverCount,
      riverPolylines: hydrology.riverPolylines.length,
      lakes: hydrology.lakeCount,
      swamps: hydrology.swampCount,
      provinces: provinces.length
    },
    maps: {
      height: tectonics.height,
      waterMask: tectonics.waterMask,
      moistureBase: tectonics.moistureBase,
      plateIndex: tectonics.plateIndex,
      stressMap: tectonics.stressMap,
      ridgeMap: tectonics.ridgeMap,
      slope: tectonics.slope,
      erosionMap: tectonics.erosionMap,
      terrainClass: tectonics.terrainClass,
      flow: hydrology.flow,
      riverMask: hydrology.riverMask,
      riverId: hydrology.riverId,
      riverPolylines: hydrology.riverPolylines,
      lakeMask: hydrology.lakeMask,
      swampMask: hydrology.swampMask,
      floodplainMask: hydrology.floodplainMask,
      basinId: hydrology.basinId,
      temp: climate.temp,
      moisture: climate.moisture,
      rainShadow: climate.rainShadow,
      continentality: climate.continentality,
      windExposure: climate.windExposure,
      biome: climate.biome,
      biomeMoistureBand: climate.moistureBand,
      biomeTempBand: climate.tempBand
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
  const moistureBase = new Float32Array(n);
  const waterMask = new Uint8Array(n);
  const plateIndex = new Uint16Array(n);
  const stressMap = new Float32Array(n);
  const ridgeMap = new Float32Array(n);
  const slope = new Float32Array(n);
  const erosionMap = new Float32Array(n);
  const terrainClass = new Uint8Array(n);

  const plateCount = clampInt(cfg.plateCount, 5, 12);
  const plates = Array.from({ length: plateCount }, (_, id) => {
    const angle = rng() * Math.PI * 2;
    return {
      id,
      x: rng() * size,
      y: rng() * size,
      vx: Math.cos(angle) * (0.4 + rng() * 0.8),
      vy: Math.sin(angle) * (0.4 + rng() * 0.8),
      continental: rng() < 0.58,
      buoyancy: 0.35 + rng() * 0.6,
      roughness: 0.3 + rng() * 0.9
    };
  });

  const seaLevel = clamp(cfg.seaLevel, 0.18, 0.4);
  const noiseSeedA = Math.floor(rng() * 1e9);
  const noiseSeedB = Math.floor(rng() * 1e9);
  const shelfWidth = clamp(cfg.coastalShelfWidth, 0.16, 0.34);

  for (let y = 0; y < size; y++) {
    const lat = Math.abs((y / (size - 1)) * 2 - 1);
    for (let x = 0; x < size; x++) {
      const i = y * size + x;

      let aId = 0;
      let bId = 1;
      let minA = 1e9;
      let minB = 1e9;

      for (const p of plates) {
        const dx = x - p.x;
        const dy = y - p.y;
        const d = dx * dx + dy * dy;
        if (d < minA) {
          minB = minA;
          bId = aId;
          minA = d;
          aId = p.id;
        } else if (d < minB) {
          minB = d;
          bId = p.id;
        }
      }

      plateIndex[i] = aId;

      const pa = plates[aId];
      const pb = plates[bId];
      const nx = x - pa.x;
      const ny = y - pa.y;
      const relVx = pb.vx - pa.vx;
      const relVy = pb.vy - pa.vy;
      const normalLen = Math.hypot(nx, ny) + 1e-6;
      const normalDot = (relVx * nx + relVy * ny) / normalLen;
      const shear = Math.abs(relVx * ny - relVy * nx) / normalLen;

      const boundaryDist = Math.sqrt(Math.max(0, minB - minA));
      const boundaryFactor = Math.max(0, 1 - boundaryDist / 26);

      const convergent = Math.max(0, -normalDot) * boundaryFactor;
      const divergent = Math.max(0, normalDot) * boundaryFactor;
      const transform = shear * 0.15 * boundaryFactor;

      const plateBias = pa.continental ? 0.09 : -0.06;
      const collisionLift = convergent * (0.42 + pa.buoyancy * 0.18 + pb.buoyancy * 0.12);
      const riftDrop = divergent * 0.24;
      const transformRidge = transform * 0.15;

      const edgeShelf = Math.min(Math.min(x, y), Math.min(size - 1 - x, size - 1 - y)) / (size * shelfWidth);
      const shelfCurve = smoothstep(0, 1, edgeShelf);

      const warpA = fbm(
        (x + 80 * fbm(x / size, y / size, noiseSeedA, 3)) / size,
        (y + 80 * fbm(y / size, x / size, noiseSeedB, 3)) / size,
        noiseSeedA,
        4
      );
      const warpB = fbm(x / size + 0.35, y / size + 0.65, noiseSeedB, 5);
      const rugged = clamp(cfg.ruggedness, 0.1, 0.95);

      let h = 0.43 * warpA + 0.27 * warpB + plateBias + collisionLift + transformRidge - riftDrop + 0.32 * shelfCurve - 0.1 * lat;
      h = h * (0.72 + rugged * 0.52) + (warpA - 0.5) * rugged * pa.roughness * 0.25;
      h = clamp(h, 0, 1);

      height[i] = h;
      stressMap[i] = clamp(convergent + transform - divergent * 0.6, 0, 1);
      ridgeMap[i] = clamp((collisionLift + transformRidge) * 1.8, 0, 1);
      moistureBase[i] = clamp(0.55 * (1 - lat) + 0.34 * (1 - h) + (rng() - 0.5) * 0.08, 0, 1);
      waterMask[i] = h < seaLevel ? 1 : 0;
    }
  }

  for (let pass = 0; pass < clampInt(cfg.erosionPasses, 0, 5); pass++) {
    thermalErosionPass(size, height, ridgeMap, waterMask, erosionMap);
  }

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const hx = height[i + 1] - height[i - 1];
      const hy = height[i + size] - height[i - size];
      slope[i] = clamp(Math.hypot(hx, hy) * 2.4, 0, 1);

      terrainClass[i] = height[i] < seaLevel
        ? 0
        : height[i] < seaLevel + 0.05
          ? 1
          : height[i] < 0.55
            ? 2
            : height[i] < 0.72
              ? 3
              : height[i] < 0.85
                ? 4
                : 5;
    }
  }

  return { height, moistureBase, waterMask, plateIndex, stressMap, ridgeMap, slope, erosionMap, terrainClass, plates };
}

function genHydrology(size, tectonics, rng, cfg) {
  const { height, waterMask, moistureBase, slope } = tectonics;
  const n = size * size;

  const flow = new Float32Array(n);
  const riverMask = new Uint8Array(n);
  const lakeMask = new Uint8Array(n);
  const swampMask = new Uint8Array(n);
  const floodplainMask = new Uint8Array(n);
  const basinId = new Int32Array(n);
  const riverId = new Int32Array(n);
  basinId.fill(-1);
  riverId.fill(-1);

  const downstream = new Int32Array(n);
  downstream.fill(-1);

  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => height[b] - height[a]);

  const seaLevel = clamp(cfg.seaLevel, 0.18, 0.4);
  const hydroStrength = clamp(cfg.hydrologyStrength, 0.1, 0.95);
  const riverThreshold = 14 + (1 - hydroStrength) * 20;
  let basinCount = 0;
  let riverCount = 0;
  let lakeCount = 0;
  let swampCount = 0;

  for (const i of indices) {
    if (waterMask[i]) continue;

    flow[i] = Math.max(flow[i], 1 + moistureBase[i] * 1.4);

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
        const sinTerm = Math.sin((i + ni) * 0.001) * clamp(cfg.riverSinuosity, 0, 1) * 0.004;
        const candidate = height[ni] + sinTerm;
        if (candidate < bestH) {
          bestH = candidate;
          best = ni;
        }
      }
    }

    if (best !== i) {
      downstream[i] = best;
      flow[best] += flow[i] * 0.985;

      const riverChance = flow[i] / riverThreshold;
      if (riverChance > 1 && height[i] > seaLevel + 0.012) {
        riverMask[i] = 1;
        riverId[i] = riverCount;
        riverCount += 1;
      }

      if (riverMask[i] && slope[i] < 0.16 && height[i] < seaLevel + 0.24) floodplainMask[i] = 1;
    } else {
      basinId[i] = basinCount++;
      if (flow[i] > riverThreshold * 0.55 && height[i] > seaLevel + 0.01) {
        lakeMask[i] = 1;
        lakeCount += 1;
      }
    }

    if (!lakeMask[i] && moistureBase[i] > 0.72 && slope[i] < 0.08 && height[i] < seaLevel + 0.22) {
      if (rng() < 0.018 + cfg.swampDensity * 0.03) {
        swampMask[i] = 1;
        swampCount += 1;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (!lakeMask[i]) continue;
    const x = i % size;
    const y = Math.floor(i / size);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) continue;
        const ni = ny * size + nx;
        if (!waterMask[ni] && height[ni] < seaLevel + 0.16 && slope[ni] < 0.18) floodplainMask[ni] = 1;
      }
    }
  }

  const riverPolylines = traceRiverPolylines(size, riverMask, downstream, flow, riverThreshold);

  return {
    flow,
    riverMask,
    riverId,
    riverPolylines,
    lakeMask,
    swampMask,
    floodplainMask,
    basinId,
    downstream,
    basinCount,
    riverCount,
    lakeCount,
    swampCount
  };
}

function genClimate(size, tectonics, hydrology, rng, cfg) {
  const n = size * size;
  const temp = new Float32Array(n);
  const moisture = new Float32Array(n);
  const rainShadow = new Float32Array(n);
  const continentality = new Float32Array(n);
  const windExposure = new Float32Array(n);
  const biome = new Uint8Array(n);
  const tempBand = new Uint8Array(n);
  const moistureBand = new Uint8Array(n);

  const { height, moistureBase, waterMask } = tectonics;
  const { riverMask, lakeMask, swampMask } = hydrology;
  const distanceToWater = buildDistanceToWater(size, waterMask, lakeMask);
  const maxDist = size * 0.4;

  for (let y = 0; y < size; y++) {
    const lat = Math.abs((y / (size - 1)) * 2 - 1);
    let shadowCarry = 0;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const h = height[i];

      if (h > 0.62) shadowCarry = clamp(shadowCarry + (h - 0.62) * (0.5 + cfg.rainShadowStrength), 0, 1);
      else shadowCarry = Math.max(0, shadowCarry - 0.04);

      const waterDistNorm = clamp(distanceToWater[i] / maxDist, 0, 1);
      const cont = smoothstep(0, 1, waterDistNorm);
      continentality[i] = cont;
      windExposure[i] = 1 - shadowCarry;

      const elevCool = Math.max(0, h - 0.35) * 0.56;
      const inlandSwing = (cont - 0.5) * 0.14;
      const t = clamp(1 - lat - elevCool - inlandSwing + cfg.tempBias * 0.25 + (rng() - 0.5) * 0.05, 0, 1);
      temp[i] = t;
      rainShadow[i] = shadowCarry;

      const riverBonus = riverMask[i] ? 0.18 : 0;
      const lakeBonus = lakeMask[i] ? 0.16 : 0;
      const swampBonus = swampMask[i] ? 0.08 : 0;
      const coastBonus = nearCoast(x, y, size, waterMask) ? 0.12 : 0;
      const inlandDry = cont * 0.22 + Math.max(0, h - 0.62) * 0.28 + shadowCarry * cfg.rainShadowStrength;

      let m = moistureBase[i] + riverBonus + lakeBonus + swampBonus + coastBonus - inlandDry + cfg.moistureBias * 0.24;
      m = clamp(m, 0, 1);
      moisture[i] = m;

      tempBand[i] = t < 0.27 ? 0 : t < 0.47 ? 1 : t < 0.68 ? 2 : 3;
      moistureBand[i] = m < 0.28 ? 0 : m < 0.56 ? 1 : 2;
      biome[i] = biomeBand(h, t, m, cfg);
    }
  }

  return { temp, moisture, rainShadow, continentality, windExposure, biome, tempBand, moistureBand };
}

function biomeBand(h, t, m, cfg) {
  const seaLevel = clamp(cfg.seaLevel, 0.18, 0.4);
  if (h < seaLevel) return BIOMES.indexOf('ocean');
  if (h < seaLevel + 0.05) return BIOMES.indexOf('coast');
  if (h > 0.85) return BIOMES.indexOf('peaks');
  if (h > 0.72) return BIOMES.indexOf('mountains');
  if (h > 0.55) return BIOMES.indexOf('hills');
  if (m < 0.2 + cfg.desertHarshness * 0.24 && t > 0.44) return BIOMES.indexOf('desert');
  if (m < 0.36) return BIOMES.indexOf('steppe');
  if (m > 0.72 - cfg.swampDensity * 0.22) return BIOMES.indexOf('swamp');
  if (m > 0.52 - cfg.forestDensity * 0.18) return BIOMES.indexOf('forest');
  return BIOMES.indexOf('lowland');
}

function genProvinces(size, tectonics, climate, hydrology, rng, cfg) {
  const target = clampInt(cfg.provinceTarget, 80, 160);
  const seeds = sampleProvinceSeeds(size, target, tectonics, climate, hydrology, rng, cfg);

  const provinceMap = growProvincesWeighted(size, seeds, tectonics, climate, hydrology);
  const provinces = buildProvinceObjects(size, seeds, provinceMap, tectonics, climate, hydrology, rng);

  computeNeighbors(size, provinceMap, provinces);
  normalizeProvinceSizes(provinces, provinceMap, size, tectonics, climate, hydrology, rng);

  return provinces;
}

function sampleProvinceSeeds(size, target, tectonics, climate, hydrology, rng, cfg) {
  const candidates = [];
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      const i = y * size + x;
      if (tectonics.waterMask[i]) continue;

      const h = tectonics.height[i];
      const b = climate.biome[i];
      if (h > 0.9) continue;
      if (b === BIOMES.indexOf('desert') && rng() < 0.65) continue;

      const fertile = climate.moisture[i] * 0.45 + (1 - Math.abs(climate.temp[i] - 0.54)) * 0.25;
      const river = hydrology.riverMask[i] ? 0.26 : 0;
      const lake = hydrology.lakeMask[i] ? 0.16 : 0;
      const pass = h > 0.58 && h < 0.74 ? 0.12 : 0;
      const coast = h < cfg.seaLevel + 0.06 ? 0.14 : 0;
      const dangerPenalty = tectonics.slope[i] > 0.42 ? 0.12 : 0;
      const score = fertile + river + lake + pass + coast - dangerPenalty;

      if (score > 0.18) candidates.push({ x, y, i, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const seeds = [];
  const minDist = Math.max(10, Math.floor(size / Math.sqrt(target)));
  const minDist2 = minDist * minDist;

  for (const c of candidates) {
    if (seeds.length >= target) break;
    let good = true;
    for (const s of seeds) {
      const d2 = (c.x - s.x) ** 2 + (c.y - s.y) ** 2;
      if (d2 < minDist2) {
        good = false;
        break;
      }
    }
    if (good) seeds.push({ id: seeds.length, x: c.x, y: c.y, i: c.i });
  }

  while (seeds.length < target) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const i = y * size + x;
    if (tectonics.waterMask[i]) continue;
    seeds.push({ id: seeds.length, x, y, i });
  }

  return seeds;
}

function growProvincesWeighted(size, seeds, tectonics, climate, hydrology) {
  const n = size * size;
  const provinceMap = new Int32Array(n);
  provinceMap.fill(-1);

  const bestCost = new Float32Array(n);
  bestCost.fill(1e9);

  const heap = new MinHeap();

  for (const seed of seeds) {
    provinceMap[seed.i] = seed.id;
    bestCost[seed.i] = 0;
    heap.push({ idx: seed.i, provinceId: seed.id, cost: 0 });
  }

  while (!heap.isEmpty()) {
    const node = heap.pop();
    if (node.cost > bestCost[node.idx]) continue;

    const x = node.idx % size;
    const y = Math.floor(node.idx / size);

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) continue;

        const ni = ny * size + nx;
        if (tectonics.waterMask[ni]) continue;

        const moveCost = terrainMoveCost(ni, tectonics, climate, hydrology);
        const diagonal = ox && oy ? 1.35 : 1;
        const nc = node.cost + moveCost * diagonal;

        if (nc < bestCost[ni]) {
          bestCost[ni] = nc;
          provinceMap[ni] = node.provinceId;
          heap.push({ idx: ni, provinceId: node.provinceId, cost: nc });
        }
      }
    }
  }

  return provinceMap;
}

function terrainMoveCost(i, tectonics, climate, hydrology) {
  const b = climate.biome[i];
  let cost = 1;
  if (b === BIOMES.indexOf('forest')) cost = 1.3;
  else if (b === BIOMES.indexOf('hills')) cost = 1.6;
  else if (b === BIOMES.indexOf('mountains')) cost = 5;
  else if (b === BIOMES.indexOf('peaks')) cost = 7;

  if (hydrology.riverMask[i]) cost += 1.8;
  if (tectonics.slope[i] > 0.3) cost += tectonics.slope[i] * 2;
  return cost;
}

function buildProvinceObjects(size, seeds, provinceMap, tectonics, climate, hydrology, rng) {
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

  const n = size * size;
  for (let i = 0; i < n; i++) {
    const pid = provinceMap[i];
    if (pid < 0) continue;
    const p = provinces[pid];

    p.cells += 1;
    p.avgElevation += tectonics.height[i];
    p.avgTemp += climate.temp[i];
    p.avgMoisture += climate.moisture[i];
    p.riverDensity += hydrology.riverMask[i];

    if (hydrology.lakeMask[i]) p.lakePresence = true;
    if (tectonics.height[i] < 0.33) p.coastal = true;
    if (p.coastal) p.portNode = true;
    if (hydrology.riverMask[i]) p.tradeNode = true;

    p.biomeType = BIOMES[climate.biome[i]];
  }

  for (const p of provinces) {
    p.avgElevation /= Math.max(1, p.cells);
    p.avgTemp /= Math.max(1, p.cells);
    p.avgMoisture /= Math.max(1, p.cells);
    p.riverDensity /= Math.max(1, p.cells);
    p.elevationVar = Math.max(0.01, 0.28 * p.avgElevation * (1 - p.avgElevation));

    p.primaryResource = pick(primaryResourceFromContext(p), rng);
    p.secondaryResources = [pick(RESOURCES, rng), pick(RESOURCES, rng)].filter((r, idx, arr) => r !== p.primaryResource && arr.indexOf(r) === idx);
    if (p.secondaryResources.length < 2) p.secondaryResources.push('Stone');
  }

  return provinces;
}

function primaryResourceFromContext(p) {
  if (p.coastal && p.tradeNode) return ['Exotic Trade', 'Salt', 'Livestock'];
  if (p.biomeType === 'forest') return ['Timber', 'Livestock'];
  if (p.biomeType === 'swamp') return ['Livestock', 'Arcane Reagent'];
  if (p.biomeType === 'desert') return ['Salt', 'Stone'];
  if (p.biomeType === 'mountains' || p.biomeType === 'peaks') return ['Iron', 'Stone', 'Silver'];
  if (p.riverDensity > 0.08) return ['Grain', 'Livestock'];
  if (p.faithStrength > 70) return ['Faith Relic', 'Grain'];
  if (p.arcaneSaturation > 70) return ['Arcane Reagent', 'Stone'];
  return ['Grain', 'Livestock', 'Timber'];
}

function computeNeighbors(size, provinceMap, provinces) {
  const n = size * size;
  const neighbors = provinces.map(() => new Set());

  for (let i = 0; i < n; i++) {
    const p = provinceMap[i];
    if (p < 0) continue;
    const x = i % size;
    const y = Math.floor(i / size);

    if (x + 1 < size) {
      const q = provinceMap[i + 1];
      if (q >= 0 && q !== p) {
        neighbors[p].add(q);
        neighbors[q].add(p);
      }
    }
    if (y + 1 < size) {
      const q = provinceMap[i + size];
      if (q >= 0 && q !== p) {
        neighbors[p].add(q);
        neighbors[q].add(p);
      }
    }
  }

  for (let i = 0; i < provinces.length; i++) {
    provinces[i].neighborIds = Array.from(neighbors[i]);
  }
}

function normalizeProvinceSizes(provinces, provinceMap, size, tectonics, climate, hydrology, rng) {
  const minCells = 180;
  const maxCells = Math.max(2500, (size * size) / 18);

  for (const p of provinces) {
    if (p.cells < minCells) {
      p.stability = clamp(p.stability - 5, 0, 100);
      p.unrest = clamp(p.unrest + 7, 0, 100);
    }
    if (p.cells > maxCells) {
      p.stability = clamp(p.stability - 6, 0, 100);
      p.expansionPressure = (p.expansionPressure ?? 0) + 5;
    }

    p.travelCostBase = clamp(8 + p.avgElevation * 20 + p.riverDensity * 14 + (p.biomeType === 'mountains' ? 10 : 0), 6, 55);
    p.tradeValue = clamp(p.tradeValue + p.riverDensity * 40 + (p.portNode ? 25 : 0) - (p.biomeType === 'desert' ? 10 : 0), 0, 120);
    p.prosperity = clamp(p.prosperity + p.tradeValue * 0.08 - p.danger * 0.05, 0, 100);
    p.infrastructure = clamp(p.infrastructure + p.tradeValue * 0.04, 0, 100);
  }

  void provinceMap;
  void tectonics;
  void climate;
  void hydrology;
  void rng;
}

function genFactions(provinces, rng, cfg) {
  const names = ['Crown', 'League', 'Synod', 'Host', 'Compact', 'March', 'Order', 'Conclave', 'Bastion', 'Mandate'];
  const archetypes = ['militant', 'mercantile', 'religious', 'arcane', 'tribal'];
  const deityKeys = Object.keys(DEITIES);
  const races = Object.keys(RACES_WORLD);

  const count = clampInt(cfg.factionCount, 5, 10);
  const factions = Array.from({ length: count }, (_, id) => ({
    id,
    name: names[id % names.length],
    cultureId: pick(races, rng),
    color: `hsl(${(id * 57) % 360} 60% 50%)`,
    archetype: pick(archetypes, rng),
    capitalProvinceId: provinces[Math.floor(rng() * provinces.length)].id,
    controlledProvinces: [],
    legitimacy: 35 + Math.floor(rng() * 65),
    wealth: 35 + Math.floor(rng() * 65),
    manpower: 35 + Math.floor(rng() * 65),
    supply: 35 + Math.floor(rng() * 65),
    techLevel: Math.floor(rng() * 6),
    faithAlignment: pick(deityKeys, rng),
    arcaneTolerance: Math.floor(rng() * 101),
    diplomacy: {},
    warExhaustion: Math.floor(rng() * 20),
    expansionPressure: 10 + Math.floor(rng() * 50),
    strategicGoals: ['hold front', 'secure trade', 'control passes']
  }));

  // cluster assignment around capitals
  for (const p of provinces) {
    let best = 0;
    let bestD = 1e9;
    for (const f of factions) {
      const cap = provinces[f.capitalProvinceId] ?? provinces[0];
      const d = (p.centerX - cap.centerX) ** 2 + (p.centerY - cap.centerY) ** 2;
      const weighted = d * (0.7 + rng() * 0.6);
      if (weighted < bestD) {
        bestD = weighted;
        best = f.id;
      }
    }
    p.factionOwnerId = best;
    factions[best].controlledProvinces.push(p.id);
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
      const tier = clampInt(p.settlementTier + Math.floor(rng() * 2), 0, types.length - 1);
      const type = types[tier];
      const name = `${p.name} ${pick(['Hold', 'Gate', 'Haven', 'Crossing', 'Hearth', 'Market'], rng)}`;
      const settlement = {
        id: settlements.length,
        provinceId: p.id,
        name,
        type,
        prosperity: 15 + Math.floor(rng() * 80),
        services: ['repair', 'hire', 'trade', 'rumors'].filter(() => rng() > 0.35)
      };
      settlements.push(settlement);
      p.settlements.push(settlement.id);
    }
  }

  return settlements;
}

function genTradeGraph(size, provinces, settlements, hydrology, rng) {
  const nodes = provinces.slice(0, Math.min(140, provinces.length)).map((p) => ({
    provinceId: p.id,
    type: p.portNode ? 'port' : p.tradeNode ? 'market' : 'capital'
  }));

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[Math.min(nodes.length - 1, i + 1 + Math.floor(rng() * 4))];

    const center = provinces[a.provinceId];
    const centerIndex = center.centerY * size + center.centerX;

    edges.push({
      from: a.provinceId,
      to: b.provinceId,
      type: hydrology.riverMask[centerIndex] ? 'river' : 'road',
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
      frontlineProvinces: provinces.filter((p) => p.factionOwnerId === a.id || p.factionOwnerId === b.id).slice(0, 8).map((p) => p.id),
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
  const actorCount = clampInt(cfg.actorTarget, 120, 260);

  for (let i = 0; i < actorCount; i++) {
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
      payout: {
        gold: 30 + Math.floor(rng() * 80),
        gear: rng() < 0.3 ? 'Relic Fragment' : null,
        influence: 1 + Math.floor(rng() * 6),
        repEffects: 1 + Math.floor(rng() * 4)
      },
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
      text: fillTemplate(pick(EXTENDED_TEMPLATES.rumors, rng), {
        province: province.name,
        actor: actor.name,
        event: pick(EVENT_TYPES, rng)
      }),
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
      text: fillTemplate(pick(EXTENDED_TEMPLATES.proclamations, rng), {
        province: province.name,
        faction: faction.name
      }),
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


function thermalErosionPass(size, height, ridgeMap, waterMask, erosionMap) {
  const n = size * size;
  const delta = new Float32Array(n);
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (waterMask[i]) continue;
      const h = height[i];
      let steepest = i;
      let maxDrop = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const ni = (y + oy) * size + (x + ox);
          const drop = h - height[ni];
          if (drop > maxDrop) {
            maxDrop = drop;
            steepest = ni;
          }
        }
      }
      if (steepest !== i && maxDrop > 0.015) {
        const move = Math.min(maxDrop * 0.18, 0.02) * (1 - ridgeMap[i] * 0.4);
        delta[i] -= move;
        delta[steepest] += move;
        erosionMap[i] = clamp(erosionMap[i] + move * 24, 0, 1);
      }
    }
  }
  for (let i = 0; i < n; i++) height[i] = clamp(height[i] + delta[i], 0, 1);
}

function traceRiverPolylines(size, riverMask, downstream, flow, threshold) {
  const lines = [];
  const visited = new Uint8Array(riverMask.length);
  for (let i = 0; i < riverMask.length; i++) {
    if (!riverMask[i] || visited[i] || flow[i] < threshold * 0.7) continue;
    const line = [];
    let cur = i;
    let guard = 0;
    while (cur >= 0 && riverMask[cur] && guard < 512) {
      if (visited[cur]) break;
      visited[cur] = 1;
      const x = cur % size;
      const y = Math.floor(cur / size);
      line.push({ x, y });
      const next = downstream[cur];
      if (next < 0 || next === cur) break;
      cur = next;
      guard += 1;
    }
    if (line.length > 3) lines.push(line);
  }
  return lines;
}

function buildDistanceToWater(size, waterMask, lakeMask) {
  const n = size * size;
  const dist = new Float32Array(n);
  const inf = 1e9;
  for (let i = 0; i < n; i++) dist[i] = (waterMask[i] || lakeMask[i]) ? 0 : inf;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
      if (y > 0) dist[i] = Math.min(dist[i], dist[i - size] + 1);
    }
  }

  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const i = y * size + x;
      if (x + 1 < size) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
      if (y + 1 < size) dist[i] = Math.min(dist[i], dist[i + size] + 1);
    }
  }

  return dist;
}

function nearCoast(x, y, size, waterMask) {
  for (let oy = -3; oy <= 3; oy++) {
    for (let ox = -3; ox <= 3; ox++) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) continue;
      const ni = ny * size + nx;
      if (waterMask[ni]) return true;
    }
  }
  return false;
}

function fbm(x, y, seed = 0, octaves = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const nx = x * freq + i * 0.31;
    const ny = y * freq + i * 0.17;
    const v = noise2d(nx, ny, seed + i * 1013);
    sum += v * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function noise2d(x, y, seed) {
  const xi = Math.floor(x * 4096);
  const yi = Math.floor(y * 4096);
  let h = (xi * 374761393 + yi * 668265263 + seed * 1442695041) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

function fillTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? key);
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

class MinHeap {
  constructor() {
    this.data = [];
  }

  isEmpty() {
    return this.data.length === 0;
  }

  push(value) {
    this.data.push(value);
    this.#bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 1) return this.data.pop();
    const root = this.data[0];
    this.data[0] = this.data.pop();
    this.#bubbleDown(0);
    return root;
  }

  #bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.data[parent].cost <= this.data[index].cost) break;
      [this.data[parent], this.data[index]] = [this.data[index], this.data[parent]];
      index = parent;
    }
  }

  #bubbleDown(index) {
    const len = this.data.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = left + 1;
      if (left < len && this.data[left].cost < this.data[smallest].cost) smallest = left;
      if (right < len && this.data[right].cost < this.data[smallest].cost) smallest = right;
      if (smallest === index) break;
      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}
