/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateSeed = vi.hoisted(() => vi.fn());

vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {},
    Physics: { Matter: { Matter: {} } },
  },
}));

vi.mock('@/util/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/util/rng')>();
  return { ...actual, generateSeed: mockGenerateSeed };
});

import { createQuizSessionSeed, QuizScene } from '@/engine/scenes/QuizScene';
import type { Lang } from '@/core/data/settings/SettingsStore';
import { setLang } from '@/core/i18n/I18n';

describe('QuizScene language switching', () => {
  beforeEach(() => {
    mockGenerateSeed.mockReset();
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
  });

  it('creates a fresh session seed instead of reusing the saved seed', () => {
    mockGenerateSeed.mockReturnValueOnce('saved-seed').mockReturnValueOnce('fresh-seed');

    expect(createQuizSessionSeed('saved-seed')).toBe('saved-seed-quiz');
    expect(createQuizSessionSeed('saved-seed')).toBe('fresh-seed');
  });

  it('refreshes localized UI without restarting the current round', () => {
    const scene = Object.create(QuizScene.prototype) as QuizScene;
    const restart = vi.fn();
    const refreshTopBar = vi.fn();
    const refreshQuestionCard = vi.fn();
    const refreshKeyboard = vi.fn();
    const applyViewport = vi.fn();

    Object.assign(scene as object, {
      paused: false,
      currentQuestion: {
        prompt: { zh: '中文题面', en: 'English prompt' },
        hint: { zh: '中文提示', en: 'English hint' },
      },
      roundPicker: { currentRound: 4, currentScore: 2, currentStreak: 2 },
      topBar: { refreshLocale: refreshTopBar },
      questionCard: { refreshLocale: refreshQuestionCard },
      keyboard: { refreshLocale: refreshKeyboard },
      _applyViewport: applyViewport,
      scene: { restart },
    });

    setLang('en');
    (scene as unknown as { _onLanguage: (language: Lang) => void })._onLanguage('en');

    expect(restart).not.toHaveBeenCalled();
    expect(refreshTopBar).toHaveBeenCalledWith(4, 2, 2);
    expect(refreshQuestionCard).toHaveBeenCalledWith('English prompt', 'English hint');
    expect(refreshKeyboard).toHaveBeenCalledOnce();
    expect(applyViewport).toHaveBeenCalledOnce();
  });
});
