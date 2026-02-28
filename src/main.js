import { generateWorld, WORLDGEN_DEFAULTS } from './worldgen.js';
import { tickDay } from './sim.js';
import { renderMap, renderWorldPreview } from './render.js';
import { MODES, OVERLAYS } from './data.js';

const SAVE_PREFIX = 'ironbound_save_slot_';
let world = null;

const ui = {
  titleScreen: document.getElementById('titleScreen'),
  worldgenScreen: document.getElementById('worldgenScreen'),
  campaignScreen: document.getElementById('campaignScreen'),

  newGameBtn: document.getElementById('newGameBtn'),
  loadGameBtn: document.getElementById('loadGameBtn'),
  skirmishBtn: document.getElementById('skirmishBtn'),
  saveList: document.getElementById('saveList'),

  campaignName: document.getElementById('campaignName'),
  seedInput: document.getElementById('seedInput'),
  sizeInput: document.getElementById('sizeInput'),
  plateInput: document.getElementById('plateInput'),
  seaLevelInput: document.getElementById('seaLevelInput'),
  ruggednessInput: document.getElementById('ruggednessInput'),
  hydrologyInput: document.getElementById('hydrologyInput'),
  moistureBiasInput: document.getElementById('moistureBiasInput'),
  tempBiasInput: document.getElementById('tempBiasInput'),
  forestInput: document.getElementById('forestInput'),
  swampInput: document.getElementById('swampInput'),
  desertInput: document.getElementById('desertInput'),
  provinceInput: document.getElementById('provinceInput'),
  factionInput: document.getElementById('factionInput'),
  actorInput: document.getElementById('actorInput'),
  generateBtn: document.getElementById('generateBtn'),
  acceptBtn: document.getElementById('acceptBtn'),
  backToTitleBtn: document.getElementById('backToTitleBtn'),
  genStats: document.getElementById('genStats'),
  worldPreview: document.getElementById('worldPreview'),

  modeTabs: document.getElementById('modeTabs'),
  toTitleBtn: document.getElementById('toTitleBtn'),
  saveBtn: document.getElementById('saveBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stepBtn: document.getElementById('stepBtn'),
  step30Btn: document.getElementById('step30Btn'),
  speedInput: document.getElementById('speedInput'),
  speedLabel: document.getElementById('speedLabel'),
  leftTitle: document.getElementById('leftTitle'),
  rightTitle: document.getElementById('rightTitle'),
  stats: document.getElementById('stats'),
  overlays: document.getElementById('overlays'),
  mapFilters: document.getElementById('mapFilters'),
  rumorFilters: document.getElementById('rumorFilters'),
  tracked: document.getElementById('tracked'),
  province: document.getElementById('province'),
  feed: document.getElementById('feed'),
  chronicle: document.getElementById('chronicle'),
  contracts: document.getElementById('contracts'),
  proclamations: document.getElementById('proclamations'),
  credHigh: document.getElementById('credHigh'),
  map: document.getElementById('map'),
  centerList: document.getElementById('centerList')
};

const campaignLoop = setInterval(() => {
  if (!world || isScreen('titleScreen') || isScreen('worldgenScreen')) return;
  if (world.paused) return;
  for (let i = 0; i < world.speed; i++) tickDay(world);
  refreshCampaign();
}, 1000);

void campaignLoop;

initTitle();

function initTitle() {
  showScreen('titleScreen');
  renderSaveList();
  ui.newGameBtn.onclick = () => {
    applyDefaultsToWorldgenForm();
    buildPreviewWorld(false);
    showScreen('worldgenScreen');
  };
  ui.loadGameBtn.onclick = () => renderSaveList(true);
  ui.skirmishBtn.onclick = () => {
    applyDefaultsToWorldgenForm();
    ui.campaignName.value = 'Skirmish';
    ui.actorInput.value = '120';
    ui.provinceInput.value = '90';
    buildPreviewWorld(true);
    showScreen('worldgenScreen');
  };

  ui.backToTitleBtn.onclick = () => {
    showScreen('titleScreen');
    renderSaveList();
  };

  ui.generateBtn.onclick = () => buildPreviewWorld(false);
  ui.acceptBtn.onclick = () => {
    if (!world) buildPreviewWorld(false);
    enterCampaign();
  };

  for (const id of [
    'seedInput', 'sizeInput', 'plateInput', 'seaLevelInput', 'ruggednessInput', 'hydrologyInput',
    'moistureBiasInput', 'tempBiasInput', 'forestInput', 'swampInput', 'desertInput',
    'provinceInput', 'factionInput', 'actorInput', 'campaignName'
  ]) {
    ui[id].addEventListener('change', () => buildPreviewWorld(false));
  }
}

function applyDefaultsToWorldgenForm() {
  ui.seedInput.value = String(1337 + Math.floor(Math.random() * 900000));
  ui.sizeInput.value = '384';
  ui.plateInput.value = String(WORLDGEN_DEFAULTS.plateCount);
  ui.seaLevelInput.value = String(Math.round(WORLDGEN_DEFAULTS.seaLevel * 100));
  ui.ruggednessInput.value = String(Math.round(WORLDGEN_DEFAULTS.ruggedness * 100));
  ui.hydrologyInput.value = String(Math.round(WORLDGEN_DEFAULTS.hydrologyStrength * 100));
  ui.moistureBiasInput.value = String(Math.round(WORLDGEN_DEFAULTS.moistureBias * 100));
  ui.tempBiasInput.value = String(Math.round(WORLDGEN_DEFAULTS.tempBias * 100));
  ui.forestInput.value = String(Math.round(WORLDGEN_DEFAULTS.forestDensity * 100));
  ui.swampInput.value = String(Math.round(WORLDGEN_DEFAULTS.swampDensity * 100));
  ui.desertInput.value = String(Math.round(WORLDGEN_DEFAULTS.desertHarshness * 100));
  ui.provinceInput.value = String(WORLDGEN_DEFAULTS.provinceTarget);
  ui.factionInput.value = String(WORLDGEN_DEFAULTS.factionCount);
  ui.actorInput.value = String(WORLDGEN_DEFAULTS.actorTarget);
}

function readWorldgenSettings(skirmish) {
  return {
    campaignName: ui.campaignName.value.trim() || 'Age of Ironbound',
    skirmish,
    plateCount: Number(ui.plateInput.value),
    seaLevel: Number(ui.seaLevelInput.value) / 100,
    ruggedness: Number(ui.ruggednessInput.value) / 100,
    hydrologyStrength: Number(ui.hydrologyInput.value) / 100,
    moistureBias: Number(ui.moistureBiasInput.value) / 100,
    tempBias: Number(ui.tempBiasInput.value) / 100,
    forestDensity: Number(ui.forestInput.value) / 100,
    swampDensity: Number(ui.swampInput.value) / 100,
    desertHarshness: Number(ui.desertInput.value) / 100,
    provinceTarget: Number(ui.provinceInput.value),
    factionCount: Number(ui.factionInput.value),
    actorTarget: Number(ui.actorInput.value)
  };
}

function buildPreviewWorld(skirmish) {
  const seed = Number(ui.seedInput.value || 1337);
  const size = Number(ui.sizeInput.value || 384);
  const settings = readWorldgenSettings(skirmish);
  world = generateWorld(seed, size, settings);
  renderWorldPreview(world, ui.worldPreview);
  ui.genStats.innerHTML = [
    ['Campaign', settings.campaignName],
    ['Seed', seed],
    ['Size', size],
    ['Generation Time', `${world.generation.totalMs.toFixed(1)} ms`],
    ['Tectonics', `${world.generation.timings.tectonics.toFixed(1)} ms`],
    ['Hydrology', `${world.generation.timings.hydrology.toFixed(1)} ms`],
    ['Climate', `${world.generation.timings.climate.toFixed(1)} ms`],
    ['Provinces', `${world.generation.timings.provinces.toFixed(1)} ms`],
    ['Political', `${world.generation.timings.political.toFixed(1)} ms`],
    ['Province Count', world.provinces.length],
    ['Faction Count', world.factions.length],
    ['Actor Count', world.actors.length],
    ['Trade Edges', world.tradeGraph.edges.length],
    ['War Count', world.wars.length]
  ].map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('');
}

function enterCampaign() {
  if (!world) return;
  showScreen('campaignScreen');
  buildModeTabs();
  buildOverlayControls();
  bindCampaignControls();
  refreshCampaign();
}

function buildModeTabs() {
  ui.modeTabs.innerHTML = '';
  for (const mode of MODES) {
    const button = document.createElement('button');
    button.textContent = mode;
    button.className = mode === world.mode ? 'active' : '';
    button.onclick = () => {
      world.mode = mode;
      updateModeUi();
      refreshCampaign();
    };
    ui.modeTabs.appendChild(button);
  }
}

function buildOverlayControls() {
  ui.overlays.innerHTML = '';
  for (const name of OVERLAYS) {
    const id = `ov_${name}`;
    ui.overlays.insertAdjacentHTML('beforeend', `<label><input type="radio" name="ov" id="${id}" ${name === world.overlay ? 'checked' : ''}/> ${name}</label>`);
    document.getElementById(id).addEventListener('change', () => {
      world.overlay = name;
      refreshCampaign();
    });
  }
}

function bindCampaignControls() {
  ui.toTitleBtn.onclick = () => {
    showScreen('titleScreen');
    renderSaveList();
  };
  ui.saveBtn.onclick = saveCurrentGame;
  ui.pauseBtn.onclick = () => {
    world.paused = !world.paused;
    ui.pauseBtn.textContent = world.paused ? 'Play' : 'Pause';
    refreshLeft();
  };
  ui.stepBtn.onclick = () => { tickDay(world); refreshCampaign(); };
  ui.step30Btn.onclick = () => { for (let i = 0; i < 30; i++) tickDay(world); refreshCampaign(); };
  ui.speedInput.oninput = () => {
    world.speed = Number(ui.speedInput.value);
    ui.speedLabel.textContent = `${world.speed} d/s`;
  };
  ui.credHigh.oninput = refreshCampaign;

  document.onkeydown = (evt) => {
    if (evt.key === 'Escape' && world.mode !== 'Map' && isScreen('campaignScreen')) {
      world.mode = 'Map';
      updateModeUi();
      refreshCampaign();
    }
  };

  ui.map.onclick = (evt) => {
    const rect = ui.map.getBoundingClientRect();
    const x = Math.floor(((evt.clientX - rect.left) / rect.width) * world.size);
    const y = Math.floor(((evt.clientY - rect.top) / rect.height) * world.size);
    world.selectedProvince = nearestProvince(x, y);
    world.pulseProvince = world.selectedProvince;
    world.pulseUntil = performance.now() + 2200;
    refreshRight();
  };

  ui.tracked.onclick = (evt) => {
    const action = evt.target.dataset.action;
    const key = evt.target.dataset.key;
    if (!action || !key) return;
    if (action === 'jump') return jumpToTracked(key);
    if (action === 'untrack') {
      world.tracked.delete(key);
      refreshCampaign();
    }
  };

  for (const list of [ui.contracts, ui.proclamations, ui.centerList, ui.province]) {
    list.onclick = onActionClick;
  }
}

function onActionClick(evt) {
  const action = evt.target.dataset.action;
  const type = evt.target.dataset.type;
  const id = Number(evt.target.dataset.id);
  if (!action) return;

  if (action === 'openSettlement') return switchMode('Settlement');
  if (action === 'openShopkeeper') return switchMode('Shopkeeper');
  if (action === 'openShop') return switchMode('Shop');
  if (action === 'buy') {
    if (!Number.isNaN(id)) buyShopItem(id);
    return refreshCampaign();
  }

  if (action === 'acceptContract' || action === 'abandonContract') {
    const c = world.contracts.find((x) => x.id === id);
    if (!c) return;
    c.status = action === 'acceptContract' ? 'accepted' : 'open';
    world.chronicle.unshift(`Day ${world.day}: ${action === 'acceptContract' ? 'Accepted' : 'Abandoned'} ${c.title}.`);
    world.chronicle = world.chronicle.slice(0, 200);
    return refreshCampaign();
  }

  if (Number.isNaN(id)) return;
  const item = world[type]?.find((e) => e.id === id);
  if (!item) return;

  if (action === 'track') world.tracked.add(`${type}:${id}`);
  if (action === 'untrack') world.tracked.delete(`${type}:${id}`);
  if (action === 'jump') {
    world.selectedProvince = item.provinceId;
    world.mode = 'Map';
    world.pulseProvince = item.provinceId;
    world.pulseUntil = performance.now() + 2200;
    updateModeUi();
  }
  if (action === 'chronicle') {
    world.chronicle.unshift(`Day ${world.day}: Referenced ${item.title}.`);
    world.chronicle = world.chronicle.slice(0, 200);
  }

  refreshCampaign();
}

function refreshCampaign() {
  if (!world || !isScreen('campaignScreen')) return;
  renderMap(world, ui.map);
  refreshLeft();
  refreshRight();
  refreshCenter();
  updateModeUi();
}

function refreshCenter() {
  const isMap = world.mode === 'Map';
  ui.map.classList.toggle('hidden', !isMap);
  ui.centerList.classList.toggle('hidden', isMap);
  if (isMap) return;

  if (world.mode === 'Rumors') {
    const source = ui.credHigh.checked ? world.rumors.filter((r) => r.credibility >= 70) : world.rumors;
    ui.centerList.innerHTML = source.slice(0, 120).map((r) => `<li><strong>${r.title}</strong> [${r.credibility}%/${r.source}] — ${r.text} <span class="badge ${r.expiresDay - world.day < 4 ? 'expiring' : ''}">d${r.expiresDay}</span> ${actionButtons('rumors', r.id)}</li>`).join('');
  } else if (world.mode === 'Contracts') {
    ui.centerList.innerHTML = world.contracts.slice(0, 140).map(contractRow).join('');
  } else if (world.mode === 'Proclamations') {
    ui.centerList.innerHTML = world.proclamations.slice(0, 120).map((p) => `<li><strong>${p.title}</strong> ${p.text} ${actionButtons('proclamations', p.id)}</li>`).join('');
  } else if (world.mode === 'Chronicle') {
    ui.centerList.innerHTML = world.chronicle.slice(0, 220).map((line) => `<li>${line}</li>`).join('');
  } else if (world.mode === 'Inventory') {
    ui.centerList.innerHTML = world.inventory.map((item) => `<li><strong>${item.name}</strong> ×${item.qty} (${item.slot})</li>`).join('');
  } else if (world.mode === 'Camp') {
    ui.centerList.innerHTML = world.campRoles.map((role) => `<li><strong>${role.role}:</strong> ${role.assignee} — ${role.effect}</li>`).join('');
  } else if (world.mode === 'Bestiary') {
    ui.centerList.innerHTML = world.bestiary.slice(0, 220).map((b) => `<li><strong>${b.name}</strong> — last seen ${b.lastSeen} (${b.completeness.toFixed(0)}% intel)</li>`).join('');
  } else if (world.mode === 'Obituary') {
    ui.centerList.innerHTML = world.obituary.length ? world.obituary.map((o) => `<li><strong>${o.name}</strong> — ${o.cause} at ${o.location} (Day ${o.day})</li>`).join('') : '<li>No fallen yet.</li>';
  } else if (world.mode === 'Settlement') {
    const settlement = settlementForProvince(world.selectedProvince);
    ui.centerList.innerHTML = settlement ? `<li><strong>${settlement.name}</strong> (${settlement.type}) — prosperity ${settlement.prosperity}. <button data-action="openShopkeeper">Talk Shopkeeper</button> <button data-action="openShop">Open Shop</button></li>` : '<li>No settlement at this province center.</li>';
  } else if (world.mode === 'Shopkeeper') {
    const settlement = settlementForProvince(world.selectedProvince);
    const name = settlement?.name ?? 'Roadside Camp';
    ui.centerList.innerHTML = `<li><strong>${name} Quartermaster</strong> — "Routes are unstable; keep your blades dry and your salt covered." <button data-action="openShop">Browse Goods</button></li>`;
  } else if (world.mode === 'Shop') {
    const gold = companyGold()?.qty ?? 0;
    ui.centerList.innerHTML = `<li><strong>Company Treasury:</strong> ${gold} crowns</li>` + world.shopStock.map((item) => `<li><strong>${item.name}</strong> (${item.slot}) — ${item.price} crowns, stock ${item.qty} <button data-action="buy" data-id="${item.id}">Buy</button></li>`).join('');
  } else if (world.mode === 'Wars') {
    ui.centerList.innerHTML = world.wars.map((w) => `<li><strong>War ${w.id}</strong> F${w.factions[0]} vs F${w.factions[1]} | battles: ${w.battles.length} | goals: ${w.goals.join(', ')}</li>`).join('');
  } else if (world.mode === 'Actors') {
    ui.centerList.innerHTML = world.actors.slice(0, 220).map((a) => `<li><strong>${a.name}</strong> (${a.type}, t${a.tier}) — power ${a.power}, rep ${a.reputation}, ${a.alive ? 'alive' : 'dead'}</li>`).join('');
  }
}

function refreshLeft() {
  const avg = (key) => (world.provinces.reduce((s, p) => s + p[key], 0) / world.provinces.length).toFixed(1);
  const accepted = world.contracts.filter((c) => c.status === 'accepted').length;
  const tradeReliability = world.tradeGraph.edges.length ? (world.tradeGraph.edges.reduce((s, e) => s + e.reliability, 0) / world.tradeGraph.edges.length * 100).toFixed(1) : '0.0';

  ui.stats.innerHTML = [
    ['Campaign', world.generation.settings.campaignName],
    ['Day', world.day], ['Age', world.age], ['Mode', world.mode], ['Paused', world.paused ? 'Yes' : 'No'],
    ['Gen Time', `${world.generation.totalMs.toFixed(1)}ms`], ['Provinces', world.provinces.length], ['Factions', world.factions.length], ['Actors', world.actors.length], ['Wars', world.wars.length],
    ['Contracts(accepted)', accepted], ['Trade Reliability', `${tradeReliability}%`], ['Stability', avg('stability')], ['Danger', avg('danger')], ['Prosperity', avg('prosperity')]
  ].map(([k, v]) => `<div>${k}</div><strong>${v}</strong>`).join('');

  ui.tracked.innerHTML = Array.from(world.tracked).map((key) => {
    const [type, idText] = key.split(':');
    const id = Number(idText);
    const item = world[type]?.find((x) => x.id === id);
    if (!item) return '';
    return `<li>${item.title} <button data-action="jump" data-key="${key}">Jump</button> <button data-action="untrack" data-key="${key}">Untrack</button></li>`;
  }).join('');
}

function refreshRight() {
  const p = world.provinces[world.selectedProvince];
  if (!p) return;

  ui.leftTitle.textContent = `${world.mode} Screen`;
  ui.rightTitle.textContent = world.mode === 'Map' ? 'Province Detail' : `${world.mode} Detail`;

  const settlement = settlementForProvince(p.id);
  ui.province.innerHTML = `<dl>
    <dt>Name</dt><dd>${p.name}</dd>
    <dt>Class</dt><dd>${p.classification}</dd>
    <dt>Biome</dt><dd>${p.biomeType}</dd>
    <dt>Owner</dt><dd>${world.factions[p.factionOwnerId]?.name ?? 'None'}</dd>
    <dt>Stability / Danger</dt><dd>${p.stability.toFixed(1)} / ${p.danger.toFixed(1)}</dd>
    <dt>Faith / Arcane</dt><dd>${p.faithStrength} / ${p.arcaneSaturation}</dd>
    <dt>Deity</dt><dd>${p.divineAlignment}</dd>
    <dt>Settlement</dt><dd>${settlement?.name ?? 'None'}</dd>
    <dt>Resource</dt><dd>${p.primaryResource}</dd>
  </dl>
  ${settlement ? '<button data-action="openSettlement">Enter Settlement</button>' : ''}`;

  ui.feed.innerHTML = [
    ...world.rumors.slice(0, 2).map((r) => `<li>Now: ${r.text}</li>`),
    ...world.contracts.filter((c) => c.status === 'accepted').slice(0, 2).map((c) => `<li>Important: ${c.title}</li>`),
    ...Array.from(world.tracked).slice(0, 3).map((t) => `<li>Tracked: ${t}</li>`)
  ].join('');

  ui.chronicle.innerHTML = world.chronicle.slice(0, 12).map((c) => `<li>${c}</li>`).join('');
  ui.contracts.innerHTML = world.contracts.slice(0, 12).map(contractRow).join('');
  ui.proclamations.innerHTML = world.proclamations.slice(0, 12).map((entry) => `<li>${entry.title} ${actionButtons('proclamations', entry.id)}</li>`).join('');
}

function updateModeUi() {
  for (const btn of ui.modeTabs.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.textContent === world.mode);
  }
  const mapMode = world.mode === 'Map';
  ui.mapFilters.classList.toggle('hidden', !mapMode);
  ui.rumorFilters.classList.toggle('hidden', world.mode !== 'Rumors');
}

function switchMode(mode) {
  world.mode = mode;
  updateModeUi();
  refreshCampaign();
}

function contractRow(c) {
  const expiring = c.expiresDay - world.day < 4;
  const badge = c.status === 'accepted' ? '<span class="badge accepted">accepted</span>'
    : c.status === 'completed' ? '<span class="badge accepted">completed</span>'
      : c.status === 'failed' ? '<span class="badge expiring">failed</span>'
        : c.status === 'expired' ? '<span class="badge expiring">expired</span>'
          : `<span class="badge ${expiring ? 'expiring' : ''}">d${c.expiresDay}</span>`;

  const action = c.status === 'accepted' ? `<button data-action="abandonContract" data-id="${c.id}">Abandon</button>`
    : c.status === 'open' ? `<button data-action="acceptContract" data-id="${c.id}">Accept</button>` : '';

  const risk = c.riskRating ?? 1;
  return `<li><strong>${c.title}</strong> @ P${c.provinceId + 1} risk ${risk} ${badge} ${action} ${actionButtons('contracts', c.id)}</li>`;
}

function actionButtons(type, id) {
  const key = `${type}:${id}`;
  const tracked = world.tracked.has(key);
  return `<button data-action="${tracked ? 'untrack' : 'track'}" data-type="${type}" data-id="${id}">${tracked ? 'Untrack' : 'Track'}</button>
    <button data-action="jump" data-type="${type}" data-id="${id}">Jump</button>
    <button data-action="chronicle" data-type="${type}" data-id="${id}">Chronicle</button>`;
}

function saveCurrentGame() {
  if (!world) return;
  const slots = listSaveSlots();
  const next = slots.length ? Math.max(...slots) + 1 : 1;
  const payload = serializeWorld(world);
  localStorage.setItem(`${SAVE_PREFIX}${next}`, JSON.stringify(payload));
  world.chronicle.unshift(`Day ${world.day}: Saved campaign to slot ${next}.`);
  world.chronicle = world.chronicle.slice(0, 200);
  refreshCampaign();
}

function renderSaveList(showLoadHelp = false) {
  const slots = listSaveSlots();
  if (!slots.length) {
    ui.saveList.innerHTML = showLoadHelp ? '<div>No save slots found.</div>' : '';
    return;
  }
  ui.saveList.innerHTML = slots.map((slot) => {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${slot}`);
    const data = raw ? JSON.parse(raw) : null;
    const name = data?.generation?.settings?.campaignName ?? 'Unknown Campaign';
    const day = data?.day ?? '?';
    return `<div>Slot ${slot}: ${name} (Day ${day})
      <button data-load-slot="${slot}">Load</button>
      <button data-delete-slot="${slot}">Delete</button>
    </div>`;
  }).join('');

  ui.saveList.querySelectorAll('[data-load-slot]').forEach((btn) => {
    btn.onclick = () => {
      const raw = localStorage.getItem(`${SAVE_PREFIX}${btn.dataset.loadSlot}`);
      if (!raw) return;
      world = deserializeWorld(JSON.parse(raw));
      showScreen('campaignScreen');
      buildModeTabs();
      buildOverlayControls();
      bindCampaignControls();
      refreshCampaign();
    };
  });

  ui.saveList.querySelectorAll('[data-delete-slot]').forEach((btn) => {
    btn.onclick = () => {
      localStorage.removeItem(`${SAVE_PREFIX}${btn.dataset.deleteSlot}`);
      renderSaveList(true);
    };
  });
}

function listSaveSlots() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(SAVE_PREFIX)) keys.push(Number(k.slice(SAVE_PREFIX.length)));
  }
  return keys.sort((a, b) => a - b);
}

function serializeWorld(source) {
  return { ...source, tracked: Array.from(source.tracked) };
}

function deserializeWorld(snapshot) {
  return { ...snapshot, tracked: new Set(snapshot.tracked ?? []) };
}

function companyGold() {
  return world.inventory.find((item) => item.slot === 'Treasury');
}

function buyShopItem(itemId) {
  const stock = world.shopStock.find((x) => x.id === itemId);
  const gold = companyGold();
  if (!stock || !gold || stock.qty <= 0 || gold.qty < stock.price) return;
  stock.qty -= 1;
  gold.qty -= stock.price;
  const existing = world.inventory.find((x) => x.name === stock.name);
  if (existing) existing.qty += 1;
  else world.inventory.push({ name: stock.name, qty: 1, slot: stock.slot });
  world.chronicle.unshift(`Day ${world.day}: Purchased ${stock.name} for ${stock.price} crowns.`);
  world.chronicle = world.chronicle.slice(0, 200);
}

function settlementForProvince(provinceId) {
  return world.settlements.find((s) => s.provinceId === provinceId) ?? null;
}

function nearestProvince(x, y) {
  let best = 0;
  let dBest = 1e9;
  for (const p of world.provinces) {
    const d = (x - p.centerX) ** 2 + (y - p.centerY) ** 2;
    if (d < dBest) {
      dBest = d;
      best = p.id;
    }
  }
  return best;
}

function jumpToTracked(key) {
  const [type, idText] = key.split(':');
  const id = Number(idText);
  const item = world[type]?.find((x) => x.id === id);
  if (!item) return;
  world.selectedProvince = item.provinceId;
  world.pulseProvince = item.provinceId;
  world.pulseUntil = performance.now() + 2200;
  world.mode = 'Map';
  updateModeUi();
  refreshCampaign();
}

function showScreen(id) {
  ui.titleScreen.classList.remove('active');
  ui.worldgenScreen.classList.remove('active');
  ui.campaignScreen.classList.remove('active');
  ui[id].classList.add('active');
}

function isScreen(id) {
  return ui[id].classList.contains('active');
}
