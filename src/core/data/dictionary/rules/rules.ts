/**
 * 规则集 —— 声明式交互规则（纯数据）。
 *
 * 首批 8 条典型规则，覆盖火、电、锋利、水、冷冻、可食、武器、燃烧 tick。
 * 规则为纯数据，RuleEngine 读取并执行。
 *
 * 与旧项目差异：apply-force 改为 apply-impulse（产出意图，由物理层消费）。
 */

import type { Rule } from '@/core/types/rules';

export const rules: Rule[] = [
  // 1. 火/燃烧中物体 × 可燃 → 点燃
  {
    id: 'fire-ignite-flammable',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { state: ['burning'] },
      b: { flags: ['flammable'], notState: ['burning'] },
    },
    effect: [{ kind: 'apply-state', target: 'b', state: 'burning' }],
    cooldownMs: 300,
    chainTag: 'fire-spread',
  },

  // 2. 带电 × 导电金属 → 带电
  {
    id: 'electricity-conduct-metal',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { state: ['electrified'] },
      b: { flags: ['conductive'], notState: ['electrified'] },
    },
    effect: [{ kind: 'apply-state', target: 'b', state: 'electrified' }],
    cooldownMs: 500,
  },

  // 2b. 带电 × 肉体 → 电击伤害
  {
    id: 'electrified-shock-flesh',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { state: ['electrified'] },
      b: { material: ['flesh'], notState: ['electrified'] },
    },
    effect: [
      { kind: 'damage', target: 'b', amount: 15 },
      { kind: 'apply-state', target: 'b', state: 'electrified' },
    ],
    cooldownMs: 800,
  },

  // 3. 锋利武器 × 可切 → 切断
  {
    id: 'sharp-cut-cuttable',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { flags: ['sharp'] },
      b: { flags: ['cuttable'] },
    },
    effect: [{ kind: 'destroy', target: 'b' }],
    cooldownMs: 0,
  },

  // 4. 水 × 燃烧 → 灭火
  {
    id: 'water-extinguish-fire',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { material: ['water'] },
      b: { state: ['burning'] },
    },
    effect: [
      { kind: 'remove-state', target: 'b', state: 'burning' },
      { kind: 'set-temperature', target: 'b', temp: 'normal' },
      { kind: 'apply-state', target: 'b', state: 'wet' },
    ],
    cooldownMs: 200,
  },

  // 5. 冷源 × 水 → 冻冰
  {
    id: 'cold-freeze-water',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { temperature: ['cold'] },
      b: { material: ['water'], notState: ['frozen'] },
    },
    effect: [{ kind: 'transform', target: 'b', toTypeId: 'ice' }],
    cooldownMs: 300,
  },

  // 6. 可食 × 饥饿生物 → 进食
  {
    id: 'edible-eaten-by-hungry',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { flags: ['edible'] },
      b: { behavior: ['hungry'] },
    },
    effect: [
      { kind: 'destroy', target: 'a' },
      { kind: 'heal', target: 'b', amount: 50 },
      { kind: 'remove-flag', target: 'b', flags: ['edible-target'] },
    ],
    cooldownMs: 0,
  },

  // 7. 武器 × 生物 → 伤害（用 category 谓词）
  {
    id: 'weapon-harm-creature',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { flags: ['weapon'] },
      b: { category: ['creature'], notState: ['dead', 'petrified'] },
    },
    effect: [{ kind: 'damage', target: 'b', amount: 25 }],
    cooldownMs: 500,
  },

  // 8. 燃烧 tick：持续掉血 + 燃尽（用 destroy 简化）
  {
    id: 'burning-tick',
    trigger: { kind: 'tick', intervalMs: 600 },
    match: { kind: 'self', a: { state: ['burning'] } },
    effect: [{ kind: 'damage', target: 'self', amount: 12 }],
    cooldownMs: 0,
    chainTag: 'fire-spread',
  },
];
