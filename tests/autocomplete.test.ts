/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete } from '@/ui/Autocomplete';
import { QuizKeyboard } from '@/ui/QuizKeyboard';

describe('Autocomplete', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the English alias in the candidate display and selection', () => {
    const onPick = vi.fn();
    const autocomplete = new Autocomplete({ onPick });

    autocomplete.update('fierce');

    const button = document.querySelector<HTMLButtonElement>('#autocomplete button');
    expect(button).toBeTruthy();
    expect(button!.textContent).toBe('fierce（凶猛）');

    autocomplete.confirm();
    expect(onPick).toHaveBeenCalledWith('fierce');
  });

  it('keeps the English alias in the quiz keyboard candidate', () => {
    const keyboard = new QuizKeyboard({ onPick: vi.fn() });
    for (const key of 'fierce') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }

    const candidate = document.querySelector<HTMLDivElement>('#quiz-keyboard > div:first-child > div:nth-child(2) button');
    expect(candidate?.textContent).toContain('fierce');

    keyboard.destroy();
  });

  it('keeps a typed space visible in the quiz keyboard input', () => {
    const keyboard = new QuizKeyboard({ onPick: vi.fn() });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    const display = document.querySelector<HTMLDivElement>('#quiz-keyboard > div:first-child > div:first-child');
    expect(display?.textContent).toBe('a ');
    expect(display?.style.whiteSpace).toBe('pre');

    keyboard.destroy();
  });

  it('shows glassy as the material adjective for gla', () => {
    const autocomplete = new Autocomplete({ onPick: vi.fn() });

    autocomplete.update('gla');

    const labels = [...document.querySelectorAll<HTMLButtonElement>('#autocomplete button')].map(
      (button) => button.textContent,
    );
    expect(labels).toContain('glassy（玻璃）');
  });
});
