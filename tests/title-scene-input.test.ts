// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('phaser', () => {
  class Scene {
    constructor(_config?: unknown) {}
  }
  return { default: { Scene } };
});

vi.mock('@/audio/MusicDirector', () => ({
  music: { start: vi.fn(), setMood: vi.fn() },
}));

import { TitleScene } from '@/engine/scenes/TitleScene';

interface TitleSceneHarness {
  scene: TitleScene;
  pointerdown?: () => void;
  start: ReturnType<typeof vi.fn>;
}

function createHarness(): TitleSceneHarness {
  const scene = new TitleScene();
  const handlers = new Map<string, () => void>();
  const start = vi.fn();
  const sceneState = scene as unknown as Record<string, unknown>;

  sceneState.scale = { width: 1280, height: 720 };
  sceneState.textures = { exists: () => false };
  sceneState.add = { image: vi.fn() };
  sceneState.events = { once: vi.fn() };
  sceneState.input = {
    keyboard: { on: vi.fn(), off: vi.fn() },
    on: vi.fn((event: string, handler: () => void, context: TitleScene) => {
      handlers.set(event, handler.bind(context));
    }),
    off: vi.fn(),
  };
  sceneState.cameras = { main: { fadeOut: vi.fn(), setBackgroundColor: vi.fn() } };
  sceneState.scene = { start, manager: { processQueue: vi.fn() } };

  scene.create();

  return { scene, pointerdown: handlers.get('pointerdown'), start };
}

describe('TitleScene input boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
  });

  afterEach(() => {
    document.getElementById('title-overlay')?.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not enter WorldScene when clicking the title canvas', () => {
    const { pointerdown, start } = createHarness();

    pointerdown?.();
    vi.runAllTimers();

    expect(start).not.toHaveBeenCalledWith('WorldScene');
  });
});
