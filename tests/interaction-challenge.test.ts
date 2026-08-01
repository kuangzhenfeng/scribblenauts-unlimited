/**
 * 交互挑战纵向切片测试 —— 规则 effect 的真实结果进入 GoalSystem 后完成挑战。
 *
 * 两条玩家可选路径共用同一个“清除绳索”目标：剑走 sharp-cut-cuttable，
 * 子弹走 projectile-breaks-breakable。测试不直接写入完成状态，避免把
 * “目标消失”误当成“目标曾被正确清除”。
 */

import { describe, expect, it } from 'vitest';
import { GoalSystem, type LevelRef } from '@/core/game/GoalSystem';
import { EffectResultLog } from '@/core/game/EffectResultLog';
import type { Entity, EntityQuery } from '@/core/entity/Entity';
import type { LevelData } from '@/core/types/level';
import { rules } from '@/core/data/dictionary/rules/rules';
import { TagIndex } from '@/core/rules/TagIndex';
import { TagSet } from '@/core/rules/TagSet';
import { RuleEngine } from '@/core/rules/RuleEngine';
import type { EffectDeps } from '@/core/rules/effects';

function mockEntity(id: string, typeId: string, tags: TagSet, x: number, y: number): Entity {
  let px = x;
  let py = y;
  return {
    id,
    typeId,
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: 'box',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags,
    health: 100,
    maxHealth: 100,
    dead: false,
    get bodyPositionX() { return px; },
    get bodyPositionY() { return py; },
    get bodyAngle() { return 0; },
    setBodyPosition(nextX: number, nextY: number) { px = nextX; py = nextY; },
    setBodyVelocity() {},
    applyImpulse() {},
  };
}

function tags(flags: string[]): TagSet {
  return TagSet.fromRaw({
    material: new Set(),
    temperature: 'normal',
    state: new Set(['normal']),
    behavior: new Set(),
    flags: new Set(flags),
  });
}

function makeLevelRef(level: LevelData, completed: Set<string>): LevelRef {
  return {
    currentLevel: level,
    isChallengeDone: (id) => completed.has(id),
    markChallengeDone: (id) => completed.add(id),
    completedArray: () => [...completed],
    npcEntityId: () => undefined,
  };
}

describe('interaction challenge vertical slice', () => {
  it.each([
    ['sword', ['sharp', 'weapon'], 'sharp-cut-cuttable'],
    ['bullet', ['projectile'], 'projectile-breaks-breakable'],
  ] as const)('completes the roadblock challenge through %s', (sourceTypeId, sourceFlags, ruleId) => {
    const source = mockEntity(`${sourceTypeId}-1`, sourceTypeId, tags([...sourceFlags]), 680, 520);
    const rope = mockEntity('rope-1', 'rope', tags(['cuttable', 'breakable']), 720, 530);
    const entities: Entity[] = [source, rope];
    const entityQuery: EntityQuery = {
      all: () => entities,
      get: (id) => entities.find((entity) => entity.id === id),
    };
    const tagIndex = new TagIndex();
    const effectResults = new EffectResultLog();
    const deps: EffectDeps = {
      entities: entityQuery,
      tagIndex,
      spawn: () => undefined,
      destroyEntity: (entity) => {
        entity.dead = true;
        tagIndex.detach(entity, entity.tags);
      },
      applyImpulse: () => {},
      onEffectResult: (result) => effectResults.record(result),
    };
    const engine = new RuleEngine(entityQuery, tagIndex, () => 0, deps);
    engine.register(rules.find((rule) => rule.id === ruleId)!);
    engine.enqueueCollision({ a: source, b: rope, phase: 'start' });
    engine.update(16);

    const completed = new Set<string>();
    const level = {
      id: 'roadblock-test',
      challenges: [{
        id: 'clear-road',
        giverNpcId: 'npc-child',
        kind: 'shard' as const,
        puzzle: {
          conditions: [{
            kind: 'object-destroyed' as const,
            typeId: 'rope',
            region: { minX: 600, minY: 430, maxX: 840, maxY: 600 },
          }],
        },
        reward: { type: 'shard' as const, count: 2 },
        dialog: [{ zh: '完成', en: 'Done' }],
      }],
    } as unknown as LevelData;
    const goal = new GoalSystem(entityQuery, makeLevelRef(level, completed), {
      onShard: () => {},
      onStarite: () => {},
      onChallengeComplete: () => {},
      onWin: () => {},
    }, effectResults);

    expect(rope.dead).toBe(true);
    expect(effectResults.has({
      kind: 'destroy',
      sourceTypeId,
      targetTypeId: 'rope',
      ruleId,
      region: { minX: 600, minY: 430, maxX: 840, maxY: 600 },
    })).toBe(true);
    goal.evaluate();
    expect(completed).toEqual(new Set(['clear-road']));
  });
});
