/**
 * 颜色形容词。effect.color 直接携带 hex 值，供 AdjectiveSystem 应用为 colorOverride。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

function colorAdj(id: string, zh: string, en: string, hex: string): AdjectiveEntry {
  return {
    id,
    zh: { name: zh },
    en: { name: en },
    category: 'color',
    effect: { kind: 'color', color: hex },
    priority: 20,
  };
}

export const colorAdjectives: AdjectiveEntry[] = [
  colorAdj('red', '红', 'red', '#E03131'),
  colorAdj('orange', '橙', 'orange', '#F08C00'),
  colorAdj('yellow', '黄', 'yellow', '#F59F00'),
  colorAdj('green', '绿', 'green', '#37B24D'),
  colorAdj('cyan', '青', 'cyan', '#0CA6A6'),
  colorAdj('blue', '蓝', 'blue', '#1C7ED6'),
  colorAdj('purple', '紫', 'purple', '#845EF7'),
  colorAdj('pink', '粉', 'pink', '#F06595'),
  colorAdj('black', '黑', 'black', '#212529'),
  colorAdj('white', '白', 'white', '#F8F9FA'),
  colorAdj('gold', '金', 'gold', '#FFD43B'),
  colorAdj('brown', '棕', 'brown', '#8B5A2B'),
];
