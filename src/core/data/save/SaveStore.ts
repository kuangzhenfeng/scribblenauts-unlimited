/**
 * 存档存储 —— IndexedDB 封装。
 *
 * 浏览器无文件系统，自定义物体与进度存 IndexedDB。
 * Node 测试环境无 indexedDB，退化为内存存储，不阻断逻辑（保证可测）。
 */

import type { SaveData, CustomObjectDef } from '@/core/types/save';

const DB_NAME = 'scribblenauts-unlimited';
const STORE = 'save';
const KEY = 'progress';

const isBrowser = typeof indexedDB !== 'undefined';

const memoryStore = new Map<string, SaveData>();

function currentSave(): SaveData {
  return {
    schemaVersion: 1,
    starites: 0,
    shards: 0,
    completedChallenges: [],
    customObjects: [],
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
        get.onsuccess = () => resolve((get.result as SaveData | undefined) ?? currentSave());
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
    data.completedChallenges = completed;
    await this.save(data);
    return data;
  }
}
