/**
 * effect 执行器 —— 把声明式 RuleEffect 应用到具体实体。
 *
 * 每种 effect kind 一个分支。执行可能改变实体状态（经 TagSet 写操作自动同步 TagIndex）。
 *
 * 与旧项目差异：
 * - 依赖注入：EffectDeps 由 RuleEngine 构造注入并向下传递，删除 globalThis.__effectDeps 全局单例（可测性）。
 * - apply-force → apply-impulse：effect 只产出意图，由 deps.applyImpulse 桥接物理层，逻辑核心零物理依赖。
 * - 删除 custom effect 空壳。
 * - setState/removeState/addFlag/removeFlag 不再手动 deindex/indexEntity（TagSet.onChange 自动同步）。
 */

import type {
  RuleEffect,
  EffectTarget,
  StateTag,
  FlagTag,
} from '@/core/types/rules';
import type { Entity, EntityQuery } from '@/core/entity/Entity';
import type { TagIndex } from './TagIndex';
import type { EffectContext } from './RuleEngine';
import { log } from '@/util/log';

/** effect 执行器依赖（构造注入，不再用全局单例） */
export interface EffectDeps {
  entities: EntityQuery;
  tagIndex: TagIndex;
  /** 生成物体（返回新建实体，可能 undefined） */
  spawn: (typeId: string, x: number, y: number) => Entity | undefined;
  /** 销毁实体（从世界移除） */
  destroyEntity: (e: Entity) => void;
  /** 施加冲量（桥接物理层） */
  applyImpulse: (e: Entity, dir: [number, number], mag: number) => void;
}

/** effect 处理器：按 kind 分发 */
type EffectHandler = (eff: RuleEffect, ctx: EffectContext, deps: EffectDeps) => void;

const handlers = new Map<RuleEffect['kind'], EffectHandler>();

/** 选取 effect 目标实体 */
function resolveTarget(tgt: EffectTarget, ctx: EffectContext): Entity[] {
  switch (tgt) {
    case 'a':
      return [ctx.a];
    case 'b':
      return ctx.b ? [ctx.b] : [];
    case 'self':
      return [ctx.self];
    case 'both':
      return ctx.b ? [ctx.a, ctx.b] : [ctx.a];
    default:
      return [];
  }
}

function setState(e: Entity, s: StateTag): void {
  if (e.tags.hasState(s)) return;
  e.tags.addState(s);
  e.state.stateLayer.add(`state:${s}`);
  log.debug('state applied', { entity: e.id, state: s });
}

function removeState(e: Entity, s: StateTag): void {
  if (!e.tags.hasState(s)) return;
  e.tags.removeState(s);
  e.state.stateLayer.delete(`state:${s}`);
}

function addFlag(e: Entity, flags: FlagTag[]): void {
  for (const f of flags) e.tags.addFlag(f);
}

function removeFlag(e: Entity, flags: FlagTag[]): void {
  for (const f of flags) e.tags.removeFlag(f);
}

function damage(e: Entity, amount: number, deps: EffectDeps): void {
  if (e.dead) return;
  e.health = (e.health ?? 100) - amount;
  log.debug('damage', { entity: e.id, amount, health: e.health });
  if (e.health <= 0) {
    e.dead = true;
    // 玩家死亡由 respawn 处理，此处不销毁
    if (!e.isPlayer) deps.destroyEntity(e);
  }
}

/** 对实体施加伤害（供 BehaviorSystem 的 attack 直接调用，复用同一逻辑） */
export function damageEntity(e: Entity, amount: number, deps: EffectDeps): void {
  damage(e, amount, deps);
}

function heal(e: Entity, amount: number): void {
  const max = e.maxHealth ?? 100;
  e.health = Math.min(max, (e.health ?? 0) + amount);
}

function spawnNear(
  typeId: string,
  ctx: EffectContext,
  deps: EffectDeps,
  at: 'a' | 'b' | 'contact' | 'center-a',
  count: number,
): void {
  const base = at === 'b' ? ctx.b : ctx.a;
  if (!base) return;
  const x = base.bodyPositionX;
  const y = base.bodyPositionY;
  for (let i = 0; i < count; i++) {
    deps.spawn(typeId, x + (i - count / 2) * 12, y - 10);
  }
}

// ---- 注册各 effect handler ----

handlers.set('apply-state', (eff, ctx) => {
  if (eff.kind !== 'apply-state') return;
  for (const e of resolveTarget(eff.target, ctx)) setState(e, eff.state);
});

handlers.set('remove-state', (eff, ctx) => {
  if (eff.kind !== 'remove-state') return;
  for (const e of resolveTarget(eff.target, ctx)) removeState(e, eff.state);
});

handlers.set('set-temperature', (eff, ctx) => {
  if (eff.kind !== 'set-temperature') return;
  for (const e of resolveTarget(eff.target, ctx)) e.tags.setTemperature(eff.temp);
});

handlers.set('spawn', (eff, ctx, deps) => {
  if (eff.kind !== 'spawn') return;
  spawnNear(eff.typeId, ctx, deps, eff.at, eff.count ?? 1);
});

handlers.set('destroy', (eff, ctx, deps) => {
  if (eff.kind !== 'destroy') return;
  for (const e of resolveTarget(eff.target, ctx)) {
    e.dead = true;
    deps.destroyEntity(e);
  }
});

handlers.set('damage', (eff, ctx, deps) => {
  if (eff.kind !== 'damage') return;
  for (const e of resolveTarget(eff.target, ctx)) damage(e, eff.amount, deps);
});

handlers.set('heal', (eff, ctx) => {
  if (eff.kind !== 'heal') return;
  for (const e of resolveTarget(eff.target, ctx)) heal(e, eff.amount);
});

handlers.set('transform', (eff, ctx, deps) => {
  if (eff.kind !== 'transform') return;
  for (const e of resolveTarget(eff.target, ctx)) {
    const x = e.bodyPositionX;
    const y = e.bodyPositionY;
    deps.destroyEntity(e);
    deps.spawn(eff.toTypeId, x, y);
  }
});

handlers.set('add-flag', (eff, ctx) => {
  if (eff.kind !== 'add-flag') return;
  for (const e of resolveTarget(eff.target, ctx)) addFlag(e, eff.flags);
});

handlers.set('remove-flag', (eff, ctx) => {
  if (eff.kind !== 'remove-flag') return;
  for (const e of resolveTarget(eff.target, ctx)) removeFlag(e, eff.flags);
});

handlers.set('apply-impulse', (eff, ctx, deps) => {
  if (eff.kind !== 'apply-impulse') return;
  for (const e of resolveTarget(eff.target, ctx)) {
    deps.applyImpulse(e, eff.dir, eff.mag);
  }
});

export function executeEffect(eff: RuleEffect, ctx: EffectContext, deps: EffectDeps): void {
  const h = handlers.get(eff.kind);
  if (!h) {
    log.warn('no handler for effect', { kind: eff.kind });
    return;
  }
  h(eff, ctx, deps);
}
