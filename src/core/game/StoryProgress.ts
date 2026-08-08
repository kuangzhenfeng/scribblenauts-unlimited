/**
 * 叙事进度 —— 只保存与 Starite 主线直接相关的状态。
 *
 * 原版 PC 的主线里程碑分成两步：3 个 Starite 开放世界地图，
 * 60 个 Starite 解除 Lily 的石化诅咒。两个阈值必须与 GoalSystem
 * 和存档里的可达内容保持一致，不能把地图解锁误当成通关。
 */

export const STORY_WORLD_MAP_UNLOCK_STARITES = 3;
export const STORY_CURSE_BREAK_STARITES = 60;
export const STORY_FULL_COLLECTION_STARITES = 106;

export type LilyCondition = 'petrified' | 'cured';

export interface StoryProgress {
  /** 是否已经看过烂苹果与 Lily 诅咒的入场叙事。 */
  introSeen: boolean;
  /** Lily 当前的诅咒状态。 */
  lilyCondition: LilyCondition;
  /** 是否已经揭示老乞丐其实是 Edgar。 */
  edgarRevealed: boolean;
  /** 是否已经达到 3 个 Starite 的世界地图里程碑。 */
  worldMapUnlocked: boolean;
  /** 是否已经达到 PC 全收集成就的 106 Starite 里程碑。 */
  fullCollectionComplete: boolean;
}

export function createStoryProgress(): StoryProgress {
  return {
    introSeen: false,
    lilyCondition: 'petrified',
    edgarRevealed: false,
    worldMapUnlocked: false,
    fullCollectionComplete: false,
  };
}

/** 只接受存档中已知的枚举值，避免脏数据传播到 UI 和游戏层。 */
export function normalizeStoryProgress(value: Partial<StoryProgress> | undefined): StoryProgress {
  const defaults = createStoryProgress();
  const lilyCondition = value?.lilyCondition === 'cured' ? 'cured' : defaults.lilyCondition;
  const edgarRevealed = lilyCondition === 'cured';
  return {
    introSeen: value?.introSeen === true,
    lilyCondition,
    edgarRevealed,
    worldMapUnlocked: value?.worldMapUnlocked === true || lilyCondition === 'cured',
    fullCollectionComplete: value?.fullCollectionComplete === true,
  };
}

export function markStoryIntroSeen(progress: StoryProgress): StoryProgress {
  return { ...progress, introSeen: true };
}

/**
 * 根据已获得的 Starite 推进叙事状态。
 * 状态只向前推进：读到已经解咒的存档时不会因为计数重置而重新石化。
 */
export function advanceStoryProgress(progress: StoryProgress, starites: number): StoryProgress {
  const worldMapUnlocked = progress.worldMapUnlocked || starites >= STORY_WORLD_MAP_UNLOCK_STARITES;
  const fullCollectionComplete = progress.fullCollectionComplete || starites >= STORY_FULL_COLLECTION_STARITES;
  if (progress.lilyCondition === 'cured' || starites >= STORY_CURSE_BREAK_STARITES) {
    return {
      ...progress,
      lilyCondition: 'cured',
      edgarRevealed: true,
      worldMapUnlocked: true,
      fullCollectionComplete,
    };
  }
  if (worldMapUnlocked === progress.worldMapUnlocked && fullCollectionComplete === progress.fullCollectionComplete) return progress;
  return { ...progress, worldMapUnlocked, fullCollectionComplete };
}

/** 重置题目/收集进度时保留入场叙事观看记录，但重新进入诅咒阶段。 */
export function resetStoryMilestone(progress: StoryProgress): StoryProgress {
  return {
    ...progress,
    lilyCondition: 'petrified',
    edgarRevealed: false,
  };
}
