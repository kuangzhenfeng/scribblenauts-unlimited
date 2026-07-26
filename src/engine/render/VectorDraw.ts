/**
 * 渲染工具函数集 —— 颜色/手绘纸片质感工具，供 sprite 路径与兜底绘制共用。
 *
 * vector paper-doll 路由已废弃删除，本文件降级为纯工具函数库，
 * 不再导出 VectorRenderer/DrawContext/DrawFn 等渲染器接口。
 */

import type Phaser from 'phaser';

/** 轴对齐包围盒（本地坐标，未应用 transform） */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ── 颜色工具 ────────────────────────────────────────────────────────────────

/** 颜色工具：hex 字符串 (#RRGGBB) → number（Phaser Graphics/Sprite.setTint 用 number 色） */
export function hexToNum(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length === 6) return parseInt(c, 16);
  if (c.length === 3) {
    return parseInt(c[0] + c[0] + c[1] + c[1] + c[2] + c[2], 16);
  }
  return 0x8b94a8;
}

/** 颜色明暗调整：amount>0 变亮，<0 变暗，返回 number 色 */
export function shade(hex: string, amount: number): number {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hexToNum(hex);
  const r = clamp(parseInt(c.slice(0, 2), 16) + Math.round(255 * amount));
  const g = clamp(parseInt(c.slice(2, 4), 16) + Math.round(255 * amount));
  const b = clamp(parseInt(c.slice(4, 6), 16) + Math.round(255 * amount));
  return (r << 16) | (g << 8) | b;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

// ── 手绘纸片质感工具（供 Environment 程序化背景与兜底绘制使用） ────────────

/**
 * 从给定起点画二次贝塞尔到终点（离散化折线，lineTo 连接）。
 * 调用方需先 beginPath + moveTo(startX, startY)，再调本函数追加曲线。
 */
export function bezierQuadraticFrom(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  segments = 12,
): void {
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x = mt * mt * startX + 2 * mt * t * controlX + t * t * endX;
    const y = mt * mt * startY + 2 * mt * t * controlY + t * t * endY;
    g.lineTo(x, y);
  }
}

/** 字符串 → 稳定 32 位哈希（供实体 id → 种子） */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 确定性 seeded RNG（mulberry32）：返回 () => [0,1)，同种子同序列 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 手绘抖动折线：把 pts 各点按种子微扰后 lineTo 连接（不闭合）。
 * 调用方需先 beginPath + moveTo(pts[0])，本函数从第 2 点开始追加。
 * 抖动量由种子决定 → 每帧稳定，不闪烁。
 */
export function wobblePolyline(
  g: Phaser.GameObjects.Graphics,
  pts: readonly (readonly [number, number])[],
  jitter = 0.6,
  seed = 1,
): void {
  const rnd = mulberry32(seed);
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i];
    g.lineTo(px + (rnd() - 0.5) * 2 * jitter, py + (rnd() - 0.5) * 2 * jitter);
  }
}

/** 手绘抖动多边形：beginPath + moveTo 首点 + wobblePolyline + closePath，供 fillPath/strokePath */
export function wobblePolygon(
  g: Phaser.GameObjects.Graphics,
  pts: readonly (readonly [number, number])[],
  jitter = 0.6,
  seed = 1,
): void {
  const rnd = mulberry32(seed);
  const [sx, sy] = pts[0];
  g.beginPath();
  g.moveTo(sx, sy);
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i];
    g.lineTo(px + (rnd() - 0.5) * 2 * jitter, py + (rnd() - 0.5) * 2 * jitter);
  }
  g.closePath();
}

/** 纸片落地软影：实体脚下扁椭圆暗影，给纸片落地重量 */
export function paperShadow(g: Phaser.GameObjects.Graphics, halfW: number, y: number, alpha = 0.18): void {
  g.fillStyle(0x000000, alpha);
  g.fillEllipse(0, y, halfW * 2, halfW * 0.7);
}

/** 纸张折角高光：左上斜亮带，替代生硬的顶部高光带 */
export function paperHighlight(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.22,
): void {
  g.fillStyle(0xffffff, alpha);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w * 0.4, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fillPath();
}
