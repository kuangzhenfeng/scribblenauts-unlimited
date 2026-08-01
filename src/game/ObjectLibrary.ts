/**
 * Magic Backpack / Object Library 领域服务。
 *
 * SaveStore 只负责持久化，ObjectLibrary 负责把存档记录与当前词典定义组合成
 * 可展示、可再次生成的条目。它不依赖 Phaser，因此可以在 UI 和单测中复用。
 */

import type { SaveStore } from '@/core/data/save/SaveStore';
import { getEntry, registerCustomObject } from '@/core/data/dictionary/Dictionary';
import type { DictEntry } from '@/core/types/dictionary';
import type { CustomObjectDef, ObjectLibraryRecord } from '@/core/types/save';
import type { ParseCandidate } from '@/core/lex/InputParser';

export type ObjectLibrarySort = 'recent' | 'frequent' | 'name';

export interface ObjectLibraryQuery {
  search?: string;
  favoritesOnly?: boolean;
  sort?: ObjectLibrarySort;
  limit?: number;
}

export interface ObjectLibraryItem {
  typeId: string;
  record: ObjectLibraryRecord;
  entry?: DictEntry;
  customDef?: CustomObjectDef;
  zh: { name: string; aliases: string[] };
  en: { name: string; aliases: string[] };
  isCustom: boolean;
}

export class ObjectLibrary {
  constructor(private readonly store: SaveStore) {}

  /**
   * 查询背包。收藏项总是排在普通项前面，再按所选排序方式排列。
   * 旧存档即使没有 library 字段，也会从 customObjects 补出自定义物体条目。
   */
  async list(query: ObjectLibraryQuery = {}): Promise<ObjectLibraryItem[]> {
    const data = await this.store.load();
    for (const def of data.customObjects) registerCustomObject(def);

    const records = new Map<string, ObjectLibraryRecord>();
    for (const record of data.library) records.set(record.typeId, record);
    for (const def of data.customObjects) {
      if (!records.has(def.id)) {
        records.set(def.id, {
          typeId: def.id,
          firstUsedAt: def.created,
          lastUsedAt: def.created,
          useCount: 0,
          favorite: false,
        });
      }
    }

    const search = query.search?.trim().toLocaleLowerCase() ?? '';
    const items = [...records.values()]
      .map((record) => this.toItem(record, data.customObjects))
      .filter((item): item is ObjectLibraryItem => item !== undefined)
      .filter((item) => !query.favoritesOnly || item.record.favorite)
      .filter((item) => !search || this.matches(item, search));

    const sort = query.sort ?? 'recent';
    items.sort((a, b) => {
      if (a.record.favorite !== b.record.favorite) return a.record.favorite ? -1 : 1;
      if (sort === 'frequent' && a.record.useCount !== b.record.useCount) {
        return b.record.useCount - a.record.useCount;
      }
      if (sort === 'name') return a.zh.name.localeCompare(b.zh.name, 'zh-CN');
      return b.record.lastUsedAt - a.record.lastUsedAt;
    });

    return query.limit === undefined ? items : items.slice(0, Math.max(0, query.limit));
  }

  /** 记录一次成功召唤，并返回更新后的背包条目。 */
  async recordSpawn(typeId: string, usedAt = Date.now()): Promise<ObjectLibraryItem | undefined> {
    const data = await this.store.recordObjectUse(typeId, usedAt);
    const record = data.library.find((item) => item.typeId === typeId);
    if (!record) return undefined;
    const customDef = data.customObjects.find((def) => def.id === typeId);
    if (customDef) registerCustomObject(customDef);
    return this.toItem(record, data.customObjects);
  }

  /** 切换收藏状态，并返回更新后的条目。 */
  async toggleFavorite(typeId: string): Promise<ObjectLibraryItem | undefined> {
    const current = (await this.store.load()).library.find((item) => item.typeId === typeId);
    const data = await this.store.setLibraryFavorite(typeId, !(current?.favorite ?? false));
    const record = data.library.find((item) => item.typeId === typeId);
    return record ? this.toItem(record, data.customObjects) : undefined;
  }

  /**
   * 根据背包条目构造主线程可直接交给 Spawner 的候选。
   * 自定义物体的固有形容词从定义中恢复，避免再次生成时丢失编辑结果。
   */
  async getSpawnCandidate(typeId: string): Promise<ParseCandidate | undefined> {
    const data = await this.store.load();
    const customDef = data.customObjects.find((def) => def.id === typeId);
    if (customDef) registerCustomObject(customDef);
    const entry = getEntry(typeId);
    if (!entry) return undefined;
    const text = customDef?.en.name ?? entry.en.name;
    return {
      noun: { entryId: typeId, text },
      adjectives: (customDef?.adjectives ?? []).map((adjId) => ({ adjId, text: adjId })),
      score: text.length * 10,
      raw: text,
    };
  }

  /** 删除自定义物体的持久化定义与背包记录。 */
  async removeCustomObject(typeId: string): Promise<void> {
    await this.store.removeCustomObject(typeId);
  }

  private toItem(record: ObjectLibraryRecord, customObjects: CustomObjectDef[]): ObjectLibraryItem | undefined {
    const customDef = customObjects.find((def) => def.id === record.typeId);
    const entry = getEntry(record.typeId);
    if (!customDef && !entry) return undefined;
    const zh = customDef?.zh ?? entry?.zh;
    const en = customDef?.en ?? entry?.en;
    if (!zh || !en) return undefined;
    return {
      typeId: record.typeId,
      record,
      entry,
      customDef,
      zh: { name: zh.name, aliases: [...(zh.aliases ?? [])] },
      en: { name: en.name, aliases: [...(en.aliases ?? [])] },
      isCustom: Boolean(customDef),
    };
  }

  private matches(item: ObjectLibraryItem, search: string): boolean {
    const values = [
      item.typeId,
      item.zh.name,
      ...(item.zh.aliases ?? []),
      item.en.name,
      ...(item.en.aliases ?? []),
    ];
    return values.some((value) => value.toLocaleLowerCase().includes(search));
  }
}
