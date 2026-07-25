/**
 * 形容词词典 —— 分类别模块，聚合后构建中英别名索引。
 *
 * 索引构建为模块级单例，加载即完成；查找为纯函数。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';
import { sizeAdjectives } from './size';
import { colorAdjectives } from './color';
import { behaviorAdjectives } from './behavior';
import { stateAdjectives } from './state';
import { materialAdjectives } from './material';

/** 全部形容词 */
export const adjectives: AdjectiveEntry[] = [
  ...sizeAdjectives,
  ...colorAdjectives,
  ...behaviorAdjectives,
  ...stateAdjectives,
  ...materialAdjectives,
];

const byId = new Map<string, AdjectiveEntry>(adjectives.map((a) => [a.id, a]));

/** 中文文本 → 形容词 id（精确，含别名） */
const cnExact = new Map<string, string>();
/** 英文文本（小写） → 形容词 id（精确，含别名） */
const enExact = new Map<string, string>();

function indexAdj(a: AdjectiveEntry): void {
  cnExact.set(a.zh.name, a.id);
  for (const alias of a.zh.aliases ?? []) cnExact.set(alias, a.id);
  enExact.set(a.en.name.toLowerCase(), a.id);
  for (const alias of a.en.aliases ?? []) enExact.set(alias.toLowerCase(), a.id);
}
for (const a of adjectives) indexAdj(a);

export function lookupAdjByCn(text: string): AdjectiveEntry | undefined {
  const id = cnExact.get(text);
  return id ? byId.get(id) : undefined;
}

export function lookupAdjByEn(text: string): AdjectiveEntry | undefined {
  const id = enExact.get(text.toLowerCase());
  return id ? byId.get(id) : undefined;
}

export function getAdjective(id: string): AdjectiveEntry | undefined {
  return byId.get(id);
}

export function allAdjectives(): AdjectiveEntry[] {
  return adjectives;
}
