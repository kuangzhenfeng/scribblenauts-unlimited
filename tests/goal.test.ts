/**
 * 目标系统单测 —— 验证挑战条件评估与发奖。
 *
 * 新架构下 GoalSystem 依赖 EntityQuery + LevelRef 抽象（core 层），不耦合 Phaser/Matter。
 */

import { describe, it, expect } from 'vitest';
import { GoalSystem, type ProgressCallbacks, type LevelRef } from '@/core/game/GoalSystem';
import type { Entity, EntityQuery } from '@/core/entity/Entity';
import type { LevelData } from '@/core/types/level';

function fakeEntity(id: string, typeId: string, x: number, y: number): Entity {
  return {
    id,
    typeId,
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: 'box',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags: undefined as never,
    get bodyPositionX() { return x; },
    get bodyPositionY() { return y; },
    get bodyAngle() { return 0; },
    setBodyPosition() {},
    setBodyVelocity() {},
    applyImpulse() {},
  };
}

function makeLevelRef(npcId: string, level: LevelData): LevelRef {
  const done = new Set<string>();
  return {
    currentLevel: level,
    isChallengeDone: (id) => done.has(id),
    markChallengeDone: (id) => done.add(id),
    completedArray: () => [...done],
    npcEntityId: (id) => (id === npcId ? npcId : undefined),
  };
}

describe('GoalSystem', () => {
  it('completes object-present challenge when object is near npc', () => {
    const npc = fakeEntity('npc1', 'human', 100, 100);
    const apple = fakeEntity('e1', 'apple', 110, 105); // 距离 ~14，在 120 半径内
    const entities: Entity[] = [npc, apple];
    const em: EntityQuery = {
      all: () => entities,
      get: (id) => entities.find((e) => e.id === id),
    };

    const level = {
      id: 'test',
      challenges: [
        {
          id: 'ch1',
          giverNpcId: 'npc1',
          kind: 'shard' as const,
          puzzle: {
            conditions: [
              {
                kind: 'object-present' as const,
                typeId: 'apple',
                near: { npcId: 'npc1', radius: 120 },
              },
            ],
          },
          reward: { type: 'shard' as const, count: 1 },
          dialog: [{ zh: '提示', en: 'hint' }],
        },
      ],
    } as unknown as LevelData;
    const levelRef = makeLevelRef('npc1', level);

    const events: string[] = [];
    const cb: ProgressCallbacks = {
      onShard: (t) => events.push(`shard:${t}`),
      onStarite: (t) => events.push(`starite:${t}`),
      onChallengeComplete: (id) => events.push(`complete:${id}`),
      onWin: () => events.push('win'),
    };

    const goal = new GoalSystem(em, levelRef, cb);
    goal.evaluate();
    expect(events).toContain('complete:ch1');
    expect(events).toContain('shard:1');
  });

  it('does not complete when object is far from npc', () => {
    const npc = fakeEntity('npc2', 'human', 0, 0);
    const apple = fakeEntity('e2', 'apple', 500, 500); // 距离远超 120
    const entities: Entity[] = [npc, apple];
    const em: EntityQuery = {
      all: () => entities,
      get: (id) => entities.find((e) => e.id === id),
    };

    const level = {
      id: 'test2',
      challenges: [
        {
          id: 'ch2',
          giverNpcId: 'npc2',
          kind: 'shard' as const,
          puzzle: {
            conditions: [
              {
                kind: 'object-present' as const,
                typeId: 'apple',
                near: { npcId: 'npc2', radius: 120 },
              },
            ],
          },
          reward: { type: 'shard' as const, count: 1 },
          dialog: [{ zh: '', en: '' }],
        },
      ],
    } as unknown as LevelData;
    const levelRef = makeLevelRef('npc2', level);

    const events: string[] = [];
    const goal = new GoalSystem(em, levelRef, {
      onShard: (t) => events.push(`shard:${t}`),
      onStarite: (t) => events.push(`starite:${t}`),
      onChallengeComplete: (id) => events.push(`complete:${id}`),
      onWin: () => events.push('win'),
    });
    goal.evaluate();
    expect(events).toHaveLength(0);
  });
});
