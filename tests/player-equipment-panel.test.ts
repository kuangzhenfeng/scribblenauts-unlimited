/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagSet } from '@/core/rules/TagSet';
import type { GameEntity } from '@/game/Entity';
import type { PlayerEquipmentSnapshot } from '@/game/PlayerController';
import { PlayerEquipmentPanel } from '@/ui/PlayerEquipmentPanel';

vi.mock('@/audio/SoundEffects', () => ({
  sfx: { play: () => undefined },
}));

function entity(id: string, typeId: string, flags: string[], behaviors: string[] = []): GameEntity {
  return {
    id,
    typeId,
    tags: TagSet.fromRaw({
      material: new Set(['metal']),
      temperature: 'normal',
      state: new Set(['normal']),
      behavior: new Set(behaviors),
      flags: new Set(flags),
      category: 'object',
    }),
  } as unknown as GameEntity;
}

describe('PlayerEquipmentPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders all independent relations and keeps the panel open after one removal', () => {
    const gun = entity('gun-1', 'gun', ['ranged']);
    const wing = entity('wing-1', 'wing', ['wing']);
    const dragon = entity('dragon-1', 'dragon', ['rideable'], ['flying']);
    const snapshot: PlayerEquipmentSnapshot = { hand: gun, back: wing, mount: dragon };
    const onUnequip = vi.fn((slot: 'hand' | 'back' | 'mount') => {
      if (slot === 'hand') snapshot.hand = undefined;
      if (slot === 'back') snapshot.back = undefined;
      if (slot === 'mount') snapshot.mount = undefined;
    });
    const panel = new PlayerEquipmentPanel({
      getEquipment: () => snapshot,
      onUnequip,
      onUnequipAll: vi.fn(),
      onUseNotebook: vi.fn(),
      onAddAdjective: vi.fn(),
    });

    panel.show();
    const root = document.querySelector<HTMLElement>('#player-equipment-panel');
    expect(root?.style.display).toBe('block');
    expect(root?.textContent).toContain('枪');
    expect(root?.textContent).toContain('翅膀');
    expect(root?.textContent).toContain('龙');
    expect(root?.textContent).toContain('飞行');

    root?.querySelector<HTMLButtonElement>('[aria-label^="解除翅膀"]')?.click();
    expect(onUnequip).toHaveBeenCalledWith('back');
    expect(root?.style.display).toBe('block');
    expect(root?.textContent).toContain('空位 · 翅膀');
    expect(root?.textContent).toContain('枪');
    expect(root?.textContent).toContain('龙');
  });

  it('disables all-removal when no relation is active', () => {
    const onUnequipAll = vi.fn();
    const panel = new PlayerEquipmentPanel({
      getEquipment: () => ({}),
      onUnequip: vi.fn(),
      onUnequipAll,
      onUseNotebook: vi.fn(),
      onAddAdjective: vi.fn(),
    });

    panel.show();
    const all = document.querySelector<HTMLButtonElement>('.player-equipment__action--wide');
    expect(all?.disabled).toBe(true);
    all?.click();
    expect(onUnequipAll).not.toHaveBeenCalled();
  });
});
