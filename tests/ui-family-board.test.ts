// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { FamilyBoard } from '@/ui/FamilyBoard';

describe('FamilyBoard', () => {
  it('renders unlock state and emits only an unlocked avatar selection', () => {
    const onSelect = vi.fn();
    const board = new FamilyBoard({ onSelect });
    board.update({
      helpedCount: 1,
      starites: 3,
      completedObjectShardCount: 0,
      unlockedAvatarIds: ['maxwell', 'sibling-01'],
      selectedAvatarId: 'maxwell',
    });
    board.show();

    const buttons = [...document.querySelectorAll<HTMLButtonElement>('#family-board .family-board__avatar')];
    expect(buttons.length).toBeGreaterThan(40);
    expect(buttons[1]?.disabled).toBe(false);
    expect(buttons[2]?.disabled).toBe(true);

    buttons[1]?.click();
    expect(onSelect).toHaveBeenCalledWith('sibling-01');
    board.destroy();
  });
});
