/**
 * 行为系统 —— 状态计时、AI、形容词行为联动。
 *
 * 处理 burning/frozen/electrified 等状态的计时与解冻、
 * 形容词 flying 的反重力；词条 behaviors 声明的 AI（wander/follow/flee/attack）
 * 在此分发为转向运动学。tick 规则（如 burning-tick）由 RuleEngine 负责，
 * 此处补持续效果与生物自主行为。
 *
 * 对话中的 NPC 暂停 AI：DialogSystem 暴露 dialogActiveEntityId，
 * 命中时跳过 steer 并清零水平速度，气泡稳定可读，避免气泡跟着 NPC 抖动难以看清。
 */

import type { EntityManager } from '@/game/EntityManager';
import type { EffectDeps } from '@/core/rules/effects';
import { damageEntity } from '@/core/rules/effects';
import type { GameEntity } from '@/game/Entity';
import { PLAYER_CONTROLLED_MOUNT } from '@/game/PlayerController';

/** AI 转向速度（世界像素/帧） */
const AI_SPEED = 1.5;
/** follow 触发距离 */
const FOLLOW_RANGE = 200;
/** attack 触发距离 */
const ATTACK_RANGE = 40;
/** attack 伤害 */
const ATTACK_DAMAGE = 10;
/** attack 冷却毫秒 */
const ATTACK_COOLDOWN = 1000;
/** 中毒持续伤害间隔 */
const POISON_TICK_INTERVAL = 1000;
/** 睡眠状态最长持续时间 */
const SLEEP_DURATION = 3000;
/** wander 方向持续时长（毫秒） */
const WANDER_MIN = 800;
const WANDER_MAX = 2000;
/** wander 游荡半径（像素），超出后强制转身回锚点 */
const WANDER_RADIUS = 80;
/** 飞行反重力补偿 */
const FLY_LIFT = 0.0011;
/** 投射物最长存在时间，避免落空的子弹/箭永久留在世界中。 */
const PROJECTILE_LIFETIME = 2200;

export class BehaviorSystem {
  constructor(
    private readonly entities: EntityManager,
    private readonly now: () => number,
    private readonly deps: EffectDeps,
    /** 当前对话中的 NPC 实体 id getter（命中时暂停该实体 AI）；对齐 now getter 的延迟绑定模式 */
    private readonly dialogActiveEntityId: () => string | undefined = () => undefined,
  ) {}

  update(): void {
    const player = this.entities.getPlayer() as GameEntity | undefined;
    const dialogEid = this.dialogActiveEntityId();
    const now = this.now();
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      const tags = ge.tags;
      this.updateTimedStates(ge, now);

      if (tags.hasState('dead') && !ge.dead) {
        ge.dead = true;
        ge.state.locomotion = 'dead';
      }
      if (tags.hasState('poisoned') && !ge.dead && this.shouldTick(ge, 'poison-tick', now, POISON_TICK_INTERVAL)) {
        damageEntity(ge, 8, this.deps);
      }

      if (tags.hasFlag('projectile') && !ge.dead) {
        const timers = ge.stateTimers ?? (ge.stateTimers = new Map<string, number>());
        const expireAt = timers.get('projectile-expire-at') ?? now + PROJECTILE_LIFETIME;
        timers.set('projectile-expire-at', expireAt);
        if (now >= expireAt) {
          ge.dead = true;
          this.deps.destroyEntity(ge);
          continue;
        }
      }

      // 玩家接管的坐骑由 PlayerController 驱动，不能再被 AI 改写速度或 locomotion。
      if (ge.aiMem?.get(PLAYER_CONTROLLED_MOUNT) === true) continue;

      // 冻结、石化、睡眠和死亡都会锁定移动；玩家仍由 PlayerController 处理。
      if (ge.isPlayer && !ge.dead) continue;
      const kinds = this.behaviorKinds(ge);
      if (this.isMovementLocked(ge, kinds)) {
        this.stopMovement(ge);
        continue;
      }

      if (kinds.size === 0) continue;
      // 飞行：施加向上的力抵消重力并悬浮。形容词标签与 BehaviorSpec 共用此分支。
      if (kinds.has('fly')) {
        const mass = (ge.body as { mass: number }).mass;
        ge.applyImpulse([0, -1], mass * FLY_LIFT);
      }
      // 对话中的 NPC 暂停 AI：清零水平速度 + 进入 idle，气泡稳定可读
      if (dialogEid !== undefined && ge.id === dialogEid) {
        const bodyVel = (ge.body as { velocity: { x: number; y: number } }).velocity;
        ge.setBodyVelocity(0, bodyVel.y);
        ge.state.locomotion = 'idle';
        continue;
      }
      this.steer(ge, player, kinds);
    }
  }

  private steer(e: GameEntity, player: GameEntity | undefined, kinds: Set<string>): void {
    const bodyVel = (e.body as { velocity: { x: number; y: number } }).velocity;
    // attack
    if (kinds.has('attack') && player) {
      const dx = player.bodyPositionX - e.bodyPositionX;
      const dy = player.bodyPositionY - e.bodyPositionY;
      if (dx * dx + dy * dy <= ATTACK_RANGE * ATTACK_RANGE) {
        const mem = e.aiMem ?? (e.aiMem = new Map<string, unknown>());
        const until = (mem.get('attackUntil') as number) ?? 0;
        if (this.now() >= until) {
          damageEntity(player, ATTACK_DAMAGE, this.deps);
          mem.set('attackUntil', this.now() + ATTACK_COOLDOWN);
        }
      }
    }
    // 转向优先级：flee > follow > wander
    let dir = 0;
    if (kinds.has('flee') && player) {
      const dx = player.bodyPositionX - e.bodyPositionX;
      dir = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : dx > 0 ? -1 : 1;
    } else if (kinds.has('follow') && player) {
      const dx = player.bodyPositionX - e.bodyPositionX;
      // 保留死区避免原地抖动；follow 无距离上限（超出范围由 flee/wander 各自分支处理）
      dir = Math.abs(dx) > FOLLOW_RANGE * 0.3 ? (dx > 0 ? 1 : -1) : 0;
    } else if (kinds.has('wander')) {
      dir = this.wanderDir(e);
    }
    // 根据行为类型确定正确的 locomotion 状态（飞行/游泳不回落到 walk/idle）
    const isFly = kinds.has('fly');
    const moveState = isFly ? 'fly' : kinds.has('swim') ? 'swim' : 'walk';
    const restState = moveState === 'walk' ? 'idle' : moveState;
    // 飞行生物每帧直接控制 Y 速度（缓慢上下浮动），抵消重力累积
    const vy = isFly ? Math.sin(this.now() * 0.002) * 0.2 : bodyVel.y;
    if (dir !== 0) {
      e.setBodyVelocity(dir * AI_SPEED, vy);
      e.state.locomotion = moveState;
      e.state.facing = dir > 0 ? 1 : -1;
    } else {
      e.setBodyVelocity(0, vy);
      e.state.locomotion = restState;
    }
  }

  /** BehaviorSpec 与 TagSet 行为标签的规范化视图。 */
  private behaviorKinds(e: GameEntity): Set<string> {
    const kinds = new Set<string>();
    for (const behavior of e.behaviors ?? []) kinds.add(normalizeBehaviorKind(behavior.kind));
    for (const behavior of e.tags.behavior) kinds.add(normalizeBehaviorKind(behavior));
    return kinds;
  }

  /** 处理有明确运行时意义的状态计时。 */
  private updateTimedStates(e: GameEntity, now: number): void {
    const tags = e.tags;
    const timers = e.stateTimers ?? (e.stateTimers = new Map());

    if (tags.hasState('electrified')) {
      const t = timers.get('electrified-expire');
      if (t === undefined) timers.set('electrified-expire', now + 2000);
      else if (now > t) {
        tags.removeState('electrified');
        e.state.stateLayer.delete('state:electrified');
        timers.delete('electrified-expire');
      }
    }

    if (tags.hasState('sleeping')) {
      const t = timers.get('sleeping-expire');
      if (t === undefined) timers.set('sleeping-expire', now + SLEEP_DURATION);
      else if (now > t) {
        tags.removeState('sleeping');
        e.state.stateLayer.delete('state:sleeping');
        timers.delete('sleeping-expire');
      }
    } else {
      timers.delete('sleeping-expire');
    }
  }

  private shouldTick(e: GameEntity, key: string, now: number, interval: number): boolean {
    const timers = e.stateTimers ?? (e.stateTimers = new Map());
    const next = timers.get(key);
    if (next === undefined) {
      timers.set(key, now + interval);
      return false;
    }
    if (now < next) return false;
    timers.set(key, now + interval);
    return true;
  }

  private isMovementLocked(e: GameEntity, kinds: Set<string>): boolean {
    return e.dead
      || kinds.has('sleep')
      || e.tags.hasState('frozen')
      || e.tags.hasState('petrified')
      || e.tags.hasState('sleeping');
  }

  private stopMovement(e: GameEntity): void {
    const bodyVel = (e.body as { velocity: { x: number; y: number } }).velocity;
    e.setBodyVelocity(0, e.dead ? 0 : bodyVel.y);
    e.state.locomotion = e.dead ? 'dead' : 'idle';
  }

  private wanderDir(e: GameEntity): number {
    const mem = e.aiMem ?? (e.aiMem = new Map<string, unknown>());
    // 首次游荡时记录出生位置作为锚点
    if (!mem.has('homeX')) {
      mem.set('homeX', e.bodyPositionX);
    }
    const homeX = mem.get('homeX') as number;
    const dx = e.bodyPositionX - homeX;
    // 超出游荡半径时强制转身回锚点，并同步重置游荡方向与计时，
    // 避免边界附近旧 wanderDir 与回弹方向每帧交替翻转（NPC 左右抽动）
    if (Math.abs(dx) > WANDER_RADIUS) {
      const dir = dx > 0 ? -1 : 1;
      mem.set('wanderDir', dir);
      const dur = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
      mem.set('wanderUntil', this.now() + dur);
      return dir;
    }
    const until = (mem.get('wanderUntil') as number) ?? 0;
    if (this.now() >= until) {
      const r = Math.random();
      const dir = r < 0.5 ? 0 : r < 0.75 ? -1 : 1;
      mem.set('wanderDir', dir);
      const dur = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
      mem.set('wanderUntil', this.now() + dur);
    }
    return (mem.get('wanderDir') as number) ?? 0;
  }
}

/** 将词条中的动作名和 TagSet 的进行时标签统一到 BehaviorSystem 内部动作名。 */
function normalizeBehaviorKind(kind: string): string {
  switch (kind) {
    case 'walking': return 'walk';
    case 'flying': return 'fly';
    case 'swimming': return 'swim';
    case 'sleeping': return 'sleep';
    default: return kind;
  }
}
