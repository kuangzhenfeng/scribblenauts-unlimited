/**
 * 附着/组合单测 —— 验证 attach 生成刚性 constraint 的契约。
 *
 * 新架构下 attach 需要 Physics 引用，此处用 stub 验证调用契约（不依赖真 Matter 引擎）。
 * 实体用最小 stub（不导入 GameEntity，避免传递依赖 Phaser 在 node 环境下初始化失败）。
 */

import { describe, it, expect } from 'vitest';
import { attach, detach } from '@/engine/physics/Composite';
import type { Physics } from '@/engine/physics/Physics';
import type { GameEntity } from '@/game/Entity';

function mkEntity(id: string): GameEntity {
  return {
    id,
    typeId: 'dog',
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: 'quadruped',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags: {} as never,
    body: { id: Math.floor(Math.random() * 1000), position: { x: 0, y: 0 }, angle: 0 } as never,
    bodyPositionX: 0,
    bodyPositionY: 0,
    bodyAngle: 0,
    setBodyPosition() {},
    setBodyVelocity() {},
    applyImpulse() {},
  } as unknown as GameEntity;
}

describe('Composite attach/detach', () => {
  it('attach returns attachment linking parent and child', () => {
    const created: { length: number; stiffness: number; pointA?: { x: number; y: number } }[] = [];
    const phys = {
      createConstraint: (_a: unknown, _b: unknown, length: number, stiffness: number, opts: unknown) => {
        const c = { length, stiffness, pointA: (opts as { pointA?: { x: number; y: number } }).pointA };
        created.push(c);
        return c as never;
      },
      removeConstraint: () => {},
    } as unknown as Physics;
    const parent = mkEntity('p1');
    const child = mkEntity('c1');
    const att = attach(phys, parent, child, [10, 0]);
    expect(att.parentId).toBe('p1');
    expect(att.childId).toBe('c1');
    expect(created).toHaveLength(1);
    expect(created[0].length).toBe(0);
    expect(created[0].stiffness).toBe(1);
    expect(created[0].pointA).toEqual({ x: 10, y: 0 });
  });

  it('detach calls physics.removeConstraint', () => {
    let removed = 0;
    const phys = {
      createConstraint: () => ({ id: 1 }) as never,
      removeConstraint: () => { removed++; },
    } as unknown as Physics;
    const parent = mkEntity('p2');
    const child = mkEntity('c2');
    const att = attach(phys, parent, child, [0, -5]);
    detach(phys, att);
    expect(removed).toBe(1);
  });
});
