/**
 * 简易问答判定 —— 答案是否命中题目。
 *
 * 复用 GoalSystem object-present 的"形容词超集"校验思路，去掉 NPC/半径/LevelData
 * 依赖，简化为纯函数：单答案题精确匹配 typeId + 形容词超集；多答案题任一命中即正确。
 *
 * 设计原则：纯函数、零依赖、可在 node 单测。
 */

import type { Question } from '@/core/types/question';
import type { ParseCandidate } from '@/core/lex/InputParser';

/**
 * 判定生成的候选是否为该题的正确答案。
 *
 * 单答案题（typeId + adjectives）：noun.entryId 精确匹配 typeId，且候选
 * adjectives 须为题目 adjectives 的超集（如"红色的鸟"要求带 red）。
 * 多答案题（answers[]）：任一 answer 满足上述条件即正确。
 */
export function checkAnswer(question: Question, candidate: ParseCandidate): boolean {
  // 多答案题：任一 answer 命中即正确
  if (question.answers && question.answers.length > 0) {
    return question.answers.some((ans) => matchesAnswer(candidate, ans.typeId, ans.adjectives));
  }
  // 单答案题
  return matchesAnswer(candidate, question.typeId, question.adjectives);
}

/** 候选 noun 是否匹配 typeId，且形容词为要求 adjectives 的超集 */
function matchesAnswer(
  candidate: ParseCandidate,
  typeId: string | undefined,
  adjectives: string[] | undefined,
): boolean {
  if (!typeId) return false;
  if (candidate.noun.entryId !== typeId) return false;
  if (adjectives && adjectives.length > 0) {
    const applied = candidate.adjectives.map((a) => a.adjId);
    return adjectives.every((adj) => applied.includes(adj));
  }
  return true;
}
