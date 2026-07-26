/**
 * 实体渲染工厂 —— 按 rendererId 在 registry 中的命中情况分两路渲染：
 *
 *  - sprite：Phaser.GameObjects.Sprite + Atlas 帧动画，每帧仅同步位置/帧/翻转/tint，零重绘开销；
 *    参数化颜色（bodyColor 等）经 setTint 染色，对齐行业做法（每对象一套美术 + tint）。
 *  - 兜底：rendererId 未注册或 atlas 缺图，内联 Graphics 绘制
 *    按 drawParams.color/w/h 染色的矩形 + 粗黑描边 + 白色问号，便于识别待接入条目。
 *
 * 形容词 color 写入 e.state.colorOverride：
 *  - sprite 路径 → setTint(colorOverride)（整体单色染色）
 *  - 兜底路径 → colorOverride 优先覆盖 drawParams.color 作为矩形填充色
 */

import Phaser from 'phaser';
import type { GameEntity } from '@/game/Entity';
import { getRendererEntry } from './registry';
import { hexToNum } from './VectorDraw';
import { registerAllRenderers } from './renderers';
import type { SpriteRendererDef } from './SpriteSheet';
import { ensureSpriteAnims, frameForState, animKeyForState } from './SpriteSheet';

let _renderersRegistered = false;
function ensureRegistered(): void {
  if (_renderersRegistered) return;
  registerAllRenderers();
  _renderersRegistered = true;
}

/**
 * 为实体创建对应的 GameObject（Sprite 或 Graphics）。
 * 渲染路由按 rendererId 在 registry 中的命中情况分两路：
 *  - sprite：已注册专用 sprite atlas 且纹理已加载；
 *  - 兜底：rendererId 未注册或 atlas 缺图，内联绘制
 *    按 drawParams.color/w/h 染色的矩形 + 描边 + 问号，便于识别待接入条目。
 */
export function createEntityGraphics(
  scene: Phaser.Scene,
  e: GameEntity,
): Phaser.GameObjects.GameObject {
  ensureRegistered();
  const entry = getRendererEntry(e.rendererId);

  if (entry?.kind === 'sprite' && scene.textures.exists(entry.def.atlasKey)) {
    ensureSpriteAnims(scene, entry.def);
    const frame = frameForState(entry.def, e.state.locomotion);
    const sprite = scene.add.sprite(e.bodyPositionX, e.bodyPositionY, entry.def.atlasKey, frame);
    sprite.setScale(e.state.scale);
    sprite.setDepth(e.layer + e.bodyPositionY * 0.001);
    applyTint(sprite, e);
    e.gameObject = sprite;
    return sprite;
  }

  // 未注册或 atlas 缺图：兜底绘制
  const g = scene.add.graphics();
  e.gameObject = g;
  _drawFallback(g, e);
  return g;
}

/** 每帧同步实体的 GameObject（位置/帧/动画/重绘/tint）。 */
export function syncGraphics(e: GameEntity): void {
  const entry = getRendererEntry(e.rendererId);

  // 按 gameObject 实际类型分派：Sprite 走 sprite 同步，Graphics 走兜底重绘。
  if (e.gameObject as Phaser.GameObjects.Sprite | undefined instanceof Phaser.GameObjects.Sprite) {
    if (entry?.kind === 'sprite') _syncSprite(e, entry.def);
    return;
  }

  const g = e.gameObject as Phaser.GameObjects.Graphics | undefined;
  if (!g) return;
  g.clear();
  _drawFallback(g, e);
  g.setDepth(e.layer + e.bodyPositionY * 0.001);
}

function _syncSprite(e: GameEntity, def: SpriteRendererDef): void {
  const sprite = e.gameObject as Phaser.GameObjects.Sprite | undefined;
  if (!sprite) return;
  sprite.setPosition(e.bodyPositionX, e.bodyPositionY);
  sprite.setRotation(e.bodyAngle);
  sprite.setScale(e.state.scale);
  sprite.setFlipX(e.state.facing < 0);
  sprite.setDepth(e.layer + e.bodyPositionY * 0.001);
  applyTint(sprite, e);

  const animKey = animKeyForState(def, e.state.locomotion);
  if (animKey) {
    if (sprite.anims.currentAnim?.key !== animKey) sprite.play(animKey, true);
  } else {
    sprite.setFrame(frameForState(def, e.state.locomotion));
  }
}

/**
 * 兜底绘制：rendererId 未注册或 atlas 缺图时使用。
 * 按 drawParams.w/h/color（缺省灰 0x8b94a8）绘制居中矩形 + 粗黑描边 + 白色问号，
 * 视觉对齐历史占位 atlas（灰底 + 问号 + 描边），但按物体自身颜色/尺寸区分，识别度更高。
 */
function _drawFallback(g: Phaser.GameObjects.Graphics, e: GameEntity): void {
  g.setPosition(e.bodyPositionX, e.bodyPositionY);
  g.setRotation(e.bodyAngle);
  g.setScale(e.state.scale, e.state.scale);

  const p = e.drawParams as { w?: number; h?: number; color?: string };
  const w = (p.w as number) ?? 40;
  const h = (p.h as number) ?? 40;
  // colorOverride（形容词 color）优先，否则取 drawParams.color
  const fillColor = hexToNum(e.state.colorOverride ?? p.color ?? '#8b94a8');

  g.fillStyle(fillColor, 1);
  g.fillRect(-w / 2, -h / 2, w, h);
  g.lineStyle(3, 0x1b2233, 1);
  g.strokeRect(-w / 2, -h / 2, w, h);

  // 居中白色问号：用线段近似 "？" 主笔画（曲线 + 一点）
  g.lineStyle(2, 0xffffff, 1);
  const r = Math.min(w, h) * 0.18;
  // 上部弧（近似为半圆开口向下的弧）
  g.beginPath();
  g.arc(0, -r * 0.6, r, Math.PI * 0.15, Math.PI * 0.85);
  g.strokePath();
  // 竖短线连接到下部点
  g.beginPath();
  g.moveTo(0, r * 0.4);
  g.lineTo(0, r * 1.4);
  g.strokePath();
  // 下部点
  g.fillStyle(0xffffff, 1);
  g.fillRect(-1, r * 1.6, 2, 2);
}

/**
 * sprite 染色：colorOverride（形容词 color）优先，否则取 drawParams.bodyColor；
 * 无颜色参数时 setTint(0xffffff) 恢复原色。
 */
function applyTint(sprite: Phaser.GameObjects.Sprite, e: GameEntity): void {
  const color = e.state.colorOverride ?? (e.drawParams.bodyColor as string | undefined);
  if (color) {
    sprite.setTint(hexToNum(color));
  } else {
    sprite.setTint(0xffffff);
  }
}

/** 选中实体的高亮环（虚线圆，用多段弧近似 setLineDash）。 */
export function drawHighlight(
  scene: Phaser.Scene,
  e: GameEntity,
  g?: Phaser.GameObjects.Graphics,
): Phaser.GameObjects.Graphics {
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
