import { describe, expect, it } from 'vitest';
import {
  OBJECT_SHARD_CATEGORIES,
  OBJECT_SHARD_TASKS,
  OBJECT_SHARD_TOTAL,
  objectShardTaskForTypeId,
} from '@/core/data/starite/object-shards';
import { GoalSystem, type LevelRef } from '@/core/game/GoalSystem';
import type { EntityQuery } from '@/core/entity/Entity';
import type { LevelData } from '@/core/types/level';

const emptyEntities: EntityQuery = {
  all: () => [],
  get: () => undefined,
};

function levelRef(): LevelRef {
  const completed = new Set<string>();
  return {
    currentLevel: { id: 'object-shard-test' } as LevelData,
    isChallengeDone: (id) => completed.has(id),
    markChallengeDone: (id) => completed.add(id),
    completedArray: () => [...completed],
    npcEntityId: () => undefined,
  };
}

describe('Object Shard catalog', () => {
  it('contains the original eight categories and stable 217-task coverage', () => {
    expect(OBJECT_SHARD_CATEGORIES.map((category) => category.id)).toEqual([
      'living',
      'food',
      'vehicle',
      'music',
      'tech',
      'weapon',
      'clothes',
      'misc',
    ]);
    expect(OBJECT_SHARD_TOTAL).toBe(217);
    expect(Object.fromEntries(
      OBJECT_SHARD_CATEGORIES.map((category) => [
        category.id,
        OBJECT_SHARD_TASKS.filter((task) => task.category === category.id).length,
      ]),
    )).toEqual({ living: 31, food: 29, vehicle: 23, music: 25, tech: 26, weapon: 26, clothes: 25, misc: 32 });
    expect(new Set(OBJECT_SHARD_TASKS.map((task) => task.id)).size).toBe(OBJECT_SHARD_TOTAL);
    expect(new Set(OBJECT_SHARD_TASKS.map((task) => task.typeId)).size).toBe(OBJECT_SHARD_TOTAL);
    expect(objectShardTaskForTypeId(OBJECT_SHARD_TASKS[0]!.typeId)).toEqual(OBJECT_SHARD_TASKS[0]);
  });
});

describe('GoalSystem Object Shards', () => {
  it('records each summoned type once and converts every ten tasks to one Starite', () => {
    const objectShardEvents: string[] = [];
    const goal = new GoalSystem(emptyEntities, levelRef(), {
      onShard: () => undefined,
      onStarite: (total) => objectShardEvents.push(`starite:${total}`),
      onObjectShard: (task, count) => objectShardEvents.push(`${task.typeId}:${count}`),
      onChallengeComplete: () => undefined,
      onWin: () => undefined,
    });
    const tasks = OBJECT_SHARD_TASKS.slice(0, 10);

    for (const task of tasks) goal.recordObjectType(task.typeId);
    goal.recordObjectType(tasks[0]!.typeId);

    expect(goal.objectShardCount).toBe(0);
    expect(goal.objectShardStariteCount).toBe(1);
    expect(goal.stariteCount).toBe(1);
    expect(goal.completedObjectShardTaskIds()).toHaveLength(10);
    expect(objectShardEvents.filter((event) => event.startsWith('starite:'))).toEqual(['starite:1']);
  });

  it('restores Object Shard tasks and source Starites independently from ordinary shards', () => {
    const tasks = OBJECT_SHARD_TASKS.slice(0, 3);
    const goal = new GoalSystem(emptyEntities, levelRef(), {
      onShard: () => undefined,
      onStarite: () => undefined,
      onChallengeComplete: () => undefined,
      onWin: () => undefined,
    });

    goal.restore(2, 4, [], 3, tasks.map((task) => task.id), 1);

    expect(goal.stariteCount).toBe(2);
    expect(goal.shardCount).toBe(4);
    expect(goal.objectShardCount).toBe(3);
    expect(goal.objectShardStariteCount).toBe(1);
    expect(goal.completedObjectShardTaskIds()).toEqual(tasks.map((task) => task.id));
  });
});
