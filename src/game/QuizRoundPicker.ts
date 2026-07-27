/**
 * 简易问答回合管理 —— 抽题 / 选提问生物 / 计回合 / 物品过期 / 积分。
 *
 * 职责边界：只管问答循环状态，不含渲染与输入（由 QuizScene 装配并驱动）。
 *
 * 流程：从题库按难度过滤后洗牌逐题消费 → 每题随机选一 creature 词条作为
 * 提问生物 → 玩家提交候选后由外部判定（QuizJudge）并决定是否切题；
 * 物品 ttl 跟踪，每切一题递减，归零销毁。
 *
 * 设计原则：纯逻辑、零 Phaser 依赖、可在 node 单测（除物品销毁回调由外部注入）。
 */

import type { Question, DifficultyTier, DifficultyStandard } from '@/core/types/question';
import { questionsByDifficulty } from '@/core/data/questions/bank';
import { allEntries } from '@/core/data/dictionary/Dictionary';
import type { DictEntry } from '@/core/types/dictionary';
import { hashString, mulberry32, shuffle } from '@/util/rng';
import { log } from '@/util/log';

/** 提问生物候选：creature 类词条（运行期由外部过滤出 atlas 已加载的子集） */
export function creaturePool(): DictEntry[] {
  return allEntries().filter((e) => e.category === 'creature');
}

/** 初始物品存活回合数 */
export const ITEM_TTL = 3;

export interface RoundState {
  /** 当前题序号（从 1 起） */
  round: number;
  /** 当前题目 */
  question: Question;
  /** 当前提问生物词条 */
  creature: DictEntry;
  /** 当前会话累计答对题数 */
  score: number;
}

/** 物品过期销毁回调（由 QuizScene 注入，销毁 GameObject + body） */
export type ExpireItem = (entityId: string) => void;

export class QuizRoundPicker {
  private pool: Question[] = [];
  private cursor = 0;
  private creatures: DictEntry[] = [];
  private round = 0;
  private score = 0;
  private rng: () => number;
  /** 难度档位（reshuffle 派生种子用） */
  private readonly tier: DifficultyTier;
  /** 难度定义方式（reshuffle 派生种子用） */
  private readonly standard: DifficultyStandard;
  /** 存档题目种子（reshuffle 派生种子用，不写回存档，不影响主游戏） */
  private readonly seedSalt: string;
  /** 会话内重洗计数器，递增派生新题序（不碰存档种子） */
  private nonce = 0;
  /** 待过期物品：entityId → 剩余回合数 */
  private readonly ttlMap = new Map<string, number>();

  constructor(
    tier: DifficultyTier,
    standard: DifficultyStandard,
    seedSalt: string,
  ) {
    this.tier = tier;
    this.standard = standard;
    this.seedSalt = seedSalt;
    const base = questionsByDifficulty(tier, standard);
    this.pool = base.length > 0 ? [...base] : [];
    this.rng = this._deriveRng();
    this.creatures = creaturePool();
    shuffle(this.pool, this.rng);
    log.info('quiz pool ready', { size: this.pool.length, creatures: this.creatures.length });
  }

  /** 以当前 nonce 派生 RNG：换 nonce = 换题序与提问生物序列，不碰存档种子 */
  private _deriveRng(): () => number {
    return mulberry32(hashString(`quiz:${this.tier}:${this.standard}:${this.seedSalt}:${this.nonce}`));
  }

  get currentRound(): number {
    return this.round;
  }

  get currentScore(): number {
    return this.score;
  }

  /** 当前是否还有题可出（题池为空时返回 false） */
  get hasQuestion(): boolean {
    return this.pool.length > 0;
  }

  /** 取下一题 + 选随机提问生物，推进回合。题池耗尽自动重新洗牌。 */
  next(): RoundState | undefined {
    if (this.pool.length === 0) return undefined;
    if (this.cursor >= this.pool.length) {
      shuffle(this.pool, this.rng);
      this.cursor = 0;
    }
    const question = this.pool[this.cursor++];
    const creature = this.creatures[Math.floor(this.rng() * this.creatures.length)] ?? this.creatures[0];
    this.round++;
    return { round: this.round, question, creature, score: this.score };
  }

  /** 记录一次答对，积分+1 */
  scoreUp(): void {
    this.score++;
  }

  /** 登记一个新生成物品，初始 ttl=3 */
  trackItem(entityId: string): void {
    this.ttlMap.set(entityId, ITEM_TTL);
  }

  /** 推进一回合：所有待过期物品 ttl-1，归零的触发回调销毁。返回被销毁的 id 列表。 */
  tickItems(expire: ExpireItem): string[] {
    const expired: string[] = [];
    for (const [id, ttl] of this.ttlMap) {
      const next = ttl - 1;
      if (next <= 0) {
        this.ttlMap.delete(id);
        expired.push(id);
        expire(id);
      } else {
        this.ttlMap.set(id, next);
      }
    }
    return expired;
  }

  /** 清空全部跟踪物品（切场景/重开时调用，不触发销毁回调） */
  clearItems(): void {
    this.ttlMap.clear();
  }

  /**
   * 会话内重洗：递增 nonce → 派生新 RNG → 重洗题池 → 重置 cursor/round/score。
   * 不碰存档种子，不影响主游戏题序；调用方负责清场与切下一题。
   * 最高分由外部持久化，这里只清当前局分数。
   */
  reshuffle(): void {
    this.nonce++;
    this.rng = this._deriveRng();
    shuffle(this.pool, this.rng);
    this.cursor = 0;
    this.round = 0;
    this.score = 0;
    this.clearItems();
    log.info('quiz reshuffled', { nonce: this.nonce });
  }
}
