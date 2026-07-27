/**
 * 补全查询 —— 输入文本 → 实时候选词（形容词 + 名词合并）。
 *
 * 从 Autocomplete 抽出的纯函数，供 Autocomplete（主游戏笔记本）与
 * QuizKeyboard（简易问答键盘）复用，避免两处独立实现多词前缀分离
 * 与 CJK 贪心分词逻辑（DRY）。
 *
 * 复用底层：completeEn/completeCn（名词）+ completeAdjEn/completeAdjCn（形容词）。
 * 多词组合：英文按空格取最后一段为正在输入的 query，前部为已确认 prefix；
 *           CJK 贪心匹配已确认词（形容词/名词 + 的/地/得 粒子），末段为 query。
 */

import { completeCn, completeEn, cnExactId, type Completion } from '@/core/data/dictionary/Dictionary';
import { completeAdjCn, completeAdjEn, lookupAdjByCn } from '@/core/data/dictionary/adjectives';

/** 补全模式：spawn=形容词+名词合并，adjective=仅形容词 */
export type CompletionMode = 'spawn' | 'adjective';

/** 带类型标记的补全候选（kind 区分形容词/名词，供键盘决定点选行为） */
export interface TaggedCompletion extends Completion {
  kind: 'adj' | 'noun';
}

/** 中文字符级形容词后缀"的/地/得"剥离（与 InputParser 对齐） */
const ADJ_PARTICLES = new Set(['的', '地', '得']);

/** 形容词/名词最长匹配限界（与 InputParser 对齐） */
const MAX_WORD_LEN = 6;

/** CJK 范围检测（与 Autocomplete 对齐） */
const CJK_RE = /[㐀-鿿豈-]/u;

/** 分离已确认前缀与正在输入的补全前缀 */
export function splitCompletionQuery(text: string): { prefix: string; query: string; queryIsCjk: boolean } {
  const t = text.trim();
  if (!t) return { prefix: '', query: '', queryIsCjk: false };
  if (CJK_RE.test(t)) {
    const seg = segmentCjkCommitted(t);
    return { prefix: seg.prefix, query: seg.remaining, queryIsCjk: CJK_RE.test(seg.remaining) };
  }
  // 英文：按空格取最后一段
  const lastSpace = t.lastIndexOf(' ');
  if (lastSpace >= 0) {
    return { prefix: t.slice(0, lastSpace + 1), query: t.slice(lastSpace + 1), queryIsCjk: false };
  }
  return { prefix: '', query: t, queryIsCjk: false };
}

/** 计算补全候选（形容词 + 名词合并，形容词优先），复用底层 completeXxx */
export function computeCompletions(
  text: string,
  mode: CompletionMode,
  limit = 8,
): { completions: TaggedCompletion[]; prefix: string; queryIsCjk: boolean } {
  const { prefix, query, queryIsCjk } = splitCompletionQuery(text);
  if (!query) return { completions: [], prefix, queryIsCjk };

  const adjs = (queryIsCjk ? completeAdjCn(query, limit) : completeAdjEn(query, limit)).map(
    (c): TaggedCompletion => ({ ...c, kind: 'adj' }),
  );

  if (mode === 'adjective') {
    return { completions: adjs, prefix, queryIsCjk };
  }

  // spawn 模式：形容词 + 名词合并，形容词优先，按显示名去重
  const nouns = (queryIsCjk ? completeCn(query, limit) : completeEn(query, limit)).map(
    (c): TaggedCompletion => ({ ...c, kind: 'noun' }),
  );
  const merged: TaggedCompletion[] = [];
  const seen = new Set<string>();
  for (const c of [...adjs, ...nouns]) {
    const key = queryIsCjk ? c.zh : c.en;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
    if (merged.length >= limit) break;
  }
  return { completions: merged, prefix, queryIsCjk };
}

/**
 * CJK 贪心匹配已确认词：从前向后逐词匹配形容词/名词，跳过 的/地/得 粒子。
 * 最后一个匹配词视为"正在输入"（query），其前的词视为已确认前缀。
 * 这样用户输入"红"时，"红"是 query 而非 prefix，能看到"红色"等补全；
 * 输入"飞行的紫色的狗"时，"狗"是 query，前缀是"飞行的紫色的"。
 */
function segmentCjkCommitted(s: string): { prefix: string; remaining: string } {
  let i = 0;
  let lastWordStart = -1;
  let lastWordEnd = -1;
  while (i < s.length) {
    // 跳过粒子
    if (ADJ_PARTICLES.has(s[i])) {
      i++;
      continue;
    }
    // 最长匹配（形容词或名词），限界 6 字
    let matched = false;
    for (let len = Math.min(s.length - i, MAX_WORD_LEN); len >= 1; len--) {
      const word = s.slice(i, i + len);
      if (lookupAdjByCn(word) || cnExactId(word)) {
        lastWordStart = i;
        lastWordEnd = i + len;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }
  // 最后一个匹配词视为正在输入 → query；之前的视为已确认 → prefix
  if (lastWordStart >= 0 && lastWordEnd === i) {
    return { prefix: s.slice(0, lastWordStart), remaining: s.slice(lastWordStart) };
  }
  // 末尾有未匹配后缀或粒子 → 后缀为 query，匹配部分为 prefix
  return { prefix: s.slice(0, i), remaining: s.slice(i) };
}
