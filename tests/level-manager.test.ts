import { describe, expect, it } from 'vitest';
import { LevelManager } from '@/game/LevelManager';
import type { LevelData } from '@/core/types/level';

const level: LevelData = {
  id: 'test-level',
  type: 'overworld',
  theme: 'jungle',
  bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
  playerStart: { x: 0, y: 0 },
  spawns: [],
  npcs: [],
  transitions: [
    { toLevelId: 'open-level', at: { minX: -20, minY: -20, maxX: 20, maxY: 20 } },
    { toLevelId: 'locked-level', at: { minX: -20, minY: -20, maxX: 20, maxY: 20 } },
  ],
};

function managerWithLevel(): LevelManager {
  const manager = new LevelManager({} as never, {} as never, {} as never);
  (manager as unknown as { current: LevelData }).current = level;
  return manager;
}

describe('LevelManager transition gating', () => {
  it('does not enter a transition target that is absent from unlockedLevels', () => {
    const manager = managerWithLevel();
    manager.setUnlockedLevels(['test-level']);

    expect(manager.checkTransition(0, 0)).toBeUndefined();
  });

  it('allows the portal after its target is unlocked', () => {
    const manager = managerWithLevel();
    manager.setUnlockedLevels(['test-level', 'open-level']);

    expect(manager.checkTransition(0, 0)).toBe('open-level');
    expect(manager.isLevelUnlocked('open-level')).toBe(true);
    expect(manager.isLevelUnlocked('locked-level')).toBe(false);
  });
});
