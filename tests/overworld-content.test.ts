import { describe, expect, it } from 'vitest';
import rawLevel from '@/core/data/levels/overworld-meadow.json';
import type { LevelData } from '@/core/types/level';
import { pickChallenges, slotId } from '@/core/data/questions/QuestionPicker';

const level = rawLevel as unknown as LevelData;

describe('首个自由探索区内容', () => {
  it('保留 Edwin 农场锚点与三阶段善意任务', () => {
    const edwin = level.npcs.find((npc) => npc.id === 'npc-edwin');
    const challenge = level.authoredChallenges?.find((item) => item.id === 'meadow-edwin-good-deed');

    expect(edwin?.fixed).toBe(true);
    expect(edwin?.avatarId).toBe('sibling-01');
    expect(challenge?.giverNpcId).toBe('npc-edwin');
    expect(challenge?.stages).toHaveLength(2);
    expect(challenge?.stages?.[1]?.conditions[0]).toMatchObject({
      kind: 'object-destroyed',
      typeId: 'crate',
    });
  });

  it('题目装配不会丢失 Edwin authored challenge', () => {
    const result = pickChallenges(level, 1, 'cefr', 'content-test');
    const challenge = result.challenges.find((item) => item.giverNpcId === 'npc-edwin');

    expect(result.challenges).toHaveLength(8);
    expect(challenge?.id).toBe(slotId('overworld-meadow', 1, 'cefr', 7));
    expect(challenge?.reward).toEqual({ type: 'shard', count: 2 });
  });
});
