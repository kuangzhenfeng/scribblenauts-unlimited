/**
 * 实体渲染工厂 —— 按 rendererId 在 registry 中的命中情况分两路渲染：
 *
 *  - sprite：Phaser.GameObjects.Sprite + Atlas 帧动画，每帧仅同步位置/帧/翻转/tint，零重绘开销；
 *    参数化颜色（bodyColor 等）经 setTint 染色，对齐行业做法（每对象一套美术 + tint）。
 *  - 装备特例：wing/bullet 暂无 atlas，使用本文件内的程序化 Graphics 绘制；
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
const CHARACTER_VISUAL_SCALE = 1.24;
const HUMAN_FRAME_WIDTH = 36;
const HUMAN_FRAME_HEIGHT = 68;

interface HumanClothingLayers {
  shirt: Phaser.GameObjects.Sprite;
  pants: Phaser.GameObjects.Sprite;
}

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
  // 熔岩是关卡固定的环境元素；独立绘制火舌，避免 fire atlas 的透明边缘在 WebGL 采样时形成方形底。
  if (e.typeId === 'lava') {
    const g = scene.add.graphics();
    e.gameObject = g;
    _drawLava(g, e);
    return g;
  }
  if (e.typeId === 'wing' || e.typeId === 'bullet') {
    const g = scene.add.graphics();
    e.gameObject = g;
    _drawEquipment(g, e);
    return g;
  }
  const entry = getRendererEntry(e.rendererId);

  if (entry?.kind === 'sprite' && scene.textures.exists(entry.def.atlasKey)) {
    ensureSpriteAnims(scene, entry.def);
    const frame = frameForState(entry.def, e.state.locomotion);
    const sprite = scene.add.sprite(e.bodyPositionX, e.bodyPositionY, entry.def.atlasKey, frame);
    sprite.setScale(e.state.scale * visualScaleFor(e));
    sprite.setDepth(e.layer + e.bodyPositionY * 0.001);
    applyTint(sprite, e);
    if (e.rendererId === 'human') createHumanClothingLayers(scene, e, entry.def.atlasKey, frame, sprite);
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
  if (e.typeId === 'lava') {
    const g = e.gameObject as Phaser.GameObjects.Graphics | undefined;
    if (!g) return;
    g.clear();
    _drawLava(g, e);
    g.setDepth(e.layer + e.bodyPositionY * 0.001);
    return;
  }
  if (e.typeId === 'wing' || e.typeId === 'bullet') {
    const g = e.gameObject as Phaser.GameObjects.Graphics | undefined;
    if (!g) return;
    g.clear();
    _drawEquipment(g, e);
    return;
  }
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
  sprite.setScale(e.state.scale * visualScaleFor(e));
  sprite.setFlipX(e.state.facing < 0);
  sprite.setDepth(e.layer + e.bodyPositionY * 0.001);
  applyTint(sprite, e);
  syncHumanClothingLayers(e, sprite, def);

  const animKey = animKeyForState(def, e.state.locomotion);
  if (animKey) {
    if (sprite.anims.currentAnim?.key !== animKey) sprite.play(animKey, true);
  } else {
    sprite.setFrame(frameForState(def, e.state.locomotion));
  }
}

/** 角色是玩法焦点，只放大视觉皮，不改变物理刚体与拾取范围。 */
function visualScaleFor(e: GameEntity): number {
  return e.isPlayer || e.typeId === 'human' ? CHARACTER_VISUAL_SCALE : 1;
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

/** 熔岩专用火舌：保持透明外轮廓与暖色内焰，不改变物理尺寸。 */
function _drawLava(g: Phaser.GameObjects.Graphics, e: GameEntity): void {
  const flicker = 1 + Math.sin(Date.now() * 0.006 + e.bodyPositionX * 0.02) * 0.06;
  g.setPosition(e.bodyPositionX, e.bodyPositionY);
  g.setRotation(e.bodyAngle);
  g.setScale(e.state.scale * flicker, e.state.scale);

  g.fillStyle(0xff5b16, 1);
  g.lineStyle(2.5, 0x5e170f, 1);
  g.beginPath();
  g.moveTo(-18, 22);
  g.lineTo(-15, 5);
  g.lineTo(-8, -7);
  g.lineTo(-10, -22);
  g.lineTo(0, -13);
  g.lineTo(6, -34);
  g.lineTo(12, -14);
  g.lineTo(18, -5);
  g.lineTo(16, 22);
  g.closePath();
  g.fillPath();
  g.strokePath();

  g.fillStyle(0xffc52f, 1);
  g.beginPath();
  g.moveTo(-11, 22);
  g.lineTo(-8, 5);
  g.lineTo(-3, -4);
  g.lineTo(1, -18);
  g.lineTo(7, -5);
  g.lineTo(11, 22);
  g.closePath();
  g.fillPath();

  g.fillStyle(0xfff2a1, 1);
  g.beginPath();
  g.moveTo(-5, 22);
  g.lineTo(-3, 9);
  g.lineTo(1, 1);
  g.lineTo(4, 9);
  g.lineTo(6, 22);
  g.closePath();
  g.fillPath();
}

/** 当前尚无 atlas 的装备与即时投射物：保留独立视觉，不改变普通缺图问号兜底。 */
function _drawEquipment(g: Phaser.GameObjects.Graphics, e: GameEntity): void {
  if (e.typeId === 'wing') {
    _drawWing(g, e);
  } else {
    _drawBullet(g, e);
  }
}

/** 翅膀：一对带羽片的背部翅翼，绘制原点对齐其 Matter 刚体锚点。 */
function _drawWing(g: Phaser.GameObjects.Graphics, e: GameEntity): void {
  const p = e.drawParams as { color?: string };
  const fillColor = hexToNum(e.state.colorOverride ?? p.color ?? '#62C4FF');
  const featherColor = 0xe9f8ff;

  g.setPosition(e.bodyPositionX, e.bodyPositionY);
  g.setRotation(e.bodyAngle);
  g.setScale(e.state.scale, e.state.scale);
  g.setDepth(e.layer + e.bodyPositionY * 0.001);
  g.setVisible(!e.hidden);

  for (const direction of [-1, 1]) {
    g.fillStyle(fillColor, 1);
    g.lineStyle(3, 0x1b2233, 1);
    g.beginPath();
    g.moveTo(0, 4);
    g.lineTo(direction * 10, 10);
    g.lineTo(direction * 28, 7);
    g.lineTo(direction * 31, -7);
    g.lineTo(direction * 23, -10);
    g.lineTo(direction * 21, -20);
    g.lineTo(direction * 13, -14);
    g.lineTo(direction * 9, -23);
    g.lineTo(direction * 5, -10);
    g.lineTo(direction * 2, -4);
    g.closePath();
    g.fillPath();
    g.strokePath();

    g.lineStyle(1.5, featherColor, 0.9);
    for (const feather of [
      [5, -2, 23, -8],
      [7, 2, 25, -1],
      [9, 5, 23, 4],
    ] as const) {
      g.beginPath();
      g.moveTo(direction * feather[0], feather[1]);
      g.lineTo(direction * feather[2], feather[3]);
      g.strokePath();
    }
  }

  g.fillStyle(0x1b2233, 1);
  g.fillCircle(0, 4, 3);
}

/** 子弹：金色弹头与尾部束带，朝向由 facing、旋转由物理 bodyAngle 决定。 */
function _drawBullet(g: Phaser.GameObjects.Graphics, e: GameEntity): void {
  const p = e.drawParams as { color?: string };
  const direction = e.state.facing < 0 ? -1 : 1;
  const fillColor = hexToNum(e.state.colorOverride ?? p.color ?? '#F6C453');
  const bandX = direction > 0 ? -5.2 : 2.7;

  g.setPosition(e.bodyPositionX, e.bodyPositionY);
  g.setRotation(e.bodyAngle);
  g.setScale(e.state.scale, e.state.scale);
  g.setDepth(e.layer + e.bodyPositionY * 0.001);
  g.setVisible(!e.hidden);

  g.fillStyle(fillColor, 1);
  g.beginPath();
  g.moveTo(-7 * direction, -3.5);
  g.lineTo(2 * direction, -3.5);
  g.lineTo(7 * direction, 0);
  g.lineTo(2 * direction, 3.5);
  g.lineTo(-7 * direction, 3.5);
  g.closePath();
  g.fillPath();

  g.fillStyle(0xd79127, 1);
  g.fillRect(bandX, -2.5, 2.5, 5);
  g.lineStyle(1.5, 0xfff1a6, 1);
  g.beginPath();
  g.moveTo(-3 * direction, -1.5);
  g.lineTo(2 * direction, -1.5);
  g.strokePath();

  g.lineStyle(2, 0x1b2233, 1);
  g.beginPath();
  g.moveTo(-7 * direction, -3.5);
  g.lineTo(2 * direction, -3.5);
  g.lineTo(7 * direction, 0);
  g.lineTo(2 * direction, 3.5);
  g.lineTo(-7 * direction, 3.5);
  g.closePath();
  g.strokePath();
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

/** 用同一 atlas 的裁剪叠层只染服装区域，保留人形 sprite 的皮肤、头发与描边。 */
function createHumanClothingLayers(
  scene: Phaser.Scene,
  e: GameEntity,
  atlasKey: string,
  frame: string,
  base: Phaser.GameObjects.Sprite,
): void {
  const shirtColor = e.drawParams.shirtColor as string | undefined;
  const pantsColor = e.drawParams.pantsColor as string | undefined;
  if (!shirtColor && !pantsColor) return;

  const shirt = scene.add.sprite(e.bodyPositionX, e.bodyPositionY, atlasKey, frame);
  const pants = scene.add.sprite(e.bodyPositionX, e.bodyPositionY, atlasKey, frame);
  for (const layer of [shirt, pants]) {
    layer.setScale(e.state.scale * visualScaleFor(e));
    layer.setDepth(base.depth + 0.001);
  }
  // 人形单帧规格固定为 36×68；裁剪只覆盖衫/裤，避免整体 tint 染到脸和头发。
  shirt.setCrop(3, 29, HUMAN_FRAME_WIDTH - 6, 19);
  pants.setCrop(8, 50, 20, HUMAN_FRAME_HEIGHT - 53);
  if (shirtColor) shirt.setTint(hexToNum(shirtColor)).setTintMode(Phaser.TintModes.FILL);
  if (pantsColor) pants.setTint(hexToNum(pantsColor)).setTintMode(Phaser.TintModes.FILL);
  base.setData('humanClothingLayers', { shirt, pants } satisfies HumanClothingLayers);
}

function syncHumanClothingLayers(e: GameEntity, base: Phaser.GameObjects.Sprite, def: SpriteRendererDef): void {
  let layers = base.getData('humanClothingLayers') as HumanClothingLayers | undefined;
  if (!layers && e.rendererId === 'human') {
    createHumanClothingLayers(base.scene, e, def.atlasKey, base.frame.name, base);
    layers = base.getData('humanClothingLayers') as HumanClothingLayers | undefined;
  }
  if (!layers) return;
  const depth = e.layer + e.bodyPositionY * 0.001 + 0.001;
  for (const layer of [layers.shirt, layers.pants]) {
    layer.setPosition(e.bodyPositionX, e.bodyPositionY);
    layer.setScale(e.state.scale * visualScaleFor(e));
    layer.setFlipX(e.state.facing < 0);
    layer.setDepth(depth);
    layer.setVisible(!e.hidden && !e.dead);
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
