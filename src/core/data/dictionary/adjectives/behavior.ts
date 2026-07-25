/**
 * 行为形容词。add-behavior 由 AdjectiveSystem 合并 tags.behavior 并调物理参数。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

export const behaviorAdjectives: AdjectiveEntry[] = [
  {
    id: 'flying',
    zh: { name: '飞行', aliases: ['飞', '会飞'] },
    en: { name: 'flying', aliases: ['fly'] },
    category: 'behavior',
    effect: { kind: 'add-behavior', behavior: 'flying' },
    priority: 30,
  },
  {
    id: 'swimming',
    zh: { name: '游泳', aliases: ['游'] },
    en: { name: 'swimming', aliases: ['swim'] },
    category: 'behavior',
    effect: { kind: 'add-behavior', behavior: 'swimming' },
    priority: 30,
  },
  {
    id: 'aggressive',
    zh: { name: '凶猛', aliases: ['凶', '暴躁'] },
    en: { name: 'aggressive', aliases: ['fierce'] },
    category: 'behavior',
    effect: { kind: 'add-behavior', behavior: 'aggressive' },
    priority: 30,
  },
  {
    id: 'friendly',
    zh: { name: '友好', aliases: ['温顺'] },
    en: { name: 'friendly', aliases: ['tame'] },
    category: 'behavior',
    effect: { kind: 'add-behavior', behavior: 'friendly' },
    priority: 30,
  },
];
