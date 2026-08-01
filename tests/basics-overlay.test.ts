/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BasicsOverlay } from '@/ui/BasicsOverlay';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelector('#basics-overlay-style')?.remove();
});

describe('BasicsOverlay', () => {
  it('展示基础入门核心步骤并在开始后触发回调', () => {
    const onStart = vi.fn();
    const overlay = new BasicsOverlay(onStart);

    overlay.show();

    expect(overlay.isOpen).toBe(true);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('.basics-overlay__eyebrow')?.textContent).toBe('基础入门');
    expect(document.querySelectorAll('.basics-overlay__step')).toHaveLength(3);
    document.querySelector<HTMLButtonElement>('.basics-overlay__start')?.click();
    expect(onStart).toHaveBeenCalledTimes(1);

    overlay.hide();
    expect(overlay.isOpen).toBe(false);
    overlay.destroy();
    expect(document.querySelector('#basics-overlay')).toBeNull();
  });
});
