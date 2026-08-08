import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { flatten, getMoodData, levelMood, type MusicMood } from '@/audio/scores';

const moods: MusicMood[] = ['storybook', 'clockwork', 'aurora'];

describe('关卡专属音乐', () => {
  it('每个新增 mood 都能展平为完整的五声部循环', () => {
    for (const mood of moods) {
      const score = flatten(mood);
      expect(getMoodData(mood).tempo).toBeGreaterThan(0);
      expect(score.melody).toHaveLength(640);
      expect(score.harmony).toHaveLength(640);
      expect(score.bass).toHaveLength(640);
      expect(score.arpeggio).toHaveLength(640);
      expect(score.percussion).toHaveLength(640);
      expect(score.melody.some((note) => note > 0)).toBe(true);
    }
  });

  it('三个专属 mood 的主旋律与编排不重复', () => {
    const signatures = moods.map((mood) => {
      const score = flatten(mood);
      return `${score.melody.join(',')}|${score.percussion.join(',')}`;
    });

    expect(new Set(signatures).size).toBe(moods.length);
  });

  it('每个主关卡都生成独立的完整乐谱', () => {
    const levelDir = path.join(process.cwd(), 'src/core/data/levels');
    const levelIds = fs.readdirSync(levelDir)
      .filter((file) => file.endsWith('.json') && file !== 'quiz-arena.json')
      .map((file) => JSON.parse(fs.readFileSync(path.join(levelDir, file), 'utf8')).id as string);
    const signatures = levelIds.map((levelId) => {
      const mood = levelMood(levelId);
      const data = getMoodData(mood);
      expect(data.tempo).toBeGreaterThan(0);
      return JSON.stringify(flatten(mood));
    });
    expect(new Set(signatures).size).toBe(levelIds.length);
  });
});
