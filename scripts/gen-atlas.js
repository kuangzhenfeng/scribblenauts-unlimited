#!/usr/bin/env node
/**
 * gen-atlas.js — 根据 SPRITE_SPECS 为 sprite strip 生成 Phaser JSON Hash atlas。
 *
 * 用法：node scripts/gen-atlas.js <atlasKey>
 *
 * 前提：`public/assets/sprites/<atlasKey>_strip.png` 已放置好。
 * 输出：`public/assets/sprites/<atlasKey>.json`（Phaser atlas JSON Hash 格式）
 * 原始图 → strip 由 `scripts/prepare-sprite.js` 完成，strip → <atlasKey>.png
 * 由 `scripts/process-sprite.js` 完成。
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITE_SPECS } from './sprite-specs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../public/assets/sprites');

// ── 生成逻辑 ────────────────────────────────────────────────────────────────

const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/gen-atlas.js <atlasKey>');
  console.error('Available keys:', Object.keys(SPRITE_SPECS).join(', '));
  process.exit(1);
}

const spec = SPRITE_SPECS[key];
if (!spec) {
  console.error(`Unknown atlasKey "${key}". Add it to scripts/sprite-specs.js.`);
  process.exit(1);
}

const totalW = spec.w * spec.frames.length;
const frameEntries = {};
for (let i = 0; i < spec.frames.length; i++) {
  const name = spec.frames[i];
  frameEntries[name] = {
    frame: { x: i * spec.w, y: 0, w: spec.w, h: spec.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: spec.w, h: spec.h },
    sourceSize: { w: spec.w, h: spec.h },
  };
}

const atlas = {
  frames: frameEntries,
  meta: {
    app: 'gen-atlas.js',
    version: '1.0',
    image: `${key}.png`,
    format: 'RGBA8888',
    size: { w: totalW, h: spec.h },
    scale: '1',
  },
};

const outPath = resolve(OUTPUT_DIR, `${key}.json`);
writeFileSync(outPath, JSON.stringify(atlas, null, 2), 'utf8');
console.log(`✓ ${key}.json written (${spec.frames.length} frames, strip ${totalW}×${spec.h}px)`);
console.log(`  Atlas image: ${key}.png (run process-sprite.js before this step)`);
