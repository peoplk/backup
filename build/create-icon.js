const fs = require('fs');
const zlib = require('zlib');

function createValidPNG(width, height, rgbaData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function makeChunk(typeStr, data) {
    const typeBytes = Buffer.from(typeStr, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < crcInput.length; i++) {
      crc ^= crcInput[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc);
    return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
  }
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdr = makeChunk('IHDR', ihdrData);
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0;
    rgbaData.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createICO(png256, png48, png32, png16) {
  const images = [png256, png48, png32, png16];
  const count = images.length;
  const headerSize = 6;
  const entrySize = 16 * count;
  let offset = headerSize + entrySize;
  const entries = [];
  const sizes = [0, 48, 32, 16];
  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(16);
    entry[0] = sizes[i];
    entry[1] = sizes[i];
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += images[i].length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, ...entries, ...images]);
}

const size = 256;
const pixels = Buffer.alloc(size * size * 4);
const cx = size / 2;
const cy = size / 2;

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function setPixel(x, y, r, g, b, a) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  if (a >= 255) { pixels[i]=r; pixels[i+1]=g; pixels[i+2]=b; pixels[i+3]=255; return; }
  if (a <= 0) return;
  const sa = a/255, da = (pixels[i+3]||0)/255, oa = sa + da*(1-sa);
  if (oa > 0.001) {
    pixels[i] = Math.round((r*sa + (pixels[i]||0)*da*(1-sa))/oa);
    pixels[i+1] = Math.round((g*sa + (pixels[i+1]||0)*da*(1-sa))/oa);
    pixels[i+2] = Math.round((b*sa + (pixels[i+2]||0)*da*(1-sa))/oa);
    pixels[i+3] = Math.min(255, Math.round(oa * 255));
  }
}

function fillCircle(ccx, ccy, r, cr, cg, cb, ca) {
  for (let y = Math.floor(ccy-r-1); y <= Math.ceil(ccy+r+1); y++) {
    for (let x = Math.floor(ccx-r-1); x <= Math.ceil(ccx+r+1); x++) {
      const d = Math.sqrt((x-ccx)**2 + (y-ccy)**2);
      if (d <= r) {
        const edgeAlpha = d > r-2 ? (r-d)/2 : 1;
        setPixel(x, y, cr, cg, cb, Math.round(ca * edgeAlpha));
      }
    }
  }
}

function fillRoundedRect(rx, ry, rw, rh, radius, cr, cg, cb, ca) {
  for (let y = Math.floor(ry); y < Math.ceil(ry+rh); y++) {
    for (let x = Math.floor(rx); x < Math.ceil(rx+rw); x++) {
      const dx = Math.abs(x - (rx + rw/2)) / (rw/2);
      const dy = Math.abs(y - (ry + rh/2)) / (rh/2);
      const cr2 = radius / (rw/2);
      let inside = false;
      if (dx <= 1-cr2 || dy <= 1-cr2) {
        const cd = Math.sqrt(Math.max(0,Math.abs(dx)-(1-cr2))**2 + Math.max(0,Math.abs(dy)-(1-cr2))**2);
        if (cd <= cr2) inside = true;
      }
      if (!inside) continue;
      const d = Math.sqrt(dx*dx + dy*dy);
      const ed = d - 1;
      let alpha = ca;
      if (ed > -0.02 && ed < 0.03) alpha = Math.round(ca * (1-(ed+0.02)/0.05));
      else if (ed >= 0.03) continue;
      setPixel(x, y, cr, cg, cb, alpha);
    }
  }
}

// Background: dark rounded square with modern gradient
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const dx = (x - cx) / (size * 0.46);
    const dy = (y - cy) / (size * 0.46);
    const cr2 = 0.18;
    let inside = false;
    if (Math.abs(dx) <= 1-cr2 || Math.abs(dy) <= 1-cr2) {
      const cd = Math.sqrt(Math.max(0,Math.abs(dx)-(1-cr2))**2 + Math.max(0,Math.abs(dy)-(1-cr2))**2);
      if (cd <= cr2) inside = true;
    }
    if (!inside) continue;
    const ed = Math.sqrt(dx*dx + dy*dy) - 1;
    let alpha = 255;
    if (ed > -0.03 && ed < 0.04) alpha = Math.round((1-(ed+0.03)/0.07)*255);
    else if (ed >= 0.04) continue;
    const t = y / size;
    const s = x / size;
    setPixel(x, y,
      Math.round(lerp(lerp(15, 30, t), lerp(20, 10, t), s)),
      Math.round(lerp(lerp(23, 58, t), lerp(30, 40, t), s)),
      Math.round(lerp(lerp(42, 110, t), lerp(55, 80, t), s)),
      alpha
    );
  }
}

// Glassmorphism inner glow
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const dx = (x - cx) / (size * 0.42);
    const dy = (y - cy) / (size * 0.42);
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 1) continue;
    const glow = Math.max(0, 1 - d) * 0.08;
    setPixel(x, y, 120, 160, 255, Math.round(glow * 255));
  }
}

// Top highlight (glass effect)
for (let y = 0; y < size * 0.35; y++) {
  for (let x = 0; x < size; x++) {
    const dx = (x - cx) / (size * 0.40);
    const dy = (y - cy) / (size * 0.40);
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 1) continue;
    const t = y / (size * 0.35);
    const glow = (1 - t) * (1 - d) * 0.12;
    setPixel(x, y, 200, 220, 255, Math.round(glow * 255));
  }
}

// Central focus ring (outer glow)
const ringR = size * 0.30;
const ringW = size * 0.035;
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const d = Math.sqrt((x-cx)**2 + (y-cy)**2);
    const ringDist = Math.abs(d - ringR);
    if (ringDist < ringW + 8) {
      const t = (y - cy + ringR) / (ringR * 2);
      const r = Math.round(lerp(99, 59, t));
      const g = Math.round(lerp(102, 130, t));
      const b = Math.round(lerp(241, 246, t));
      if (ringDist < ringW) {
        const edgeAlpha = ringDist > ringW - 3 ? (ringW - ringDist) / 3 : 1;
        setPixel(x, y, r, g, b, Math.round(255 * edgeAlpha));
      } else {
        const glowAlpha = (1 - (ringDist - ringW) / 8) * 0.3;
        setPixel(x, y, r, g, b, Math.round(255 * glowAlpha));
      }
    }
  }
}

// Progress arc (75% complete) - bright gradient
const arcStart = -Math.PI * 0.5;
const arcEnd = arcStart + Math.PI * 1.5;
const arcR = ringR;
const arcW = size * 0.035;
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const d = Math.sqrt((x-cx)**2 + (y-cy)**2);
    if (Math.abs(d - arcR) > arcW) continue;
    let angle = Math.atan2(y - cy, x - cx);
    if (angle < arcStart) angle += Math.PI * 2;
    if (angle > arcEnd || angle < arcStart) continue;
    const progress = (angle - arcStart) / (arcEnd - arcStart);
    const r = Math.round(lerp(56, 168, progress));
    const g = Math.round(lerp(189, 85, progress));
    const b = Math.round(lerp(248, 247, progress));
    const ringDist = Math.abs(d - arcR);
    const edgeAlpha = ringDist > arcW - 3 ? (arcW - ringDist) / 3 : 1;
    setPixel(x, y, r, g, b, Math.round(255 * edgeAlpha));
  }
}

// Arc end cap (bright dot)
const endAngle = arcEnd;
const endX = cx + Math.cos(endAngle) * arcR;
const endY = cy + Math.sin(endAngle) * arcR;
fillCircle(endX, endY, arcW * 0.9, 168, 85, 247, 255);
fillCircle(endX, endY, arcW * 0.5, 220, 180, 255, 255);

// Center "F" letter (modern, bold)
const fSize = size * 0.22;
const fTop = cy - fSize * 0.55;
const fBot = cy + fSize * 0.55;
const fLeft = cx - fSize * 0.3;
const fRight = cx + fSize * 0.3;
const fStroke = fSize * 0.16;
const fMid = cy - fSize * 0.05;

// Vertical bar of F
for (let y = Math.floor(fTop); y <= Math.ceil(fBot); y++) {
  for (let x = Math.floor(fLeft); x <= Math.ceil(fLeft + fStroke); x++) {
    const t = (y - fTop) / (fBot - fTop);
    const r = Math.round(lerp(240, 200, t));
    const g = Math.round(lerp(245, 210, t));
    const b = Math.round(lerp(255, 230, t));
    setPixel(x, y, r, g, b, 255);
  }
}

// Top horizontal bar of F
for (let y = Math.floor(fTop); y <= Math.ceil(fTop + fStroke); y++) {
  for (let x = Math.floor(fLeft); x <= Math.ceil(fRight); x++) {
    const t = (x - fLeft) / (fRight - fLeft);
    const r = Math.round(lerp(240, 220, t));
    const g = Math.round(lerp(245, 225, t));
    const b = Math.round(lerp(255, 240, t));
    setPixel(x, y, r, g, b, 255);
  }
}

// Middle horizontal bar of F
for (let y = Math.floor(fMid); y <= Math.ceil(fMid + fStroke * 0.85); y++) {
  for (let x = Math.floor(fLeft); x <= Math.ceil(fLeft + (fRight - fLeft) * 0.75); x++) {
    const t = (x - fLeft) / ((fRight - fLeft) * 0.75);
    const r = Math.round(lerp(240, 220, t));
    const g = Math.round(lerp(245, 225, t));
    const b = Math.round(lerp(255, 240, t));
    setPixel(x, y, r, g, b, 255);
  }
}

// Sparkle accents
const sparkles = [
  [cx + size*0.22, cy - size*0.22, 5, 1.0],
  [cx - size*0.25, cy - size*0.18, 3.5, 0.7],
  [cx + size*0.15, cy + size*0.25, 3, 0.6],
  [cx - size*0.18, cy + size*0.22, 2.5, 0.5],
];
sparkles.forEach(([sx, sy, sr, opacity]) => {
  for (let y = Math.floor(sy-sr*2); y <= Math.ceil(sy+sr*2); y++) {
    for (let x = Math.floor(sx-sr*2); x <= Math.ceil(sx+sr*2); x++) {
      const d = Math.sqrt((x-sx)**2 + (y-sy)**2);
      if (d <= sr) {
        const a = (1 - d/sr) * opacity;
        setPixel(x, y, 255, 255, 255, Math.round(a * 255));
      }
    }
  }
});

// Small decorative dots
const dots = [
  [cx - size*0.32, cy + size*0.05, 3, 99, 102, 241, 0.4],
  [cx + size*0.33, cy + size*0.1, 2.5, 168, 85, 247, 0.3],
  [cx + size*0.05, cy - size*0.35, 2, 56, 189, 248, 0.35],
];
dots.forEach(([dx, dy, dr, r, g, b, a]) => {
  fillCircle(dx, dy, dr, r, g, b, Math.round(a * 255));
});

// Generate multi-size ICO
function resizePixels(srcPixels, srcSize, dstSize) {
  const dst = Buffer.alloc(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.floor(x * srcSize / dstSize);
      const sy = Math.floor(y * srcSize / dstSize);
      const si = (sy * srcSize + sx) * 4;
      const di = (y * dstSize + x) * 4;
      dst[di] = srcPixels[si];
      dst[di+1] = srcPixels[si+1];
      dst[di+2] = srcPixels[si+2];
      dst[di+3] = srcPixels[si+3];
    }
  }
  return dst;
}

const png256 = createValidPNG(size, size, pixels);
const pixels48 = resizePixels(pixels, size, 48);
const png48 = createValidPNG(48, 48, pixels48);
const pixels32 = resizePixels(pixels, size, 32);
const png32 = createValidPNG(32, 32, pixels32);
const pixels16 = resizePixels(pixels, size, 16);
const png16 = createValidPNG(16, 16, pixels16);

const ico = createICO(png256, png48, png32, png16);

fs.writeFileSync('public/icon.png', png256);
fs.writeFileSync('public/icon.ico', ico);

// Also create SVG version
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0F172A"/>
      <stop offset="100%" style="stop-color:#1E3A5F"/>
    </linearGradient>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#3B82F6"/>
    </linearGradient>
    <linearGradient id="arc" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#38BDF8"/>
      <stop offset="100%" style="stop-color:#A855F7"/>
    </linearGradient>
    <linearGradient id="letter" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#F0F5FF"/>
      <stop offset="100%" style="stop-color:#C8D6E6"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="248" height="248" rx="46" fill="url(#bg)"/>
  <circle cx="128" cy="128" r="77" fill="none" stroke="url(#ring)" stroke-width="9" opacity="0.25"/>
  <circle cx="128" cy="128" r="77" fill="none" stroke="url(#arc)" stroke-width="9" stroke-dasharray="363 485" stroke-dashoffset="121" stroke-linecap="round"/>
  <circle cx="89" cy="56" r="5" fill="white" opacity="0.8"/>
  <circle cx="184" cy="72" r="3.5" fill="white" opacity="0.7"/>
  <circle cx="166" cy="192" r="3" fill="white" opacity="0.6"/>
  <circle cx="48" cy="136" r="3" fill="#6366F1" opacity="0.4"/>
  <circle cx="212" cy="154" r="2.5" fill="#A855F7" opacity="0.3"/>
  <text x="128" y="148" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="88" font-weight="800" fill="url(#letter)">F</text>
</svg>`;

fs.writeFileSync('public/icon.svg', svg);

console.log('✅ Modern FocusFlow icons generated successfully!');
console.log(`   📄 public/icon.png (${(png256.length/1024).toFixed(1)} KB)`);
console.log(`   📄 public/icon.ico (${(ico.length/1024).toFixed(1)} KB)`);
console.log(`   📄 public/icon.svg`);
