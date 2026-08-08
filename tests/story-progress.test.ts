import { describe, expect, it } from 'vitest';
import {
  advanceStoryProgress,
  createStoryProgress,
  markStoryIntroSeen,
  normalizeStoryProgress,
  resetStoryMilestone,
  STORY_CURSE_BREAK_STARITES,
  STORY_FULL_COLLECTION_STARITES,
} from '@/core/game/StoryProgress';

describe('StoryProgress', () => {
  it('starts with Lily petrified and the opening story unseen', () => {
    expect(createStoryProgress()).toEqual({
      introSeen: false,
      lilyCondition: 'petrified',
      edgarRevealed: false,
      worldMapUnlocked: false,
      fullCollectionComplete: false,
    });
  });

  it('marks the opening story without changing the curse state', () => {
    const next = markStoryIntroSeen(createStoryProgress());
    expect(next.introSeen).toBe(true);
    expect(next.lilyCondition).toBe('petrified');
    expect(next.edgarRevealed).toBe(false);
    expect(next.worldMapUnlocked).toBe(false);
    expect(next.fullCollectionComplete).toBe(false);
  });

  it('keeps Lily petrified before the shared Starite threshold', () => {
    const progress = markStoryIntroSeen(createStoryProgress());
    const next = advanceStoryProgress(progress, STORY_CURSE_BREAK_STARITES - 1);
    expect(next.lilyCondition).toBe('petrified');
    expect(next.worldMapUnlocked).toBe(true);
    expect(next.fullCollectionComplete).toBe(false);
  });

  it('reveals the cure and Edgar together at the threshold', () => {
    const next = advanceStoryProgress(createStoryProgress(), STORY_CURSE_BREAK_STARITES);
    expect(next.lilyCondition).toBe('cured');
    expect(next.edgarRevealed).toBe(true);
    expect(next.worldMapUnlocked).toBe(true);
  });

  it('records the 106 Starite full collection milestone independently', () => {
    const next = advanceStoryProgress(createStoryProgress(), STORY_FULL_COLLECTION_STARITES);
    expect(next.fullCollectionComplete).toBe(true);
    expect(next.lilyCondition).toBe('cured');
  });

  it('unlocks the world map at three Starites without curing Lily', () => {
    const next = advanceStoryProgress(createStoryProgress(), 3);
    expect(next.worldMapUnlocked).toBe(true);
    expect(next.lilyCondition).toBe('petrified');
  });

  it('normalizes impossible saved combinations', () => {
    expect(normalizeStoryProgress({ lilyCondition: 'petrified', edgarRevealed: true })).toEqual(
      createStoryProgress(),
    );
    expect(normalizeStoryProgress({ lilyCondition: 'cured', edgarRevealed: false }).edgarRevealed).toBe(true);
  });

  it('resets collectible milestones while keeping the opening story seen', () => {
    const cured = advanceStoryProgress(markStoryIntroSeen(createStoryProgress()), STORY_CURSE_BREAK_STARITES);
    expect(resetStoryMilestone(cured)).toEqual({
      introSeen: true,
      lilyCondition: 'petrified',
      edgarRevealed: false,
      worldMapUnlocked: true,
      fullCollectionComplete: false,
    });
  });
});
