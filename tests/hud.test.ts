/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { Hud } from '@/ui/Hud';

describe('Hud', () => {
  it('数据未变化时不重复重建 DOM', () => {
    const setter = vi.spyOn(Element.prototype, 'innerHTML', 'set');
    const hud = new Hud();
    const afterCreate = setter.mock.calls.length;

    hud.render(0, 0, 0);
    expect(setter.mock.calls.length).toBe(afterCreate);

    hud.render(1, 0, 0);
    expect(setter.mock.calls.length).toBe(afterCreate + 1);
    setter.mockRestore();
  });
});
