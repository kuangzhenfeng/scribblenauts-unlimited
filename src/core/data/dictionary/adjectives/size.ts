/**
 * 大小形容词。effect.scale 由 AdjectiveSystem 累乘并钳制。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

export const sizeAdjectives: AdjectiveEntry[] = [
  {
    id: 'big',
    zh: { name: '大', aliases: ['巨大', '大型'] },
    en: { name: 'big', aliases: ['large', 'huge'] },
    category: 'size',
    effect: { kind: 'scale', factor: 1.5 },
    priority: 10,
  },
  {
    id: 'small',
    zh: { name: '小', aliases: ['小型', '微小'] },
    en: { name: 'small', aliases: ['tiny', 'little'] },
    category: 'size',
    effect: { kind: 'scale', factor: 0.5 },
    priority: 10,
  },
  {
    id: 'giant',
    zh: { name: '巨型', aliases: ['庞然'] },
    en: { name: 'giant', aliases: ['gigantic'] },
    category: 'size',
    effect: { kind: 'scale', factor: 3 },
    priority: 11,
  },
];
