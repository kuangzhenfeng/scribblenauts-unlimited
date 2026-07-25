/**
 * 矢量渲染器接口 —— 用 Phaser Graphics 程序绘制一个物体类别的函数契约。
 *
 * 与旧项目差异：DrawContext 的 ctx 改为 Phaser.GameObjects.Graphics（命令式绘制缓冲），
 * 每帧 clear + 重绘；渲染器在本地坐标 (0,0) 为中心绘制。
 * 渲染器不持有状态，纯函数式绘制；所有状态经 DrawContext 传入。
 */

import type Phaser from 'phaser';

/** 轴对齐包围盒（本地坐标，未应用 transform） */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 实体的绘制变换 */
export interface DrawTransform {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** 渲染状态（与 Entity.state 部分对应，渲染层只读所需子集） */
export interface DrawState {
  animTime: number;
  locomotion: 'idle' | 'walk' | 'fly' | 'swim' | 'attack' | 'jump';
  facing: number;
  colorOverride?: string;
  stateLayer: Set<string>;
}

/** 绘制上下文 */
export interface DrawContext {
  /** Phaser Graphics 对象（已应用 transform，在本地坐标 (0,0) 为中心绘制） */
  g: Phaser.GameObjects.Graphics;
  transform: DrawTransform;
  state: DrawState;
  camera: { zoom: number };
  /** 实体稳定种子（由 entity id 哈希），供手绘抖动每帧稳定不闪烁 */
  seed: number;
}

export type DrawFn = (dc: DrawContext, params: Record<string, unknown>) => void;

export interface VectorRenderer {
  /** 绘制：g 已应用 transform，渲染器在本地坐标 (0,0) 为中心绘制 */
  draw: DrawFn;
  /** 本地坐标包围盒，供点击拾取与排序 */
  bounds: (params: Record<string, unknown>) => AABB;
}

/** 颜色工具：hex 字符串 (#RRGGBB) → number（Phaser Graphics 用 number 色） */
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

/**
 * 二次贝塞尔曲线辅助：在当前 Graphics 路径上追加一段二次贝塞尔。
 *
 * Phaser 4 Graphics 无 quadraticCurveTo（它属于 Curves.Path），用多段折线离散化近似：
 * 取 P0=当前路径点，按 (1-t)²P0 + 2(1-t)t·C + t²·P1 计算点并 lineTo 连接。
 * 注：调用前需已 beginPath + moveTo 到起点。
 */
export function bezierQuadratic(
  g: Phaser.GameObjects.Graphics,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  segments = 12,
): void {
  // 起点取当前路径末点（Graphics 不暴露，调用方须先 moveTo）
  // 这里无法读取当前点，故要求 endX/endY 作为绝对终点，用 P0 未知 → 改为接受起点
  // 实际：调用方 moveTo 后，我们用相对参数不可行。改为离散从 (0,0) 起点（本地坐标）。
  // —— 见下方 bezierQuadraticFrom 实现，渲染器统一改用它。
  void g; void controlX; void controlY; void endX; void endY; void segments;
}

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

// ---- 涂鸦手绘纸片质感工具 ----
// 设计：抖动量是种子函数（非 animTime）→ 每帧稳定不闪烁；纸片软影/折角高光
// 下沉到渲染器原语，纸纹颗粒上提到 Camera 级 Noise 层（见 fx/Filters）。

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
