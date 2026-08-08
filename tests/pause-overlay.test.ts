/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PauseOverlay } from '@/ui/PauseOverlay';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelector('#pause-overlay-style')?.remove();
});

describe('PauseOverlay', () => {
  it('展示继续游戏与返回主菜单两个出口', () => {
    const onResume = vi.fn();
    const onMainMenu = vi.fn();
    const overlay = new PauseOverlay(onResume, onMainMenu);

    overlay.show();

    expect(overlay.isOpen).toBe(true);
    expect(document.querySelector('#pause-overlay')).not.toBeNull();
    expect(document.body.textContent).toContain('继续游戏');
    expect(document.body.textContent).toContain('返回主菜单');

    document.querySelector<HTMLButtonElement>('#pause-overlay-resume')?.click();
    document.querySelector<HTMLButtonElement>('#pause-overlay-main-menu')?.click();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onMainMenu).toHaveBeenCalledTimes(1);

    overlay.hide();
    expect(overlay.isOpen).toBe(false);
  });
});
