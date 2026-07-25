/**
 * 存档恢复单测 —— 验证 SaveStore 的读写与自定义物体恢复。
 *
 * node 环境 indexedDB 退化为内存存储，不阻断逻辑。
 */

import { describe, it, expect } from 'vitest';
import { SaveStore } from '@/core/data/save/SaveStore';
import type { CustomObjectDef } from '@/core/types/save';

describe('SaveStore', () => {
  it('load returns default save when empty', async () => {
    const store = new SaveStore();
    const data = await store.load();
    expect(data.schemaVersion).toBe(1);
    expect(data.starites).toBe(0);
    expect(data.customObjects).toEqual([]);
  });

  it('updateProgress persists starites/shards/completed', async () => {
    const store = new SaveStore();
    await store.updateProgress(3, 5, ['ch1', 'ch2']);
    const data = await store.load();
    expect(data.starites).toBe(3);
    expect(data.shards).toBe(5);
    expect(data.completedChallenges).toEqual(['ch1', 'ch2']);
  });

  it('addCustomObject persists def', async () => {
    const store = new SaveStore();
    const def: CustomObjectDef = {
      id: 'custom:dragon',
      zh: { name: '飞龙' },
      en: { name: 'dragon' },
      baseTypeId: 'dog',
      adjectives: ['flying', 'red'],
      created: 1,
    };
    await store.addCustomObject(def);
    const data = await store.load();
    expect(data.customObjects).toHaveLength(1);
    expect(data.customObjects[0].id).toBe('custom:dragon');
  });
});
