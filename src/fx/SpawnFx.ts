/**
 * 生成动效 —— 实体出现的墨迹飞溅 + pop-in 缩放；Starite 飞向 HUD。
 *
 * Spawner 不含渲染关注，动效是渲染/FX 层关注，在 WorldScene.onSpawn 成功后触发。
 * 轻类，非状态机框架：两个方法。
 *
 * 设计：
 * - 墨迹飞溅复用 FxParticles.burst（当前无调用方，正是其存在意义）。
 * - pop-in tween 作用于 entity.state.scale（syncGraphics 已读 e.state.scale，零冲突）。
 * - 物理不禁用：实体在 spawnCandidate 时 body 已在目标世界点激活立即下落，
 *   pop-in 只是视觉缩放不影响 Matter body 尺寸，物理与视觉解耦。
 * - Starite 飞向 HUD 用 sprite（starite atlas 已注册），废弃 vector draw 路径。
 */

import type Phaser from 'phaser';
import type { GameEntity } from '@/game/Entity';
import type { FxParticles } from './Particles';
import type { Camera } from '@/engine/render/Camera';
import { log } from '@/util/log';

export class SpawnFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fxParticles: FxParticles,
    private readonly camera: Camera,
  ) {}

  /** 生成出现：墨迹飞溅 + 实体 pop-in */
  playSpawn(entity: GameEntity, _fromScreenX: number, _fromScreenY: number): void {
    const wx = entity.bodyPositionX;
    const wy = entity.bodyPositionY;
    // 墨迹飞溅（复用 burst）
    this.fxParticles.burst(wx, wy, 0x2b2b2b);
    // pop-in：state.scale 从 0.2 → 1.0（保留形容词 size 的最终倍率）
    const targetScale = entity.state.scale;
    entity.state.scale = 0.2;
    this.scene.tweens.add({
      targets: entity.state,
      scale: targetScale,
      duration: 240,
      ease: 'Back.out',
      onUpdate: () => {
        // scale 变化由 WorldScene.update 的 syncGraphics 每帧消费，无需额外动作
      },
      onComplete: () => {
        entity.state.scale = targetScale;
      },
    });
    log.info('spawn fx played', { id: entity.id, x: wx, y: wy });
  }

  /** Starite 从世界点飞向 HUD 进度面板（挑战完成时调用） */
  playStariteFly(fromWorldX: number, fromWorldY: number, onArrive?: () => void): void {
    // 终点：HUD 进度面板屏幕坐标（右上）→ 反算世界坐标
    const endScreenX = this.scene.scale.width - 80;
    const endScreenY = 40;
    const end = this.camera.screenToWorld(endScreenX, endScreenY);

    // Starite sprite（atlas 已注册），用首帧 + Glow 滤镜，tween 飞向 HUD
    const sprite = this.scene.add.sprite(fromWorldX, fromWorldY, 'starite', 'starite_0');
    sprite.setScale(0.2, 0.2);
    sprite.setDepth(100);
    sprite.setScrollFactor(1, 1);
    sprite.enableFilters();
    sprite.filters?.internal.addGlow(0xffdc50, 4, 0, 1, false);

    this.scene.tweens.add({
      targets: sprite,
      x: end.x,
      y: end.y,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 800,
      ease: 'Quad.in',
      onComplete: () => {
        sprite.destroy();
        onArrive?.();
      },
    });
  }
}
