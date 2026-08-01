/**
 * 规则类型定义 —— 声明式交互规则的数据契约。
 *
 * 规则为纯数据：trigger（何时检查）+ match（匹配哪些实体）+ effect（做什么）。
 * RuleEngine 读取这些声明，在物理碰撞对或 tick 上匹配并串行执行 effect。
 *
 * 设计原则：
 * - 有限 effect 类型枚举，避免无限扩展；
 * - 规则不直接操作渲染/物理/DOM，effect 只产出状态变更或抽象意图；
 * - 反应链通过 chainTag 分组限流，防死循环。
 *
 * 与旧项目的差异：不声明未实现的字段/触发器/effect（删除 state-enter 触发器、
 * custom effect、relation、InteractionRole 等死路径）。
 */

/** 物体大类 */
export type ObjectCategory =
  | 'creature' // 生物（人/动物）
  | 'object' // 物品
  | 'food' // 食物
  | 'weapon' // 武器
  | 'tool' // 工具
  | 'vehicle' // 载具
  | 'element' // 元素（火/水/冰/电）
  | 'plant' // 植物
  | 'structure' // 结构（地形/建筑）
  | 'magic'; // 魔法/抽象

/** 材质标签 */
export type MaterialTag =
  | 'wood'
  | 'metal'
  | 'cloth'
  | 'glass'
  | 'flesh'
  | 'stone'
  | 'paper'
  | 'plastic'
  | 'rubber'
  | 'water'
  | 'ice'
  | 'plant'
  | 'gold';

/** 温度标签（单值，互斥） */
export type TemperatureTag = 'hot' | 'cold' | 'normal';

/** 状态标签 */
export type StateTag =
  | 'normal'
  | 'burning'
  | 'frozen'
  | 'wet'
  | 'electrified'
  | 'dead'
  | 'petrified'
  | 'poisoned'
  | 'sleeping'
  | 'charred';

/** 行为标签 */
export type BehaviorTag =
  | 'flying'
  | 'swimming'
  | 'walking'
  | 'aggressive'
  | 'friendly'
  | 'scared'
  | 'hungry'
  | 'tame';

/** 标志标签（可参与交互的开关） */
export type FlagTag =
  | 'flammable'
  | 'conductive'
  | 'sharp'
  | 'edible'
  | 'fragile'
  | 'cuttable'
  | 'breakable'
  | 'weapon'
  | 'ranged'
  | 'tool'
  | 'projectile'
  | 'container'
  | 'rideable'
  | 'wing'
  | 'igniter'
  | 'edible-target';

/** 规则触发条件（只声明并实现 collision/contact/tick 三种） */
export type RuleTrigger =
  | { kind: 'collision' } // 碰撞开始（事件）
  | { kind: 'contact' } // 持续接触（collisionActive 节流）
  | { kind: 'tick'; intervalMs: number }; // 周期逻辑

/** 标签谓词：描述一类实体 */
export interface TagPredicate {
  material?: MaterialTag[];
  temperature?: TemperatureTag[];
  state?: StateTag[];
  flags?: FlagTag[];
  behavior?: BehaviorTag[];
  /** 精确词条 id */
  typeIds?: string[];
  /** 物体大类 */
  category?: ObjectCategory[];
  notState?: StateTag[];
  notFlags?: FlagTag[];
}

/** 规则匹配方式（只 pair 与 self 两种，不声明 relation） */
export type RuleMatcher =
  | { kind: 'pair'; a: TagPredicate; b: TagPredicate }
  | { kind: 'self'; a: TagPredicate };

/** effect 作用目标 */
export type EffectTarget = 'a' | 'b' | 'self' | 'both';

/** 冲量方向：固定向量或根据碰撞双方位置计算的相对方向。 */
export type ImpulseDirection =
  | [number, number]
  | 'away-from-source'
  | 'towards-source'
  | 'upward';

/** 生成位置 */
export type SpawnLocation = 'a' | 'b' | 'contact' | 'center-a';

/**
 * 规则 effect（有限枚举，删除 custom 空壳）。
 *
 * apply-force 只产出意图（impulse），不直接调物理 API，由 EffectDeps.applyImpulse 桥接物理层，
 * 保持逻辑核心零物理依赖。
 */
export type RuleEffect =
  | { kind: 'apply-state'; target: EffectTarget; state: StateTag }
  | { kind: 'remove-state'; target: EffectTarget; state: StateTag }
  | { kind: 'set-temperature'; target: EffectTarget; temp: TemperatureTag }
  | { kind: 'spawn'; typeId: string; at: SpawnLocation; count?: number }
  | { kind: 'destroy'; target: EffectTarget }
  | { kind: 'damage'; target: EffectTarget; amount: number }
  | { kind: 'heal'; target: EffectTarget; amount: number }
  | { kind: 'transform'; target: EffectTarget; toTypeId: string }
  | { kind: 'add-flag'; target: EffectTarget; flags: FlagTag[] }
  | { kind: 'remove-flag'; target: EffectTarget; flags: FlagTag[] }
  | { kind: 'apply-impulse'; target: EffectTarget; dir: ImpulseDirection; mag: number };

/** 声明式规则 */
export interface Rule {
  id: string;
  trigger: RuleTrigger;
  match: RuleMatcher;
  effect: RuleEffect | RuleEffect[];
  /** 同一实体对该规则的冷却（毫秒） */
  cooldownMs?: number;
  /** 同触发多规则时的执行序 */
  priority?: number;
  /** 反应链限流分组 */
  chainTag?: string;
}
