/**
 * 占位渲染器工厂（Phase 3）。
 *
 * 为每个实体创建一个 Graphics 矩形 + 词条文本标签，用于跑通物理与生成闭环。
 * Phase 4 将替换为 20 个矢量渲染器（quadruped/biped/fire/...）。
 */

import Phaser from 'phaser';
import type { GameEntity } from '@/game/Entity';

/** 取词条尺寸（drawParams 可能被形容词 size 覆盖） */
function sizeOf(e: GameEntity): { w: number; h: number } {
  const p = e.drawParams as { w?: number; h?: number };
  const w = (p.w as number) ?? 40;
  const h = (p.h as number) ?? 40;
  return { w: w * e.state.scale, h: h * e.state.scale };
}

export type CreateGameObjectFn = (scene: Phaser.Scene, e: GameEntity) => Phaser.GameObjects.GameObject;

/** 占位渲染器工厂（适配 Spawner 的 createGameObject 签名：忽略 scene，用 e.gameObject.scene 推断） */
export const createPlaceholder: CreateGameObjectFn = (_scene, e) => {
  const { w, h } = sizeOf(e);
  const g = _scene.add.graphics();
  const color = (e.drawParams.color as number) ?? 0x8b94a8;
  g.fillStyle(color, 1);
  g.fillRect(-w / 2, -h / 2, w, h);
  g.lineStyle(2, 0x1b2233, 1);
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.setPosition(e.bodyPositionX, e.bodyPositionY);
  g.setRotation(e.bodyAngle);
  g.setDepth(e.layer);
  return g as unknown as Phaser.GameObjects.GameObject;
};

/** Spawner 用的薄适配：把 (e) => 签名包装为 (scene, e) */
export function createPlaceholderFactory(): CreateGameObjectFn {
  return (scene, e) => createPlaceholder(scene, e);
}
