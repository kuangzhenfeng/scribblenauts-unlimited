/**
 * 词典静态校验单测 —— 保证词条数据一致性。
 */

import { describe, it, expect } from 'vitest';
import { allEntries, getEntry, size } from '@/core/data/dictionary/Dictionary';
import { allAdjectives } from '@/core/data/dictionary/adjectives';
import { normalizeEnglishKey } from '@/core/data/dictionary/normalize';
import { WORD_METADATA } from '@/core/data/questions/word-metadata';

function findExactCollisions(
  entries: { id: string; zh: { name: string; aliases?: string[] }; en: { name: string; aliases?: string[] } }[],
) {
  const collisions: string[] = [];
  for (const language of ['zh', 'en'] as const) {
    const owners = new Map<string, Set<string>>();
    for (const entry of entries) {
      const values = [entry[language].name, ...(entry[language].aliases ?? [])];
      const entryKeys = new Set<string>();
      for (const value of values) {
        const key = language === 'en' ? normalizeEnglishKey(value) : value;
        if (entryKeys.has(key)) collisions.push(`${language}:${key}=${entry.id}(duplicate)`);
        entryKeys.add(key);
        const ids = owners.get(key) ?? new Set<string>();
        ids.add(entry.id);
        owners.set(key, ids);
      }
    }
    for (const [value, ids] of owners) {
      if (ids.size > 1) collisions.push(`${language}:${value}=${[...ids].sort().join(',')}`);
    }
  }
  return collisions.sort();
}

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

  it('declares composable equipment capabilities', () => {
    expect(getEntry('gun')?.tags.flags.has('ranged')).toBe(true);
    expect(getEntry('gun')?.tags.flags.has('projectile')).toBe(false);
    expect(getEntry('wing')?.tags.flags.has('wing')).toBe(true);
    expect(getEntry('dragon')?.tags.flags.has('rideable')).toBe(true);
    expect(getEntry('horse')?.tags.flags.has('rideable')).toBe(true);
    expect(getEntry('unicorn')?.tags.flags.has('rideable')).toBe(true);
    expect(getEntry('bullet')?.tags.flags.has('projectile')).toBe(true);
    for (const id of ['slingshot', 'crossbow', 'cannon', 'rifle']) {
      expect(getEntry(id)?.tags.flags.has('ranged')).toBe(true);
    }
  });

  it('has no exact Chinese or English collisions within a dictionary layer', () => {
    expect(findExactCollisions(allEntries())).toEqual([]);
    expect(findExactCollisions(allAdjectives())).toEqual([]);
  });

  it('has an explicit difficulty record for every dictionary id', () => {
    const ids = new Set(Object.keys(WORD_METADATA));
    const missing = [...allEntries(), ...allAdjectives()]
      .filter((entry) => !ids.has(entry.id))
      .map((entry) => entry.id)
      .filter((id, index, all) => all.indexOf(id) === index);
    expect(missing).toEqual([]);
  });

  it('has no difficulty records for removed dictionary ids', () => {
    const validIds = new Set([...allEntries(), ...allAdjectives()].map((entry) => entry.id));
    const orphaned = Object.keys(WORD_METADATA).filter((id) => !validIds.has(id));
    expect(orphaned).toEqual([]);
  });
});
