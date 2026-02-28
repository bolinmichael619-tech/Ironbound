import { generateWorld } from './worldgen.js';
import { tickDay } from './sim.js';
import { renderMap } from './render.js';
import { MODES, OVERLAYS } from './data.js';

const el = {
  map: document.getElementById('map'),
  centerList: document.getElementById('centerList'),
  modeTabs: document.getElementById('modeTabs'),
  seedInput: document.getElementById('seedInput'),
  regenBtn: document.getElementById('regenBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stepBtn: document.getElementById('stepBtn'),
  step30Btn: document.getElementById('step30Btn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
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
  credHigh: document.getElementById('credHigh')
};

let world = generateWorld(Number(el.seedInput.value));

for (const mode of MODES) {
  const button = document.createElement('button');
  button.textContent = mode;
  button.className = mode === world.mode ? 'active' : '';
  button.onclick = () => {
    world.mode = mode;
    updateModeUi();
    refresh();
  };
  el.modeTabs.appendChild(button);
}

for (const name of OVERLAYS) {
  const id = `ov_${name}`;
  el.overlays.insertAdjacentHTML('beforeend', `<label><input type="radio" name="ov" id="${id}" ${name === 'terrain' ? 'checked' : ''}/> ${name}</label>`);
  document.getElementById(id).addEventListener('change', () => {
    world.overlay = name;
    refresh();
  });
}

el.regenBtn.onclick = () => {
  world = generateWorld(Number(el.seedInput.value));
  el.pauseBtn.textContent = world.paused ? 'Play' : 'Pause';
  updateModeUi();
  refresh();
};

el.pauseBtn.onclick = () => {
  world.paused = !world.paused;
  el.pauseBtn.textContent = world.paused ? 'Play' : 'Pause';
  refreshLeft();
};

el.stepBtn.onclick = () => {
  tickDay(world);
  refresh();
};

el.step30Btn.onclick = () => {
  for (let i = 0; i < 30; i++) tickDay(world);
  refresh();
};

el.exportBtn.onclick = async () => {
  const snapshot = JSON.stringify(serializeWorld(world));
  await navigator.clipboard.writeText(snapshot);
  world.chronicle.unshift(`Day ${world.day}: Snapshot copied to clipboard.`);
  world.chronicle = world.chronicle.slice(0, 200);
  refresh();
};

el.importBtn.onclick = () => {
  const raw = prompt('Paste snapshot JSON');
  if (!raw) return;
  try {
    world = deserializeWorld(JSON.parse(raw));
    el.pauseBtn.textContent = world.paused ? 'Play' : 'Pause';
    updateModeUi();
    refresh();
  } catch {
    world.chronicle.unshift(`Day ${world.day}: Snapshot import failed.`);
    refresh();
  }
};

el.speedInput.oninput = () => {
  world.speed = Number(el.speedInput.value);
  el.speedLabel.textContent = `${world.speed} d/s`;
};

el.credHigh.oninput = refresh;

document.addEventListener('keydown', (evt) => {
  if (evt.key !== 'Escape') return;
  if (world.mode !== 'Map') {
    world.mode = 'Map';
    updateModeUi();
    refresh();
  }
});

el.map.addEventListener('click', (evt) => {
  const rect = el.map.getBoundingClientRect();
  const x = Math.floor(((evt.clientX - rect.left) / rect.width) * world.size);
  const y = Math.floor(((evt.clientY - rect.top) / rect.height) * world.size);
  world.selectedProvince = nearestProvince(x, y);
  const settlement = settlementForProvince(world.selectedProvince);
  if (settlement) world.selectedSettlement = settlement.id;
  world.pulseProvince = world.selectedProvince;
  world.pulseUntil = performance.now() + 2200;
  refreshRight();
});

el.tracked.addEventListener('click', (evt) => {
  const action = evt.target.dataset.action;
  const key = evt.target.dataset.key;
  if (!action || !key) return;
  if (action === 'jump') jumpToTracked(key);
  if (action === 'untrack') {
    world.tracked.delete(key);
    refresh();
  }
});

for (const list of [el.contracts, el.proclamations, el.centerList, el.province]) {
  list.addEventListener('click', onActionClick);
}

setInterval(() => {
  if (world.paused) return;
  for (let i = 0; i < world.speed; i++) tickDay(world);
  refresh();
}, 1000);

function onActionClick(evt) {
  const action = evt.target.dataset.action;
  const type = evt.target.dataset.type;
  const id = Number(evt.target.dataset.id);
  if (!action) return;

  if (action === 'openSettlement') return setMode('Settlement');
  if (action === 'openShopkeeper') return setMode('Shopkeeper');
  if (action === 'openShop') return setMode('Shop');
  if (action === 'buy') {
    if (!Number.isNaN(id)) buyShopItem(id);
    return refresh();
  }

  if (action === 'acceptContract' || action === 'abandonContract') {
    const c = world.contracts.find((x) => x.id === id);
    if (!c) return;
    c.status = action === 'acceptContract' ? 'accepted' : 'open';
    world.chronicle.unshift(`Day ${world.day}: ${action === 'acceptContract' ? 'Accepted' : 'Abandoned'} ${c.title}.`);
    world.chronicle = world.chronicle.slice(0, 200);
    return refresh();
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

  refresh();
}

function setMode(mode) {
  world.mode = mode;
  updateModeUi();
  refresh();
}

function refresh() {
  renderMap(world, el.map);
  refreshLeft();
  refreshRight();
  refreshCenter();
}

function refreshCenter() {
  const isMap = world.mode === 'Map';
  el.map.classList.toggle('hidden', !isMap);
  el.centerList.classList.toggle('hidden', isMap);

  if (isMap) return;

  if (world.mode === 'Rumors') {
    const source = el.credHigh.checked ? world.rumors.filter((r) => r.credibility >= 70) : world.rumors;
    el.centerList.innerHTML = source.slice(0, 80).map((r) =>
      `<li><strong>${r.title}</strong> [${r.credibility}%/${r.source}] — ${r.text} <span class="badge ${r.expiresDay - world.day < 4 ? 'expiring' : ''}">d${r.expiresDay}</span> ${actionButtons('rumors', r.id)}</li>`).join('');
    return;
  }

  if (world.mode === 'Contracts') {
    el.centerList.innerHTML = world.contracts.slice(0, 100).map(contractRow).join('');
    return;
  }

  if (world.mode === 'Proclamations') {
    el.centerList.innerHTML = world.proclamations.slice(0, 80).map((p) => `<li><strong>${p.title}</strong> ${p.text} ${actionButtons('proclamations', p.id)}</li>`).join('');
    return;
  }

  if (world.mode === 'Chronicle') {
    el.centerList.innerHTML = world.chronicle.slice(0, 200).map((line) => `<li>${line}</li>`).join('');
    return;
  }

  if (world.mode === 'Inventory') {
    el.centerList.innerHTML = world.inventory.map((item) => `<li><strong>${item.name}</strong> ×${item.qty} (${item.slot})</li>`).join('');
    return;
  }

  if (world.mode === 'Camp') {
    el.centerList.innerHTML = world.campRoles.map((role) => `<li><strong>${role.role}:</strong> ${role.assignee} — ${role.effect}</li>`).join('');
    return;
  }

  if (world.mode === 'Bestiary') {
    el.centerList.innerHTML = world.bestiary.slice(0, 120).map((b) => `<li><strong>${b.name}</strong> — last seen ${b.lastSeen} (${b.completeness.toFixed(0)}% intel)</li>`).join('');
    return;
  }

  if (world.mode === 'Obituary') {
    el.centerList.innerHTML = world.obituary.length
      ? world.obituary.map((o) => `<li><strong>${o.name}</strong> — ${o.cause} at ${o.location} (Day ${o.day})</li>`).join('')
      : '<li>No fallen yet.</li>';
    return;
  }

  if (world.mode === 'Settlement') {
    const settlement = settlementForProvince(world.selectedProvince);
    el.centerList.innerHTML = settlement
      ? `<li><strong>${settlement.name}</strong> (${settlement.type}) — prosperity ${settlement.prosperity}.
          <button data-action="openShopkeeper">Talk Shopkeeper</button>
          <button data-action="openShop">Open Shop</button></li>`
      : '<li>No settlement at this province center.</li>';
    return;
  }

  if (world.mode === 'Shopkeeper') {
    const settlement = settlementForProvince(world.selectedProvince);
    const name = settlement?.name ?? 'Roadside Camp';
    el.centerList.innerHTML = `<li><strong>${name} Quartermaster</strong> — "Routes are unstable; keep your blades dry and your salt covered."
      <button data-action="openShop">Browse Goods</button></li>`;
    return;
  }

  if (world.mode === 'Shop') {
    const gold = companyGold()?.qty ?? 0;
    el.centerList.innerHTML = `<li><strong>Company Treasury:</strong> ${gold} crowns</li>` +
      world.shopStock.map((item) => `<li><strong>${item.name}</strong> (${item.slot}) — ${item.price} crowns, stock ${item.qty}
        <button data-action="buy" data-id="${item.id}">Buy</button></li>`).join('');
    return;
  }

  if (world.mode === 'Wars') {
    el.centerList.innerHTML = world.wars.map((w) =>
      `<li><strong>War ${w.id}</strong> F${w.factions[0]} vs F${w.factions[1]} | battles: ${w.battles.length} | goals: ${w.goals.join(', ')}</li>`).join('');
    return;
  }

  if (world.mode === 'Actors') {
    el.centerList.innerHTML = world.actors.slice(0, 160).map((a) =>
      `<li><strong>${a.name}</strong> (${a.type}, t${a.tier}) — power ${a.power}, rep ${a.reputation}, ${a.alive ? 'alive' : 'dead'}</li>`).join('');
  }
}

function refreshLeft() {
  const avg = (key) => (world.provinces.reduce((s, p) => s + p[key], 0) / world.provinces.length).toFixed(1);
  const accepted = world.contracts.filter((c) => c.status === 'accepted').length;
  const tradeReliability = world.tradeGraph.edges.length
    ? (world.tradeGraph.edges.reduce((s, e) => s + e.reliability, 0) / world.tradeGraph.edges.length * 100).toFixed(1)
    : '0.0';

  el.stats.innerHTML = [
    ['Day', world.day],
    ['Age', world.age],
    ['Mode', world.mode],
    ['Paused', world.paused ? 'Yes' : 'No'],
    ['Gen Time', `${world.generation.totalMs.toFixed(1)}ms`],
    ['Provinces', world.provinces.length],
    ['Factions', world.factions.length],
    ['Actors', world.actors.length],
    ['Wars', world.wars.length],
    ['Contracts(accepted)', accepted],
    ['Trade Reliability', `${tradeReliability}%`],
    ['Stability', avg('stability')],
    ['Danger', avg('danger')],
    ['Prosperity', avg('prosperity')]
  ].map(([k, v]) => `<div>${k}</div><strong>${v}</strong>`).join('');

  el.tracked.innerHTML = Array.from(world.tracked).map((key) => {
    const [type, idText] = key.split(':');
    const id = Number(idText);
    const item = world[type]?.find((x) => x.id === id);
    if (!item) return '';
    return `<li>${item.title}
      <button data-action="jump" data-key="${key}">Jump</button>
      <button data-action="untrack" data-key="${key}">Untrack</button>
    </li>`;
  }).join('');
}

function refreshRight() {
  const p = world.provinces[world.selectedProvince];
  if (!p) return;

  el.leftTitle.textContent = `${world.mode} Screen`;
  el.rightTitle.textContent = world.mode === 'Map' ? 'Province Detail' : `${world.mode} Detail`;

  const settlement = settlementForProvince(p.id);
  el.province.innerHTML = `<dl>
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

  el.feed.innerHTML = [
    ...world.rumors.slice(0, 2).map((r) => `<li>Now: ${r.text}</li>`),
    ...world.contracts.filter((c) => c.status === 'accepted').slice(0, 2).map((c) => `<li>Important: ${c.title}</li>`),
    ...Array.from(world.tracked).slice(0, 3).map((t) => `<li>Tracked: ${t}</li>`)
  ].join('');

  el.chronicle.innerHTML = world.chronicle.slice(0, 10).map((c) => `<li>${c}</li>`).join('');
  el.contracts.innerHTML = world.contracts.slice(0, 10).map(contractRow).join('');
  el.proclamations.innerHTML = world.proclamations.slice(0, 10).map((entry) => `<li>${entry.title} ${actionButtons('proclamations', entry.id)}</li>`).join('');
}

function settlementForProvince(provinceId) {
  return world.settlements.find((s) => s.provinceId === provinceId) ?? null;
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

function serializeWorld(source) {
  return { ...source, tracked: Array.from(source.tracked) };
}

function deserializeWorld(snapshot) {
  return { ...snapshot, tracked: new Set(snapshot.tracked ?? []) };
}

function updateModeUi() {
  for (const btn of el.modeTabs.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.textContent === world.mode);
  }
  const mapMode = world.mode === 'Map';
  el.mapFilters.classList.toggle('hidden', !mapMode);
  el.rumorFilters.classList.toggle('hidden', world.mode !== 'Rumors');
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
  refresh();
}

function actionButtons(type, id) {
  const key = `${type}:${id}`;
  const tracked = world.tracked.has(key);
  return `<button data-action="${tracked ? 'untrack' : 'track'}" data-type="${type}" data-id="${id}">${tracked ? 'Untrack' : 'Track'}</button>
  <button data-action="jump" data-type="${type}" data-id="${id}">Jump</button>
  <button data-action="chronicle" data-type="${type}" data-id="${id}">Chronicle</button>`;
}

function contractRow(c) {
  const expiring = c.expiresDay - world.day < 4;
  const badge = c.status === 'accepted'
    ? '<span class="badge accepted">accepted</span>'
    : c.status === 'completed'
      ? '<span class="badge accepted">completed</span>'
      : c.status === 'failed'
        ? '<span class="badge expiring">failed</span>'
        : c.status === 'expired'
          ? '<span class="badge expiring">expired</span>'
          : `<span class="badge ${expiring ? 'expiring' : ''}">d${c.expiresDay}</span>`;

  const action = c.status === 'accepted'
    ? `<button data-action="abandonContract" data-id="${c.id}">Abandon</button>`
    : c.status === 'open'
      ? `<button data-action="acceptContract" data-id="${c.id}">Accept</button>`
      : '';

  const risk = c.riskRating ?? 1;
  return `<li><strong>${c.title}</strong> @ P${c.provinceId + 1} risk ${risk} ${badge}
    ${action} ${actionButtons('contracts', c.id)}</li>`;
}

updateModeUi();
refresh();
