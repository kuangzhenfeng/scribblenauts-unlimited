/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hud } from '@/ui/Hud';

describe('Hud', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

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

  it('Maxwell 头像可作为装备与骑乘面板入口', () => {
    const onPortraitClick = vi.fn();
    const hud = new Hud(onPortraitClick);
    document.querySelector<HTMLButtonElement>('.world-hud__portrait')?.click();
    expect(onPortraitClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLButtonElement>('.world-hud__portrait')?.getAttribute('aria-label')).toContain('装备');
    void hud;
  });

  it('保留原版常驻资源栏，不把玩家血量塞进左上角 HUD', () => {
    const hud = new Hud();
    hud.render(0, 0, 0);
    expect(document.querySelector('.world-hud__health')).toBeNull();
  });
});
