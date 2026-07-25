/**
 * 行为系统 —— 状态计时、AI、形容词行为联动。
 *
 * 处理 burning/frozen/electrified 等状态的计时与解冻、
 * 形容词 flying 的反重力；词条 behaviors 声明的 AI（wander/follow/flee/attack）
 * 在此分发为转向运动学。tick 规则（如 burning-tick）由 RuleEngine 负责，
 * 此处补持续效果与生物自主行为。
 */

import type { EntityManager } from '@/game/EntityManager';
import type { EffectDeps } from '@/core/rules/effects';
import { damageEntity } from '@/core/rules/effects';
import type { GameEntity } from '@/game/Entity';

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
/** wander 方向持续时长（毫秒） */
const WANDER_MIN = 800;
const WANDER_MAX = 2000;
/** 飞行反重力补偿 */
const FLY_LIFT = 0.0011;

export class BehaviorSystem {
  constructor(
    private readonly entities: EntityManager,
    private readonly now: () => number,
    private readonly deps: EffectDeps,
  ) {}

  update(): void {
    const player = this.entities.getPlayer() as GameEntity | undefined;
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      const tags = ge.tags;
      // 飞行：施加向上的力抵消重力并悬浮
      if (tags.behavior.has('flying')) {
        const mass = (ge.body as { mass: number }).mass;
        ge.applyImpulse([0, -1], mass * FLY_LIFT);
      }
      // 带电状态自衰减（2s 后消失，避免永久链）
      if (tags.hasState('electrified')) {
        const timers = ge.stateTimers ?? (ge.stateTimers = new Map());
        const t = timers.get('electrified-expire');
        if (t === undefined) {
          timers.set('electrified-expire', this.now() + 2000);
        } else if (this.now() > t) {
          tags.removeState('electrified');
          ge.state.stateLayer.delete('state:electrified');
          timers.delete('electrified-expire');
        }
      }
      // 冻结/死亡/玩家不跑 AI
      if (tags.hasState('frozen') || ge.dead || ge.isPlayer) continue;
      if (!ge.behaviors || ge.behaviors.length === 0) continue;
      this.steer(ge, player);
    }
  }

  private steer(e: GameEntity, player: GameEntity | undefined): void {
    const kinds = e.behaviors!.map((b) => b.kind);
    const bodyVel = (e.body as { velocity: { x: number; y: number } }).velocity;
    // attack
    if (kinds.includes('attack') && player) {
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
    if (kinds.includes('flee') && player) {
      const dx = player.bodyPositionX - e.bodyPositionX;
      dir = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : dx > 0 ? -1 : 1;
    } else if (kinds.includes('follow') && player) {
      const dx = player.bodyPositionX - e.bodyPositionX;
      if (Math.abs(dx) > FOLLOW_RANGE * 0.3) {
        dir = dx > 0 ? 1 : -1;
      } else {
        dir = 0;
      }
    } else if (kinds.includes('wander')) {
      dir = this.wanderDir(e);
    }
    if (dir !== 0) {
      e.setBodyVelocity(dir * AI_SPEED, bodyVel.y);
      e.state.locomotion = 'walk';
      e.state.facing = dir > 0 ? 1 : -1;
    } else {
      e.setBodyVelocity(0, bodyVel.y);
      e.state.locomotion = 'idle';
    }
  }

  private wanderDir(e: GameEntity): number {
    const mem = e.aiMem ?? (e.aiMem = new Map<string, unknown>());
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
