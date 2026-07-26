/**
 * 玩家控制器着地探针与虚拟输入单测。
 *
 * 用最小 stub 实体与 Physics（不导入 GameEntity，避免传递依赖 Phaser 在 node 环境下初始化失败）。
 */

import { describe, it, expect, vi } from 'vitest';
import { PlayerController } from '@/game/PlayerController';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { GameEntity } from '@/game/Entity';

// sfx.play 在 node 环境会触发 AudioContext 初始化失败，mock 掉音效模块
vi.mock('@/audio/SoundEffects', () => ({
  sfx: { play: () => undefined },
}));

function mkPlayer(x: number, y: number): GameEntity {
  return {
    id: 'p1',
    typeId: 'human',
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: 'biped',
    layer: 1,
    critical: true,
    lastTouchedAt: 0,
    isPlayer: true,
    tags: {} as never,
    body: { id: 1, position: { x, y }, angle: 0, velocity: { x: 0, y: 0 } } as never,
    bodyPositionX: x,
    bodyPositionY: y,
    bodyAngle: 0,
    setBodyPosition() {},
    setBodyVelocity(vx: number, vy: number) {
      // 记录到 body.velocity 供断言
      (this as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity = { x: vx, y: vy };
    },
    applyImpulse() {},
  } as unknown as GameEntity;
}

function mkStubPhysics(bodiesAt: { id: number; x: number; y: number }[]): Physics {
  return {
    pointQuery: (x: number, y: number) => bodiesAt.filter((b) => b.x === x && b.y === y) as never,
  } as unknown as Physics;
}

/** 组装一个"已着地"的玩家 + EntityManager stub，供虚拟输入测试复用 */
function groundedPlayer(): { player: GameEntity; em: EntityManager; phys: Physics } {
  const player = mkPlayer(100, 100);
  const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
  // 脚下 134 处有 body（id 99），probeGrounded 返回 true
  const phys = mkStubPhysics([{ id: 99, x: 92, y: 134 }]);
  return { player, em, phys };
}

describe('PlayerController probeGrounded', () => {
  it('returns true when a body is below feet', () => {
    const player = mkPlayer(100, 100);
    const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
    // feet y = 100+30 = 130, probe y = 130+4 = 134；feet x = 100±8 = 92 或 108
    const phys = mkStubPhysics([{ id: 99, x: 92, y: 134 }]);
    const pc = new PlayerController(em, phys);
    expect(pc.probeGrounded(player)).toBe(true);
  });

  it('returns false when no body below feet', () => {
    const player = mkPlayer(100, 100);
    const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
    const phys = mkStubPhysics([]);
    const pc = new PlayerController(em, phys);
    expect(pc.probeGrounded(player)).toBe(false);
  });

  it('ignores own body id in probe', () => {
    const player = mkPlayer(100, 100);
    const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
    // 自身 body 在脚下位置（id 相同），应忽略不算着地
    const phys = mkStubPhysics([{ id: 1, x: 92, y: 134 }]);
    const pc = new PlayerController(em, phys);
    expect(pc.probeGrounded(player)).toBe(false);
  });
});

describe('PlayerController virtual input', () => {
  it('setVirtualMove(1) drives rightward velocity on update', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setVirtualMove(1);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBeGreaterThan(0);
  });

  it('setVirtualMove(-1) drives leftward velocity on update', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setVirtualMove(-1);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBeLessThan(0);
  });

  it('small moveX below deadzone produces no movement', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    // 0.2 低于 0.5 死区
    pc.setVirtualMove(0.2);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBe(0);
  });

  it('setVirtualJump(true) sets upward velocity when grounded', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setVirtualJump(true);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { y: number } } }).body.velocity;
    expect(vel.y).toBeLessThan(0);
  });

  it('triggerInteract with no held item attempts pickup (no throw)', () => {
    const { em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    // 无持物/未骑乘 → triggerInteract 走 tryPickUpNearby（前方无物体，静默返回，不应抛异常）
    expect(() => pc.triggerInteract()).not.toThrow();
  });
});