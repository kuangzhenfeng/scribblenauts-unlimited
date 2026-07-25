/**
 * 实体（Entity）—— 运行时生成在世界中的一个物体实例的领域接口。
 *
 * 核心层只定义实体在逻辑层所需的最小契约（id/typeId/tags/health 等），
 * 具体 Phaser GameObject 与 Matter body 引用由 game 层的实体实现持有。
 * 这样规则引擎与效果执行器可对"逻辑实体"操作，而不耦合 Phaser/Matter。
 *
 * 设计原则：
 * - 接口最小化，不持有渲染/物理 API；
 * - 行为由各 System 驱动（ECS-lite）；
 * - tags 是规则匹配与倒排索引的依据。
 */

import type { TagSet } from '../rules/TagSet';
import type { BehaviorSpec } from '@/core/types/dictionary';

/** 实体运行时状态（渲染用，core 层只关心 animTime/locomotion/facing） */
export interface EntityState {
  /** 动画累计时间（毫秒），用于周期性绘制（行走摆动等） */
  animTime: number;
  /** 当前移动模式，驱动渲染器状态机分支 */
  locomotion: 'idle' | 'walk' | 'fly' | 'swim' | 'attack' | 'jump';
  /** 朝向：-1 朝左 / 1 朝右 */
  facing: number;
  /** 颜色覆盖（来自形容词），undefined 则用词条默认 */
  colorOverride?: string;
  /** 缩放倍率（来自形容词 size），默认 1 */
  scale: number;
  /** 状态覆盖层（燃烧/冻结/带电）的显示标志，由规则引擎设置 */
  stateLayer: Set<string>;
}

export function createEntityState(): EntityState {
  return {
    animTime: 0,
    locomotion: 'idle',
    facing: 1,
    scale: 1,
    stateLayer: new Set<string>(),
  };
}

/** 实体运行时的状态计时器：state → 到期时间戳（毫秒） */
export type StateTimers = Map<string, number>;

/**
 * 实体逻辑接口。
 *
 * 规则引擎/effect 执行器只依赖此接口，不依赖 Phaser GameObject 或 Matter body。
 * 位置/速度等运动学量经 bodyPosition/bodyAngle 暴露（由 game 层实体实现桥接 Matter body）。
 */
export interface Entity {
  /** 全局唯一实例 id（运行时生成，区别于词条 id） */
  id: string;
  /** 来源词条 id */
  typeId: string;
  /** 渲染状态快照 */
  state: EntityState;
  /** 绘制参数（合并词条 + 形容词覆盖） */
  drawParams: Record<string, unknown>;
  /** 渲染器 id */
  rendererId: string;
  /** 渲染层级，用于排序 */
  layer: number;
  /** 是否关键物体（不可被 60 上限驱逐） */
  critical: boolean;
  /** 最后交互时间，供 LRU 驱逐用 */
  lastTouchedAt: number;
  /** 属性标签（规则引擎使用） */
  tags: TagSet;
  /** 生命值（生物与可破坏物使用） */
  health?: number;
  /** 最大生命值（用于回血上限） */
  maxHealth?: number;
  /** 状态计时：state → 到期毫秒时间戳 */
  stateTimers?: StateTimers;
  /** 是否已死亡（销毁前置标志，避免重复销毁） */
  dead?: boolean;
  /** 是否为玩家（Maxwell），仅作"是否受玩家输入控制"开关，规则引擎不读 */
  isPlayer?: boolean;
  /** 运行时行为列表（从词条复制，供 BehaviorSystem AI 分发） */
  behaviors?: BehaviorSpec[];
  /** 渲染隐藏（骑乘时玩家本体隐藏） */
  hidden?: boolean;
  /** AI 临时记忆（wander 方向与计时等），按需创建 */
  aiMem?: Map<string, unknown>;

  // ---- 运动学桥接（由 game 层实体实现代理 Matter body） ----

  /** 刚体世界坐标 x */
  readonly bodyPositionX: number;
  /** 刚体世界坐标 y */
  readonly bodyPositionY: number;
  /** 刚体角度（弧度） */
  readonly bodyAngle: number;

  /** 设置刚体位置（拖拽对齐鼠标用） */
  setBodyPosition(x: number, y: number): void;
  /** 设置刚体速度（投掷用） */
  setBodyVelocity(x: number, y: number): void;
  /** 施加冲量（规则 apply-impulse 用），返回值供物理层消费 */
  applyImpulse(dir: [number, number], mag: number): void;
}

/** 实体集合查询接口（EntityManager 的最小契约，供规则引擎/effect 使用） */
export interface EntityQuery {
  all(): Entity[];
  /** 按 id 取实体 */
  get(id: string): Entity | undefined;
}
