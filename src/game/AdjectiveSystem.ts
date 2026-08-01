/**
 * 形容词系统 —— 把解析出的形容词应用到实体。
 *
 * 按 category 分组、组内 priority 排序，遵循互斥/累乘规则。
 * 形容词直接改写实体 tags（经 TagSet 写操作自动同步 TagIndex），规则引擎据此匹配。
 *
 * 与旧项目差异：删除 isModifiable 重复实现，复用 core/data/dictionary/modifiable.ts。
 * TagSet.onChange 自动同步索引，不再手动 indexEntity。
 */

import Phaser from 'phaser';
import type { Entity } from '@/core/entity/Entity';
import type { ParseCandidate } from '@/core/lex/InputParser';
import type { AdjectiveEntry } from '@/core/types/adjective';
import type { DictEntry } from '@/core/types/dictionary';
import { getAdjective } from '@/core/data/dictionary/adjectives';
import { isModifiable } from '@/core/data/dictionary/modifiable';
import type { MaterialTag, StateTag, BehaviorTag, FlagTag } from '@/core/types/rules';

type MatterBody = MatterJS.BodyType;
const Matter = (Phaser as unknown as {
  Physics: { Matter: { Matter: typeof MatterJS } };
}).Physics.Matter.Matter;

const TRANSIENT_STATES: StateTag[] = [
  'burning', 'frozen', 'wet', 'electrified', 'dead',
  'petrified', 'poisoned', 'sleeping', 'charred',
];

/** 应用候选中的形容词到实体 */
export function applyAdjectives(entity: Entity, candidate: ParseCandidate, base: DictEntry): void {
  if (candidate.adjectives.length === 0) return;

  // 按 category 分组
  const byCategory = new Map<string, AdjectiveEntry[]>();
  for (const pa of candidate.adjectives) {
    const adj = getAdjective(pa.adjId);
    if (!adj) continue;
    if (!isModifiable(base, adj.category)) continue;
    const list = byCategory.get(adj.category) ?? [];
    list.push(adj);
    byCategory.set(adj.category, list);
  }

  for (const [category, list] of byCategory) {
    list.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    applyCategory(entity, category, list);
  }
}

function applyCategory(entity: Entity, category: string, list: AdjectiveEntry[]): void {
  switch (category) {
    case 'size': {
      let factor = 1;
      for (const a of list) {
        if (a.effect.kind === 'scale') factor *= a.effect.factor;
      }
      factor = Math.max(0.25, Math.min(4, factor));
      const previousScale = entity.state.scale;
      entity.state.scale *= factor;
      syncPhysicsScale(entity, entity.state.scale / previousScale);
      break;
    }
    case 'color': {
      const last = list[list.length - 1];
      if (last.effect.kind === 'color') {
        entity.state.colorOverride = last.effect.color;
      }
      break;
    }
    case 'behavior': {
      for (const a of list) {
        if (a.effect.kind === 'add-behavior') {
          entity.tags.addBehavior(a.effect.behavior as BehaviorTag);
          // 睡眠类行为原本只写入行为字符串；同时落地为 sleeping 状态，才能阻断 AI 并自动恢复。
          if (a.effect.behavior === 'sleeping') applyState(entity, 'sleeping');
          if (a.effect.behavior === 'flying') {
            entity.state.locomotion = 'fly';
            // 飞行：提高空气阻力（实体 body 经 game 层持有，frictionAir 由物理引擎消费）
            const flying = a.effect.physics as { frictionAir?: number } | undefined;
            if (flying?.frictionAir) {
              const bodyAny = (entity as unknown as { body: { frictionAir?: number } }).body;
              bodyAny.frictionAir = Math.max(bodyAny.frictionAir ?? 0, flying.frictionAir);
            }
          }
        } else if (a.effect.kind === 'add-flags') {
          for (const flag of a.effect.flags) entity.tags.addFlag(flag as FlagTag);
        }
      }
      break;
    }
    case 'state': {
      for (const a of list) {
        if (a.effect.kind === 'add-state') {
          const state = a.effect.state as StateTag;
          if (state === 'normal') clearTransientStates(entity);
          else applyState(entity, state);
          if (a.id === 'invisible') {
            entity.hidden = true;
            entity.state.stateLayer.add('state:invisible');
          } else if (a.id === 'glowing') {
            entity.drawParams.glowing = true;
            entity.state.stateLayer.add('state:glowing');
          } else if (a.id === 'invincible') {
            // damage effect 读取这一运行时语义，避免把无敌伪装成普通标签。
            entity.drawParams.invincible = true;
          }
        }
      }
      break;
    }
    case 'material': {
      for (const a of list) {
        if (a.effect.kind === 'set-material') {
          // 覆盖：先清后加（保持单一材质主导）
          entity.tags.material.clear();
          entity.tags.material.add(a.effect.material as MaterialTag);
        }
      }
      break;
    }
    default:
      break;
  }
}

/** 应用状态形容词时同步标签、状态层和可观察的死亡状态。 */
function applyState(entity: Entity, state: StateTag): void {
  entity.tags.addState(state);
  entity.state.stateLayer.add(`state:${state}`);
  if (state === 'dead') {
    entity.dead = true;
    entity.health = 0;
    entity.state.locomotion = 'dead';
  }
}

/** normal 形容词表示恢复为无临时状态，而不是再添加一个无效标签。 */
function clearTransientStates(entity: Entity): void {
  for (const state of TRANSIENT_STATES) {
    entity.tags.removeState(state);
    entity.state.stateLayer.delete(`state:${state}`);
  }
}

/** 形容词缩放同时作用于 Matter 刚体；纯逻辑实体没有 body 时仍可安全使用。 */
function syncPhysicsScale(entity: Entity, factor: number): void {
  if (factor === 1) return;
  const body = (entity as unknown as { body?: MatterBody }).body;
  if (!body) return;
  Matter.Body.scale(body, factor, factor);
}
