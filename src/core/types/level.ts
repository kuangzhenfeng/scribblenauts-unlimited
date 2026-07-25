/**
 * 关卡数据类型 —— overworld 区域与自包含关卡。
 *
 * overworld 多主题区域经 transitions 连通自由探索；
 * 自包含关卡经入口传送进入，解多谜题得 1 完整 Starite，完成/放弃返回。
 *
 * 与旧项目的差异：PuzzleCondition 只声明并实现首期能用到的 4 种
 * （object-present / object-destroyed / all-of / any-of），删除 entity-at / npc-state / counter。
 */

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface NpcSpawn {
  id: string;
  typeId: string;
  x: number;
  y: number;
  gender: 'male' | 'female';
  /** NPC 专属绘制参数覆盖（衬衫色/发型/帽子等），合并进 entity.drawParams */
  drawParams?: Record<string, unknown>;
}

export interface SpawnDef {
  typeId: string;
  x: number;
  y: number;
  layer?: number;
}

/** 关卡装饰（手绘纸片环境点缀，由 Environment 渲染） */
export interface Decoration {
  /** 装饰种类：bush/flower/fence/stalactite/lantern/mushroom/cloud 等 */
  kind: string;
  x: number;
  y: number;
  scale?: number;
}

export interface Challenge {
  id: string;
  giverNpcId: string;
  kind: 'shard' | 'starite-gate' | 'side';
  puzzle: PuzzleSpec;
  reward: { type: 'shard' | 'starite'; count: number };
  dialog: { zh: string; en: string }[];
}

/** 谜题条件 DSL（只声明并实现首期 4 种） */
export type PuzzleCondition =
  | {
      kind: 'object-present';
      typeId: string;
      near: { npcId: string; radius: number };
    }
  | { kind: 'object-destroyed'; typeId: string }
  | { kind: 'all-of'; conditions: PuzzleCondition[] }
  | { kind: 'any-of'; conditions: PuzzleCondition[] };

export interface PuzzleSpec {
  conditions: PuzzleCondition[];
}

export interface LevelData {
  id: string;
  type: 'overworld' | 'self-contained';
  theme: string;
  bounds: AABB;
  /** 玩家出生/重定位点（关卡入口） */
  playerStart: { x: number; y: number };
  /** 额外平台/地形（可选，每项一个静态矩形；Environment 同步渲染为可见平台） */
  terrain?: { x: number; y: number; w: number; h: number }[];
  spawns: SpawnDef[];
  npcs: NpcSpawn[];
  challenges: Challenge[];
  transitions?: { toLevelId: string; at: AABB }[];
  starite?: { x: number; y: number };
  bgm?: string;
  /** 手绘纸片环境装饰（草丛/花/栅栏/钟乳石/灯笼/蘑菇等），由 Environment 渲染 */
  decorations?: Decoration[];
}
