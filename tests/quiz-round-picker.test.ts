/**
 * 简易问答回合管理单测 —— 验证积分、连胜与物品回合过期。
 */

import { describe, expect, it } from 'vitest';
import { QuizRoundPicker } from '@/game/QuizRoundPicker';

describe('QuizRoundPicker', () => {
  it('records consecutive correct answers in score and streak', () => {
    const picker = new QuizRoundPicker(1, 'cefr', 'streak-test');

    picker.recordCorrect();
    picker.recordCorrect();

    expect(picker.currentScore).toBe(2);
    expect(picker.currentStreak).toBe(2);
  });

  it('resets streak after a wrong answer without removing earned score', () => {
    const picker = new QuizRoundPicker(1, 'cefr', 'wrong-test');
    picker.recordCorrect();
    picker.recordCorrect();

    picker.recordWrong();

    expect(picker.currentScore).toBe(2);
    expect(picker.currentStreak).toBe(0);
  });

  it('resets round, score, and streak when reshuffling', () => {
    const picker = new QuizRoundPicker(1, 'cefr', 'reshuffle-test');
    picker.next();
    picker.recordCorrect();

    picker.reshuffle();

    expect(picker.currentRound).toBe(0);
    expect(picker.currentScore).toBe(0);
    expect(picker.currentStreak).toBe(0);
  });

  it('expires tracked items after three round ticks', () => {
    const picker = new QuizRoundPicker(1, 'cefr', 'ttl-test');
    const expired: string[] = [];
    picker.trackItem('spawned-item');

    expect(picker.tickItems((id) => expired.push(id))).toEqual([]);
    expect(picker.tickItems((id) => expired.push(id))).toEqual([]);
    expect(picker.tickItems((id) => expired.push(id))).toEqual(['spawned-item']);
    expect(expired).toEqual(['spawned-item']);
  });
});
