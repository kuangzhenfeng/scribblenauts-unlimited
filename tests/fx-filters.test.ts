import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    BlendModes: { MULTIPLY: 2 },
  },
}));

const { FxFilters } = await import('@/fx/Filters');

describe('FxFilters', () => {
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
