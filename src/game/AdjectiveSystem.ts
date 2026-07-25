/**
 * 形容词系统 —— 把解析出的形容词应用到实体。
 *
 * 按 category 分组、组内 priority 排序，遵循互斥/累乘规则。
 * 形容词直接改写实体 tags（经 TagSet 写操作自动同步 TagIndex），规则引擎据此匹配。
 *
 * 与旧项目差异：删除 isModifiable 重复实现，复用 core/data/dictionary/modifiable.ts。
 * TagSet.onChange 自动同步索引，不再手动 indexEntity。
 */

import type { Entity } from '@/core/entity/Entity';
import type { ParseCandidate } from '@/core/lex/InputParser';
import type { AdjectiveEntry } from '@/core/types/adjective';
import type { DictEntry } from '@/core/types/dictionary';
import { getAdjective } from '@/core/data/dictionary/adjectives';
import { isModifiable } from '@/core/data/dictionary/modifiable';
import type { MaterialTag, StateTag, BehaviorTag } from '@/core/types/rules';

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
      entity.state.scale *= factor;
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
          if (a.effect.behavior === 'flying') {
            entity.state.locomotion = 'fly';
            // 飞行：提高空气阻力（实体 body 经 game 层持有，frictionAir 由物理引擎消费）
            const flying = a.effect.physics as { frictionAir?: number } | undefined;
            if (flying?.frictionAir) {
              const bodyAny = (entity as unknown as { body: { frictionAir?: number } }).body;
              bodyAny.frictionAir = Math.max(bodyAny.frictionAir ?? 0, flying.frictionAir);
            }
          }
        }
      }
      break;
    }
    case 'state': {
      for (const a of list) {
        if (a.effect.kind === 'add-state') {
          entity.tags.addState(a.effect.state as StateTag);
          entity.state.stateLayer.add(`state:${a.effect.state}`);
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
