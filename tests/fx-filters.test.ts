import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    BlendModes: { NORMAL: 0, MULTIPLY: 2 },
  },
}));

const { FxFilters } = await import('@/fx/Filters');

describe('FxFilters', () => {
  it('纸纹层使用 WebGL 安全的普通叠加而不是全屏 Multiply', () => {
    const setBlendMode = vi.fn();
    const grain = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setBlendMode: setBlendMode.mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
    };
    const graphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      generateTexture: vi.fn(),
      destroy: vi.fn(),
    };
    const scene = {
      textures: { exists: vi.fn(() => false) },
      make: { graphics: vi.fn(() => graphics) },
      add: { tileSprite: vi.fn(() => grain) },
    };
    const fx = new FxFilters(scene as never, { width: 100, height: 80 } as never);

    fx.applyPaperGrain();

    expect(setBlendMode).toHaveBeenCalledWith(0);
    expect(grain.setAlpha).toHaveBeenCalledWith(0.035);
  });

  it('同一实体重复刷新燃烧状态时只挂一个 Glow filter', () => {
    const glow = { destroy: vi.fn() };
    const addGlow = vi.fn(() => glow);
    const gameObject = {
      enableFilters: vi.fn(),
      filters: { internal: { list: [], addGlow, remove: vi.fn() } },
    };
    const fx = new FxFilters({} as never, {} as never);
    const entity = { gameObject } as never;

    fx.attachGlow(entity);
    fx.attachGlow(entity);

    expect(addGlow).toHaveBeenCalledTimes(1);
  });

  it('实体停止燃烧后移除已挂载的 Glow filter', () => {
    const glow = { destroy: vi.fn() };
    const gameObject = {
      enableFilters: vi.fn(),
      filters: { internal: { list: [], addGlow: vi.fn(() => glow), remove: vi.fn() } },
    };
    const fx = new FxFilters({} as never, {} as never);
    const entity = { gameObject } as never;

    fx.attachGlow(entity);
    fx.detachGlow(entity);

    expect(gameObject.filters.internal.remove).toHaveBeenCalledWith(glow);
  });
});
