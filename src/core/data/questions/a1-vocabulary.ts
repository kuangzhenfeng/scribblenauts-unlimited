/**
 * CEFR A1 基础词汇表 —— 过滤过于 trivial 的题目。
 *
 * 词表来源：`docs/cefr/cefr-a1.json`（官方 CEFR A1 词汇表，Cambridge A1 Movers +
 * ESL Lounge A1），构建期经 import.meta.glob 聚合为全小写 Set。
 * 与 `word-metadata.ts` 的 `cefr` 档位独立：那是对每个词的人工游戏内分档，
 * 这里是外部 A1 标准，用于判定"答案全 A1"的题目是否过于基础。
 *
 * `isBasicQuestion` 取题目的全部答案词 id（单答案 typeId+adjectives，多答案
 * 每个 answer 的 typeId+adjectives），查对应词条/形容词的英文 name 与 id
 * 是否均在 A1 Set 中；全部 A1 → true。
 */

import type { Question } from '@/core/types/question';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { getAdjective } from '@/core/data/dictionary/adjectives';

/** CEFR A1 词表（构建期聚合，与 `docs/cefr/cefr-a1.json` 同源） */
const a1Module = import.meta.glob<{ words: string[] }>('/docs/cefr/cefr-a1.json', { eager: true });
const A1_WORDS: ReadonlySet<string> = new Set(
  Object.values(a1Module)[0]!.words.map((w) => w.toLowerCase()),
);

/** 判断一个英文词是否属于 A1 词汇（小写查 Set） */
export function isA1Word(word: string): boolean {
  return A1_WORDS.has(word.toLowerCase());
}

/**
 * 判断一个词条/形容词 id 对应的英文是否属于 A1。
 *
 * 词条查 `getEntry(id).en.name` + id 本身；形容词查 `getAdjective(id).en.name` + id。
 * 任一命中即视为 A1（id 或规范英文名在 A1 表中）。
 */
function isIdA1(id: string): boolean {
  if (A1_WORDS.has(id.toLowerCase())) return true;
  const entry = getEntry(id);
  if (entry && A1_WORDS.has(entry.en.name.toLowerCase())) return true;
  const adj = getAdjective(id);
  if (adj && A1_WORDS.has(adj.en.name.toLowerCase())) return true;
  return false;
}

/**
 * 判断一道题是否"过于基础"：所有答案涉及的词 id（typeId + adjectives）均属于 A1。
 *
 * 单答案题取 typeId + adjectives；多答案题取每个 answer 的 typeId + adjectives。
 * 全部 A1 → true（应被过滤）；任一非 A1 → false（保留）。
 */
export function isBasicQuestion(q: Question): boolean {
  const ids: string[] = [];
  if (q.answers && q.answers.length > 0) {
    for (const a of q.answers) {
      ids.push(a.typeId);
      if (a.adjectives) ids.push(...a.adjectives);
    }
  } else {
    if (q.typeId) ids.push(q.typeId);
    if (q.adjectives) ids.push(...q.adjectives);
  }
  if (ids.length === 0) return false;
  return ids.every(isIdA1);
}
