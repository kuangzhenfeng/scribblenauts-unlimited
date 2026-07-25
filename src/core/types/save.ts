/**
 * 存档类型 —— IndexedDB 持久化自定义物体与进度。
 *
 * 自定义物体：玩家在 ObjectEditor 中组合物体+形容词→命名保存→注入词典索引。
 * 进度：Starite/碎片计数、已完成挑战。
 * 不做向前兼容迁移逻辑（遵循"无需考虑兼容"），但留 schemaVersion 供未来重置。
 */

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

export interface SaveData {
  schemaVersion: number;
  starites: number;
  shards: number;
  completedChallenges: string[];
  customObjects: CustomObjectDef[];
}
