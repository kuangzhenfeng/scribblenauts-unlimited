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

  // 1b. 火焰 × 爆炸物 → 范围爆炸
  {
    id: 'fire-detonates-explosive',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { state: ['burning'] },
      b: { flags: ['explosive'], notState: ['dead'] },
    },
    effect: [{ kind: 'explode', target: 'b', radius: 140, damage: 100 }],
    cooldownMs: 0,
    priority: 10,
    chainTag: 'explosion-spread',
  },

  // 1c. 容器 × 物品 → 收纳，取出动作由对象面板完成
  {
    id: 'container-stores-object',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { flags: ['container'] },
      b: { category: ['object', 'food', 'weapon', 'tool', 'vehicle', 'element', 'plant', 'magic'], notFlags: ['container'] },
    },
    effect: [{ kind: 'store', container: 'a', item: 'b' }],
    cooldownMs: 0,
    priority: 3,
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
      { kind: 'apply-state', target: 'b', state: 'charred' },
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
    effect: [
      { kind: 'damage', target: 'b', amount: 25 },
      { kind: 'apply-impulse', target: 'b', dir: 'away-from-source', mag: 0.08 },
    ],
    cooldownMs: 500,
  },

  // 8. 燃烧 tick：持续掉血 + 燃尽（用 destroy 简化）
  {
    id: 'burning-tick',
    trigger: { kind: 'tick', intervalMs: 600 },
    match: { kind: 'self', a: { state: ['burning'] } },
    effect: [
      { kind: 'damage', target: 'self', amount: 12 },
      { kind: 'apply-state', target: 'self', state: 'charred' },
    ],
    cooldownMs: 0,
    chainTag: 'fire-spread',
  },

  // 9. 投射物 × 生物 → 穿透伤害与击退
  {
    id: 'projectile-hit-creature',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { flags: ['projectile'] },
      b: { category: ['creature'], notState: ['dead', 'petrified'] },
    },
    effect: [
      { kind: 'damage', target: 'b', amount: 35 },
      { kind: 'apply-impulse', target: 'b', dir: 'away-from-source', mag: 0.12 },
    ],
    cooldownMs: 350,
    priority: 5,
  },

  // 10. 投射物 × 可破坏物 → 一次性破坏并消耗投射物
  {
    id: 'projectile-breaks-breakable',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { flags: ['projectile'] },
      b: { flags: ['breakable'], notState: ['dead'] },
    },
    effect: [
      { kind: 'destroy', target: 'b' },
      { kind: 'destroy', target: 'a' },
    ],
    cooldownMs: 0,
    priority: 4,
  },

  // 11. 毒液 × 生物 → 中毒并造成初始伤害
  {
    id: 'poison-infect-creature',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { typeIds: ['poison'] },
      b: { category: ['creature'], notState: ['dead', 'petrified'] },
    },
    effect: [
      { kind: 'apply-state', target: 'b', state: 'poisoned' },
      { kind: 'damage', target: 'b', amount: 10 },
    ],
    cooldownMs: 700,
  },

  // 12. 药水 × 中毒生物 → 解毒、治疗并消耗药水
  {
    id: 'potion-cures-poison',
    trigger: { kind: 'collision' },
    match: {
      kind: 'pair',
      a: { typeIds: ['potion'] },
      b: { category: ['creature'], state: ['poisoned'] },
    },
    effect: [
      { kind: 'remove-state', target: 'b', state: 'poisoned' },
      { kind: 'heal', target: 'b', amount: 35 },
      { kind: 'destroy', target: 'a' },
    ],
    cooldownMs: 0,
    priority: 6,
  },

  // 13. 热源 × 冻结实体 → 解冻
  {
    id: 'hot-thaw-frozen',
    trigger: { kind: 'contact' },
    match: {
      kind: 'pair',
      a: { temperature: ['hot'] },
      b: { state: ['frozen'] },
    },
    effect: [
      { kind: 'remove-state', target: 'b', state: 'frozen' },
      { kind: 'set-temperature', target: 'b', temp: 'normal' },
    ],
    cooldownMs: 300,
  },
];
