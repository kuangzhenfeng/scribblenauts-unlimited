/**
 * 元素词条 —— 火/水/冰/电等。
 *
 * 这些物体参与规则交互（燃烧、灭火、冻结、导电）。
 */

import type { DictEntry, TagSetLike } from '@/core/types/dictionary';

function tags(
  material: string[],
  flags: string[],
  state: string[] = ['normal'],
  temperature = 'normal',
): TagSetLike {
  return {
    material: new Set(material),
    temperature,
    state: new Set(state),
    behavior: new Set(),
    flags: new Set(flags),
  };
}

export const elementEntries: DictEntry[] = [
  {
    id: 'fire',
    zh: { name: '火', aliases: ['火焰'] },
    en: { name: 'fire', aliases: ['flame'] },
    category: 'element',
    size: { width: 32, height: 40 },
    appearance: { renderer: 'fire' },
    physics: { shape: 'circle', density: 0.0008, friction: 0, restitution: 0.2, frictionAir: 0.05 },
    tags: tags([], ['igniter', 'flammable'], ['burning'], 'hot'),
    behaviors: [{ kind: 'idle' }],
    description: { zh: '炽热的火苗。', en: 'A hot flame.' },
  },
  {
    id: 'water',
    zh: { name: '水', aliases: ['清水'] },
    en: { name: 'water', aliases: ['h2o'] },
    category: 'element',
    size: { width: 40, height: 40 },
    appearance: { renderer: 'water' },
    physics: { shape: 'circle', density: 0.002, friction: 0.1, restitution: 0.1 },
    tags: tags(['water'], [], ['wet'], 'normal'),
    behaviors: [{ kind: 'idle' }],
    description: { zh: '透明液体。', en: 'Transparent liquid.' },
  },
  {
    id: 'ice',
    zh: { name: '冰', aliases: ['冰块'] },
    en: { name: 'ice', aliases: ['iceblock'] },
    category: 'element',
    size: { width: 40, height: 40 },
    appearance: { renderer: 'box', params: { w: 40, h: 40, color: '#A7D8F0' } },
    physics: { shape: 'box', density: 0.003, friction: 0.05, restitution: 0.2 },
    tags: tags(['ice'], [], ['frozen'], 'cold'),
    behaviors: [{ kind: 'idle' }],
    description: { zh: '低温固体水。', en: 'Frozen water.' },
  },
  {
    id: 'steam',
    zh: { name: '蒸汽', aliases: ['水蒸气'] },
    en: { name: 'steam', aliases: ['vapor'] },
    category: 'element',
    size: { width: 36, height: 36 },
    appearance: { renderer: 'steam' },
    physics: { shape: 'circle', density: 0.0005, friction: 0, restitution: 0.1, frictionAir: 0.04 },
    tags: tags([], [], [], 'hot'),
    behaviors: [{ kind: 'idle' }],
    description: { zh: '汽化的水。', en: 'Vaporized water.' },
  },
];
