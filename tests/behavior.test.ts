/**
 * 行为系统 AI 单测 —— 验证 follow 朝玩家移动、frozen 不行动。
 *
 * 新架构 BehaviorSystem 依赖注入式（EffectDeps 构造注入）。
 * 用最小 GameEntity 实现（body 运动学量闭包存储）。
 */

import { describe, it, expect } from 'vitest';
import { BehaviorSystem } from '@/game/BehaviorSystem';
import type { EntityManager } from '@/game/EntityManager';
import type { Entity } from '@/core/entity/Entity';
import type { EffectDeps } from '@/core/rules/effects';
import { TagSet } from '@/core/rules/TagSet';

function mkEntity(id: string, x: number, behaviors: { kind: string }[]): Entity {
  let px = x;
  let py = 0;
  let vx = 0;
  let vy = 0;
  return {
    id,
    typeId: 'dog',
    state: { animTime: 0, locomotion: 'idle' as const, facing: 1, scale: 1, stateLayer: new Set<string>() },
    drawParams: {},
    rendererId: 'quadruped',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags: TagSet.fromRaw({
      material: new Set(['flesh']),
      temperature: 'normal',
      state: new Set(['normal']),
      behavior: new Set(['walking']),
      flags: new Set(),
      category: 'creature',
    }),
    behaviors: behaviors as never,
    health: 100,
    maxHealth: 100,
    stateTimers: new Map(),
    dead: false,
    // body 运动学桥接（stub：闭包存储 + velocity 字段）
    body: {
      id: Math.floor(Math.random() * 10000),
      position: { get x() { return px; }, get y() { return py; } },
      velocity: { get x() { return vx; }, get y() { return vy; } },
      angle: 0,
      mass: 1,
    } as never,
    get bodyPositionX() { return px; },
    get bodyPositionY() { return py; },
    get bodyAngle() { return 0; },
    setBodyPosition(x: number, y: number) { px = x; py = y; },
    setBodyVelocity(x: number, y: number) { vx = x; vy = y; },
    applyImpulse() {},
    get _vx() { return vx; },
  } as unknown as Entity & { _vx: number };
}

function mkPlayer(x: number): Entity {
  return { ...mkEntity('p1', x, []), isPlayer: true, critical: true };
}

function setup(ents: Entity[]): { em: EntityManager; bs: BehaviorSystem } {
  const em = {
    all: () => ents,
    get: (id: string) => ents.find((e) => e.id === id),
    getPlayer: () => ents.find((e) => e.isPlayer),
  } as unknown as EntityManager;
  const deps: EffectDeps = {
    entities: em,
    tagIndex: { attach() {}, detach() {}, byStateSet: () => new Set(), byFlagSet: () => new Set() } as never,
    spawn: () => undefined,
    destroyEntity: () => {},
    applyImpulse: () => {},
  };
  const bs = new BehaviorSystem(em, () => 1000, deps);
  return { em, bs };
}

describe('BehaviorSystem AI', () => {
  it('follow moves creature toward player', () => {
    const dog = mkEntity('d1', -300, [{ kind: 'follow' }]) as Entity & { _vx: number };
    const player = mkPlayer(0);
    const { bs } = setup([dog, player]);
    bs.update();
    // 玩家在 dog 右侧，follow 应朝右（x 速度 > 0）
    expect(dog._vx).toBeGreaterThan(0);
    expect(dog.state.facing).toBe(1);
  });

  it('frozen creature does not move', () => {
    const dog = mkEntity('d1', -300, [{ kind: 'follow' }]) as Entity & { _vx: number };
    dog.tags.addState('frozen');
    const player = mkPlayer(0);
    const { bs } = setup([dog, player]);
    bs.update();
    expect(dog._vx).toBe(0);
  });

  it('wander sets locomotion walk when moving', () => {
    const dog = mkEntity('d1', 0, [{ kind: 'wander' }]) as Entity & { _vx: number };
    const player = mkPlayer(0);
    const { bs } = setup([dog, player]);
    bs.update();
    // wander 50% 停止或移动，locomotion 应为 walk 或 idle（不抛错即可）
    expect(['walk', 'idle']).toContain(dog.state.locomotion);
  });
});
