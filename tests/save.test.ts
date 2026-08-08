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
    expect(data.schemaVersion).toBe(4);
    expect(data.starites).toBe(0);
    expect(data.objectShards).toBe(0);
    expect(data.objectShardStarites).toBe(0);
    expect(data.completedObjectShardTasks).toEqual([]);
    expect(data.customObjects).toEqual([]);
    expect(data.completedSlots).toEqual([]);
    expect(data.difficultySetting.tier).toBe(1);
    expect(data.difficultySetting.standard).toBe('cefr');
    expect(data.tutorialCompleted).toBe(false);
    expect(data.avatarId).toBe('maxwell');
    expect(data.storyProgress).toEqual({
      introSeen: false,
      lilyCondition: 'petrified',
      edgarRevealed: false,
      worldMapUnlocked: false,
      fullCollectionComplete: false,
    });
    expect(typeof data.questionSeed).toBe('string');
    expect(data.questionSeed.length).toBeGreaterThan(0);
  });

  it('updateProgress persists starites/shards/completedSlots', async () => {
    const store = new SaveStore();
    await store.updateProgress(3, 5, ['stage-cave:2:cefr:0']);
    const data = await store.load();
    expect(data.starites).toBe(3);
    expect(data.shards).toBe(5);
    expect(data.completedSlots).toEqual(['stage-cave:2:cefr:0']);
  });

  it('persists Object Shard progress and keeps its Starite source when challenge progress clears', async () => {
    const store = new SaveStore();
    await store.updateProgress(3, 5, ['stage-cave:2:cefr:0'], 7, ['object-shard:living:dog'], 1);
    const saved = await store.load();
    expect(saved.objectShards).toBe(7);
    expect(saved.completedObjectShardTasks).toEqual(['object-shard:living:dog']);
    expect(saved.objectShardStarites).toBe(1);

    await store.clearChallengeProgress();
    const cleared = await store.load();
    expect(cleared.starites).toBe(1);
    expect(cleared.shards).toBe(0);
    expect(cleared.objectShards).toBe(7);
    expect(cleared.completedObjectShardTasks).toEqual(['object-shard:living:dog']);
  });

  it('updateDifficultySetting persists tier and standard', async () => {
    const store = new SaveStore();
    await store.updateDifficultySetting(3, 'frequency');
    const data = await store.load();
    expect(data.difficultySetting.tier).toBe(3);
    expect(data.difficultySetting.standard).toBe('frequency');
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

  it('default save has first level unlocked', async () => {
    const store = new SaveStore();
    const data = await store.load();
    expect(data.unlockedLevels).toEqual(['overworld-meadow']);
    expect(await store.isUnlocked('overworld-meadow')).toBe(true);
    expect(await store.isUnlocked('stage-cave')).toBe(false);
  });

  it('unlockLevel adds new level to unlocked list', async () => {
    const store = new SaveStore();
    await store.unlockLevel('stage-cave');
    const data = await store.load();
    expect(data.unlockedLevels).toContain('stage-cave');
    expect(await store.isUnlocked('stage-cave')).toBe(true);
  });

  it('unlockLevel is idempotent', async () => {
    const store = new SaveStore();
    await store.unlockLevel('stage-snow');
    await store.unlockLevel('stage-snow');
    const data = await store.load();
    const count = data.unlockedLevels.filter((id) => id === 'stage-snow').length;
    expect(count).toBe(1);
  });

  it('unlockAllLevels adds every requested level without duplicates', async () => {
    const store = new SaveStore();
    await store.clear();
    await store.unlockAllLevels(['overworld-meadow', 'stage-cave', 'stage-snow', 'stage-cave']);
    const data = await store.load();
    expect(data.unlockedLevels).toEqual(['overworld-meadow', 'stage-cave', 'stage-snow']);
  });

  it('updateQuestionSeed persists seed', async () => {
    const store = new SaveStore();
    await store.updateQuestionSeed('abc123');
    const data = await store.load();
    expect(data.questionSeed).toBe('abc123');
  });

  it('markTutorialCompleted persists the first-run flow state', async () => {
    const store = new SaveStore();
    await store.markTutorialCompleted();
    expect((await store.load()).tutorialCompleted).toBe(true);
  });

  it('persists the selected family avatar', async () => {
    const store = new SaveStore();
    const data = await store.updateAvatarId('sibling-01');
    expect(data.avatarId).toBe('sibling-01');
    expect((await store.load()).avatarId).toBe('sibling-01');
  });

  it('updateStoryProgress persists the Lily narrative state', async () => {
    const store = new SaveStore();
    await store.updateStoryProgress({ introSeen: true, lilyCondition: 'cured', edgarRevealed: true, worldMapUnlocked: true, fullCollectionComplete: false });
    expect((await store.load()).storyProgress).toEqual({
      introSeen: true,
      lilyCondition: 'cured',
      edgarRevealed: true,
      worldMapUnlocked: true,
      fullCollectionComplete: false,
    });
  });

  it('clearing challenge progress returns Lily to the curse stage but keeps the opening seen', async () => {
    const store = new SaveStore();
    await store.updateStoryProgress({ introSeen: true, lilyCondition: 'cured', edgarRevealed: true, worldMapUnlocked: true, fullCollectionComplete: false });
    await store.clearChallengeProgress();
    expect((await store.load()).storyProgress).toEqual({
      introSeen: true,
      lilyCondition: 'petrified',
      edgarRevealed: false,
      worldMapUnlocked: true,
      fullCollectionComplete: false,
    });
  });

  it('clearChallengeProgress clears slots and counters but keeps unlocks', async () => {
    const store = new SaveStore();
    await store.clear();
    // 预置：进度 + 解锁第二关
    await store.updateProgress(2, 5, ['stage-cave:2:cefr:0', 'stage-cave:2:cefr:1']);
    await store.unlockLevel('stage-cave');
    // 换种子触发清进度
    await store.clearChallengeProgress();
    const data = await store.load();
    expect(data.starites).toBe(0);
    expect(data.shards).toBe(0);
    expect(data.completedSlots).toEqual([]);
    // 关卡解锁保留（访问权与题目内容正交）
    expect(data.unlockedLevels).toContain('overworld-meadow');
    expect(data.unlockedLevels).toContain('stage-cave');
  });
});
