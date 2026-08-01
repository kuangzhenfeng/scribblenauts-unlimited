import { describe, expect, it } from 'vitest';
import { randomizeLevelContent } from '@/game/LevelRandomizer';
import type { LevelData } from '@/core/types/level';

const level: LevelData = {
  id: 'random-test',
  type: 'overworld',
  theme: 'jungle',
  bounds: { minX: -1000, minY: -200, maxX: 1000, maxY: 600 },
  playerStart: { x: 0, y: 542 },
  terrain: [{ x: 0, y: 250, w: 200, h: 24 }],
  spawns: [
    { typeId: 'tree', x: -700, y: 320 },
    { typeId: 'stone', x: -300, y: 320 },
    { typeId: 'flower', x: 200, y: 320 },
    { typeId: 'dog', x: 650, y: 320 },
    { typeId: 'bird', x: 400, y: 100 },
    { typeId: 'cloud', x: -200, y: 80 },
  ],
  npcs: [
    { id: 'npc-a', typeId: 'human', x: -500, y: 320, gender: 'male' },
    { id: 'npc-b', typeId: 'human', x: 0, y: 320, gender: 'female' },
    { id: 'npc-c', typeId: 'human', x: 500, y: 320, gender: 'male' },
  ],
  decorations: [
    { kind: 'bush', x: -300, y: 400, scale: 1 },
    { kind: 'flower', x: 300, y: 400, scale: 0.8 },
  ],
};

describe('LevelRandomizer', () => {
  it('同一关卡和种子生成完全一致的运行时内容', () => {
    const first = randomizeLevelContent(level, 'seed-a');
    const second = randomizeLevelContent(level, 'seed-a');
    expect(second).toEqual(first);
    expect(first.terrain).toEqual(level.terrain);
    expect(first.playerStart).toEqual(level.playerStart);
  });

  it('更换种子会改变内容，同时保留挑战引用所需的 NPC id', () => {
    const first = randomizeLevelContent(level, 'seed-a');
    const second = randomizeLevelContent(level, 'seed-b');
    expect(second.spawns).not.toEqual(first.spawns);
    expect(second.decorations).not.toEqual(first.decorations);
    expect(second.npcs.map((npc) => npc.id)).toEqual(level.npcs.map((npc) => npc.id));
    expect(second.spawns.length).toBeGreaterThan(level.spawns.length);
  });

  it('随机位置仍被限制在关卡边界内', () => {
    const result = randomizeLevelContent(level, 'bounds-seed');
    for (const spawn of result.spawns) {
      expect(spawn.x).toBeGreaterThanOrEqual(level.bounds.minX + 70);
      expect(spawn.x).toBeLessThanOrEqual(level.bounds.maxX - 70);
    }
    for (const npc of result.npcs) {
      expect(npc.x).toBeGreaterThanOrEqual(level.bounds.minX + 90);
      expect(npc.x).toBeLessThanOrEqual(level.bounds.maxX - 90);
    }
  });
});
