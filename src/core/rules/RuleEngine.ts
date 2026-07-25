/**
 * 规则引擎 —— 声明式交互规则的核心。
 *
 * 工作模型：
 * - 碰撞事件（collisionStart/contact）入事件队列，不立即执行（非重入）；
 * - 每逻辑 tick 串行消费事件队列，匹配规则，执行 effect；
 * - tick 规则按 intervalMs 节流，遍历倒排索引的相应集合。
 *
 * 三重限流：① 非重入队列；② 同实体同规则 cooldownMs 冷却；
 * ③ 同 chainTag 链深度 ≤4 + 每帧 effect 总量上限 256。
 *
 * 与旧项目差异：
 * - 删除 state-enter 触发器（声明但无 dispatch 路径的死代码）。
 * - EffectDeps 构造注入并向下传递，删除全局单例。
 * - cooldowns Map 命中过期项时惰性 delete（防内存泄漏）。
 *
 * 设计原则：规则为纯数据声明，引擎只做匹配与 effect 派发。
 */

import type { Rule, RuleEffect, EffectTarget, StateTag } from '@/core/types/rules';
import type { Entity, EntityQuery } from '@/core/entity/Entity';
import { TagSet, compilePredicate, type PredicateMask } from './TagSet';
import type { TagIndex } from './TagIndex';
import { executeEffect, type EffectDeps } from './effects';

/** 碰撞/接触事件 */
export interface CollisionEvent {
  a: Entity;
  b: Entity;
  phase: 'start' | 'active' | 'end';
}

/** effect 执行上下文 */
export interface EffectContext {
  a: Entity;
  b: Entity | undefined;
  self: Entity;
  /** 派生 effect 入队（供反应链使用） */
  enqueue: (effect: RuleEffect, target: EffectTarget, chainTag?: string, depthInc?: number) => void;
}

const MAX_CHAIN_DEPTH = 4;
const MAX_EFFECTS_PER_FRAME = 256;

/** 待执行的 effect（已绑定具体实体） */
interface PendingEffect {
  effect: RuleEffect;
  a: Entity;
  b: Entity | undefined;
  chainTag?: string;
  chainDepth: number;
  priority: number;
}

/** 编译后的规则 */
interface CompiledRule {
  rule: Rule;
  triggerKind: 'collision' | 'contact' | 'tick';
  intervalMs?: number;
  matchKind: 'pair' | 'self';
  predA?: PredicateMask;
  predB?: PredicateMask;
  /** 谓词要求的 state（tick 优化用：从倒排集合取候选） */
  predAStates?: StateTag[];
  effects: RuleEffect[];
  cooldownMs: number;
  priority: number;
  chainTag?: string;
}

export class RuleEngine {
  private rules: CompiledRule[] = [];
  private readonly eventQueue: CollisionEvent[] = [];
  private readonly pendingEffects: PendingEffect[] = [];
  /** 同实体同规则冷却：`${entityId}:${ruleId}` → 到期时间戳 */
  private readonly cooldowns = new Map<string, number>();
  /** tick 规则累计时间：ruleId → 已累计毫秒 */
  private readonly tickAccum = new Map<string, number>();
  /** 当前帧已执行 effect 计数 */
  private frameEffectCount = 0;
  /** 反应链当前深度（按 chainTag 分组） */
  private chainDepth = new Map<string, number>();

  constructor(
    private readonly entities: EntityQuery,
    private readonly tagIndex: TagIndex,
    private readonly now: () => number,
    private readonly deps: EffectDeps,
  ) {}

  register(rule: Rule): void {
    const cr: CompiledRule = {
      rule,
      triggerKind: rule.trigger.kind,
      intervalMs: rule.trigger.kind === 'tick' ? rule.trigger.intervalMs : undefined,
      matchKind: rule.match.kind,
      predA: compilePredicate(rule.match.a),
      predB: rule.match.kind === 'pair' ? compilePredicate(rule.match.b) : undefined,
      predAStates: rule.match.a.state,
      effects: Array.isArray(rule.effect) ? rule.effect : [rule.effect],
      cooldownMs: rule.cooldownMs ?? 0,
      priority: rule.priority ?? 0,
      chainTag: rule.chainTag,
    };
    this.rules.push(cr);
  }

  enqueueCollision(ev: CollisionEvent): void {
    this.eventQueue.push(ev);
  }

  /** 每帧调用：消费事件队列 + 跑 tick 规则 + 执行待处理 effect */
  update(dt: number): void {
    this.frameEffectCount = 0;
    this.chainDepth.clear();

    // 1) 处理碰撞/接触事件
    this.processEvents();

    // 2) 跑 tick 规则（self 类，遍历倒排集合）
    this.processTickRules(dt);

    // 3) 串行执行待处理 effect
    this.drainEffects();
  }

  private processEvents(): void {
    const events = this.eventQueue.splice(0);
    for (const ev of events) {
      if (ev.phase === 'end') continue;
      const phase: 'collision' | 'contact' = ev.phase === 'start' ? 'collision' : 'contact';
      for (const cr of this.rules) {
        if (cr.triggerKind !== phase) continue;
        if (cr.matchKind !== 'pair') continue;
        // 尝试 a/b 双向匹配
        if (this.matchPair(cr, ev.a, ev.b)) {
          this.enqueueEffects(cr, ev.a, ev.b);
        } else if (this.matchPair(cr, ev.b, ev.a)) {
          this.enqueueEffects(cr, ev.b, ev.a);
        }
      }
    }
  }

  private matchPair(cr: CompiledRule, a: Entity, b: Entity): boolean {
    if (!cr.predA || !cr.predB) return false;
    if (!TagSet.typeIdMatches(cr.predA, a.typeId)) return false;
    if (!TagSet.typeIdMatches(cr.predB, b.typeId)) return false;
    if (!a.tags.matches(cr.predA)) return false;
    if (!b.tags.matches(cr.predB)) return false;
    return true;
  }

  private processTickRules(dt: number): void {
    for (const cr of this.rules) {
      if (cr.triggerKind !== 'tick') continue;
      if (cr.matchKind !== 'self') continue;
      const acc = (this.tickAccum.get(cr.rule.id) ?? 0) + dt;
      this.tickAccum.set(cr.rule.id, acc);
      if (acc < (cr.intervalMs ?? 0)) continue;
      this.tickAccum.set(cr.rule.id, 0);
      // 遍历 predA 要求的 state 倒排集合
      const states = cr.predAStates;
      let candidates: Entity[];
      if (states && states.length) {
        const set = new Set<Entity>();
        for (const s of states) {
          for (const e of this.tagIndex.byStateSet(s)) set.add(e);
        }
        candidates = [...set];
      } else {
        candidates = [...this.entities.all()];
      }
      for (const e of candidates) {
        if (!cr.predA || !TagSet.typeIdMatches(cr.predA, e.typeId)) continue;
        if (!e.tags.matches(cr.predA)) continue;
        if (!this.checkCooldown(cr.rule.id, e.id, cr.cooldownMs)) continue;
        this.enqueueEffects(cr, e, undefined);
      }
    }
  }

  private enqueueEffects(cr: CompiledRule, a: Entity, b: Entity | undefined): void {
    if (!this.checkCooldown(cr.rule.id, a.id, cr.cooldownMs)) return;
    this.setCooldown(cr.rule.id, a.id, cr.cooldownMs);
    const depth = cr.chainTag ? (this.chainDepth.get(cr.chainTag) ?? 0) : 0;
    for (const effect of cr.effects) {
      this.pendingEffects.push({
        effect,
        a,
        b,
        chainTag: cr.chainTag,
        chainDepth: depth,
        priority: cr.priority,
      });
    }
  }

  private drainEffects(): void {
    // 按优先级降序
    this.pendingEffects.sort((x, y) => y.priority - x.priority);
    while (this.pendingEffects.length > 0) {
      if (this.frameEffectCount >= MAX_EFFECTS_PER_FRAME) {
        this.pendingEffects.length = 0;
        break;
      }
      const pe = this.pendingEffects.shift()!;
      this.frameEffectCount++;
      const ctx: EffectContext = {
        a: pe.a,
        b: pe.b,
        self: pe.a,
        enqueue: (eff, _tgt, chainTag, depthInc) =>
          this.enqueueDerived(eff, pe.a, pe.b, chainTag ?? pe.chainTag, pe.chainDepth + (depthInc ?? 1)),
      };
      executeEffect(pe.effect, ctx, this.deps);
    }
  }

  private enqueueDerived(
    effect: RuleEffect,
    a: Entity,
    b: Entity | undefined,
    chainTag: string | undefined,
    depth: number,
  ): void {
    if (chainTag && depth > MAX_CHAIN_DEPTH) return;
    if (chainTag) this.chainDepth.set(chainTag, depth);
    this.pendingEffects.push({
      effect,
      a,
      b,
      chainTag,
      chainDepth: depth,
      priority: 0,
    });
  }

  private checkCooldown(ruleId: string, entityId: string, cd: number): boolean {
    if (cd <= 0) return true;
    const key = `${entityId}:${ruleId}`;
    const until = this.cooldowns.get(key);
    if (until !== undefined && this.now() < until) return false;
    // 命中过期项时惰性清理
    if (until !== undefined && this.now() >= until) this.cooldowns.delete(key);
    return true;
  }

  private setCooldown(ruleId: string, entityId: string, cd: number): void {
    if (cd <= 0) return;
    this.cooldowns.set(`${entityId}:${ruleId}`, this.now() + cd);
  }
}
