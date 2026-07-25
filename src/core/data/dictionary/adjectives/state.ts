/**
 * 状态形容词。add-state 由 AdjectiveSystem 合并 tags.state。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

export const stateAdjectives: AdjectiveEntry[] = [
  {
    id: 'burning',
    zh: { name: '燃烧', aliases: ['着火', '烧'] },
    en: { name: 'burning', aliases: ['fire', 'burn'] },
    category: 'state',
    effect: { kind: 'add-state', state: 'burning' },
    priority: 40,
  },
  {
    id: 'frozen',
    zh: { name: '冻结', aliases: ['冰冻', '冻'] },
    en: { name: 'frozen', aliases: ['freeze'] },
    category: 'state',
    effect: { kind: 'add-state', state: 'frozen' },
    priority: 40,
  },
  {
    id: 'electrified',
    zh: { name: '带电', aliases: ['充电', '通电'] },
    en: { name: 'electrified', aliases: ['electric', 'charged'] },
    category: 'state',
    effect: { kind: 'add-state', state: 'electrified' },
    priority: 40,
  },
  {
    id: 'wet',
    zh: { name: '湿', aliases: ['湿透'] },
    en: { name: 'wet', aliases: ['wet'] },
    category: 'state',
    effect: { kind: 'add-state', state: 'wet' },
    priority: 40,
  },
];
