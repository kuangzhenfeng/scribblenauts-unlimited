/**
 * 词典数据结构 —— 全层依赖的统一类型契约。
 *
 * 一个 DictEntry 描述"一类可生成物体"的静态定义：名（中英别名）、
 * 物理配置、矢量绘制配置、属性标签、行为、形容词可改字段白名单。
 *
 * 设计原则：
 * - 词条是纯数据，不含运行时逻辑；
 * - appearance 通过引用渲染器 id + params 实现 DRY 复用；
 * - tags 为运行时实体共享，词条只提供"默认标签"。
 *
 * 与旧项目的差异：删除 InteractionRole（声明不消费）。
 */

import type { ObjectCategory } from './rules';

export type { ObjectCategory } from './rules';

/** 双语命名：主名 + 别名 */
export interface LocalizedName {
  name: string;
  aliases?: string[];
}

/** 基准尺寸，单位为世界坐标像素；形容词 size 在此乘 */
export interface SizeSpec {
  width: number;
  height: number;
}

/** 矢量绘制配置：引用渲染器 + 参数 */
export interface AppearanceSpec {
  /** 引用 render/renderers/registry 中注册的渲染器 id（如 'quadruped' / 'box' / 'fire'） */
  renderer: string;
  /** 传递给渲染器的参数（颜色/样式开关等），形容词可覆盖其中部分字段 */
  params?: Record<string, unknown>;
}

/** 复合刚体的一个部件 */
export interface CompoundPart {
  shape: 'box' | 'circle';
  /** 相对刚体中心的偏移 */
  offset: [number, number];
  size: [number, number];
}

/** 物理刚体配置，直传 matter.js */
export interface PhysicsSpec {
  shape: 'box' | 'circle' | 'capsule' | 'compound' | 'none';
  density: number;
  friction: number;
  restitution: number;
  isStatic?: boolean;
  /** 飞行/飘浮用空气阻力 */
  frictionAir?: number;
  /** shape='compound' 时的部件列表 */
  parts?: CompoundPart[];
}

/** 行为定义 */
export interface BehaviorSpec {
  kind: BehaviorKind;
  params?: Record<string, number | string>;
  priority?: number;
}

export type BehaviorKind =
  | 'idle'
  | 'walk'
  | 'fly'
  | 'swim'
  | 'climb'
  | 'attack'
  | 'flee'
  | 'follow'
  | 'wander'
  | 'sleep'
  | 'hunt';

/**
 * 形容词可改字段白名单。缺省（undefined）= 全部允许。
 * 少数词条需禁用某类修改（如 dog 禁 nature）。
 */
export interface ModifiableFields {
  size?: boolean;
  color?: boolean;
  behavior?: boolean;
  state?: boolean;
  material?: boolean;
  /** 改变本性（transform-type），默认 false */
  nature?: boolean;
}

/**
 * 词典词条。
 *
 * tags 字段为最小接口 TagSetLike，避免数据层依赖规则层（TagSet 实现见 rules/TagSet.ts）。
 * 运行时由 Spawner 调 TagSet.fromRaw 装配为含 bitmask 缓存的运行时结构。
 */
export interface DictEntry {
  /** 全局唯一 id，如 'dog' */
  id: string;
  zh: LocalizedName;
  en: LocalizedName;
  category: ObjectCategory;
  size: SizeSpec;
  appearance: AppearanceSpec;
  physics: PhysicsSpec;
  /** 默认属性标签，运行时复制到实体 */
  tags: TagSetLike;
  behaviors: BehaviorSpec[];
  modifiable?: ModifiableFields;
  description?: { zh: string; en: string };
}

/**
 * TagSet 的结构契约（具体实现见 rules/TagSet.ts）。
 * 此处用最小接口解耦数据层与规则层，避免数据层依赖规则层。
 */
export interface TagSetLike {
  material: Set<string>;
  temperature: string;
  state: Set<string>;
  behavior: Set<string>;
  flags: Set<string>;
  /** 物体大类，运行时缓存以便规则 category 谓词使用 */
  category?: ObjectCategory;
}
