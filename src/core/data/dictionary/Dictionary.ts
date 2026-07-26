/**
 * 词典聚合 + 双语索引构建。
 *
 * 索引构建为模块级单例，加载即完成；查找为纯函数。
 * 支持运行时注入自定义物体（registerCustomObject），把基础词条克隆为真实 DictEntry
 * 注入全部索引，使输入该名可经分词器正常命中。
 *
 * 与旧项目差异：删除双 Trie（cnTrie/enTrie）+ 双 Exact Map 的四重索引；
 * 首期词条规模小，自动补全用扁平前缀过滤即可（YAGNI）。
 * appearance.renderer 不再区分 'dsl'/'custom'，统一为渲染器 id 字符串。
 * isModifiable 抽到 modifiable.ts，消除两份重复。
 */

import type { DictEntry } from '@/core/types/dictionary';
import type { CustomObjectDef } from '@/core/types/save';
import { animalEntries } from './entries/animals';
import { elementEntries } from './entries/elements';
import { objectEntries } from './entries/objects';
import { miscEntries } from './entries/misc';
import { isModifiable } from './modifiable';
import { getAdjective } from './adjectives';

/** 全部词条 */
const entries: DictEntry[] = [
  ...animalEntries,
  ...elementEntries,
  ...objectEntries,
  ...miscEntries,
];

const byId = new Map<string, DictEntry>(entries.map((e) => [e.id, e]));

/** 中文精确：名/别名 → entryId */
const cnExact = new Map<string, string>();
/** 英文精确：名/别名小写 → entryId */
const enExact = new Map<string, string>();

function indexEntry(entry: DictEntry): void {
  cnExact.set(entry.zh.name, entry.id);
  for (const a of entry.zh.aliases ?? []) cnExact.set(a, entry.id);
  enExact.set(entry.en.name.toLowerCase(), entry.id);
  for (const a of entry.en.aliases ?? []) enExact.set(a.toLowerCase(), entry.id);
}

for (const e of entries) indexEntry(e);

// ---- 精确查找 ----

export function lookupByCn(text: string): DictEntry | undefined {
  const id = cnExact.get(text);
  return id ? byId.get(id) : undefined;
}

export function lookupByEn(text: string): DictEntry | undefined {
  const id = enExact.get(text.toLowerCase());
  return id ? byId.get(id) : undefined;
}

export function getEntry(id: string): DictEntry | undefined {
  return byId.get(id);
}

export function allEntries(): DictEntry[] {
  return entries;
}

export function size(): number {
  return entries.length;
}

/** 中文精确 → entryId（供分词器用，区别于 lookupByCn 返回对象） */
export function cnExactId(text: string): string | undefined {
  return cnExact.get(text);
}

/** 英文精确 → entryId */
export function enExactId(text: string): string | undefined {
  return enExact.get(text.toLowerCase());
}

// ---- 前缀补全（扁平过滤，首期词条规模小） ----

export interface Completion {
  text: string;
  id: string;
  zh: string;
  en: string;
}

/** 中文前缀补全（精确名+别名文本），最多 limit 个 */
export function completeCn(prefix: string, limit = 8): Completion[] {
  const out: Completion[] = [];
  for (const e of entries) {
    const cands = [e.zh.name, ...(e.zh.aliases ?? [])];
    for (const text of cands) {
      if (text.startsWith(prefix)) {
        out.push({ text, id: e.id, zh: e.zh.name, en: e.en.name });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/** 英文前缀补全 */
export function completeEn(prefix: string, limit = 8): Completion[] {
  const lp = prefix.toLowerCase();
  const out: Completion[] = [];
  for (const e of entries) {
    const cands = [e.en.name, ...(e.en.aliases ?? [])];
    for (const text of cands) {
      if (text.toLowerCase().startsWith(lp)) {
        out.push({ text, id: e.id, zh: e.zh.name, en: e.en.name });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

// ---- 自定义物体 ----

const customDefs = new Map<string, CustomObjectDef>();

/**
 * 注册自定义物体到全部词典索引。
 *
 * 注入前按基础词条的 modifiable 白名单过滤被禁形容词类，
 * 保证保存的修饰在生成时不会被 AdjectiveSystem 静默丢弃。
 * 形容词在生成时由 candidate 注入，不在词条层硬编码。
 */
export function registerCustomObject(def: CustomObjectDef): void {
  const base = byId.get(def.baseTypeId);
  if (!base) return;
  const adjectives = def.adjectives.filter((adjId) => {
    const adj = getAdjective(adjId);
    return adj ? isModifiable(base, adj.category) : false;
  });
  const filtered: CustomObjectDef = { ...def, adjectives };
  const entry: DictEntry = {
    ...base,
    id: def.id,
    zh: { ...def.zh },
    en: { ...def.en },
    appearance: def.appearanceOverrides
      ? { ...base.appearance, params: { ...base.appearance.params, ...def.appearanceOverrides } }
      : base.appearance,
  };
  byId.set(def.id, entry);
  customDefs.set(def.id, filtered);
  indexEntry(entry);
}

/** 取自定义物体定义（供 Spawner 在生成 custom: 前缀 id 时构造 candidate 形容词） */
export function getCustomDef(id: string): CustomObjectDef | undefined {
  return customDefs.get(id);
}

/** 全部自定义物体定义（供存档恢复时遍历） */
export function allCustomDefs(): CustomObjectDef[] {
  return [...customDefs.values()];
}
