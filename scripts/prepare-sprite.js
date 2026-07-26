#!/usr/bin/env node
/**
 * prepare-sprite.js — 从原始生成图制作精确尺寸的透明 strip。
 *
 * 生成图的白色/灰色抗锯齿背景与角色外部轮廓是同一张 RGB 图，必须在
 * 缩小前根据“从边界连通”关系去除。这样不会误删角色内部白色细节，也
 * 不会把 Starite 的黄色发光边缘当成白色背景。
 * 依赖 ImageMagick 7 的 `magick` 命令。
 * 用法：node scripts/prepare-sprite.js <atlasKey> <sourcePath>
 * 输出：public/assets/sprites/<atlasKey>_strip.png（RGBA8888）
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SPRITE_SPECS } from './sprite-specs.js';
import { removeNeutralBackground } from './sprite-processing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../public/assets/sprites');
const atlasKey = process.argv[2];
const sourceArgument = process.argv[3];

if (!atlasKey || !sourceArgument) {
  console.error('Usage: node scripts/prepare-sprite.js <atlasKey> <sourcePath>');
  process.exit(1);
}

const spec = SPRITE_SPECS[atlasKey];
if (!spec) {
  console.error(`Unknown atlasKey "${atlasKey}". Add it to scripts/sprite-specs.js.`);
  process.exit(1);
}

const sourcePath = isAbsolute(sourceArgument) ? sourceArgument : resolve(process.cwd(), sourceArgument);
if (!existsSync(sourcePath)) {
  console.error(`Missing source image: ${sourcePath}`);
  process.exit(1);
}

const targetWidth = spec.w * spec.frames.length;
const targetHeight = spec.h;
const tempDirectory = mkdtempSync(join(tmpdir(), 'sprite-prepare-'));
const cleanedPath = join(tempDirectory, `${atlasKey}-cleaned.png`);
const resizedPath = join(tempDirectory, `${atlasKey}-resized.png`);
const stripPath = resolve(OUTPUT_DIR, `${atlasKey}_strip.png`);

function readSource() {
  const dimensions = execFileSync('magick', [
    sourcePath,
    '-format', '%w %h',
    'info:',
  ]).toString().trim().split(/\s+/).map(Number);
  const [width, height] = dimensions;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Unable to read source dimensions: ${sourcePath}`);
  }

  const rgba = execFileSync('magick', [
    sourcePath,
    '-alpha', 'on',
    '-depth', '8',
    'rgba:-',
  ], { maxBuffer: 1024 * 1024 * 1024 });
  const expectedBytes = width * height * 4;
  if (rgba.length !== expectedBytes) {
    throw new Error(`Unexpected RGBA size for ${sourcePath}: ${rgba.length} != ${expectedBytes}`);
  }
  return { rgba, width, height };
}

function writeCleanedImage(rgba, width, height) {
  execFileSync('magick', [
    '-size', `${width}x${height}`,
    '-depth', '8',
    'rgba:-',
    '-define', 'png:color-type=6',
    cleanedPath,
  ], { input: rgba });
}

function createResizedStrip() {
  execFileSync('magick', [
    cleanedPath,
    '-trim',
    '+repage',
    '-resize', `${targetWidth}x${targetHeight}!`,
    '-background', 'none',
    '-gravity', 'center',
    '-extent', `${targetWidth}x${targetHeight}`,
    '-define', 'png:color-type=6',
    resizedPath,
  ]);
}

function cleanResizedStrip() {
  const rgba = execFileSync('magick', [
    resizedPath,
    '-depth', '8',
    'rgba:-',
  ], { maxBuffer: 1024 * 1024 * 1024 });
  const expectedBytes = targetWidth * targetHeight * 4;
  if (rgba.length !== expectedBytes) {
    throw new Error(`Unexpected resized RGBA size for ${atlasKey}: ${rgba.length} != ${expectedBytes}`);
  }

  // 缩放会重新生成少量低 alpha 的灰白抗锯齿像素，只清理从帧边界连通的
  // 极淡中性像素；Starite 的黄色高光不满足中性色条件，会被保留。
  removeNeutralBackground(rgba, targetWidth, targetHeight, {
    neutralRange: 16,
    maxAlpha: 8,
  });
  execFileSync('magick', [
    '-size', `${targetWidth}x${targetHeight}`,
    '-depth', '8',
    'rgba:-',
    '-define', 'png:color-type=6',
    stripPath,
  ], { input: rgba });
}

try {
  const source = readSource();
  removeNeutralBackground(source.rgba, source.width, source.height);

  writeCleanedImage(source.rgba, source.width, source.height);
  createResizedStrip();
  cleanResizedStrip();
  console.log(`✓ ${atlasKey}_strip.png prepared from ${sourcePath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
