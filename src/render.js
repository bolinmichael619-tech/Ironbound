let offscreen;

export function renderMap(world, canvas) {
  const ctx = canvas.getContext('2d');
  const size = world.size;
  const { height, moisture, riverMask, temp } = world.maps;
  const img = ctx.createImageData(size, size);

  for (let i = 0; i < height.length; i++) {
    const o = i * 4;
    const col = colorFor(world, i, height[i], moisture[i], riverMask[i], temp[i]);
    img.data[o] = col[0];
    img.data[o + 1] = col[1];
    img.data[o + 2] = col[2];
    img.data[o + 3] = 255;
  }

  offscreen ??= document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  offscreen.getContext('2d').putImageData(img, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

  drawTradeRoutes(world, ctx, canvas);
  drawAcceptedContractMarkers(world, ctx, canvas);
  drawPulse(world, ctx, canvas);
}

function colorFor(world, i, h, m, r, t) {
  switch (world.overlay) {
    case 'elevation':
      return [h * 255, h * 255, h * 255];
    case 'rivers':
      return r ? [45, 140, 240] : [18, 28, 45];
    case 'danger': {
      const p = world.provinces[nearestProvince(world, i)];
      return [40 + p.danger * 2.1, 20, 24];
    }
    case 'faith': {
      const p = world.provinces[nearestProvince(world, i)];
      return [40, 30 + p.faithStrength * 2.2, 120];
    }
    case 'arcane': {
      const p = world.provinces[nearestProvince(world, i)];
      return [120, 30, 20 + p.arcaneSaturation * 2.2];
    }
    case 'trade': {
      const p = world.provinces[nearestProvince(world, i)];
      return [30, 60 + p.tradeValue * 1.9, 120];
    }
    case 'warfront': {
      const p = world.provinces[nearestProvince(world, i)];
      return p.contested ? [170, 40, 30] : [35, 40, 60];
    }
    case 'contracts': {
      const p = world.provinces[nearestProvince(world, i)];
      const load = p.availableContracts?.length ?? 0;
      return [40 + load * 50, 55, 120];
    }
    case 'political': {
      const p = world.provinces[nearestProvince(world, i)];
      const hue = (p.factionOwnerId * 47) % 255;
      return [hue, 90 + hue / 3, 180 - hue / 4];
    }
    default:
      if (h < 0.28) return [24, 58, 98];
      if (h > 0.85) return [210, 210, 220];
      if (h > 0.72) return [145, 140, 145];
      if (m < 0.24 && t > 0.45) return [171, 140, 90];
      if (m > 0.72) return [42, 104, 80];
      return [78, 132, 82];
  }
}

function drawAcceptedContractMarkers(world, ctx, canvas) {
  for (const c of world.contracts) {
    if (c.status !== 'accepted') continue;
    const p = world.provinces[c.provinceId];
    if (!p) continue;
    const px = (p.centerX / world.size) * canvas.width;
    const py = (p.centerY / world.size) * canvas.height;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f0c85a';
    ctx.fill();
    ctx.strokeStyle = '#2f2310';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawTradeRoutes(world, ctx, canvas) {
  if (world.overlay !== 'trade') return;
  ctx.lineWidth = 1;
  for (const edge of world.tradeGraph.edges) {
    const a = world.provinces[edge.from];
    const b = world.provinces[edge.to];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo((a.centerX / world.size) * canvas.width, (a.centerY / world.size) * canvas.height);
    ctx.lineTo((b.centerX / world.size) * canvas.width, (b.centerY / world.size) * canvas.height);
    ctx.strokeStyle = `rgba(240,220,160,${edge.reliability * 0.8})`;
    ctx.stroke();
  }
}

function drawPulse(world, ctx, canvas) {
  if (world.pulseProvince == null || performance.now() >= world.pulseUntil) return;
  const p = world.provinces[world.pulseProvince];
  const px = (p.centerX / world.size) * canvas.width;
  const py = (p.centerY / world.size) * canvas.height;
  const t = (world.pulseUntil - performance.now()) / 2200;
  ctx.beginPath();
  ctx.arc(px, py, 10 + (1 - t) * 36, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,220,120,${Math.max(0.2, t)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function nearestProvince(world, index) {
  const x = index % world.size;
  const y = Math.floor(index / world.size);
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


export function renderWorldPreview(world, canvas) {
  const ctx = canvas.getContext('2d');
  const size = world.size;
  const { height, moisture, riverMask, temp } = world.maps;
  const img = ctx.createImageData(size, size);

  for (let i = 0; i < height.length; i++) {
    const o = i * 4;
    const h = height[i];
    const m = moisture[i];
    const t = temp[i];
    const tex = texturedTerrainColor(h, m, t, riverMask[i], i, size);
    img.data[o] = tex[0];
    img.data[o + 1] = tex[1];
    img.data[o + 2] = tex[2];
    img.data[o + 3] = 255;
  }

  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

function texturedTerrainColor(h, m, t, river, idx, size) {
  const x = idx % size;
  const y = Math.floor(idx / size);
  const grain = ((Math.sin(x * 0.27) + Math.cos(y * 0.21) + Math.sin((x + y) * 0.11)) * 0.5 + 0.5) * 18;
  if (h < 0.28) return [14 + grain * 0.2, 42 + grain * 0.25, 86 + grain * 0.3];
  if (h > 0.85) return [210 + grain * 0.1, 210 + grain * 0.1, 220 + grain * 0.1];
  if (h > 0.72) return [145 + grain * 0.2, 136 + grain * 0.2, 140 + grain * 0.2];
  if (river) return [58 + grain * 0.12, 130 + grain * 0.15, 165 + grain * 0.12];
  if (m < 0.24 && t > 0.45) return [166 + grain * 0.22, 136 + grain * 0.16, 92 + grain * 0.1];
  if (m > 0.72) return [32 + grain * 0.1, 98 + grain * 0.2, 72 + grain * 0.1];
  if (m > 0.56) return [58 + grain * 0.15, 112 + grain * 0.2, 66 + grain * 0.12];
  return [82 + grain * 0.13, 128 + grain * 0.16, 84 + grain * 0.13];
}

