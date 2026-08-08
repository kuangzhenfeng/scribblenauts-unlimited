/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { OBJECT_SHARD_CATEGORIES, OBJECT_SHARD_TASKS } from '@/core/data/starite/object-shards';
import { ObjectShardBoard } from '@/ui/ObjectShardBoard';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ObjectShardBoard', () => {
  it('renders eight category counters, updates completion, and cleans up', () => {
    const board = new ObjectShardBoard({
      categories: OBJECT_SHARD_CATEGORIES,
      tasks: OBJECT_SHARD_TASKS,
      completedTaskIds: [],
      objectShards: 4,
    });

    expect(document.querySelectorAll('.object-shard-board__category')).toHaveLength(8);
    expect(document.querySelector('.object-shard-board__summary')?.textContent).toContain('4 / 10');

    const firstTask = OBJECT_SHARD_TASKS[0]!;
    board.update({ completedTaskIds: [firstTask.id], objectShards: 5 });
    expect(document.querySelector(`[data-completed="true"]`)).not.toBeNull();
    expect(document.querySelector('.object-shard-board__summary')?.textContent).toContain('5 / 10');

    board.show();
    expect(board.isOpen).toBe(true);
    board.destroy();
    expect(document.querySelector('.object-shard-board')).toBeNull();
  });
});
