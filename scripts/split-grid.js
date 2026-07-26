#!/usr/bin/env node
/**
 * split-grid.js — 从一张含多个小物件的网格图切割出独立源图。
 *
 * 用法：node scripts/split-grid.js <gridImagePath> <columns> <rows> <cellW> <cellH> <outDir> [prefix]
 *   gridImagePath  网格图路径
 *   columns/rows   网格行列数
 *   cellW/cellH    单格尺寸（px）
 *   outDir         输出目录（通常 tmp/imagegen/）
 *   prefix         可选，输出文件名前缀映射（CSV 或 JSON），用于将格子序号映射到 atlasKey
 *                 未提供时，文件名按格子序号命名 cell-0.png ... cell-N.png
 *
 * 输出：每格一个独立 PNG（RGBA8888），可直接喂给 prepare-sprite.js 三步流水线。
 * 依赖 ImageMagick 7 的 `magick` 命令。
 *
 * 设计目的：GPT 一次生成一张含 N 个小物件的网格图（生图阶段批量），
 * 本脚本切割后每对象仍走独立 prepare→process→gen-atlas，运行时加载逻辑零改动。
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [, , gridPath, colsStr, rowsStr, cellWStr, cellHStr, outDirArg, prefixArg] = process.argv;

if (!gridPath || !colsStr || !rowsStr || !cellWStr || !cellHStr || !outDirArg) {
  console.error('Usage: node scripts/split-grid.js <gridImagePath> <cols> <rows> <cellW> <cellH> <outDir> [prefixJsonPath]');
  console.error('  prefixJsonPath: 可选 JSON 文件，格式 {"0":"apple","1":"banana",...}，把格子序号映射到 atlasKey');
  process.exit(1);
}

const cols = Number(colsStr);
const rows = Number(rowsStr);
const cellW = Number(cellWStr);
const cellH = Number(cellHStr);
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

let prefixMap = {};
if (prefixArg && existsSync(resolve(prefixArg))) {
  prefixMap = JSON.parse(
    // 读取 prefix JSON（用 magick 不行，用 node 内置）
    (await import('node:fs')).readFileSync(resolve(prefixArg), 'utf8'),
  );
}

if (!existsSync(gridPath)) {
  console.error(`Missing grid image: ${gridPath}`);
  process.exit(1);
}

let idx = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = c * cellW;
    const y = r * cellH;
    const key = prefixMap[String(idx)] ?? `cell-${idx}`;
    const outPath = join(outDir, `${key}.png`);
    try {
      execFileSync('magick', [
        gridPath,
        '-crop', `${cellW}x${cellH}+${x}+${y}`,
        '+repage',
        outPath,
      ]);
      console.log(`✓ [${r},${c}] → ${key}.png`);
    } catch (e) {
      console.error(`✗ [${r},${c}] failed: ${e.message}`);
    }
    idx++;
  }
}
console.log(`=== split done: ${idx} cells → ${outDir} ===`);
