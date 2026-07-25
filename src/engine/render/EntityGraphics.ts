/**
 * 渲染器工厂 —— 按 entity.rendererId 选 VectorRenderer，创建并持有 Graphics。
 *
 * 与旧项目差异：旧 Renderer 手写 sort + drawEntity；新项目用 Phaser depth 排序，
 * 每个实体一个 Graphics，每帧 clear + draw（命令式重绘，对齐旧 Canvas 全重画语义）。
 * 选中高亮用 Graphics 虚线圆环（无 setLineDash，用多段弧近似虚线）。
 */

import Phaser from 'phaser';
import type { GameEntity } from '@/game/Entity';
import { getRenderer } from './registry';
import type { DrawContext } from './VectorDraw';
import { hashStr } from './VectorDraw';
import { registerAllRenderers } from './renderers';

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  registerAllRenderers();
  registered = true;
}

/**
 * 为实体创建 Graphics（VectorRenderer 驱动）。
 * 返回的 Graphics 由 WorldScene 每帧调 syncGraphics 同步位置/朝向/重绘。
 */
export function createEntityGraphics(scene: Phaser.Scene, e: GameEntity): Phaser.GameObjects.Graphics | undefined {
  ensureRegistered();
  const renderer = getRenderer(e.rendererId) ?? getRenderer('box');
  if (!renderer) return undefined;
  const g = scene.add.graphics();
  // 挂到实体的 gameObject
  e.gameObject = g;
  drawEntity(g, e);
  return g;
}

/** 每帧同步：清屏 + 应用 transform + 调渲染器 draw */
export function syncGraphics(e: GameEntity): void {
  const g = e.gameObject as Phaser.GameObjects.Graphics | undefined;
  if (!g) return;
  g.clear();
  drawEntity(g, e);
  g.setDepth(e.layer + e.bodyPositionY * 0.001);
}

function drawEntity(g: Phaser.GameObjects.Graphics, e: GameEntity): void {
  const renderer = getRenderer(e.rendererId) ?? getRenderer('box');
  if (!renderer) return;
  // 位置/朝向/缩放
  g.setPosition(e.bodyPositionX, e.bodyPositionY);
  g.setRotation(e.bodyAngle);
  g.setScale(e.state.scale, e.state.scale);

  const dc: DrawContext = {
    g,
    transform: { x: e.bodyPositionX, y: e.bodyPositionY, rotation: e.bodyAngle, scale: e.state.scale },
    state: {
      animTime: e.state.animTime,
      locomotion: e.state.locomotion,
      facing: e.state.facing,
      colorOverride: e.state.colorOverride,
      stateLayer: e.state.stateLayer,
    },
    camera: { zoom: 1 },
    seed: hashStr(e.id),
  };
  renderer.draw(dc, e.drawParams);
}

/** 选中实体的高亮环（虚线圆，用多段弧近似 setLineDash） */
export function drawHighlight(scene: Phaser.Scene, e: GameEntity, g?: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics {
  const ring = g ?? scene.add.graphics();
  ring.clear();
  const r = 28;
  const segs = 24;
  ring.lineStyle(2, 0xffdc50, 0.9);
  for (let i = 0; i < segs; i += 2) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    ring.beginPath();
    ring.arc(e.bodyPositionX, e.bodyPositionY, r, a0, a1);
    ring.strokePath();
  }
  return ring;
}
