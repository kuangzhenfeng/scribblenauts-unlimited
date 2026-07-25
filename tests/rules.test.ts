/**
 * 规则引擎单测 —— 验证核心交互规则的行为正确性。
 *
 * 不启动渲染/物理，直接构造最小逻辑实体 + TagSet，喂事件给 RuleEngine，
 * 断言 effect 执行后的状态变化。验证依赖注入式架构（无全局单例）。
 */

import { describe, it, expect } from 'vitest';
import { TagSet } from '@/core/rules/TagSet';
import { TagIndex } from '@/core/rules/TagIndex';
import { RuleEngine } from '@/core/rules/RuleEngine';
import { rules } from '@/core/data/dictionary/rules/rules';
import type { Entity } from '@/core/entity/Entity';

let fakeNow = 0;

/** 构造一个最小逻辑实体（body 运动学量用闭包变量存储） */
function mockEntity(id: string, typeId: string, tags: TagSet): Entity {
  let px = 0;
  let py = 0;
  return {
    id,
    typeId,
    state: {
      animTime: 0,
      locomotion: 'idle',
      facing: 1,
      scale: 1,
      stateLayer: new Set<string>(),
    },
    drawParams: {},
    rendererId: 'box',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags,
    health: 100,
    maxHealth: 100,
    stateTimers: new Map(),
    dead: false,
    get bodyPositionX() { return px; },
    get bodyPositionY() { return py; },
    get bodyAngle() { return 0; },
    setBodyPosition(x: number, y: number) { px = x; py = y; },
    setBodyVelocity() {},
    applyImpulse() {},
  };
}

const tagIndex = new TagIndex();

/** 构造 EffectDeps（依赖注入） */
function makeDeps(entities: { all: () => Entity[] } = { all: () => [] }) {
  return {
    entities: { all: entities.all, get: () => undefined },
    tagIndex,
    spawn: () => undefined,
    destroyEntity: (e: Entity) => {
      tagIndex.detach(e, e.tags);
      e.dead = true;
    },
    applyImpulse: () => {},
  };
}

function ts(raw: {
  material?: string[];
  state?: string[];
  flags?: string[];
  behavior?: string[];
  temperature?: string;
  category?: import('@/core/types/rules').ObjectCategory;
}): TagSet {
  return TagSet.fromRaw({
    material: new Set(raw.material ?? []),
    temperature: raw.temperature ?? 'normal',
    state: new Set(raw.state ?? ['normal']),
    behavior: new Set(raw.behavior ?? []),
    flags: new Set(raw.flags ?? []),
    category: raw.category,
  });
}

describe('TagSet bitmask + auto index sync', () => {
  it('addState/hasState works and notifies index', () => {
    const t = ts({ state: [], flags: ['flammable'] });
    expect(t.hasFlag('flammable')).toBe(true);
    const e = mockEntity('e', 'wood', t);
    tagIndex.attach(e, t);
    expect(tagIndex.byStateSet('burning').has(e)).toBe(false);
    t.addState('burning');
    expect(t.hasState('burning')).toBe(true);
    expect(tagIndex.byStateSet('burning').has(e)).toBe(true);
    t.removeState('burning');
    expect(t.hasState('burning')).toBe(false);
    expect(tagIndex.byStateSet('burning').has(e)).toBe(false);
    tagIndex.detach(e, t);
  });
});

describe('rule: fire ignites flammable', () => {
  it('burning a ignites flammable b', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'fire-ignite-flammable') engine.register(r);
    const a = mockEntity('a1', 'fire', ts({ state: ['burning'], flags: ['igniter'], material: [] }));
    const b = mockEntity('b1', 'wood', ts({ flags: ['flammable'] }));
    tagIndex.attach(a, a.tags);
    tagIndex.attach(b, b.tags);
    engine.enqueueCollision({ a, b, phase: 'active' });
    fakeNow = 0;
    engine.update(16);
    expect(b.tags.hasState('burning')).toBe(true);
    tagIndex.detach(a, a.tags);
    tagIndex.detach(b, b.tags);
  });
});

describe('rule: water extinguishes fire', () => {
  it('water removes burning from b', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'water-extinguish-fire') engine.register(r);
    const a = mockEntity('a2', 'water', ts({ material: ['water'] }));
    const b = mockEntity('b2', 'wood', ts({ state: ['burning'], flags: ['flammable'] }));
    engine.enqueueCollision({ a, b, phase: 'active' });
    engine.update(16);
    expect(b.tags.hasState('burning')).toBe(false);
    expect(b.tags.hasState('wet')).toBe(true);
  });
});

describe('rule: sharp cuts cuttable', () => {
  it('sword destroys rope', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'sharp-cut-cuttable') engine.register(r);
    const a = mockEntity('a3', 'sword', ts({ material: ['metal'], flags: ['sharp', 'weapon'] }));
    const b = mockEntity('b3', 'rope', ts({ material: ['cloth'], flags: ['cuttable'] }));
    engine.enqueueCollision({ a, b, phase: 'start' });
    engine.update(16);
    expect(b.dead).toBe(true);
  });
});

describe('rule: weapon harms creature', () => {
  it('sword damages dog', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'weapon-harm-creature') engine.register(r);
    const a = mockEntity('a4', 'sword', ts({ flags: ['weapon', 'sharp'] }));
    const b = mockEntity('b4', 'dog', ts({ material: ['flesh'], flags: ['edible-target'], behavior: ['walk'], category: 'creature' }));
    engine.enqueueCollision({ a, b, phase: 'start' });
    engine.update(16);
    expect(b.health).toBeLessThan(100);
  });
});

describe('rule: cold freezes water', () => {
  it('cold temperature transforms water to ice (destroy + spawn mocked)', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'cold-freeze-water') engine.register(r);
    const a = mockEntity('a5', 'ice', ts({ material: ['ice'], flags: [], temperature: 'cold' }));
    const b = mockEntity('b5', 'water', ts({ material: ['water'] }));
    engine.enqueueCollision({ a, b, phase: 'active' });
    engine.update(16);
    // transform 会 destroy b 并 spawn ice（spawn 被 mock 为 undefined）
    expect(b.dead).toBe(true);
  });
});

describe('rule: burning tick damages self', () => {
  it('tick reduces health of burning entity', () => {
    fakeNow = 0;
    const b = mockEntity('b6', 'wood', ts({ state: ['burning'], flags: ['flammable'] }));
    tagIndex.attach(b, b.tags);
    const engine = new RuleEngine({ all: () => [b], get: () => undefined }, tagIndex, () => fakeNow, makeDeps({ all: () => [b] }));
    for (const r of rules) if (r.id === 'burning-tick') engine.register(r);
    engine.update(700); // 超过 intervalMs=600
    expect(b.health).toBeLessThan(100);
    tagIndex.detach(b, b.tags);
  });
});
