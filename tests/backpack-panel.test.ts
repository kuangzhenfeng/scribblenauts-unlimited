/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveStore } from '@/core/data/save/SaveStore';
import { ObjectLibrary } from '@/game/ObjectLibrary';
import { BackpackPanel } from '@/ui/BackpackPanel';

describe('BackpackPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a library item and forwards spawn intent', async () => {
    const store = new SaveStore();
    await store.clear();
    const library = new ObjectLibrary(store);
    await library.recordSpawn('dog', 100);
    const onSpawn = vi.fn();
    const panel = new BackpackPanel(library, { onSpawn });

    await panel.show();
    expect(document.querySelector('#backpack-panel')).toBeTruthy();
    expect(document.querySelector('#backpack-list')?.textContent).toContain('狗');
    document.querySelector<HTMLButtonElement>('#backpack-list button[aria-label="生成"]')?.click();
    expect(onSpawn).toHaveBeenCalledWith('dog');
  });
});
