/**
 * 存档存储 —— IndexedDB 封装。
 *
 * 浏览器无文件系统，自定义物体与进度存 IndexedDB。
 * Node 测试环境无 indexedDB，退化为内存存储，不阻断逻辑（保证可测）。
 */

import type { SaveData, CustomObjectDef } from '@/core/types/save';
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
    unlockedLevels: ['overworld-meadow'],
    difficultySetting: { tier: 1 as DifficultyTier, standard: 'cefr' as DifficultyStandard },
    questionSeed: generateSeed(),
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
          const loaded = get.result as SaveData | undefined;
          // 运行时数据完整性：旧存档可能无 questionSeed，补默认值
          // （非 schema 迁移，下次 save 自然持久化）
          if (loaded && typeof loaded.questionSeed === 'string' && loaded.questionSeed) {
            resolve(loaded);
          } else if (loaded) {
            resolve({ ...loaded, questionSeed: generateSeed() });
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
      memoryStore.set(KEY, data);
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
        tx.objectStore(STORE).put(data, KEY);
        tx.oncomplete = () => resolve();
      };
      req.onerror = () => resolve();
    });
  }

  /** 追加自定义物体并写回 */
  async addCustomObject(def: CustomObjectDef): Promise<SaveData> {
    const data = await this.load();
    data.customObjects.push(def);
    await this.save(data);
    return data;
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
