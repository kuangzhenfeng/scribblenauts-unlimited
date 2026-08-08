/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryIntroOverlay } from '@/ui/StoryIntroOverlay';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelector('#story-intro-overlay-style')?.remove();
});

describe('StoryIntroOverlay', () => {
  it('shows the rotten apple, curse, and Starite chain before continuing', () => {
    const onContinue = vi.fn();
    const overlay = new StoryIntroOverlay({ onContinue });

    overlay.show();

    expect(overlay.isOpen).toBe(true);
    expect(document.querySelector('#story-intro-title')?.textContent).toBe('先把事情做对');
    expect(document.querySelectorAll('.story-intro-overlay__beat')).toHaveLength(3);
    expect(document.body.textContent).toContain('烂苹果');
    expect(document.body.textContent).toContain('石化');
    expect(document.body.textContent).toContain('Starite');

    document.querySelector<HTMLButtonElement>('.story-intro-overlay__continue')?.click();
    expect(onContinue).toHaveBeenCalledTimes(1);

    overlay.hide();
    overlay.destroy();
    expect(document.querySelector('#story-intro-overlay')).toBeNull();
  });
});
