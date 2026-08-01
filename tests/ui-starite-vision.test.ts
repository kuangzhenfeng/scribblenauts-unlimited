/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filterStariteVisionTargets,
  markStariteVisionTargets,
  StariteVision,
  type StariteCollectible,
} from '@/ui/StariteVision';

const collectibles: StariteCollectible[] = [
  { id: 'near-shard', kind: 'shard', x: 3, y: 4, label: '近处碎片' },
  { id: 'far-star', kind: 'starite', x: 20, y: 0, label: '远处 Starite' },
  { id: 'collected', kind: 'starite', x: 1, y: 1, collected: true },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('StariteVision logic', () => {
  it('关闭时不返回目标，并按距离、类型和半径筛选未收集物', () => {
    expect(filterStariteVisionTargets(collectibles, false)).toEqual([]);
    const targets = filterStariteVisionTargets(collectibles, true, {
      kind: 'starite',
      origin: { x: 0, y: 0 },
      maxDistance: 5,
    });
    expect(targets.map((target) => target.id)).toEqual([]);

    const sorted = filterStariteVisionTargets(collectibles, true, {
      origin: { x: 0, y: 0 },
      markedIds: ['far-star'],
    });
    expect(sorted.map((target) => target.id)).toEqual(['near-shard', 'far-star']);
    expect(sorted[1]?.marked).toBe(true);
    expect(sorted[0]?.distance).toBe(5);
  });

  it('纯标记器不修改输入，并能取消既有目标标记', () => {
    const initiallyMarked = filterStariteVisionTargets(collectibles, true, { markedIds: ['near-shard'] });
    const marked = markStariteVisionTargets(initiallyMarked, ['far-star']);
    expect(marked.find((target) => target.id === 'near-shard')?.marked).toBe(true);
    expect(marked.find((target) => target.id === 'far-star')?.marked).toBe(true);
    expect(initiallyMarked.find((target) => target.id === 'far-star')?.marked).toBe(false);

    const unmarked = markStariteVisionTargets(marked, ['near-shard'], false);
    expect(unmarked.find((target) => target.id === 'near-shard')?.marked).toBe(false);
    expect(unmarked.find((target) => target.id === 'far-star')?.marked).toBe(true);
  });
});

describe('StariteVision DOM shell', () => {
  it('切换启用状态、渲染屏幕标记，并在销毁时清理 DOM', () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    const vision = new StariteVision({ collectibles, onToggle, onSelect });
    vision.setProjectedPositions({ 'near-shard': { x: 120, y: 80 }, 'far-star': { x: 220, y: 100 } });
    vision.setEnabled(true);

    expect(vision.visibleTargets).toHaveLength(2);
    expect(document.querySelectorAll('.starite-vision__marker')).toHaveLength(2);
    expect(onToggle).toHaveBeenCalledWith(true);

    document.querySelector<HTMLButtonElement>('.starite-vision__marker')?.click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'near-shard', marked: true }));

    vision.destroy();
    expect(document.querySelector('.starite-vision')).toBeNull();
  });
});

