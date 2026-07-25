/**
 * 材质形容词。set-material 由 AdjectiveSystem 覆盖 tags.material。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

export const materialAdjectives: AdjectiveEntry[] = [
  {
    id: 'golden',
    zh: { name: '金', aliases: ['金色', '黄金'] },
    en: { name: 'golden', aliases: ['gold'] },
    category: 'material',
    effect: { kind: 'set-material', material: 'gold' },
    priority: 50,
  },
  {
    id: 'metallic',
    zh: { name: '金属', aliases: ['金属质'] },
    en: { name: 'metal', aliases: ['metallic'] },
    category: 'material',
    effect: { kind: 'set-material', material: 'metal' },
    priority: 50,
  },
  {
    id: 'wooden',
    zh: { name: '木', aliases: ['木质'] },
    en: { name: 'wooden', aliases: ['wood'] },
    category: 'material',
    effect: { kind: 'set-material', material: 'wood' },
    priority: 50,
  },
];
