/**
 * 存档存储 —— IndexedDB 封装。
 *
 * 浏览器无文件系统，自定义物体与进度存 IndexedDB。
 * Node 测试环境无 indexedDB，退化为内存存储，不阻断逻辑（保证可测）。
 */

import type { SaveData, CustomObjectDef, ObjectLibraryRecord } from '@/core/types/save';
import type { DifficultyTier, DifficultyStandard } from '@/core/types/question';
import { generateSeed } from '@/util/rng';

const DB_NAME = 'scribblenauts-unlimited';
const STORE = 'save';
const KEY = 'progress';

const isBrowser = typeof indexedDB !== 'undefined';

const memoryStore = new Map<string, SaveData>();

function currentSave(): SaveData {
  return {
    schemaVersion: 3,
    starites: 0,
    shards: 0,
    completedSlots: [],
    customObjects: [],
    library: [],
    unlockedLevels: ['overworld-meadow'],
    difficultySetting: { tier: 1 as DifficultyTier, standard: 'cefr' as DifficultyStandard },
    questionSeed: generateSeed(),
  };
}

/** 补齐旧存档缺失的可选字段，并避免把脏数据传播到业务层。 */
function normalizeSave(data: Partial<SaveData> | undefined): SaveData {
  const defaults = currentSave();
  if (!data) return defaults;
  return {
    ...defaults,
    ...data,
    customObjects: Array.isArray(data.customObjects) ? data.customObjects : [],
    library: Array.isArray(data.library)
      ? data.library.filter((record): record is ObjectLibraryRecord => Boolean(record && record.typeId))
      : [],
    unlockedLevels: Array.isArray(data.unlockedLevels) && data.unlockedLevels.length > 0
      ? data.unlockedLevels
      : defaults.unlockedLevels,
    completedSlots: Array.isArray(data.completedSlots) ? data.completedSlots : [],
  };
}

export class SaveStore {
  async load(): Promise<SaveData> {
    if (!isBrowser) {
      return memoryStore.get(KEY) ?? currentSave();
    }
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE, 'readonly');
        const get = tx.objectStore(STORE).get(KEY);
        get.onsuccess = () => {
          const loaded = get.result as Partial<SaveData> | undefined;
          // 运行时数据完整性：旧存档可能无 questionSeed，补默认值
          // （非 schema 迁移，下次 save 自然持久化）
          if (loaded && typeof loaded.questionSeed === 'string' && loaded.questionSeed) {
            resolve(normalizeSave(loaded));
          } else if (loaded) {
            resolve(normalizeSave({ ...loaded, questionSeed: generateSeed() }));
          } else {
            resolve(currentSave());
          }
        };
        get.onerror = () => resolve(currentSave());
      };
      req.onerror = () => resolve(currentSave());
    });
  }

  async save(data: SaveData): Promise<void> {
    if (!isBrowser) {
      memoryStore.set(KEY, normalizeSave(data));
      return;
    }
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(normalizeSave(data), KEY);
        tx.oncomplete = () => resolve();
      };
      req.onerror = () => resolve();
    });
  }

  /** 追加自定义物体并写回；同 id 时覆盖，避免编辑后产生重复定义。 */
  async addCustomObject(def: CustomObjectDef): Promise<SaveData> {
    return this.upsertCustomObject(def);
  }

  /** 新增或更新自定义物体，并确保它出现在 Magic Backpack 中。 */
  async upsertCustomObject(def: CustomObjectDef): Promise<SaveData> {
    const data = await this.load();
    const index = data.customObjects.findIndex((item) => item.id === def.id);
    if (index >= 0) data.customObjects[index] = def;
    else data.customObjects.push(def);
    if (!data.library.some((record) => record.typeId === def.id)) {
      data.library.push({
        typeId: def.id,
        firstUsedAt: def.created,
        lastUsedAt: def.created,
        useCount: 0,
        favorite: false,
      });
    }
    await this.save(data);
    return data;
  }

  /** 删除自定义物体及其背包记录。 */
  async removeCustomObject(id: string): Promise<SaveData> {
    const data = await this.load();
    data.customObjects = data.customObjects.filter((item) => item.id !== id);
    data.library = data.library.filter((record) => record.typeId !== id);
    await this.save(data);
    return data;
  }

  /** 读取一个自定义物体定义。 */
  async getCustomObject(id: string): Promise<CustomObjectDef | undefined> {
    const data = await this.load();
    return data.customObjects.find((item) => item.id === id);
  }

  /** 记录一次成功召唤，内置物体和自定义物体共用此入口。 */
  async recordObjectUse(typeId: string, usedAt = Date.now()): Promise<SaveData> {
    const normalizedTypeId = typeId.trim();
    if (!normalizedTypeId) return this.load();
    const data = await this.load();
    const existing = data.library.find((record) => record.typeId === normalizedTypeId);
    if (existing) {
      existing.lastUsedAt = usedAt;
      existing.useCount += 1;
    } else {
      data.library.push({
        typeId: normalizedTypeId,
        firstUsedAt: usedAt,
        lastUsedAt: usedAt,
        useCount: 1,
        favorite: false,
      });
    }
    await this.save(data);
    return data;
  }

  /** 切换或设置背包收藏状态。 */
  async setLibraryFavorite(typeId: string, favorite?: boolean): Promise<SaveData> {
    const data = await this.load();
    const existing = data.library.find((record) => record.typeId === typeId);
    if (existing) {
      existing.favorite = favorite ?? !existing.favorite;
    } else {
      const now = Date.now();
      data.library.push({ typeId, firstUsedAt: now, lastUsedAt: now, useCount: 0, favorite: favorite ?? true });
    }
    await this.save(data);
    return data;
  }

  /** 读取背包记录，按最近使用时间降序返回。 */
  async listLibraryRecords(): Promise<ObjectLibraryRecord[]> {
    const data = await this.load();
    return [...data.library].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  async updateProgress(starites: number, shards: number, completed: string[]): Promise<SaveData> {
    const data = await this.load();
    data.starites = starites;
    data.shards = shards;
    data.completedSlots = completed;
    await this.save(data);
    return data;
  }

  /** 更新难度设置（玩家在选关界面切换难度后持久化） */
  async updateDifficultySetting(tier: DifficultyTier, standard: DifficultyStandard): Promise<SaveData> {
    const data = await this.load();
    data.difficultySetting = { tier, standard };
    await this.save(data);
    return data;
  }

  /**
   * 更新题目随机种子。换种子 = 换一轮题目，调用方应同步清题目进度
   * （clearChallengeProgress），因旧 completedSlots 对应的具体题目已不存在。
   */
  async updateQuestionSeed(seed: string): Promise<SaveData> {
    const data = await this.load();
    data.questionSeed = seed;
    await this.save(data);
    return data;
  }

  /**
   * 清空题目进度：completedSlots/starites/shards 归零。
   * 保留 unlockedLevels（关卡访问权，与题目内容正交）与 customObjects。
   * 换种子、重置本关均经此入口。
   */
  async clearChallengeProgress(): Promise<SaveData> {
    const data = await this.load();
    data.starites = 0;
    data.shards = 0;
    data.completedSlots = [];
    await this.save(data);
    return data;
  }

  /** 解锁关卡并写回，幂等：已存在不重复追加 */
  async unlockLevel(levelId: string): Promise<SaveData> {
    const data = await this.load();
    if (!data.unlockedLevels.includes(levelId)) {
      data.unlockedLevels = [...data.unlockedLevels, levelId];
      await this.save(data);
    }
    return data;
  }

  /**
   * 完整重置进度：挑战清零、Starite/碎片归零、关卡解锁回退到仅首关。
   * 保留 customObjects（自制物体与关卡进度无关）。
   */
  async resetAll(): Promise<SaveData> {
    const data = await this.load();
    data.starites = 0;
    data.shards = 0;
    data.completedSlots = [];
    data.unlockedLevels = ['overworld-meadow'];
    await this.save(data);
    return data;
  }

  /** 纯读：关卡是否已解锁 */
  async isUnlocked(levelId: string): Promise<boolean> {
    const data = await this.load();
    return data.unlockedLevels.includes(levelId);
  }

  /**
   * 清除存档：把进度记录重置为初始态，彻底清空 IndexedDB 中对应条目
   * （比 resetAll 更干净：resetAll 仍保留记录，clear 删除记录本身）。
   */
  async clear(): Promise<void> {
    if (!isBrowser) {
      memoryStore.delete(KEY);
      return;
    }
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    });
  }
}
