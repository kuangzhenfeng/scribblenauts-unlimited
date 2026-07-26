/**
 * 题库单测 —— 验证题库规模、难度分布、词条/形容词引用合法性、多答案题结构。
 */

import { describe, it, expect } from 'vitest';
import { QUESTION_BANK, questionsByDifficulty, questionCount } from '@/core/data/questions/bank';
import { allEntries } from '@/core/data/dictionary/Dictionary';
import { allAdjectives } from '@/core/data/dictionary/adjectives';

describe('QuestionBank', () => {
  it('has at least 800 questions', () => {
    expect(questionCount()).toBeGreaterThanOrEqual(800);
  });

  it('every typeId (single-answer or in answers) exists in dictionary', () => {
    const entryIds = new Set(allEntries().map((e) => e.id));
    const bad: string[] = [];
    for (const q of QUESTION_BANK) {
      // 单答案题 typeId
      if (q.typeId && !entryIds.has(q.typeId)) bad.push(`${q.id}.typeId=${q.typeId}`);
      // 多答案题 answers[].typeId
      if (q.answers) {
        for (const a of q.answers) {
          if (!entryIds.has(a.typeId)) bad.push(`${q.id}.answers[].typeId=${a.typeId}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every adjective id (single-answer or in answers) exists in adjective dictionary', () => {
    const adjIds = new Set(allAdjectives().map((a) => a.id));
    const bad: string[] = [];
    for (const q of QUESTION_BANK) {
      if (q.adjectives) {
        for (const a of q.adjectives) if (!adjIds.has(a)) bad.push(`${q.id}.adjectives=${a}`);
      }
      if (q.answers) {
        for (const ans of q.answers) {
          if (ans.adjectives) {
            for (const a of ans.adjectives) if (!adjIds.has(a)) bad.push(`${q.id}.answers[].adjectives=${a}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('cefr and freq fields are valid tiers (1-3)', () => {
    const bad = QUESTION_BANK.filter(
      (q) => ![1, 2, 3].includes(q.cefr) || ![1, 2, 3].includes(q.freq),
    );
    expect(bad).toEqual([]);
  });

  it('every difficulty tier has questions under both standards', () => {
    for (const tier of [1, 2, 3] as const) {
      const cefr = questionsByDifficulty(tier, 'cefr').length;
      const freq = questionsByDifficulty(tier, 'frequency').length;
      expect(cefr).toBeGreaterThan(0);
      expect(freq).toBeGreaterThan(0);
    }
  });

  it('question ids are unique', () => {
    const ids = QUESTION_BANK.map((q) => q.id);
    const deduped = new Set(ids);
    expect(deduped.size).toBe(ids.length);
  });

  it('combo questions have at least one adjective', () => {
    const combos = QUESTION_BANK.filter((q) => q.adjectives && q.adjectives.length > 0);
    expect(combos.length).toBeGreaterThan(0);
    for (const q of combos) {
      expect(q.adjectives!.length).toBeGreaterThan(0);
    }
  });

  it('multi-answer (situational) questions have at least 2 answers', () => {
    const multi = QUESTION_BANK.filter((q) => q.answers && q.answers.length > 0);
    expect(multi.length).toBeGreaterThan(0);
    for (const q of multi) {
      expect(q.answers!.length).toBeGreaterThanOrEqual(2);
    }
  });
});
