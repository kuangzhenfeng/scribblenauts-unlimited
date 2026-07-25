/**
 * 形容词类型定义。
 *
 * 形容词数据：双语名/别名/类别 + effect。
 * AdjectiveSystem 消费 effect 修改实体 tags/外观/物理参数。
 *
 * 与旧项目的差异：删除 AdjectiveEffect.composite（声明不消费），首期按 category 硬编码
 * 互斥/叠加语义（承认），不声明 stackable/conflictsWith。
 */

export type AdjectiveCategory =
  | 'size'
  | 'color'
  | 'behavior'
  | 'material'
  | 'state'
  | 'nature';

/** 形容词效果 */
export type AdjectiveEffect =
  | { kind: 'scale'; factor: number }
  | { kind: 'color'; color: string }
  | { kind: 'add-behavior'; behavior: string; physics?: Record<string, unknown> }
  | { kind: 'add-state'; state: string }
  | { kind: 'set-temperature'; temp: string }
  | { kind: 'set-material'; material: string }
  | { kind: 'add-flags'; flags: string[] }
  | { kind: 'transform-type'; toTypeId: string };

/** 形容词条目 */
export interface AdjectiveEntry {
  id: string;
  zh: { name: string; aliases?: string[] };
  en: { name: string; aliases?: string[] };
  category: AdjectiveCategory;
  effect: AdjectiveEffect;
  /** 应用顺序优先级（按 category 硬编码互斥/叠加，priority 仅决定同类内顺序） */
  priority?: number;
}
