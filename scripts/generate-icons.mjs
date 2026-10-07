import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync, crc32 } from 'node:zlib';

function createPng(width, height, drawPixel) {
  // RGBA buffer with scanline filter byte (0)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width(4), height(4), bitDepth(1), colorType(1)=6(RGBA), comp(1), filter(1), interlace(1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Leaf drawing function
function leafDrawer(x, y, w, h) {
  // Normalize coordinates to -1..1
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;

  // Background: Deep Forest Green #315e4d (R:49, G:94, B:77)
  const bgR = 49, bgG = 94, bgB = 77;

  // Icon inner rounded rect boundary for maskable safety (within 0.85 circle/box)
  // Distance from center
  // Draw an elegant leaf shape
  // Rotate by -35 degrees
  const angle = -0.65;
  const rx = nx * Math.cos(angle) - ny * Math.sin(angle);
  const ry = nx * Math.sin(angle) + ny * Math.cos(angle);

  // Leaf parametric formula:
  // Base at rx = 0, ry = 0.55; Tip at rx = 0, ry = -0.55
  // Leaf width varies with height: roughly ellipse or teardrop
  let isLeaf = false;
  let isStem = false;

  if (ry >= -0.55 && ry <= 0.55) {
    // Width at this height
    const t = (ry + 0.55) / 1.1; // 0 at tip, 1 at base
    const maxW = 0.38 * Math.sin(t * Math.PI) * (1.1 - 0.2 * t);
    if (Math.abs(rx) <= maxW) {
      isLeaf = true;
      // Leaf vein (central line)
      if (Math.abs(rx) < 0.018 && ry >= -0.45 && ry <= 0.45) {
        isStem = true;
      }
    }
  }

  // Stem below leaf
  if (ry > 0.55 && ry <= 0.68) {
    if (Math.abs(rx - (ry - 0.55) * 0.4) < 0.022) {
      isStem = true;
    }
  }

  if (isStem) {
    return [49, 94, 77, 255]; // Stem uses bg color cutting through
  } else if (isLeaf) {
    // Soft ivory/white leaf #edf2e7 (R:237, G:242, B:231)
    return [237, 242, 231, 255];
  } else {
    // Background
    return [bgR, bgG, bgB, 255];
  }
}

async function main() {
  await mkdir('public', { recursive: true });

  const p192 = createPng(192, 192, leafDrawer);
  await writeFile('public/icon-192.png', p192);

  const p512 = createPng(512, 512, leafDrawer);
  await writeFile('public/icon-512.png', p512);

  const pApple = createPng(180, 180, leafDrawer);
  await writeFile('public/apple-touch-icon.png', pApple);

  // SVG favicon / icon
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="112" fill="#315e4d"/>
  <path d="M380 132 C380 132 230 140 170 240 C125 315 155 375 220 380 C290 385 365 310 380 132 Z" fill="#edf2e7"/>
  <path d="M190 350 Q 260 270 365 150" stroke="#315e4d" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M220 380 Q 210 420 185 435" stroke="#edf2e7" stroke-width="16" stroke-linecap="round" fill="none"/>
</svg>`;
  await writeFile('public/favicon.svg', svgContent);

  console.log('Icons generated successfully in public/');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
