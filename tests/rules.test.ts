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
import type { EffectDeps, EffectResult } from '@/core/rules/effects';

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
function makeDeps(entities: { all: () => Entity[] } = { all: () => [] }): EffectDeps {
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

describe('rule: fire detonates explosive', () => {
  it('damages every entity inside the blast radius and leaves distant entities alone', () => {
    const fire = mockEntity('fire-blast', 'fire', ts({ state: ['burning'] }));
    const bomb = mockEntity('bomb-blast', 'bomb', ts({ flags: ['explosive'] }));
    const chainBomb = mockEntity('chain-bomb-blast', 'bomb', ts({ flags: ['explosive'] }));
    const barrel = mockEntity('barrel-blast', 'barrel', ts({ flags: ['breakable'] }));
    const distant = mockEntity('distant-blast', 'barrel', ts({ flags: ['breakable'] }));
    fire.setBodyPosition(0, 0);
    bomb.setBodyPosition(20, 0);
    chainBomb.setBodyPosition(100, 0);
    barrel.setBodyPosition(100, 0);
    distant.setBodyPosition(230, 0);
    const entities = [fire, bomb, chainBomb, barrel, distant];
    const engine = new RuleEngine(
      { all: () => entities, get: () => undefined },
      tagIndex,
      () => fakeNow,
      makeDeps({ all: () => entities }),
    );
    engine.register(rules.find((r) => r.id === 'fire-detonates-explosive')!);
    for (const e of entities) tagIndex.attach(e, e.tags);

    engine.enqueueCollision({ a: fire, b: bomb, phase: 'active' });
    engine.update(16);

    expect(bomb.dead).toBe(true);
    expect(chainBomb.dead).toBe(true);
    expect(barrel.dead).toBe(true);
    expect(distant.dead).toBe(true);
    for (const e of entities) tagIndex.detach(e, e.tags);
  });
});

describe('rule: container stores object', () => {
  it('moves a colliding object into a container and leaves the container alive', () => {
    const container = mockEntity('container1', 'box', ts({ flags: ['container'], category: 'object' }));
    const item = mockEntity('item1', 'apple', ts({ flags: ['edible'], category: 'food' }));
    const stored: Array<{ container: Entity; item: Entity }> = [];
    const deps = makeDeps({ all: () => [container, item] });
    deps.storeEntity = (parent, child) => {
      stored.push({ container: parent, item: child });
      parent.containedTypeIds = [...(parent.containedTypeIds ?? []), child.typeId];
      child.dead = true;
    };
    const engine = new RuleEngine({ all: () => [container, item], get: () => undefined }, tagIndex, () => fakeNow, deps);
    engine.register(rules.find((r) => r.id === 'container-stores-object')!);
    engine.enqueueCollision({ a: container, b: item, phase: 'start' });
    engine.update(16);
    expect(stored).toHaveLength(1);
    expect(stored[0].item).toBe(item);
    expect(container.dead).toBe(false);
    expect(container.containedTypeIds).toEqual(['apple']);
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

describe('rule: projectile impact', () => {
  it('damages and knocks a creature away from the projectile', () => {
    const impulses: Array<{ entity: Entity; dir: [number, number]; mag: number }> = [];
    const deps = makeDeps();
    deps.applyImpulse = (entity: Entity, dir: [number, number], mag: number) => {
      impulses.push({ entity, dir, mag });
    };
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, deps);
    for (const r of rules) if (r.id === 'projectile-hit-creature') engine.register(r);
    const a = mockEntity('projectile1', 'arrow', ts({ flags: ['projectile', 'weapon'] }));
    const b = mockEntity('target1', 'dog', ts({ material: ['flesh'], category: 'creature' }));
    a.setBodyPosition(0, 0);
    b.setBodyPosition(20, 0);
    tagIndex.attach(a, a.tags);
    tagIndex.attach(b, b.tags);
    engine.enqueueCollision({ a, b, phase: 'start' });
    engine.update(16);
    expect(b.health).toBe(65);
    expect(impulses).toHaveLength(1);
    expect(impulses[0].entity).toBe(b);
    expect(impulses[0].dir[0]).toBeGreaterThan(0);
    tagIndex.detach(a, a.tags);
    tagIndex.detach(b, b.tags);
  });

  it('keeps rule cooldown throttling intact across repeated contacts', () => {
    fakeNow = 0;
    const impulses: Array<{ entity: Entity; dir: [number, number]; mag: number }> = [];
    const deps = makeDeps();
    deps.applyImpulse = (entity, dir, mag) => impulses.push({ entity, dir, mag });
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, deps);
    for (const r of rules) if (r.id === 'projectile-hit-creature') engine.register(r);
    const a = mockEntity('projectile-cooldown', 'arrow', ts({ flags: ['projectile'] }));
    const b = mockEntity('target-cooldown', 'dog', ts({ material: ['flesh'], category: 'creature' }));
    a.setBodyPosition(0, 0);
    b.setBodyPosition(20, 0);
    engine.enqueueCollision({ a, b, phase: 'start' });
    engine.enqueueCollision({ a, b, phase: 'start' });
    engine.update(16);
    expect(impulses).toHaveLength(1);
    fakeNow = 400;
    engine.enqueueCollision({ a, b, phase: 'start' });
    engine.update(16);
    expect(impulses).toHaveLength(2);
  });
});

describe('rule result recording', () => {
  it('records the actual target and source when a projectile destroys a breakable object', () => {
    const results: EffectResult[] = [];
    const deps = makeDeps();
    deps.onEffectResult = (result) => results.push(result);
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, deps);
    for (const r of rules) if (r.id === 'projectile-breaks-breakable') engine.register(r);
    const bullet = mockEntity('bullet1', 'bullet', ts({ flags: ['projectile'] }));
    const barrel = mockEntity('barrel1', 'barrel', ts({ flags: ['breakable'] }));
    barrel.setBodyPosition(48, 12);
    engine.enqueueCollision({ a: bullet, b: barrel, phase: 'start' });
    engine.update(16);
    expect(results).toEqual([
      expect.objectContaining({
        kind: 'destroy',
        ruleId: 'projectile-breaks-breakable',
        sourceId: 'bullet1',
        sourceTypeId: 'bullet',
        targetId: 'barrel1',
        targetTypeId: 'barrel',
        targetX: 48,
        targetY: 12,
      }),
      expect.objectContaining({ targetId: 'bullet1', targetTypeId: 'bullet' }),
    ]);
  });
});

describe('rule: poison and antidote', () => {
  it('poison contact applies a damaging poisoned state', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'poison-infect-creature') engine.register(r);
    const poison = mockEntity('poison1', 'poison', ts({}));
    const target = mockEntity('target2', 'human', ts({ material: ['flesh'], category: 'creature' }));
    engine.enqueueCollision({ a: poison, b: target, phase: 'start' });
    engine.update(16);
    expect(target.tags.hasState('poisoned')).toBe(true);
    expect(target.health).toBe(90);
  });

  it('potion cures poison and restores health', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    for (const r of rules) if (r.id === 'potion-cures-poison') engine.register(r);
    const potion = mockEntity('potion1', 'potion', ts({}));
    const target = mockEntity('target3', 'human', ts({ material: ['flesh'], state: ['poisoned'], category: 'creature' }));
    target.health = 40;
    engine.enqueueCollision({ a: potion, b: target, phase: 'start' });
    engine.update(16);
    expect(target.tags.hasState('poisoned')).toBe(false);
    expect(target.health).toBe(75);
    expect(potion.dead).toBe(true);
  });
});

describe('effect: lethal damage', () => {
  it('marks the entity dead and switches its locomotion state', () => {
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, makeDeps());
    engine.register({
      id: 'test-lethal-damage',
      trigger: { kind: 'collision' },
      match: { kind: 'pair', a: { flags: ['weapon'] }, b: { category: ['creature'] } },
      effect: { kind: 'damage', target: 'b', amount: 120 },
    });
    const weapon = mockEntity('weapon1', 'sword', ts({ flags: ['weapon'] }));
    const target = mockEntity('target4', 'human', ts({ material: ['flesh'], category: 'creature' }));
    engine.enqueueCollision({ a: weapon, b: target, phase: 'start' });
    engine.update(16);
    expect(target.dead).toBe(true);
    expect(target.tags.hasState('dead')).toBe(true);
    expect(target.state.locomotion).toBe('dead');
  });

  it('does not report a respawning player as a destroyed object', () => {
    const results: EffectResult[] = [];
    const deps = makeDeps();
    deps.onEffectResult = (result) => results.push(result);
    const engine = new RuleEngine({ all: () => [], get: () => undefined }, tagIndex, () => fakeNow, deps);
    engine.register({
      id: 'test-player-lethal-damage',
      trigger: { kind: 'collision' },
      match: { kind: 'pair', a: { flags: ['weapon'] }, b: { category: ['creature'] } },
      effect: { kind: 'damage', target: 'b', amount: 120 },
    });
    const weapon = mockEntity('weapon-player-test', 'sword', ts({ flags: ['weapon'] }));
    const player = mockEntity('player-test', 'human', ts({ material: ['flesh'], category: 'creature' }));
    player.isPlayer = true;
    engine.enqueueCollision({ a: weapon, b: player, phase: 'start' });
    engine.update(16);
    expect(player.dead).toBe(true);
    expect(results).toHaveLength(0);
  });
});
