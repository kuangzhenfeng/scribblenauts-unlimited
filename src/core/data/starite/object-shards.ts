/**
 * Object Shard 任务目录 —— 跨关、非排他的物体召唤收集。
 *
 * 原版把 Object Shard 分成 Living / Food / Vehicle / Music / Tech /
 * Weapon / Clothes / Misc 八类，共 217 个任务。当前词库不是原版完整词库，
 * 因此从已有可召唤词条中按稳定规则选出代表性任务；新增词条不会改变既有任务 id。
 */

import type { DictEntry } from '@/core/types/dictionary';
import { allEntries } from '@/core/data/dictionary/Dictionary';

export const OBJECT_SHARD_CATEGORY_IDS = [
  'living',
  'food',
  'vehicle',
  'music',
  'tech',
  'weapon',
  'clothes',
  'misc',
] as const;

export type ObjectShardCategory = typeof OBJECT_SHARD_CATEGORY_IDS[number];

export interface ObjectShardCategoryDef {
  id: ObjectShardCategory;
  zh: string;
  en: string;
}

export interface ObjectShardTask {
  id: string;
  category: ObjectShardCategory;
  typeId: string;
  zh: string;
  en: string;
}

export const OBJECT_SHARD_CATEGORIES: readonly ObjectShardCategoryDef[] = [
  { id: 'living', zh: '生命', en: 'Living' },
  { id: 'food', zh: '食物', en: 'Food' },
  { id: 'vehicle', zh: '载具', en: 'Vehicle' },
  { id: 'music', zh: '音乐', en: 'Music' },
  { id: 'tech', zh: '科技', en: 'Tech' },
  { id: 'weapon', zh: '武器', en: 'Weapon' },
  { id: 'clothes', zh: '服装', en: 'Clothes' },
  { id: 'misc', zh: '杂项', en: 'Misc' },
];

/**
 * 原版 Music 类任务会同时使用乐器、播放媒介和演奏相关角色/道具。
 * 当前词库缺少部分原版专用词条，先用已有词条覆盖相同的召唤入口。
 */
const MUSIC_IDS = new Set([
  'angel',
  'bell',
  'canary',
  'cockatoo',
  'dog',
  'demon',
  'drum',
  'flute-instrument',
  'goose',
  'guitar',
  'human',
  'macaw',
  'parakeet',
  'parrot',
  'piano',
  'paper',
  'radio',
  'robin',
  'snake',
  'sparrow',
  'trumpet',
  'tv',
  'violin',
  'wrench',
  'fork',
]);

/** 当前词库中能覆盖原版 Tech 类任务的设备、机器和技术工具。 */
const TECH_IDS = new Set([
  'camera',
  'chainsaw',
  'clock',
  'computer',
  'compass-tool',
  'drill',
  'elevator',
  'escalator',
  'fan',
  'fridge',
  'lamp',
  'lawnmower',
  'level',
  'magnet',
  'microwave',
  'oven',
  'phone',
  'printer',
  'ruler',
  'screwdriver',
  'sprinkler',
  'toaster',
  'torch',
  'watch',
  'wheel',
  'window',
]);

/**
 * Clothes 只收录可穿戴物与明确的服装/织物相关用品。
 * 词典的 cloth 材质标签也用于燃烧/外观，不足以直接代表服装类别，
 * 因此不能把所有带 cloth 标签的书、床或工具误归入 Clothes。
 */
const CLOTHING_IDS = new Set([
  'apron',
  'armor',
  'backpack',
  'boot',
  'cap',
  'coat',
  'crown',
  'crown-flower',
  'curtain',
  'dress',
  'glasses',
  'glove',
  'goggles',
  'helmet',
  'hat-top',
  'mask',
  'medal',
  'necklace',
  'pants',
  'pillow',
  'purse',
  'ring',
  'robe',
  'rope',
  'rug',
  'scarf',
  'shirt',
  'shoe',
  'sock',
  'tent',
  'tie',
  'towel',
  'umbrella-rain',
  'watch',
  'wardrobe',
]);

/** 原版 217 个 Object Shard 任务；按八类保留代表性词条。 */
const CATEGORY_TARGETS: Readonly<Record<ObjectShardCategory, number>> = {
  living: 31,
  food: 29,
  vehicle: 23,
  music: 25,
  tech: 26,
  weapon: 26,
  clothes: 25,
  misc: 32,
};

function categoryOf(entry: DictEntry): ObjectShardCategory {
  if (MUSIC_IDS.has(entry.id)) return 'music';
  if (TECH_IDS.has(entry.id)) return 'tech';
  if (entry.category === 'creature' || entry.category === 'plant') return 'living';
  if (entry.category === 'food') return 'food';
  if (entry.category === 'vehicle') return 'vehicle';
  if (entry.category === 'weapon') return 'weapon';
  if (CLOTHING_IDS.has(entry.id)) return 'clothes';
  return 'misc';
}

function stableEntriesByCategory(): Map<ObjectShardCategory, DictEntry[]> {
  const pools = new Map<ObjectShardCategory, DictEntry[]>(
    OBJECT_SHARD_CATEGORY_IDS.map((id) => [id, []]),
  );
  for (const entry of allEntries()) {
    pools.get(categoryOf(entry))!.push(entry);
  }
  for (const entries of pools.values()) entries.sort((a, b) => a.id.localeCompare(b.id));
  return pools;
}

function buildTasks(): ObjectShardTask[] {
  const pools = stableEntriesByCategory();
  const selected = new Set<string>();
  const tasks: ObjectShardTask[] = [];

  const add = (category: ObjectShardCategory, entry: DictEntry): void => {
    if (selected.has(entry.id)) return;
    selected.add(entry.id);
    tasks.push({
      id: `object-shard:${category}:${entry.id}`,
      category,
      typeId: entry.id,
      zh: entry.zh.name,
      en: entry.en.name,
    });
  };

  for (const category of OBJECT_SHARD_CATEGORY_IDS) {
    const pool = pools.get(category)!;
    for (const entry of pool.slice(0, CATEGORY_TARGETS[category])) add(category, entry);
  }

  // 词库某一类别不足配额时，从其余未选词条稳定补齐，保持任务总量接近原版。
  const targetTotal = Object.values(CATEGORY_TARGETS).reduce((sum, count) => sum + count, 0);
  if (tasks.length < targetTotal) {
    for (const category of OBJECT_SHARD_CATEGORY_IDS) {
      for (const entry of pools.get(category)!) {
        if (tasks.length >= targetTotal) break;
        add(category, entry);
      }
      if (tasks.length >= targetTotal) break;
    }
  }

  return tasks;
}

export const OBJECT_SHARD_TASKS: readonly ObjectShardTask[] = buildTasks();
export const OBJECT_SHARD_TOTAL = OBJECT_SHARD_TASKS.length;

const TASK_BY_TYPE_ID = new Map(OBJECT_SHARD_TASKS.map((task) => [task.typeId, task]));

export function objectShardTaskForTypeId(typeId: string): ObjectShardTask | undefined {
  return TASK_BY_TYPE_ID.get(typeId);
}

export function objectShardTasksForCategory(category: ObjectShardCategory): readonly ObjectShardTask[] {
  return OBJECT_SHARD_TASKS.filter((task) => task.category === category);
}

export function objectShardCategoryDef(category: ObjectShardCategory): ObjectShardCategoryDef {
  return OBJECT_SHARD_CATEGORIES.find((def) => def.id === category)!;
}
