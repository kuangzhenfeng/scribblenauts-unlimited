/**
 * 双语输入解析器 —— 核心创新点。
 *
 * 结构恒为 [形容词]* 名词（名词在末尾）。
 * 流程：normalize → splitByScript → CJK 段后向贪婪分词 / ASCII 段按空格分词
 *      → 枚举名词边界多种切法生成候选 → 打分排序。
 *
 * 关键洞察：词典与形容词表是受限闭集，分词只在闭集内匹配，
 * 不引入通用中文 NLP（jieba 等），准确度高、性能好、零依赖。
 *
 * 与旧项目差异：统一入口 parse(raw, {mode}) 替代双入口 parseInput/parseAdjectivesOnly，
 * 模式分流下沉到分词层（旧项目在 Notebook UI 层试错）。
 */

import { normalize, collapseSpaces } from './normalize';
import { splitByScript } from './Segmenter';
import { cnExactId, enExactId } from '@/core/data/dictionary/Dictionary';
import { lookupAdjByCn, lookupAdjByEn } from '@/core/data/dictionary/adjectives';

/** 解析模式 */
export type ParseMode = 'spawn' | 'adjectives-only';

/** 一个 token 的类型与文本 */
export interface Token {
  kind: 'adjective' | 'noun' | 'unknown';
  text: string;
  /** 形容词 id（仅 kind=adjective） */
  adjId?: string;
  /** 名词 entryId（仅 kind=noun，且为精确匹配时） */
  nounId?: string;
}

export interface ParsedAdjective {
  adjId: string;
  text: string;
}

export interface ParsedNoun {
  entryId: string;
  text: string;
}

export interface ParseCandidate {
  noun: ParsedNoun;
  adjectives: ParsedAdjective[];
  /** 分数越高越优：长名词优先 + 无 unknown token 优先 */
  score: number;
  raw: string;
}

/** 中文字符级形容词后缀"的/地/得"剥离 */
const ADJ_PARTICLES = new Set(['的', '地', '得']);

/** CJK 段最大名词长度（字符），用于限界最长匹配 */
const MAX_NOUN_LEN = 8;

/** 统一解析入口 */
export function parse(raw: string, mode: ParseMode = 'spawn'): ParseCandidate[] | ParsedAdjective[] {
  if (mode === 'adjectives-only') {
    return parseAdjectivesOnly(raw);
  }
  return parseInput(raw);
}

/** 生成模式：返回多个候选，按 score 降序 */
export function parseInput(raw: string): ParseCandidate[] {
  const norm = normalize(raw);
  if (!norm) return [];

  const segments = splitByScript(norm);
  const tokens: Token[] = [];
  for (const seg of segments) {
    if (seg.kind === 'cjk') {
      tokens.push(...segmentCjk(seg.text));
    } else {
      // ASCII 段：折叠空白后按空格切
      const collapsed = collapseSpaces(seg.text);
      if (!collapsed) continue;
      for (const w of collapsed.split(' ')) {
        tokens.push(classifyAscii(w));
      }
    }
  }

  return generateCandidates(tokens, norm);
}

/**
 * 纯形容词模式：输入全为形容词（无名词）时返回这些形容词。
 * 供"对选中实体施加形容词"用：选中实体后笔记本输入纯形容词（如"燃烧"）回车即应用。
 * 遇任何非形容词 token（名词/未知）即返回空，交由调用方回退到普通生成解析。
 */
export function parseAdjectivesOnly(raw: string): ParsedAdjective[] {
  const norm = normalize(raw);
  if (!norm) return [];
  const segments = splitByScript(norm);
  const out: ParsedAdjective[] = [];
  for (const seg of segments) {
    if (seg.kind === 'cjk') {
      const toks = segmentCjkAdjectives(seg.text);
      for (const t of toks) {
        if (t.kind === 'adjective' && t.adjId) {
          out.push({ adjId: t.adjId, text: t.text });
        } else {
          return []; // 出现非形容词即放弃纯形容词模式
        }
      }
    } else {
      const collapsed = collapseSpaces(seg.text);
      if (!collapsed) continue;
      for (const w of collapsed.split(' ')) {
        const adj = lookupAdjByEn(w.toLowerCase());
        if (adj) {
          out.push({ adjId: adj.id, text: w });
        } else {
          return [];
        }
      }
    }
  }
  return out;
}

/** CJK 段后向贪婪闭集分词 */
function segmentCjk(s: string): Token[] {
  const out: Token[] = [];
  // 从末尾尝试最长名词匹配（结构恒为名词在末尾）
  let nounMatched = false;
  for (let len = Math.min(s.length, MAX_NOUN_LEN); len >= 1; len--) {
    const candidate = s.slice(s.length - len);
    const id = cnExactId(candidate);
    if (id) {
      const before = s.slice(0, s.length - len);
      out.push(...segmentCjkAdjectives(before));
      out.push({ kind: 'noun', text: candidate, nounId: id });
      nounMatched = true;
      break;
    }
  }
  if (!nounMatched) {
    // 无名词匹配：整段尝试形容词切分，否则记 unknown
    out.push(...segmentCjkAdjectives(s));
  }
  return out;
}

/** CJK 形容词段：逐段切分，剥离"的/地/得"粒子 */
function segmentCjkAdjectives(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    // 跳过粒子
    if (ADJ_PARTICLES.has(s[i])) {
      i++;
      continue;
    }
    // 最长形容词匹配（限界 6 字）
    let matched = false;
    for (let len = Math.min(s.length - i, 6); len >= 1; len--) {
      const word = s.slice(i, i + len);
      const adj = lookupAdjByCn(word);
      if (adj) {
        out.push({ kind: 'adjective', text: word, adjId: adj.id });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 也可能是名词别名出现在前部（罕见，如"热狗"前部"热"）——这里整体记 unknown，
      // 交由候选生成阶段尝试重组
      out.push({ kind: 'unknown', text: s.slice(i) });
      i = s.length;
    }
  }
  return out;
}

/** ASCII token 分类 */
function classifyAscii(w: string): Token {
  const wl = w.toLowerCase();
  const nounId = enExactId(wl);
  if (nounId) return { kind: 'noun', text: w, nounId };
  const adj = lookupAdjByEn(wl);
  if (adj) return { kind: 'adjective', text: w, adjId: adj.id };
  return { kind: 'unknown', text: w };
}

// ---- 候选生成 ----

/** 枚举名词 token 边界的几种切法，产出候选 */
function generateCandidates(tokens: Token[], raw: string): ParseCandidate[] {
  // 收集所有"可作名词"的位置：精确 noun token，或 unknown token（可能整体是名词别名）
  const nounPositions: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'noun') {
      nounPositions.push(i);
    } else if (t.kind === 'unknown') {
      // 尝试把 unknown 整体当名词查中英精确
      const id = cnExactId(t.text) ?? enExactId(t.text.toLowerCase());
      if (id) {
        t.kind = 'noun';
        t.nounId = id;
        nounPositions.push(i);
      }
    }
  }

  if (nounPositions.length === 0) {
    // 完全无名词：尝试整串精确查（如单形容词无名词则失败）
    const id = cnExactId(raw) ?? enExactId(raw.toLowerCase());
    if (id) {
      return [{ noun: { entryId: id, text: raw }, adjectives: [], score: 1, raw }];
    }
    return [];
  }

  // 结构恒为名词在末尾，取最后一个名词位置作为主名词
  const lastNounPos = nounPositions[nounPositions.length - 1];
  const nounTok = tokens[lastNounPos];
  const adjs: ParsedAdjective[] = [];
  let unknownCount = 0;
  for (let i = 0; i < lastNounPos; i++) {
    const t = tokens[i];
    if (t.kind === 'adjective' && t.adjId) {
      adjs.push({ adjId: t.adjId, text: t.text });
    } else {
      // 前部名词/unknown 视作容错，扣分
      unknownCount++;
    }
  }

  const score = nounTok.text!.length * 10 - unknownCount * 100;
  const candidate: ParseCandidate = {
    noun: { entryId: nounTok.nounId!, text: nounTok.text },
    adjectives: adjs,
    score,
    raw,
  };

  // 多候选：若末尾名词前还有一个候选名词边界，产出"形容词+名词"的第二解
  // 例如 "hot dog"：可能整体是词条"热狗"，也可能是 hot(形)+dog(名)
  // 当 tokens 只有 1 个 noun 且无 unknown，且 raw 整体也能精确匹配词条时，追加整体候选
  const altId = cnExactId(raw) ?? enExactId(raw.toLowerCase());
  const candidates: ParseCandidate[] = [candidate];
  if (altId && altId !== nounTok.nounId) {
    candidates.push({
      noun: { entryId: altId, text: raw },
      adjectives: [],
      score: raw.length * 10 + 5, // 整体名词略加分（少切更优）
      raw,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}
