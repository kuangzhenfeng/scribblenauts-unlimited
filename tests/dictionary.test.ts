/**
 * 词典静态校验单测 —— 保证词条数据一致性。
 */

import { describe, it, expect } from 'vitest';
import { allEntries, getEntry, size } from '@/core/data/dictionary/Dictionary';

describe('dictionary box entry', () => {
  it('box entry exists with bilingual names', () => {
    const box = getEntry('box');
    expect(box).toBeDefined();
    expect(box!.zh.name).toBe('方块');
    expect(box!.en.name).toBe('box');
  });

  it('all entries have unique ids and non-empty names', () => {
    const ids = new Set<string>();
    for (const e of allEntries()) {
      expect(e.id).toBeTruthy();
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.zh.name).toBeTruthy();
      expect(e.en.name).toBeTruthy();
    }
  });

  it('size matches allEntries length', () => {
    expect(size()).toBe(allEntries().length);
  });
});
