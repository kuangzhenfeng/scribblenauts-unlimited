/**
 * 题目挑选器 —— 关卡加载时按难度从题库随机抽题并装配为运行时 Challenge。
 *
 * 流程：按 tier+standard 过滤题库 → 种子洗牌（同 seed 可复现） → 取 challengeSlots 道
 * → 随机分配给本关 NPC → 装配为 Challenge（id 用 slot 语义，puzzle 用 object-present + typeId + adjectives）。
 *
 * 种子来源：levelId + tier + standard + 当日日期。同一玩家同一天同关同难度
 * 题目固定，跨天或换难度则变化；既保证"每次进入都不同"的体感，又可复现调试。
 */

import type { Challenge, LevelData, PuzzleCondition } from '@/core/types/level';
import type { DifficultyTier, DifficultyStandard, Question } from '@/core/types/question';
import { questionsByDifficulty } from './bank';
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
 */
export function pickChallenges(
  level: LevelData,
  tier: DifficultyTier,
  standard: DifficultyStandard,
  seedSalt: string,
): PickResult {
  const slots = level.challengeSlots ?? Math.min(level.npcs.length, 3);
  const pool = questionsByDifficulty(tier, standard);
  if (pool.length === 0) {
    return { challenges: [], npcSlots: [] };
  }

  // 种子：levelId + tier + standard + salt
  const seedStr = `${level.id}:${tier}:${standard}:${seedSalt}`;
  const rng = mulberry32(hashString(seedStr));
  const shuffled = shuffle([...pool], rng);

  // 取 slots 道，题库不足则循环补足（保证 slot 满）
  const picked = [];
  for (let i = 0; i < slots; i++) {
    picked.push(shuffled[i % shuffled.length]);
  }

  // NPC 分配：本关 npc 列表洗牌后按 slot 顺序取
  const npcPool = shuffle([...level.npcs], rng);
  const npcSlots: { slot: number; giverNpcId: string }[] = [];
  const challenges: Challenge[] = picked.map((q, i) => {
    const npc = npcPool[i % npcPool.length];
    npcSlots.push({ slot: i, giverNpcId: npc.id });
    const role = roleOf(npc.id);
    // 谜题条件装配：多答案题（answers 长度>1）→ any-of，每个 answer 一个
    // object-present；否则单答案 object-present（typeId + adjectives）。
    const conditions = buildConditions(q, npc.id);
    return {
      id: slotId(level.id, tier, standard, i),
      giverNpcId: npc.id,
      kind: i === slots - 1 ? 'starite-gate' : 'shard',
      puzzle: { conditions },
      reward: i === slots - 1 ? { type: 'starite' as const, count: 1 } : { type: 'shard' as const, count: 4 },
      // 角色名前缀双语：中文用全角冒号，英文用半角冒号；运行期由 L() 取当前语言
      dialog: [
        { zh: `${role.zh}：${q.prompt.zh}`, en: `${role.en}: ${q.prompt.en}` },
        q.hint ?? { zh: '', en: '' },
      ],
    };
  });

  return { challenges, npcSlots };
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
