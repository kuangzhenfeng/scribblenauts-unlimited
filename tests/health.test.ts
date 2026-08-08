import { describe, expect, it } from 'vitest';
import { getEntry } from '@/core/data/dictionary/Dictionary';

describe('原版常见词条生命值', () => {
  it('保留常见生物和容器的原版生命值差异', () => {
    expect(getEntry('human')?.health).toBe(50);
    expect(getEntry('dog')?.health).toBe(50);
    expect(getEntry('cat')?.health).toBe(30);
    expect(getEntry('octopus')?.health).toBe(20);
    expect(getEntry('dragon')?.health).toBe(50);
    expect(getEntry('chest')?.health).toBe(30);
  });
});
