#!/usr/bin/env node
/** Make welcome watermarks: transparent Objectiv mark, white A-Zing mark. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPngRgba(path) {
  const buf = readFileSync(path);
  if (buf.toString('binary', 0, 8) !== '\x89PNG\r\n\x1a\n') throw new Error('not png');
  let w = 0;
  let h = 0;
  let bit = 8;
  let color = 6;
  const idats = [];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    i += 12 + len;
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bit = data[8];
      color = data[9];
    } else if (type === 'IDAT') idats.push(data);
  }
  if (color !== 6 || bit !== 8) throw new Error(`unsupported png ${color}/${bit}`);
  const compressed = Buffer.concat(idats);
  const raw = inflateSync(compressed);
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[src++];
    const row = Buffer.alloc(stride);
    raw.copy(row, 0, src, src + stride);
    src += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? cur[x - 4] : 0;
      const up = prev[x];
      const upLeft = x >= 4 ? prev[x - 4] : 0;
      let val = row[x];
      if (filter === 1) val = (val + left) & 255;
      else if (filter === 2) val = (val + up) & 255;
      else if (filter === 3) val = (val + ((left + up) >> 1)) & 255;
      else if (filter === 4) val = (val + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`filter ${filter}`);
      cur[x] = val;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, rgba: out };
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writePngRgba(path, w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1);
    raw[o] = 0;
    rgba.copy(raw, o + 1, y * stride, y * stride + stride);
  }
  const compressed = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typ = Buffer.from(type);
    const crcBuf = Buffer.concat([typ, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, typ, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const out = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(path, out);
}

function knockNearBlack(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // near-black / dark charcoal bg
    if (a > 0 && max < 48 && max - min < 18) {
      rgba[i + 3] = 0;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
    }
  }
}

function strokesToFadedWhite(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 8) {
      rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
      rgba[i + 3] = 0;
      continue;
    }
    const lum = (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
    // dark stroke → white; already-light AA → white
    rgba[i] = rgba[i + 1] = rgba[i + 2] = 255;
    // keep coverage alpha (darker original → stronger)
    const strength = Math.max(0, Math.min(1, (220 - lum) / 220));
    rgba[i + 3] = Math.round(a * (0.35 + 0.65 * Math.max(strength, lum > 200 ? 1 : strength)));
  }
}

// Prefer backups if present (pre-ffmpeg originals)
const azingSrc = join(pub, 'azing-logo.png.bak');
const objSrc = join(pub, 'objectiv-azo-logo.png.bak');
const azingPath = join(pub, 'azing-logo.png');
const objPath = join(pub, 'objectiv-azo-logo.png');

const azing = readPngRgba(azingSrc);
strokesToFadedWhite(azing.rgba);
writePngRgba(azingPath, azing.w, azing.h, azing.rgba);

const obj = readPngRgba(objSrc);
knockNearBlack(obj.rgba);
writePngRgba(objPath, obj.w, obj.h, obj.rgba);

console.log('Wrote', azingPath, objPath);
