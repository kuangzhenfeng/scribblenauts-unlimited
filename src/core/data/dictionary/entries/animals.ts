/**
 * 生物词条 —— 动物与人形。
 *
 * 每条用矢量渲染器 base 复用。物理/外观参数遵循 matter.js 与渲染器约定。
 *
 * 与旧项目差异：appearance.renderer 不再区分 'dsl'/'custom'，统一为渲染器 id 字符串；
 * modifiable 白名单由 core/data/modifiable.ts 统一判断（消除重复）。
 */

import type { DictEntry, TagSetLike } from '@/core/types/dictionary';

/** 词条默认标签构造器（生物：默认 normal 状态、normal 温度） */
function tags(material: string[], flags: string[], behavior: string[] = []): TagSetLike {
  return {
    material: new Set(material),
    temperature: 'normal',
    state: new Set(['normal']),
    behavior: new Set(behavior),
    flags: new Set(flags),
  };
}

export const animalEntries: DictEntry[] = [
  {
    id: 'dog',
    zh: { name: '狗', aliases: ['犬', '狗狗'] },
    en: { name: 'dog', aliases: ['hound', 'puppy'] },
    category: 'creature',
    size: { width: 48, height: 32 },
    appearance: { renderer: 'quadruped', params: { bodyColor: '#8B5A2B' } },
    physics: { shape: 'box', density: 0.004, friction: 0.3, restitution: 0.1 },
    tags: tags(['flesh'], ['edible-target'], ['walk']),
    behaviors: [{ kind: 'wander' }, { kind: 'follow' }],
    modifiable: { nature: false },
    description: { zh: '忠诚的四足伴侣。', en: 'A loyal quadruped companion.' },
  },
  {
    id: 'cat',
    zh: { name: '猫', aliases: ['猫咪'] },
    en: { name: 'cat', aliases: ['kitten'] },
    category: 'creature',
    size: { width: 40, height: 28 },
    appearance: { renderer: 'quadruped', params: { bodyColor: '#5A5A5A' } },
    physics: { shape: 'box', density: 0.003, friction: 0.3, restitution: 0.2 },
    tags: tags(['flesh'], ['edible-target'], ['walk']),
    behaviors: [{ kind: 'wander' }],
    modifiable: { nature: false },
    description: { zh: '敏捷的小型食肉动物。', en: 'A nimble small carnivore.' },
  },
  {
    id: 'cow',
    zh: { name: '牛', aliases: ['奶牛', '公牛'] },
    en: { name: 'cow', aliases: ['cattle', 'bull'] },
    category: 'creature',
    size: { width: 64, height: 44 },
    appearance: { renderer: 'quadruped', params: { bodyColor: '#F8F8F8', spots: true } },
    physics: { shape: 'box', density: 0.006, friction: 0.4, restitution: 0.05 },
    tags: tags(['flesh'], ['edible-target'], ['walk']),
    behaviors: [{ kind: 'wander' }],
    modifiable: { nature: false },
    description: { zh: '温顺的反刍家畜。', en: 'A docile ruminant.' },
  },
  {
    id: 'octopus',
    zh: { name: '章鱼', aliases: ['八爪鱼'] },
    en: { name: 'octopus', aliases: ['octopi'] },
    category: 'creature',
    size: { width: 56, height: 56 },
    appearance: { renderer: 'tentacled' },
    physics: { shape: 'circle', density: 0.003, friction: 0.4, restitution: 0.2 },
    tags: tags(['flesh'], ['edible-target'], ['swim']),
    behaviors: [{ kind: 'swim' }, { kind: 'wander' }],
    description: { zh: '八条触手的海洋软体动物。', en: 'An eight-tentacled sea creature.' },
  },
  {
    id: 'bird',
    zh: { name: '鸟', aliases: ['小鸟'] },
    en: { name: 'bird', aliases: ['birdie'] },
    category: 'creature',
    size: { width: 28, height: 24 },
    appearance: { renderer: 'bird', params: { bodyColor: '#4A90E2' } },
    physics: { shape: 'circle', density: 0.002, friction: 0.2, restitution: 0.3, frictionAir: 0.08 },
    tags: tags(['flesh'], ['edible-target'], ['flying']),
    behaviors: [{ kind: 'fly' }, { kind: 'wander' }],
    description: { zh: '会飞的小型动物。', en: 'A small flying animal.' },
  },
  {
    id: 'fish',
    zh: { name: '鱼', aliases: ['小鱼'] },
    en: { name: 'fish', aliases: ['fishie'] },
    category: 'creature',
    size: { width: 36, height: 18 },
    appearance: { renderer: 'fish', params: { bodyColor: '#F59F00' } },
    physics: { shape: 'box', density: 0.003, friction: 0.2, restitution: 0.1 },
    tags: tags(['flesh'], ['edible-target'], ['swim']),
    behaviors: [{ kind: 'swim' }, { kind: 'wander' }],
    description: { zh: '水生脊椎动物。', en: 'An aquatic vertebrate.' },
  },
  {
    id: 'human',
    zh: { name: '人', aliases: ['人类', '男人', '女人'] },
    en: { name: 'human', aliases: ['person', 'man', 'woman'] },
    category: 'creature',
    size: { width: 28, height: 56 },
    appearance: { renderer: 'biped', params: { shirtColor: '#3B6EA5', pantsColor: '#3A3A3A' } },
    physics: { shape: 'box', density: 0.005, friction: 0.3, restitution: 0.05 },
    tags: tags(['flesh'], [], ['walk']),
    behaviors: [{ kind: 'wander' }, { kind: 'follow' }],
    modifiable: { nature: false },
    description: { zh: '一个普通人类。', en: 'An ordinary human.' },
  },
];
