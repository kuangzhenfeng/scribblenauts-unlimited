/**
 * 存档类型 —— IndexedDB 持久化自定义物体与进度。
 *
 * 自定义物体：玩家在 ObjectEditor 中组合物体+形容词→命名保存→注入词典索引。
 * 进度：Starite/碎片计数、已完成题目 slot、已解锁关卡、难度设置。
 * 不做向前兼容迁移逻辑（遵循"无需考虑兼容"），但留 schemaVersion 供未来重置。
 */

import type { DifficultyTier, DifficultyStandard } from './question';

export interface CustomObjectDef {
  id: string; // 'custom:myDragon'
  zh: { name: string; aliases?: string[] };
  en: { name: string; aliases?: string[] };
  baseTypeId: string;
  adjectives: string[];
  attachments?: { childTypeId: string; anchor: [number, number] }[];
  appearanceOverrides?: Record<string, unknown>;
  created: number;
}

/**
 * Magic Backpack 中的一条使用记录。
 *
 * 词典定义与使用记录分离：词典负责“能否生成”，记录负责“最近使用/收藏”。
 * 这样内置物体、自定义物体都可以共用同一套背包排序与收藏 API。
 */
export interface ObjectLibraryRecord {
  typeId: string;
  firstUsedAt: number;
  lastUsedAt: number;
  useCount: number;
  favorite: boolean;
}

export interface SaveData {
  schemaVersion: number;
  starites: number;
  shards: number;
  /**
   * 已完成的题目 slot 列表，元素格式 `{levelId}:{tier}:{standard}:{slotIndex}`。
   * 题目随机化后 challenge id 每次不同，改用 slot 语义持久化进度。
   */
  completedSlots: string[];
  customObjects: CustomObjectDef[];
  /** Magic Backpack：已召唤物体的最近使用、频次与收藏状态 */
  library: ObjectLibraryRecord[];
  /** 已解锁关卡 id 列表，首关默认解锁，完成上一关 starite-gate 后追加下一关 */
  unlockedLevels: string[];
  /** 玩家上次选择的难度设置，进关默认复用 */
  difficultySetting: { tier: DifficultyTier; standard: DifficultyStandard };
  /** 首次进入世界时的基础入门是否已完成。 */
  tutorialCompleted: boolean;
  /**
   * 题目随机种子。QuestionPicker 以 {levelId}:{tier}:{standard}:{questionSeed}
   * 派生 RNG 种子，同种子+同关+同难度 → 同题序；换种子 = 换一轮题目。
   * 由设置页显示/输入/刷新，换种子时清空题目进度（保留解锁与自制物体）。
   */
  questionSeed: string;
}
