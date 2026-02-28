import { CONTRACT_TYPES, EVENT_TYPES, EXTENDED_TEMPLATES, RUMOR_SOURCES } from './content.js';

export function tickDay(world) {
  world.day += 1;

  tickProvinces(world);
  tickFactions(world);
  tickWars(world);
  tickTrade(world);
  tickActors(world);
  tickChains(world);
  tickContracts(world);
  tickRumors(world);
  tickProclamations(world);
  tickNarrative(world);
  tickBestiary(world);
  tickObituary(world);
  tickWorldAge(world);
}

function tickProvinces(world) {
  for (const p of world.provinces) {
    const corruption = p.arcaneSaturation > 70 && p.faithStrength < 20 ? 3 : 0;
    const holyStability = p.faithStrength > 70 && p.arcaneSaturation < 25 ? 2 : 0;
    const tension = p.arcaneSaturation > 70 && p.faithStrength > 70 ? 2 : 0;
    const warPressure = p.contested ? 2 : 0;

    p.danger = clamp(p.danger + (rand(world) * 6 - 2) + corruption + warPressure - holyStability, 0, 100);
    p.stability = clamp(p.stability + (rand(world) * 6 - 3) - corruption - tension - warPressure + holyStability, 0, 100);
    p.prosperity = clamp(p.prosperity + (rand(world) * 4 - 2) + (p.stability > 65 ? 1.2 : -1.2), 0, 100);
    p.infrastructure = clamp(p.infrastructure + (p.prosperity > 55 ? 0.5 : -0.3), 0, 100);
    p.unrest = clamp(100 - p.stability + rand(world) * 6 - 3, 0, 100);
    p.lawless = p.unrest > 72;
    p.monsterPresence = p.danger > 58;

    if (p.contested) {
      p.contestedDays += 1;
      if (p.contestedDays > 5 && rand(world) < 0.35) p.contested = false;
    } else {
      p.contestedDays = Math.max(0, p.contestedDays - 1);
    }
  }
}

function tickFactions(world) {
  for (const f of world.factions) {
    const sizePressure = Math.max(0, f.controlledProvinces.length - 18) * 0.6;
    f.warExhaustion = clamp(f.warExhaustion + rand(world) * 3 - 1 + sizePressure, 0, 100);
    f.wealth = clamp(f.wealth + rand(world) * 4 - 1.2, 0, 100);
    f.manpower = clamp(f.manpower + rand(world) * 3 - 1.4, 0, 100);
    f.supply = clamp(f.supply + rand(world) * 3 - 1.4, 0, 100);
    f.expansionPressure = clamp(f.expansionPressure + rand(world) * 4 - 1.5 + (f.warExhaustion < 30 ? 1 : -0.5), 0, 100);
  }
}

function tickWars(world) {
  for (const war of world.wars) {
    war.supplyA = clamp(war.supplyA + rand(world) * 4 - 2, 0, 100);
    war.supplyB = clamp(war.supplyB + rand(world) * 4 - 2, 0, 100);
    war.moraleA = clamp(war.moraleA + rand(world) * 4 - 2, 0, 100);
    war.moraleB = clamp(war.moraleB + rand(world) * 4 - 2, 0, 100);
    war.warExhaustionA = clamp(war.warExhaustionA + rand(world) * 2, 0, 100);
    war.warExhaustionB = clamp(war.warExhaustionB + rand(world) * 2, 0, 100);

    if (rand(world) < 0.12 && war.frontlineProvinces.length) {
      const provinceId = pick(world, war.frontlineProvinces);
      const winnerId = rand(world) > 0.5 ? war.factions[0] : war.factions[1];
      war.battles.push({ day: world.day, provinceId, winnerId, losses: 10 + Math.floor(rand(world) * 80) });
      war.battles = war.battles.slice(-20);

      const p = world.provinces[provinceId];
      if (p) {
        p.contested = true;
        p.contestedDays = 4;
        p.danger = clamp(p.danger + 7, 0, 100);
        p.stability = clamp(p.stability - 5, 0, 100);
      }
    }
  }
}

function tickTrade(world) {
  for (const edge of world.tradeGraph.edges) {
    edge.reliability = clamp(edge.reliability + (rand(world) * 0.08 - 0.03), 0.05, 1);
    const pA = world.provinces[edge.from];
    const pB = world.provinces[edge.to];
    if (pA?.contested || pB?.contested) edge.reliability = clamp(edge.reliability - 0.08, 0.05, 1);
  }
}

function tickActors(world) {
  for (const actor of world.actors) {
    if (!actor.alive) continue;
    if (rand(world) < 0.06) actor.provinceId = Math.floor(rand(world) * world.provinces.length);
    actor.power = clamp(actor.power + rand(world) * 4 - 2, 0, 100);
    actor.reputation = clamp(actor.reputation + rand(world) * 8 - 4, -100, 100);
    actor.fear = clamp(actor.fear + rand(world) * 6 - 3, 0, 100);

    if (actor.type === 'monster') {
      actor.territorySize = clamp(actor.territorySize + rand(world) * 1.2 - 0.2, 1, 99);
      actor.notoriety = clamp(actor.notoriety + rand(world) * 4 - 0.5, 0, 100);
    }

    if (rand(world) < 0.0018) {
      actor.alive = false;
      actor.deathDay = world.day;
      actor.deathCause = pick(world, ['battle', 'assassination', 'disease', 'monster attack', 'duel']);
      world.obituary.unshift({ id: world.day * 1000 + actor.id, name: actor.name, cause: actor.deathCause, location: world.provinces[actor.provinceId]?.name ?? 'Unknown', day: world.day });
    }
  }

  world.obituary = world.obituary.slice(0, 80);
}

function tickChains(world) {
  for (const chain of world.eventChains) {
    if (!chain.active) continue;
    chain.progress += rand(world) * 1.6;
    if (chain.progress >= 10) {
      chain.progress = 0;
      chain.stage += 1;
      const province = world.provinces[chain.provinceId];
      if (province) {
        province.activeEvents.push(chain.id);
        province.danger = clamp(province.danger + 4, 0, 100);
      }
      world.chronicle.unshift(fillTemplate(pick(world, EXTENDED_TEMPLATES.chronicle), {
        actor: world.actors[chain.actorId]?.name ?? 'An unknown hand',
        target: province?.name ?? 'the frontier',
        province: province?.name ?? 'the frontier',
        event: chain.type,
        faction: world.factions[chain.factionId]?.name ?? 'a distant throne',
        deity: world.provinces[chain.provinceId]?.divineAlignment ?? 'the gods'
      }));
      if (chain.stage > chain.maxStage) chain.active = false;
    }
  }

  const activeCount = world.eventChains.filter((c) => c.active).length;
  if (activeCount < 2 && rand(world) < 0.4) {
    world.eventChains.push({
      id: world.eventChains.length,
      type: pick(world, EVENT_TYPES),
      stage: 1,
      maxStage: 4,
      provinceId: Math.floor(rand(world) * world.provinces.length),
      factionId: Math.floor(rand(world) * world.factions.length),
      actorId: Math.floor(rand(world) * world.actors.length),
      progress: 0,
      active: true,
      eventId: `chain-${world.day}-${world.eventChains.length}`
    });
  }
}

function tickContracts(world) {
  for (const c of world.contracts) {
    if (c.status === 'accepted' && rand(world) < 0.11) {
      resolveContract(world, c);
    }
    if (c.status === 'open' && c.expiresDay <= world.day) c.status = 'expired';
  }

  world.contracts = world.contracts
    .filter((c) => c.status === 'open' || c.status === 'accepted' || c.expiresDay + 4 >= world.day)
    .slice(-120);

  if (world.day % 6 === 0) {
    const allTypes = Object.values(CONTRACT_TYPES).flat();
    const province = pick(world, world.provinces);
    const chain = pick(world, world.eventChains);
    const issuer = pick(world, world.actors);
    world.contracts.unshift({
      id: world.day * 10 + Math.floor(rand(world) * 9),
      type: pick(world, allTypes),
      category: pick(world, Object.keys(CONTRACT_TYPES)),
      issuerActorId: issuer.id,
      issuerFactionId: issuer.factionId,
      targetProvinceIds: [province.id],
      causeRefs: { eventId: chain.eventId, actorId: issuer.id, warId: null, monsterId: null },
      objectives: ['Reach area', 'Resolve threat', 'Report outcome'],
      timeWindow: 8 + Math.floor(rand(world) * 18),
      riskRating: 1 + Math.floor(province.danger / 20),
      payout: { gold: 25 + Math.floor(rand(world) * 90), gear: null, influence: 1 + Math.floor(rand(world) * 4), repEffects: 1 + Math.floor(rand(world) * 4) },
      factionRelationEffects: {},
      successConsequences: ['Province stability rises'],
      failureConsequences: ['Province danger rises'],
      provinceId: province.id,
      title: `${pick(world, allTypes)} in ${province.name}`,
      issuedDay: world.day,
      expiresDay: world.day + 8 + Math.floor(rand(world) * 18),
      status: 'open'
    });
  }
}

function resolveContract(world, c) {
  const province = world.provinces[c.provinceId];
  const success = rand(world) > (0.18 + c.riskRating * 0.09);
  c.status = success ? 'completed' : 'failed';
  c.expiresDay = world.day + 3;

  if (success) {
    const treasury = world.inventory.find((i) => i.slot === 'Treasury');
    if (treasury) treasury.qty += c.payout.gold;
    if (province) {
      province.danger = clamp(province.danger - 5 - c.riskRating, 0, 100);
      province.stability = clamp(province.stability + 4, 0, 100);
      province.prosperity = clamp(province.prosperity + 2, 0, 100);
    }
  } else if (province) {
    province.danger = clamp(province.danger + 6, 0, 100);
    province.stability = clamp(province.stability - 4, 0, 100);
    province.unrest = clamp(province.unrest + 5, 0, 100);
  }

  world.chronicle.unshift(`Day ${world.day}: Contract ${c.title} ${success ? 'succeeded' : 'failed'} in ${province?.name ?? `P${c.provinceId + 1}`}.`);
}

function tickRumors(world) {
  world.rumors = world.rumors.filter((r) => r.expiresDay >= world.day).slice(0, 60);
  if (world.day % 4 !== 0) return;

  const province = pick(world, world.provinces);
  const actor = pick(world, world.actors);
  world.rumors.unshift({
    id: world.day * 10 + Math.floor(rand(world) * 9),
    title: `Whispers of ${province.name}`,
    text: fillTemplate(pick(world, EXTENDED_TEMPLATES.rumors), { province: province.name, actor: actor.name, event: pick(world, EVENT_TYPES) }),
    source: pick(world, RUMOR_SOURCES),
    credibility: 30 + Math.floor(rand(world) * 70),
    provinceId: province.id,
    expiresDay: world.day + 10 + Math.floor(rand(world) * 16)
  });
}

function tickProclamations(world) {
  if (world.day % 12 !== 0) return;
  const province = pick(world, world.provinces);
  const faction = pick(world, world.factions);
  world.proclamations.unshift({
    id: world.day * 10 + 2,
    title: `Proclamation of ${faction.name}`,
    text: fillTemplate(pick(world, EXTENDED_TEMPLATES.proclamations), { faction: faction.name, province: province.name }),
    provinceId: province.id,
    day: world.day
  });
  world.proclamations = world.proclamations.slice(0, 40);
}

function tickNarrative(world) {
  if (world.day % 8 !== 0) return;
  const province = pick(world, world.provinces);
  const faction = pick(world, world.factions);
  const actor = pick(world, world.actors);
  world.chronicle.unshift(fillTemplate(pick(world, EXTENDED_TEMPLATES.chronicle), {
    actor: actor.name,
    target: province.name,
    province: province.name,
    event: pick(world, EVENT_TYPES),
    faction: faction.name,
    deity: province.divineAlignment
  }));
  world.chronicle = world.chronicle.slice(0, 160);
}

function tickBestiary(world) {
  if (world.day % 9 !== 0 || !world.bestiary.length) return;
  const b = pick(world, world.bestiary);
  b.lastSeen = `P${1 + Math.floor(rand(world) * world.provinces.length)}`;
  b.completeness = clamp(b.completeness + rand(world) * 6 - 2, 5, 100);
}

function tickObituary(world) {
  if (world.day % 17 !== 0 || rand(world) >= 0.42) return;
  const province = pick(world, world.provinces);
  world.obituary.unshift({
    id: world.day * 100 + world.obituary.length,
    name: pick(world, ['Rook', 'Ilya', 'Dren', 'Sabin', 'Mora']),
    cause: province.danger > 60 ? 'slain by raiders' : 'fever in camp',
    location: province.name,
    day: world.day
  });
  world.obituary = world.obituary.slice(0, 80);
}

function tickWorldAge(world) {
  const civilizationScore = avg(world.provinces, 'prosperity') + avg(world.provinces, 'stability') - avg(world.provinces, 'danger');
  const warFrequency = world.wars.reduce((s, w) => s + w.battles.length, 0) / Math.max(1, world.wars.length);
  const meanArcane = avg(world.provinces, 'arcaneSaturation');
  const meanFaith = avg(world.provinces, 'faithStrength');
  const apexActivityIndex = world.actors.filter((a) => a.type === 'monster' && a.notoriety > 70).length;
  const score = civilizationScore - warFrequency * 0.8 + meanFaith * 0.2 - meanArcane * 0.15 - apexActivityIndex * 2;

  world.age = score > 120 ? 'Golden' : score > 95 ? 'Young' : score > 70 ? 'Decline' : 'Apocalyptic';
}

function rand(world) {
  world.randState = (world.randState * 1664525 + 1013904223) >>> 0;
  return world.randState / 4294967296;
}

function pick(world, arr) {
  return arr[Math.floor(rand(world) * arr.length)];
}

function fillTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? key);
}

const avg = (arr, key) => arr.reduce((s, v) => s + (v[key] ?? 0), 0) / Math.max(arr.length, 1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
