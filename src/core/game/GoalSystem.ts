/**
 * 目标系统 —— 评估当前激活挑战的谜题条件，满足则发奖、推进剧情。
 *
 * Starite 计数：完整 Starite 或 10 碎片换 1 Starite。
 * 达阈值解除石化诅咒 = 通关。
 *
 * 与旧项目差异：PuzzleCondition 只实现首期 4 种（删除 entity-at/npc-state/counter 占位）。
 * 依赖 EntityQuery 抽象（core 层），不耦合 EntityManager 具体实现。
 */

import type { LevelData, PuzzleCondition } from '@/core/types/level';
import type { Entity, EntityQuery } from '@/core/entity/Entity';
import { log } from '@/util/log';
import { L } from '@/core/i18n/I18n';

/** 进度回调：当 Starite/碎片计数变化时通知 UI */
export interface ProgressCallbacks {
  onShard: (total: number) => void;
  onStarite: (total: number) => void;
  onChallengeComplete: (challengeId: string, dialogZh: string) => void;
  onWin: () => void;
  /** 进度变化时通知持久化（完成挑战即写盘） */
  onProgress?: (starites: number, shards: number, completed: string[]) => void;
}

/** 10 碎片换 1 Starite */
const SHARDS_PER_STARITE = 10;
/** 通关所需 Starite 数 */
const WIN_STARITE = 3;

export class GoalSystem {
  private shards = 0;
  private starites = 0;
  private won = false;

  constructor(
    private readonly entities: EntityQuery,
    private readonly level: LevelRef,
    private readonly cb: ProgressCallbacks,
  ) {}

  get shardCount(): number {
    return this.shards;
  }
  get stariteCount(): number {
    return this.starites;
  }

  /** 每 tick 评估当前关卡的挑战 */
  evaluate(): void {
    const lvl = this.level.currentLevel;
    if (!lvl?.challenges) return;
    for (const ch of lvl.challenges) {
      if (this.level.isChallengeDone(ch.id)) continue;
      if (this.allConditionsMet(ch.puzzle.conditions)) {
        this.completeChallenge(ch);
      }
    }
  }

  private completeChallenge(ch: NonNullable<LevelData['challenges']>[number]): void {
    this.level.markChallengeDone(ch.id);
    if (ch.reward.type === 'shard') {
      this.shards += ch.reward.count;
      this.cb.onShard(this.shards);
      while (this.shards >= SHARDS_PER_STARITE) {
        this.shards -= SHARDS_PER_STARITE;
        this.starites += 1;
        this.cb.onStarite(this.starites);
      }
    } else {
      this.starites += ch.reward.count;
      this.cb.onStarite(this.starites);
    }
    const lastDialog = L(ch.dialog[ch.dialog.length - 1]);
    this.cb.onChallengeComplete(ch.id, lastDialog);
    log.info('challenge complete', { id: ch.id, starites: this.starites, shards: this.shards });
    this.cb.onProgress?.(this.starites, this.shards, this.level.completedArray());
    if (this.starites >= WIN_STARITE && !this.won) {
      this.won = true;
      this.cb.onWin();
    }
  }

  /** 从存档恢复：设计数 + 标记已完成挑战（避免 loadLevel 后 evaluate 重复发奖） */
  restore(starites: number, shards: number, completed: string[]): void {
    this.starites = starites;
    this.shards = shards;
    for (const id of completed) this.level.markChallengeDone(id);
    if (starites >= WIN_STARITE) this.won = true;
  }

  private allConditionsMet(conditions: PuzzleCondition[]): boolean {
    for (const c of conditions) {
      if (!this.conditionMet(c)) return false;
    }
    return true;
  }

  private conditionMet(c: PuzzleCondition): boolean {
    switch (c.kind) {
      case 'object-present':
        return this.hasObjectNear(c.typeId, c.adjectives, c.near.npcId, c.near.radius);
      case 'object-destroyed':
        return !this.hasEntityOfType(c.typeId);
      case 'all-of':
        return c.conditions.every((sub) => this.conditionMet(sub));
      case 'any-of':
        return c.conditions.some((sub) => this.conditionMet(sub));
      default:
        return false;
    }
  }

  private hasObjectNear(
    typeId: string,
    adjectives: string[] | undefined,
    npcId: string,
    radius: number,
  ): boolean {
    const npcEntityId = this.level.npcEntityId(npcId);
    if (!npcEntityId) return false;
    const npc = this.entities.get(npcEntityId);
    if (!npc) return false;
    const nx = npc.bodyPositionX;
    const ny = npc.bodyPositionY;
    const r2 = radius * radius;
    for (const e of this.entities.all()) {
      if (e.typeId !== typeId) continue;
      // 形容词校验：实体 appliedAdjectives 须为题目要求 adjectives 的超集
      if (adjectives && adjectives.length > 0) {
        const applied = e.appliedAdjectives;
        if (!applied || !adjectives.every((a) => applied.has(a))) continue;
      }
      const dx = e.bodyPositionX - nx;
      const dy = e.bodyPositionY - ny;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  private hasEntityOfType(typeId: string): boolean {
    for (const e of this.entities.all()) {
      if (e.typeId === typeId) return true;
    }
    return false;
  }
}

/** 占位：LevelRef 由 game 层实现，提供当前关卡/挑战完成集合/NPC 实体 id 映射 */
export interface LevelRef {
  readonly currentLevel: LevelData | null;
  isChallengeDone(id: string): boolean;
  markChallengeDone(id: string): void;
  completedArray(): string[];
  npcEntityId(npcId: string): string | undefined;
}

/** 工具：按实体距离判定（供 BehaviorSystem 等复用） */
export function nearestEntity(subject: Entity, list: Entity[], maxRadius: number): Entity | undefined {
  const r2 = maxRadius * maxRadius;
  let best: Entity | undefined;
  let bestD = Infinity;
  for (const e of list) {
    if (e === subject) continue;
    const dx = e.bodyPositionX - subject.bodyPositionX;
    const dy = e.bodyPositionY - subject.bodyPositionY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestD) {
      bestD = d2;
      best = e;
    }
  }
  return best;
}
