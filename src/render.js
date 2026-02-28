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
  const { height, moisture, riverMask, temp, slope } = world.maps;
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const octx = off.getContext('2d');

  octx.fillStyle = '#08111a';
  octx.fillRect(0, 0, off.width, off.height);

  const previewResolution = Math.min(176, size);
  const step = Math.max(1, Math.floor(size / previewResolution));
  const gridW = Math.floor(size / step);
  const gridH = Math.floor(size / step);

  const tileW = Math.max(2, Math.floor(Math.min(off.width * 0.88 / gridW, off.height * 0.9 / gridH) * 2));
  const tileH = Math.max(2, Math.floor(tileW * 0.5));
  const elevScale = Math.max(2, tileH * 1.6);
  const originX = off.width * 0.5;
  const originY = off.height * 0.1;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x = gx * step;
      const y = gy * step;
      const i = y * size + x;
      const h = height[i];
      const m = moisture[i];
      const t = temp[i];
      const s = slope ? slope[i] : 0;

      const sx = (gx - gy) * (tileW * 0.5) + originX;
      const sy = (gx + gy) * (tileH * 0.5) + originY - h * elevScale;

      const shade = computeIsoShade(height, size, x, y, step);
      const col = texturedTerrainColor(h, m, t, riverMask[i], i, size, s, shade);

      drawIsoTile(octx, sx, sy, tileW, tileH, col);

      if (h >= 0.28 && riverMask[i]) {
        octx.strokeStyle = 'rgba(74,166,230,0.75)';
        octx.lineWidth = Math.max(1, tileW * 0.08);
        octx.beginPath();
        octx.moveTo(sx, sy - tileH * 0.2);
        octx.lineTo(sx + tileW * 0.22, sy + tileH * 0.15);
        octx.stroke();
      }
    }
  }

  octx.strokeStyle = 'rgba(255,255,255,0.08)';
  octx.strokeRect(12, 12, off.width - 24, off.height - 24);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

function texturedTerrainColor(h, m, t, river, idx, size, slope = 0, shade = 0.5) {
  const x = idx % size;
  const y = Math.floor(idx / size);
  const grain = ((Math.sin(x * 0.27) + Math.cos(y * 0.21) + Math.sin((x + y) * 0.11)) * 0.5 + 0.5) * 18;
  const light = 0.78 + shade * 0.35 - slope * 0.18;

  let r;
  let g;
  let b;

  if (h < 0.28) {
    r = 10 + grain * 0.12;
    g = 34 + grain * 0.18;
    b = 78 + grain * 0.28;
  } else if (h > 0.85) {
    r = 214 + grain * 0.08;
    g = 214 + grain * 0.08;
    b = 224 + grain * 0.08;
  } else if (h > 0.72) {
    r = 128 + grain * 0.12;
    g = 122 + grain * 0.12;
    b = 128 + grain * 0.14;
  } else if (river) {
    r = 54 + grain * 0.1;
    g = 118 + grain * 0.12;
    b = 150 + grain * 0.1;
  } else if (m < 0.24 && t > 0.45) {
    r = 163 + grain * 0.22;
    g = 133 + grain * 0.15;
    b = 88 + grain * 0.08;
  } else if (m > 0.72) {
    r = 30 + grain * 0.1;
    g = 96 + grain * 0.16;
    b = 70 + grain * 0.08;
  } else if (m > 0.56) {
    r = 58 + grain * 0.13;
    g = 112 + grain * 0.18;
    b = 68 + grain * 0.1;
  } else {
    r = 78 + grain * 0.12;
    g = 124 + grain * 0.14;
    b = 84 + grain * 0.11;
  }

  return [
    Math.max(0, Math.min(255, r * light)),
    Math.max(0, Math.min(255, g * light)),
    Math.max(0, Math.min(255, b * light))
  ];
}

function drawIsoTile(ctx, x, y, w, h, color) {
  const [r, g, b] = color;
  const top = `rgb(${r | 0},${g | 0},${b | 0})`;
  const left = `rgb(${(r * 0.82) | 0},${(g * 0.82) | 0},${(b * 0.82) | 0})`;
  const right = `rgb(${(r * 0.9) | 0},${(g * 0.9) | 0},${(b * 0.9) | 0})`;

  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.5);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x, y + h * 0.5);
  ctx.lineTo(x - w * 0.5, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.lineTo(x, y + h * 0.5);
  ctx.lineTo(x, y + h * 0.72);
  ctx.lineTo(x - w * 0.5, y + h * 0.22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x, y + h * 0.5);
  ctx.lineTo(x, y + h * 0.72);
  ctx.lineTo(x + w * 0.5, y + h * 0.22);
  ctx.closePath();
  ctx.fill();
}

function computeIsoShade(height, size, x, y, step) {
  const x1 = Math.min(size - 1, x + step);
  const y1 = Math.min(size - 1, y + step);
  const h = height[y * size + x];
  const hx = height[y * size + x1] - h;
  const hy = height[y1 * size + x] - h;
  return Math.max(0, Math.min(1, 0.5 + hx * 2.4 - hy * 1.9));
}
