/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { calculateMeritCompletion, MeritBoard, type MeritChallenge } from '@/ui/MeritBoard';

const challenges: MeritChallenge[] = [
  { id: 'help', title: '帮助园丁', description: '让园丁得到需要的工具。', hint: '试试召唤一把铲子。', reward: { type: 'shard', count: 2 } },
  { id: 'gate', title: '打开大门', reward: { type: 'starite', count: 1 } },
  { id: 'secret', title: '找到隐藏物品', reward: { type: 'shard', count: 1 } },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MeritBoard', () => {
  it('计算完成率时只统计当前挑战，忽略未知完成 id', () => {
    expect(calculateMeritCompletion(challenges, ['help', 'unknown'])).toEqual({
      completed: 1,
      total: 3,
      percentage: 33,
    });
    expect(calculateMeritCompletion([], [])).toEqual({ completed: 0, total: 0, percentage: 0 });
  });

  it('渲染任务、奖励、提示和进度，并在销毁时移除 DOM', () => {
    const board = new MeritBoard({
      challenges,
      completedChallengeIds: ['help'],
      levelTitle: '丛林草地',
    });
    board.show();

    expect(board.completion).toEqual({ completed: 1, total: 3, percentage: 33 });
    expect(document.querySelectorAll('.merit-board__item')).toHaveLength(3);
    expect(document.querySelector('.merit-board__item[data-completed="true"]')).not.toBeNull();
    expect(document.querySelector('.merit-board__item-hint')?.textContent).toContain('铲子');
    expect(document.querySelector('.merit-board__reward')?.textContent).toContain('碎片');

    board.setCompleted(['help', 'gate', 'secret']);
    expect(board.completion.percentage).toBe(100);
    expect(document.querySelectorAll('.merit-board__item[data-completed="true"]')).toHaveLength(3);

    board.destroy();
    expect(document.querySelector('.merit-board')).toBeNull();
  });
});

