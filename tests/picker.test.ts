/**
 * 拾取器单测 —— 验证 parseAdjectivesOnly 的纯形容词模式分流（统一入口 parse(raw,'adjectives-only')）。
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@/core/lex/InputParser';
import { pickChallenges, slotId } from '@/core/data/questions/QuestionPicker';
import type { LevelData } from '@/core/types/level';

describe('picker adjectives-only mode', () => {
  it('parse(raw, adjectives-only) returns single adjective for pure input', () => {
    const r = parse('燃烧', 'adjectives-only');
    expect(r).toHaveLength(1);
    expect((r as { adjId: string }[])[0].adjId).toBe('burning');
  });

  it('parse(raw, adjectives-only) returns empty when input contains a noun', () => {
    expect(parse('燃烧的狗', 'adjectives-only')).toHaveLength(0);
  });

  it('parse(raw, adjectives-only) returns empty for unknown text', () => {
    expect(parse('xyz中文未知', 'adjectives-only')).toHaveLength(0);
  });

  it('returns no slots instead of indexing an empty NPC pool', () => {
    const level = { id: 'empty-npc', npcs: [], challengeSlots: 3 } as unknown as LevelData;
    expect(pickChallenges(level, 1, 'cefr', 'test')).toEqual({ challenges: [], npcSlots: [] });
  });

  it('normalizes fractional challenge slots and authored ids to slot ids', () => {
    const level = {
      id: 'authored-level',
      npcs: [{ id: 'npc-a', typeId: 'human', x: 0, y: 0, gender: 'male' as const }],
      challengeSlots: 1.9,
      authoredChallenges: [{
        id: 'human-readable-template-name',
        giverNpcId: 'npc-a',
        kind: 'starite-gate' as const,
        puzzle: { conditions: [{ kind: 'sequence' as const, conditions: [] }] },
        stages: [{ conditions: [{ kind: 'counter' as const, typeId: 'apple', count: 2 }] }],
        reward: { type: 'starite' as const, count: 1 },
        dialog: [{ zh: '测试', en: 'test' }],
      }],
    } as unknown as LevelData;

    const result = pickChallenges(level, 2, 'frequency', 'test');
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].id).toBe(slotId('authored-level', 2, 'frequency', 0));
    expect(result.challenges[0].stages).toHaveLength(1);
    expect(result.npcSlots).toEqual([{ slot: 0, giverNpcId: 'npc-a' }]);
  });
});
