/**
 * 粒子系统 —— 火/蒸汽/水/爆炸的 ParticleEmitter 配置。
 *
 * 用 Phaser 4 内置 ParticleEmitter + 程序生成纹理（零位图）。
 * 实体粒子发射器由 fx/particles.ts 在实体生成/状态变化时挂接。
 * 替代旧项目的 Math.sin 伪粒子（旧 Canvas2D 无粒子系统）。
 */

import Phaser from 'phaser';
import { PARTICLE_TEXTURE_KEY } from './particleTexture';
import type { GameEntity } from '@/game/Entity';

export class FxParticles {
  /** 实体 id → 火焰 emitter（持续） */
  private readonly fireEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** 为实体挂火焰粒子（按实体 body 大小估算粒子量/速度） */
  attachFire(e: GameEntity): void {
    if (this.fireEmitters.has(e.id)) return;
    if (!e.tags.hasState('burning')) return;
    const tex = PARTICLE_TEXTURE_KEY;
    const em = this.scene.add.particles(e.bodyPositionX, e.bodyPositionY, tex, {
      lifespan: { min: 400, max: 800 },
      speed: { min: 10, max: 40 },
      angle: { min: -90, max: -70 }, // 向上飘
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      color: [0xffdc50, 0xff8c00, 0xff5a00],
      colorEase: 'quad.out',
      frequency: 30,
      quantity: 2,
      blendMode: 'ADD',
      tint: 0xffaa33,
    });
    em.setDepth(e.layer + 0.5);
    this.fireEmitters.set(e.id, em);
  }

  /** 移除实体的火焰粒子 */
  detachFire(e: GameEntity): void {
    const em = this.fireEmitters.get(e.id);
    if (em) {
      em.destroy();
      this.fireEmitters.delete(e.id);
    }
  }

  /** 每帧把 emitter 位置对齐到实体（火苗贴着燃烧体） */
  sync(): void {
    // 保留入口供外部按需调用；跟随逻辑在 followEntities
  }

  /** 一帧爆炸：在某位置迸发粒子 */
  burst(x: number, y: number, color = 0xff8c00): void {
    const em = this.scene.add.particles(x, y, PARTICLE_TEXTURE_KEY, {
      lifespan: { min: 300, max: 700 },
      speed: { min: 60, max: 200 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      color: [0xffffff, color],
      colorEase: 'quad.out',
      blendMode: 'ADD',
      frequency: -1,
      quantity: 0,
    });
    em.explode(24, x, y);
    // 寿命结束后销毁
    this.scene.time.delayedCall(800, () => em.destroy());
  }

  /** 同步所有火焰 emitter 到对应实体 body 位置 */
  followEntities(getEntity: (id: string) => GameEntity | undefined): void {
    for (const [id, em] of this.fireEmitters) {
      const e = getEntity(id);
      if (!e) {
        em.destroy();
        this.fireEmitters.delete(id);
        continue;
      }
      em.setPosition(e.bodyPositionX, e.bodyPositionY - 6);
    }
  }
}
