/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { WorldMapOverlay, type WorldMapNode } from '@/ui/WorldMapOverlay';
import { worldMapNodePosition } from '@/ui/WorldMapLayout';

const nodes: WorldMapNode[] = [
  { id: 'meadow', title: '丛林草地', subtitle: '起点区域', x: 20, y: 50 },
  { id: 'cave', title: '洞穴探险', subtitle: '尚未开放', x: 50, y: 35 },
  { id: 'snow', title: '雪原秘境', x: 80, y: 60 },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('WorldMapOverlay', () => {
  it('完整关卡列表的节点不会因横坐标溢出而重叠', () => {
    const positions = Array.from({ length: 41 }, (_, index) => worldMapNodePosition(index, 41));
    const uniquePositions = new Set(positions.map((position) => `${position.x}:${position.y}`));

    expect(uniquePositions).toHaveLength(41);
    expect(positions.every(({ x, y }) => x >= 4 && x <= 96 && y >= 4 && y <= 96)).toBe(true);
  });

  it('以当前已解锁关卡作为初始选择，并点击节点触发进入回调', () => {
    const entered: string[] = [];
    const overlay = new WorldMapOverlay({
      nodes,
      unlockedLevels: ['meadow', 'snow'],
      currentLevelId: 'meadow',
      onEnter: (node) => entered.push(node.id),
    });

    overlay.show();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.world-map-overlay__node')];
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.disabled).toBe(true);

    buttons[2]?.click();
    expect(entered).toEqual(['snow']);
    expect(document.querySelector('.world-map-overlay__selected-title')?.textContent).toBe('雪原秘境');

    overlay.destroy();
    expect(document.querySelector('.world-map-overlay')).toBeNull();
  });

  it('支持方向键在已解锁节点之间移动，并在 Escape 时关闭', () => {
    const onClose = () => undefined;
    const overlay = new WorldMapOverlay({
      nodes,
      unlockedLevels: ['meadow', 'snow'],
      currentLevelId: 'meadow',
      onEnter: () => undefined,
      onClose,
    });
    overlay.show();

    const first = document.querySelector<HTMLButtonElement>('.world-map-overlay__node');
    first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const mapButtons = [...document.querySelectorAll<HTMLButtonElement>('.world-map-overlay__node')];
    expect(mapButtons[2]?.getAttribute('aria-pressed')).toBe('true');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlay.isOpen).toBe(false);
    overlay.destroy();
  });
});
