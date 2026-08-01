/**
 * 题目挑选器 —— 关卡加载时按难度从题库随机抽题并装配为运行时 Challenge。
 *
 * 流程：先保留关卡 authoredChallenges，再按 tier+standard 过滤题库 → 种子洗牌
 * → 用随机题补足 challengeSlots → 分配给本关 NPC → 装配为运行时 Challenge。
 *
 * 种子来源：levelId + tier + standard + 当日日期。同一玩家同一天同关同难度
 * 题目固定，跨天或换难度则变化；既保证"每次进入都不同"的体感，又可复现调试。
 */

import type { Challenge, LevelData, PuzzleCondition } from '@/core/types/level';
import type { DifficultyTier, DifficultyStandard, Question } from '@/core/types/question';
import { questionsByDifficulty } from './bank';
import { isBasicQuestion } from './a1-vocabulary';
import { hashString, mulberry32, shuffle } from '@/util/rng';

/** slot id 格式：{levelId}:{tier}:{standard}:{slotIndex}，供存档去重 */
export function slotId(levelId: string, tier: DifficultyTier, standard: DifficultyStandard, slot: number): string {
  return `${levelId}:${tier}:${standard}:${slot}`;
}

/** NPC 角色名映射（按 npcSpawnId → 双语角色名，用于 dialog 前缀） */
const NPC_ROLE: Record<string, { zh: string; en: string }> = {
  'npc-explorer': { zh: '探险者', en: 'Explorer' },
  'npc-miner': { zh: '矿工', en: 'Miner' },
  'npc-cartographer': { zh: '制图师', en: 'Cartographer' },
  'npc-treasurer': { zh: '司库', en: 'Treasurer' },
  'npc-hunter': { zh: '猎人', en: 'Hunter' },
  'npc-botanist': { zh: '植物学家', en: 'Botanist' },
  'npc-farmer': { zh: '农夫', en: 'Farmer' },
  'npc-fisherman': { zh: '渔夫', en: 'Fisherman' },
  'npc-pilot': { zh: '飞行员', en: 'Pilot' },
  'npc-vulcanologist': { zh: '火山学家', en: 'Vulcanologist' },
  'npc-icefisher': { zh: '冰钓者', en: 'Ice Fisher' },
  'npc-merchant': { zh: '商人', en: 'Merchant' },
  'npc-nomad': { zh: '游牧民', en: 'Nomad' },
  'npc-geomancer': { zh: '地卜师', en: 'Geomancer' },
};

function roleOf(npcId: string): { zh: string; en: string } {
  return NPC_ROLE[npcId] ?? { zh: '路人', en: 'NPC' };
}

export interface PickResult {
  challenges: Challenge[];
  /** slot → giverNpcId 映射，供外部查询 */
  npcSlots: { slot: number; giverNpcId: string }[];
}

/**
 * 按难度为本关抽题并装配 Challenge。
 *
 * @param level 关卡数据（取 npc 列表与 challengeSlots）
 * @param tier 难度档
 * @param standard 难度标准
 * @param seedSalt 种子盐（如日期字符串），同盐+同关+同难度 → 同题序
 * @param filterBasic 过滤 A1 基础题（答案全为 CEFR A1 级词汇的题目）
 */
export function pickChallenges(
  level: LevelData,
  tier: DifficultyTier,
  standard: DifficultyStandard,
  seedSalt: string,
  filterBasic = false,
): PickResult {
  const requestedSlots = level.challengeSlots ?? Math.min(level.npcs.length, 3);
  const slots = normalizeSlots(requestedSlots);
  // 没有 NPC 时无法建立 near 条件；此前 slots>0 会在 npcPool[i % 0] 处产生 undefined。
  if (slots === 0 || level.npcs.length === 0) {
    return { challenges: [], npcSlots: [] };
  }

  const authored = (level.authoredChallenges ?? [])
    .filter((ch) => level.npcs.some((npc) => npc.id === ch.giverNpcId))
    .slice(0, slots)
    .map((challenge, slot) => ({
      ...challenge,
      // authored id 只作为模板名；运行时统一使用存档可识别的难度槽 id。
      id: slotId(level.id, tier, standard, slot),
    }));
  const authoredCount = authored.length;
  const pool = questionsByDifficulty(tier, standard);
  const filtered = (filterBasic ? pool.filter((q) => !isBasicQuestion(q)) : pool).filter(isUsableQuestion);
  // authored 关卡仍可独立运行；题库为空时只返回已写作挑战，不生成 undefined 题目。
  const generatedSlots = filtered.length === 0 ? 0 : slots - authoredCount;
  if (generatedSlots > 0 && filtered.length === 0 && authoredCount === 0) {
    return { challenges: [], npcSlots: [] };
  }

  // 种子：levelId + tier + standard + salt
  const seedStr = `${level.id}:${tier}:${standard}:${seedSalt}`;
  const rng = mulberry32(hashString(seedStr));
  const shuffled = shuffle([...filtered], rng);

  // 取 slots 道，题库不足则循环补足（保证 slot 满）
  const picked = [];
  for (let i = 0; i < generatedSlots; i++) {
    picked.push(shuffled[i % shuffled.length]);
  }

  // NPC 分配：本关 npc 列表洗牌后按 slot 顺序取
  const npcPool = shuffle([...level.npcs], rng);
  const npcSlots: { slot: number; giverNpcId: string }[] = [];
  const challenges: Challenge[] = authored.map((challenge, i) => {
    npcSlots.push({ slot: i, giverNpcId: challenge.giverNpcId });
    return challenge;
  });
  picked.forEach((q, i) => {
    const slot = authoredCount + i;
    const npc = npcPool[slot % npcPool.length];
    npcSlots.push({ slot, giverNpcId: npc.id });
    const role = roleOf(npc.id);
    // 谜题条件装配：多答案题（answers 长度>1）→ any-of，每个 answer 一个
    // object-present；否则单答案 object-present（typeId + adjectives）。
    const conditions = buildConditions(q, npc.id);
    challenges.push({
      id: slotId(level.id, tier, standard, slot),
      giverNpcId: npc.id,
      kind: slot === slots - 1 ? 'starite-gate' : 'shard',
      puzzle: { conditions },
      reward: slot === slots - 1 ? { type: 'starite' as const, count: 1 } : { type: 'shard' as const, count: 4 },
      // 角色名前缀双语：中文用全角冒号，英文用半角冒号；运行期由 L() 取当前语言
      dialog: [
        { zh: `${role.zh}：${q.prompt.zh}`, en: `${role.en}: ${q.prompt.en}` },
        q.hint ?? { zh: '', en: '' },
      ],
    });
  });

  return { challenges, npcSlots };
}

function normalizeSlots(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function isUsableQuestion(q: Question): boolean {
  if (q.answers !== undefined) {
    return q.answers.length > 0 && q.answers.every((answer) => answer.typeId.length > 0);
  }
  return typeof q.typeId === 'string' && q.typeId.length > 0;
}

/** 按 Question 装配谜题条件：多答案题 → any-of，单答案题 → object-present */
function buildConditions(q: Question, npcId: string): PuzzleCondition[] {
  const radius = 220;
  // 多答案题：每个 answer 一个 object-present，包进 any-of（任一即过关）
  if (q.answers && q.answers.length > 1) {
    return [
      {
        kind: 'any-of' as const,
        conditions: q.answers.map((a) => ({
          kind: 'object-present' as const,
          typeId: a.typeId,
          adjectives: a.adjectives,
          near: { npcId, radius },
        })),
      },
    ];
  }
  // 单答案题：直接 object-present（typeId + 可选 adjectives）
  return [
    {
      kind: 'object-present' as const,
      typeId: q.typeId!,
      adjectives: q.adjectives,
      near: { npcId, radius },
    },
  ];
}
