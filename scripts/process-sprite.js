#!/usr/bin/env node
/**
 * process-sprite.js — 为最终 strip 做逐帧透明边缘颜色扩展。
 *
 * 去除生成图背景必须先通过 prepare-sprite.js 在原始分辨率完成；本脚本
 * 不再重新猜测背景颜色，也不再对已经透明的图片执行 alpha remove。
 * 依赖 ImageMagick 7 的 `magick` 命令。
 * 用法：node scripts/process-sprite.js <atlasKey>
 * 输入：public/assets/sprites/<atlasKey>_strip.png
 * 输出：public/assets/sprites/<atlasKey>.png（RGBA8888）
 */

import { existsSync, unlinkSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITE_SPECS } from './sprite-specs.js';
import { bleedTransparentEdges } from './sprite-processing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../public/assets/sprites');
const EDGE_BLEED_RADIUS = 2;
const atlasKey = process.argv[2];

if (!atlasKey) {
  console.error('Usage: node scripts/process-sprite.js <atlasKey>');
  process.exit(1);
}

const spec = SPRITE_SPECS[atlasKey];
if (!spec) {
  console.error(`Unknown atlasKey "${atlasKey}". Add it to scripts/sprite-specs.js.`);
  process.exit(1);
}

const stripPath = resolve(OUTPUT_DIR, `${atlasKey}_strip.png`);
const outputPath = resolve(OUTPUT_DIR, `${atlasKey}.png`);
if (!existsSync(stripPath)) {
  console.error(`Missing prepared sprite strip: ${stripPath}`);
  process.exit(1);
}

const width = spec.w * spec.frames.length;
const height = spec.h;
const tempPath = resolve(OUTPUT_DIR, `.${atlasKey}.edge.tmp.png`);

function readRgba() {
  const rgba = execFileSync('magick', [
    stripPath,
    '-depth', '8',
    'rgba:-',
  ], { maxBuffer: 1024 * 1024 * 1024 });
  const expectedBytes = width * height * 4;
  if (rgba.length !== expectedBytes) {
    throw new Error(`Unexpected RGBA size for ${atlasKey}: ${rgba.length} != ${expectedBytes}`);
  }
  return rgba;
}

function writePng(rgba) {
  execFileSync('magick', [
    '-size', `${width}x${height}`,
    '-depth', '8',
    'rgba:-',
    '-define', 'png:color-type=6',
    tempPath,
  ], { input: rgba });
}

try {
  const rgba = readRgba();
  bleedTransparentEdges(rgba, {
    width,
    height,
    frameWidth: spec.w,
    frameHeight: spec.h,
    frameCount: spec.frames.length,
    radius: EDGE_BLEED_RADIUS,
  });
  writePng(rgba);

  if (existsSync(outputPath)) unlinkSync(outputPath);
  renameSync(tempPath, outputPath);
  console.log(`✓ ${atlasKey}.png written with ${EDGE_BLEED_RADIUS}px per-frame edge color bleed`);
} catch (error) {
  if (existsSync(tempPath)) unlinkSync(tempPath);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
