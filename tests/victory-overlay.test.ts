/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { VictoryOverlay } from '@/ui/VictoryOverlay';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelector('#victory-overlay-style')?.remove();
});

describe('VictoryOverlay', () => {
  it('展示解咒结果并提供继续探索与打开地图两个出口', () => {
    const onContinue = vi.fn();
    const onMap = vi.fn();
    const overlay = new VictoryOverlay({ onContinue, onMap });

    overlay.show();

    expect(overlay.isOpen).toBe(true);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('#victory-overlay-title')?.textContent).toBe('Lily 的诅咒解除了');
    expect(document.body.textContent).toContain('Edgar');
    document.querySelector<HTMLButtonElement>('.victory-overlay__continue')?.click();
    document.querySelector<HTMLButtonElement>('.victory-overlay__map')?.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onMap).toHaveBeenCalledTimes(1);

    overlay.hide();
    expect(overlay.isOpen).toBe(false);
    overlay.destroy();
    expect(document.querySelector('#victory-overlay')).toBeNull();
  });

  it('展示独立的全收集里程碑文案', () => {
    const overlay = new VictoryOverlay({ onContinue: vi.fn(), onMap: vi.fn() });

    overlay.show('collection');

    expect(document.querySelector('#victory-overlay-title')?.textContent).toBe('故事的最后一页');
    expect(document.body.textContent).toContain('家庭档案已展开');

    overlay.destroy();
  });
});
