/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { Notebook } from '@/ui/Notebook';

vi.mock('@/audio/SoundEffects', () => ({
  sfx: { play: () => undefined },
}));

describe('Notebook exact dictionary submission', () => {
  it('submits the exact gun entry before accepting a colliding autocomplete prefix', () => {
    const spawned: string[] = [];
    const notebook = new Notebook({
      onSpawn: (candidate) => { spawned.push(candidate.noun.entryId); },
    });
    notebook.show();
    const input = document.querySelector<HTMLInputElement>('#notebook input');
    expect(input).toBeTruthy();
    input!.value = '枪';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    expect(spawned).toEqual(['gun']);
    document.getElementById('notebook')?.remove();
    document.getElementById('autocomplete')?.remove();
    document.getElementById('candidate-menu')?.remove();
  });
});
