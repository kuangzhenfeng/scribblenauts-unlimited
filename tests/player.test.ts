/**
 * 玩家控制器着地探针单测 —— 验证 probeGrounded 命中判定。
 *
 * 用最小 stub 实体与 Physics（不导入 GameEntity，避免传递依赖 Phaser 在 node 环境下初始化失败）。
 */

import { describe, it, expect } from 'vitest';
import { PlayerController } from '@/game/PlayerController';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { GameEntity } from '@/game/Entity';

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
    setBodyVelocity() {},
    applyImpulse() {},
  } as unknown as GameEntity;
}

function mkStubPhysics(bodiesAt: { id: number; x: number; y: number }[]): Physics {
  return {
    pointQuery: (x: number, y: number) => bodiesAt.filter((b) => b.x === x && b.y === y) as never,
  } as unknown as Physics;
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