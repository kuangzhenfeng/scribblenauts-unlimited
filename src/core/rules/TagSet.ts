/**
 * 属性标签集合 —— 实体的材质/温度/状态/行为/标志。
 *
 * 双层表示：
 * - Set 版本：可读性、序列化、任意字符串扩展（自定义物体）；
 * - bitmask 缓存：热路径（规则匹配）用按位与 O(1) 判定。
 *
 * 设计原则：bitmask 由 Set 派生缓存，写入时同步更新，读时零成本。
 * 枚举标签有限，bit 编码固定；自定义/未知标签不参与 bitmask，仅 Set 可见。
 *
 * 与旧项目差异：TagSet 持 onChange 回调自动同步 TagIndex，effect handler 不再手动 deindex/index。
 */

import type {
  FlagTag,
  MaterialTag,
  StateTag,
  TemperatureTag,
  BehaviorTag,
  ObjectCategory,
} from '@/core/types/rules';
import type { TagSetLike } from '@/core/types/dictionary';

// ---- 枚举 → bit 编码 ----

const MATERIAL_ORDER: MaterialTag[] = [
  'wood', 'metal', 'cloth', 'glass', 'flesh', 'stone',
  'paper', 'plastic', 'rubber', 'water', 'ice', 'plant', 'gold',
];
const STATE_ORDER: StateTag[] = [
  'normal', 'burning', 'frozen', 'wet', 'electrified',
  'dead', 'petrified', 'poisoned', 'sleeping', 'charred',
];
const BEHAVIOR_ORDER: BehaviorTag[] = [
  'flying', 'swimming', 'walking', 'aggressive',
  'friendly', 'scared', 'hungry', 'tame',
];
const FLAG_ORDER: FlagTag[] = [
  'flammable', 'conductive', 'sharp', 'edible', 'fragile', 'cuttable',
  'breakable', 'weapon', 'ranged', 'tool', 'projectile', 'container', 'rideable', 'wing',
  'igniter', 'edible-target',
];

const materialBit = new Map<MaterialTag, number>();
MATERIAL_ORDER.forEach((t, i) => materialBit.set(t, 1 << i));
const stateBit = new Map<StateTag, number>();
STATE_ORDER.forEach((t, i) => stateBit.set(t, 1 << i));
const behaviorBit = new Map<BehaviorTag, number>();
BEHAVIOR_ORDER.forEach((t, i) => behaviorBit.set(t, 1 << i));
const flagBit = new Map<FlagTag, number>();
FLAG_ORDER.forEach((t, i) => flagBit.set(t, 1 << i));

/** 温度无 bitmask（单值互斥，直接比较） */

/** 谓词 bitmask：从 TagPredicate 的数组生成，用于按位与匹配 */
export interface PredicateMask {
  material?: number;
  state?: number;
  behavior?: number;
  flags?: number;
  notState?: number;
  notFlags?: number;
  temperature?: TemperatureTag[];
  typeIds?: Set<string>;
  category?: Set<ObjectCategory>;
}

/** 标签变更监听器（TagIndex 自动同步用） */
export interface TagSetChangeListener {
  onTagsChanged(ts: TagSet): void;
}

/** TagSet 运行时表示（含 bitmask 缓存） */
export class TagSet {
  material = new Set<MaterialTag>();
  temperature: TemperatureTag = 'normal';
  state = new Set<StateTag>();
  behavior = new Set<BehaviorTag>();
  flags = new Set<FlagTag>();
  category?: ObjectCategory;

  // bitmask 缓存
  private materialMask = 0;
  private stateMask = 0;
  private behaviorMask = 0;
  private flagsMask = 0;

  private listener?: TagSetChangeListener;

  static fromRaw(raw: TagSetLike): TagSet {
    const ts = new TagSet();
    for (const m of raw.material) {
      const bm = materialBit.get(m as MaterialTag);
      if (bm) ts.material.add(m as MaterialTag);
    }
    ts.temperature = (raw.temperature as TemperatureTag) ?? 'normal';
    for (const s of raw.state) {
      const bs = stateBit.get(s as StateTag);
      if (bs) ts.state.add(s as StateTag);
    }
    for (const b of raw.behavior) {
      const bb = behaviorBit.get(b as BehaviorTag);
      if (bb) ts.behavior.add(b as BehaviorTag);
    }
    for (const f of raw.flags) {
      const bf = flagBit.get(f as FlagTag);
      if (bf) ts.flags.add(f as FlagTag);
    }
    ts.category = raw.category as ObjectCategory | undefined;
    ts.rebuildMasks();
    return ts;
  }

  /** 设置变更监听器（TagIndex 自动同步索引） */
  setListener(l: TagSetChangeListener): void {
    this.listener = l;
  }

  private rebuildMasks(): void {
    let mm = 0;
    for (const m of this.material) mm |= materialBit.get(m) ?? 0;
    this.materialMask = mm;
    let sm = 0;
    for (const s of this.state) sm |= stateBit.get(s) ?? 0;
    this.stateMask = sm;
    let bm = 0;
    for (const b of this.behavior) bm |= behaviorBit.get(b) ?? 0;
    this.behaviorMask = bm;
    let fm = 0;
    for (const f of this.flags) fm |= flagBit.get(f) ?? 0;
    this.flagsMask = fm;
  }

  /** 写操作后通知监听器重建索引 */
  private notify(): void {
    this.listener?.onTagsChanged(this);
  }

  get materialBits(): number { return this.materialMask; }
  get stateBits(): number { return this.stateMask; }
  get behaviorBits(): number { return this.behaviorMask; }
  get flagsBits(): number { return this.flagsMask; }

  // ---- 写操作（同步更新 bitmask + 通知监听器） ----

  addState(s: StateTag): void {
    if (this.state.has(s)) return;
    this.state.add(s);
    this.stateMask |= stateBit.get(s) ?? 0;
    this.notify();
  }
  removeState(s: StateTag): void {
    if (!this.state.has(s)) return;
    this.state.delete(s);
    this.stateMask &= ~(stateBit.get(s) ?? 0);
    this.notify();
  }
  hasState(s: StateTag): boolean { return this.state.has(s); }

  addFlag(f: FlagTag): void {
    if (this.flags.has(f)) return;
    this.flags.add(f);
    this.flagsMask |= flagBit.get(f) ?? 0;
    this.notify();
  }
  removeFlag(f: FlagTag): void {
    if (!this.flags.has(f)) return;
    this.flags.delete(f);
    this.flagsMask &= ~(flagBit.get(f) ?? 0);
    this.notify();
  }
  hasFlag(f: FlagTag): boolean { return this.flags.has(f); }

  addBehavior(b: BehaviorTag): void {
    if (this.behavior.has(b)) return;
    this.behavior.add(b);
    this.behaviorMask |= behaviorBit.get(b) ?? 0;
    this.notify();
  }
  removeBehavior(b: BehaviorTag): void {
    if (!this.behavior.has(b)) return;
    this.behavior.delete(b);
    this.behaviorMask &= ~(behaviorBit.get(b) ?? 0);
    this.notify();
  }

  setTemperature(t: TemperatureTag): void {
    this.temperature = t;
    this.notify();
  }

  /** 测试谓词是否匹配本 TagSet */
  matches(pred: PredicateMask): boolean {
    if (pred.material !== undefined && (this.materialMask & pred.material) !== pred.material) return false;
    if (pred.state !== undefined && (this.stateMask & pred.state) === 0) return false;
    if (pred.behavior !== undefined && (this.behaviorMask & pred.behavior) === 0) return false;
    if (pred.flags !== undefined && (this.flagsMask & pred.flags) === 0) return false;
    if (pred.notState !== undefined && (this.stateMask & pred.notState) !== 0) return false;
    if (pred.notFlags !== undefined && (this.flagsMask & pred.notFlags) !== 0) return false;
    if (pred.temperature && pred.temperature.length && !pred.temperature.includes(this.temperature)) return false;
    if (pred.category && pred.category.size && (!this.category || !pred.category.has(this.category))) return false;
    return true;
  }

  /** 精确 typeId 匹配（与 bitmask 分离，因 typeId 不在 TagSet 内） */
  static typeIdMatches(pred: PredicateMask | undefined, typeId: string): boolean {
    if (!pred?.typeIds || pred.typeIds.size === 0) return true;
    return pred.typeIds.has(typeId);
  }
}

// ---- 谓词编译：TagPredicate → PredicateMask ----

import type { TagPredicate } from '@/core/types/rules';

export function compilePredicate(pred: TagPredicate): PredicateMask {
  const mask: PredicateMask = {};
  if (pred.material?.length) {
    mask.material = pred.material.reduce((acc, m) => acc | (materialBit.get(m) ?? 0), 0);
  }
  if (pred.state?.length) {
    mask.state = pred.state.reduce((acc, s) => acc | (stateBit.get(s) ?? 0), 0);
  }
  if (pred.behavior?.length) {
    mask.behavior = pred.behavior.reduce((acc, b) => acc | (behaviorBit.get(b) ?? 0), 0);
  }
  if (pred.flags?.length) {
    mask.flags = pred.flags.reduce((acc, f) => acc | (flagBit.get(f) ?? 0), 0);
  }
  if (pred.notState?.length) {
    mask.notState = pred.notState.reduce((acc, s) => acc | (stateBit.get(s) ?? 0), 0);
  }
  if (pred.notFlags?.length) {
    mask.notFlags = pred.notFlags.reduce((acc, f) => acc | (flagBit.get(f) ?? 0), 0);
  }
  if (pred.temperature?.length) mask.temperature = pred.temperature;
  if (pred.typeIds?.length) mask.typeIds = new Set(pred.typeIds);
  if (pred.category?.length) mask.category = new Set(pred.category);
  return mask;
}
