/**
 * 目标系统 —— 评估当前激活挑战的谜题条件，满足则发奖、推进剧情。
 *
 * Starite 计数：完整 Starite 或 10 碎片换 1 Starite。
 * 达阈值解除石化诅咒 = 通关。
 *
 * PuzzleCondition 同时支持首期四种兼容条件、数量/区域筛选、NPC 状态与有序阶段。
 * 依赖 EntityQuery 抽象（core 层），不耦合 EntityManager 具体实现。
 */

import type { LevelData, PuzzleCondition } from '@/core/types/level';
import type { Entity, EntityQuery } from '@/core/entity/Entity';
import type { BehaviorTag, StateTag } from '@/core/types/rules';
import type { EffectResultQuery } from './EffectResultLog';
import { log } from '@/util/log';
import { L } from '@/core/i18n/I18n';
import { STORY_CURSE_BREAK_STARITES } from './StoryProgress';
import { objectShardTaskForTypeId, type ObjectShardTask } from '@/core/data/starite/object-shards';

export interface ProgressSnapshot {
  starites: number;
  shards: number;
  completed: string[];
  objectShards: number;
  objectShardStarites: number;
  completedObjectShardTasks: string[];
}

/** 进度回调：当 Starite/碎片计数变化时通知 UI */
export interface ProgressCallbacks {
  onShard: (total: number) => void;
  onStarite: (total: number) => void;
  /** 首次召唤一个 Object Shard 目录词条时触发。 */
  onObjectShard?: (task: ObjectShardTask, objectShards: number, starites: number) => void;
  onChallengeComplete: (challengeId: string, dialogZh: string) => void;
  onWin: () => void;
  /** 进度变化时通知持久化（完成挑战即写盘） */
  onProgress?: (snapshot: ProgressSnapshot) => void | Promise<void>;
}

/** 10 碎片换 1 Starite */
const SHARDS_PER_STARITE = 10;
/** 通关所需 Starite 数 */
const WIN_STARITE = STORY_CURSE_BREAK_STARITES;

export class GoalSystem {
  private shards = 0;
  private starites = 0;
  private objectShards = 0;
  private objectShardStarites = 0;
  private readonly completedObjectShardTasks = new Set<string>();
  private won = false;
  /** 有序条件的阶段游标只属于本次运行，挑战完成后不会再次评估。 */
  private readonly sequenceProgress = new Map<string, number>();

  constructor(
    private readonly entities: EntityQuery,
    private readonly level: LevelRef,
    private readonly cb: ProgressCallbacks,
    private readonly effectResults: EffectResultQuery = { has: () => false },
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
      if (this.challengeMet(ch)) {
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
    this.emitProgress();
    if (this.starites >= WIN_STARITE && !this.won) {
      this.won = true;
      this.cb.onWin();
    }
  }

  /**
   * 记录玩家首次召唤的 Object Shard 词条。
   *
   * 任务跨关且非排他：同一词条只完成一次，10 个 Object Shard 自动兑换
   * 一个 Starite，并把来源单独记录以便重置普通挑战时保留该成果。
   */
  recordObjectType(typeId: string): ObjectShardTask | undefined {
    const task = objectShardTaskForTypeId(typeId);
    if (!task || this.completedObjectShardTasks.has(task.id)) return undefined;

    this.completedObjectShardTasks.add(task.id);
    this.objectShards += 1;
    while (this.objectShards >= SHARDS_PER_STARITE) {
      this.objectShards -= SHARDS_PER_STARITE;
      this.starites += 1;
      this.objectShardStarites += 1;
      this.cb.onStarite(this.starites);
    }
    this.cb.onObjectShard?.(task, this.objectShards, this.starites);
    log.info('object shard completed', {
      taskId: task.id,
      typeId: task.typeId,
      objectShards: this.objectShards,
      starites: this.starites,
    });
    this.emitProgress();
    if (this.starites >= WIN_STARITE && !this.won) {
      this.won = true;
      this.cb.onWin();
    }
    return task;
  }

  /** 从存档恢复：设计数 + 标记已完成挑战（避免 loadLevel 后 evaluate 重复发奖） */
  restore(
    starites: number,
    shards: number,
    completed: string[],
    objectShards = 0,
    completedObjectShardTasks: string[] = [],
    objectShardStarites = 0,
  ): void {
    this.starites = Math.max(0, starites);
    this.shards = Math.max(0, shards);
    this.objectShards = Math.max(0, objectShards);
    this.objectShardStarites = Math.min(this.starites, Math.max(0, objectShardStarites));
    this.completedObjectShardTasks.clear();
    for (const id of completedObjectShardTasks) this.completedObjectShardTasks.add(id);
    this.sequenceProgress.clear();
    for (const id of completed) this.level.markChallengeDone(id);
    if (this.starites >= WIN_STARITE) this.won = true;
  }

  get objectShardCount(): number {
    return this.objectShards;
  }

  get objectShardStariteCount(): number {
    return this.objectShardStarites;
  }

  completedObjectShardTaskIds(): string[] {
    return [...this.completedObjectShardTasks];
  }

  private challengeMet(ch: NonNullable<LevelData['challenges']>[number]): boolean {
    const stages = [ch.puzzle, ...(ch.stages ?? [])];
    const stageKey = `challenge:${ch.id}`;
    let stage = this.sequenceProgress.get(stageKey) ?? 0;
    while (stage < stages.length && this.allConditionsMet(stages[stage].conditions, `${stageKey}:${stage}`)) {
      stage += 1;
    }
    this.sequenceProgress.set(stageKey, stage);
    return stage >= stages.length;
  }

  private allConditionsMet(conditions: PuzzleCondition[], progressKey: string): boolean {
    return conditions.every((c, index) => this.conditionMet(c, `${progressKey}:${index}`));
  }

  private conditionMet(c: PuzzleCondition, progressKey: string): boolean {
    switch (c.kind) {
      case 'object-present':
        return this.countMatchingEntities(c.typeId, c.adjectives, c.near, c.region) >= normalizeCount(c.count, 1);
      case 'object-destroyed':
        return this.effectResults.has({
          kind: 'destroy',
          targetTypeId: c.typeId,
          sourceTypeId: c.sourceTypeId,
          ruleId: c.ruleId,
          region: c.region,
        });
      case 'counter':
        return this.countMatchingEntities(c.typeId, c.adjectives, c.near, c.region) >= normalizeCount(c.count, 0);
      case 'entity-at':
        return this.countMatchingEntities(c.typeId, c.adjectives, undefined, c.region) >= normalizeCount(c.count, 1);
      case 'npc-state':
        return this.npcHasState(c.npcId, c.states, c.mode);
      case 'sequence': {
        let stage = this.sequenceProgress.get(progressKey) ?? 0;
        while (stage < c.conditions.length && this.conditionMet(c.conditions[stage], `${progressKey}:${stage}`)) {
          stage += 1;
        }
        this.sequenceProgress.set(progressKey, stage);
        return stage >= c.conditions.length;
      }
      case 'all-of':
        return this.allConditionsMet(c.conditions, `${progressKey}:all`);
      case 'any-of':
        return c.conditions.some((sub, index) => this.conditionMet(sub, `${progressKey}:any:${index}`));
      default:
        return false;
    }
  }

  private countMatchingEntities(
    typeId: string,
    adjectives: string[] | undefined,
    near: { npcId: string; radius: number } | undefined,
    region: { minX: number; minY: number; maxX: number; maxY: number } | undefined,
  ): number {
    let nearPoint: { x: number; y: number; r2: number } | undefined;
    if (near) {
      const npcEntityId = this.level.npcEntityId(near.npcId);
      if (!npcEntityId) return 0;
      const npc = this.entities.get(npcEntityId);
      if (!npc) return 0;
      nearPoint = { x: npc.bodyPositionX, y: npc.bodyPositionY, r2: near.radius * near.radius };
    }
    let count = 0;
    for (const e of this.entities.all()) {
      if (e.typeId !== typeId) continue;
      if (e.dead) continue;
      // 形容词校验：实体 appliedAdjectives 须为题目要求 adjectives 的超集
      if (adjectives && adjectives.length > 0) {
        const applied = e.appliedAdjectives;
        if (!applied || !adjectives.every((a) => applied.has(a))) continue;
      }
      if (nearPoint) {
        const dx = e.bodyPositionX - nearPoint.x;
        const dy = e.bodyPositionY - nearPoint.y;
        if (dx * dx + dy * dy > nearPoint.r2) continue;
      }
      if (region && !insideRegion(e.bodyPositionX, e.bodyPositionY, region)) continue;
      count += 1;
    }
    return count;
  }

  private npcHasState(npcId: string, states: string[], mode: 'all' | 'any' = 'all'): boolean {
    if (states.length === 0) return false;
    const entityId = this.level.npcEntityId(npcId);
    if (!entityId) return false;
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    const hasState = (state: string): boolean => {
      if (state === 'dead') return entity.dead === true || entity.tags?.hasState('dead') === true;
      if (state === entity.state.locomotion) return true;
      if (entity.state.stateLayer.has(state) || entity.state.stateLayer.has(`state:${state}`)) return true;
      return entity.tags?.state.has(state as StateTag) === true || entity.tags?.behavior.has(state as BehaviorTag) === true;
    };
    return mode === 'any' ? states.some(hasState) : states.every(hasState);
  }

  private emitProgress(): void {
    this.cb.onProgress?.({
      starites: this.starites,
      shards: this.shards,
      completed: this.level.completedArray(),
      objectShards: this.objectShards,
      objectShardStarites: this.objectShardStarites,
      completedObjectShardTasks: this.completedObjectShardTaskIds(),
    });
  }
}

function normalizeCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function insideRegion(
  x: number,
  y: number,
  region: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY;
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
