import { beforeEach, describe, expect, it } from 'vitest';
import { SaveStore } from '@/core/data/save/SaveStore';
import { ObjectEditor } from '@/game/ObjectEditor';
import { ObjectLibrary } from '@/game/ObjectLibrary';

describe('Magic Backpack and ObjectEditor', () => {
  let store: SaveStore;

  beforeEach(async () => {
    store = new SaveStore();
    await store.clear();
  });

  it('records recent use, frequency and favorites for built-in objects', async () => {
    const library = new ObjectLibrary(store);
    await library.recordSpawn('dog', 100);
    await library.recordSpawn('dog', 200);
    await library.recordSpawn('box', 300);
    await library.toggleFavorite('dog');

    const items = await library.list();
    expect(items[0].typeId).toBe('dog');
    expect(items[0].record.useCount).toBe(2);
    expect(items[0].record.favorite).toBe(true);
    expect((await library.list({ search: '方块' }))[0].typeId).toBe('box');
    expect((await library.list({ favoritesOnly: true })).map((item) => item.typeId)).toEqual(['dog']);
  });

  it('normalizes Chinese base and adjective names into stable IDs', async () => {
    const editor = new ObjectEditor(store);
    const result = await editor.save({
      zh: { name: '红色大狗', aliases: '大狗，红狗' },
      en: { name: 'big red dog', aliases: 'large red dog' },
      baseText: '狗',
      adjectives: '红色 大',
      appearanceOverrides: { color: '#e03131' },
    });

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.baseTypeId).toBe('dog');
    expect(result.adjectives).toEqual(['red', 'big']);
    expect(result.zh.aliases).toEqual(['大狗', '红狗']);
    expect(result.en.name).toBe('big red dog');
    expect(result.appearanceOverrides).toMatchObject({ color: '#E03131', bodyColor: '#E03131' });
  });

  it('updates, duplicates and removes custom definitions without duplicate active saves', async () => {
    const editor = new ObjectEditor(store);
    const first = await editor.save({
      zh: { name: '图书馆测试龙' },
      en: { name: 'library test dragon' },
      baseTypeId: 'dog',
      adjectives: ['flying'],
    });
    expect('error' in first).toBe(false);
    if ('error' in first) return;

    const updated = await editor.update(first.id, {
      zh: { name: '图书馆测试龙改' },
      en: { name: 'library test dragon edited' },
      baseText: 'dog',
      adjectives: '飞行 紫色',
    });
    expect('error' in updated).toBe(false);
    expect((await store.load()).customObjects).toHaveLength(1);

    const copy = await editor.duplicate(first.id);
    expect('error' in copy).toBe(false);
    expect((await store.load()).customObjects).toHaveLength(2);

    const library = new ObjectLibrary(store);
    const candidate = await library.getSpawnCandidate(first.id);
    expect(candidate?.noun.entryId).toBe(first.id);
    expect(candidate?.adjectives.map((item) => item.adjId)).toEqual(['flying', 'purple']);

    expect(await editor.delete(first.id)).toBeUndefined();
    expect((await store.load()).customObjects.some((item) => item.id === first.id)).toBe(false);
    expect((await library.list()).some((item) => item.typeId === first.id)).toBe(false);
  });

  it('rejects a duplicate active name', async () => {
    const editor = new ObjectEditor(store);
    const first = await editor.save({
      zh: { name: '唯一测试物体' },
      en: { name: 'unique test object' },
      baseTypeId: 'box',
      adjectives: [],
    });
    expect('error' in first).toBe(false);
    const second = await editor.save({
      zh: { name: '唯一测试物体' },
      en: { name: 'another test object' },
      baseTypeId: 'box',
      adjectives: [],
    });
    expect(second).toEqual({ error: '名称「唯一测试物体」已存在' });
  });

  it('normalizes multi-part composite attachments into stable entry ids and anchors', async () => {
    const editor = new ObjectEditor(store);
    const result = await editor.save({
      zh: { name: '组合测试车' },
      en: { name: 'composite test car' },
      baseTypeId: 'car',
      adjectives: [],
      attachments: 'wheel@0:-18, lamp',
    });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.attachments).toEqual([
      { childTypeId: 'wheel', anchor: [0, -18] },
      { childTypeId: 'lamp', anchor: [0, -30] },
    ]);
    expect((await store.load()).customObjects[0].attachments).toEqual(result.attachments);
  });
});
