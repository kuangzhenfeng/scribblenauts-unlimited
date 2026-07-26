/**
 * 自动补全 —— 输入时实时前缀补全下拉（涂鸦纸片风）。
 *
 * 多词组合补全：
 *  - 英文：按空格分词，对最后一段做前缀补全，选中后只回填最后一段（保留前缀）。
 *  - 中文：贪心匹配已确认词（形容词/名词 + 的/地/得 粒子），对剩余未确认后缀做前缀补全。
 * 输入英文时优先按英文匹配与显示，输入中文时优先按中文。
 */

import { completeCn, completeEn, cnExactId, type Completion } from '@/core/data/dictionary/Dictionary';
import { completeAdjCn, completeAdjEn, lookupAdjByCn } from '@/core/data/dictionary/adjectives';
import { UI_FONT, PAPER_BG, INK, INK_HIGHLIGHT, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

export interface AutocompleteCallbacks {
  /** 选中候选后回填完整输入文本（已确认前缀 + 选中名） */
  onPick: (fullText: string) => void;
  /** 当前是否处于纯形容词输入模式（笔记本 adjective 模式时补全形容词而非词条） */
  isAdjectiveMode?: () => boolean;
}

/** 中文字符级形容词后缀"的/地/得"剥离（与 InputParser 对齐） */
const ADJ_PARTICLES = new Set(['的', '地', '得']);

/** 形容词/名词最长匹配限界（与 InputParser 对齐） */
const MAX_WORD_LEN = 6;

export class Autocomplete {
  private el: HTMLDivElement;
  private items: HTMLDivElement[] = [];
  private selected = 0;
  private active = false;
  private completions: Completion[] = [];
  /** 已确认前缀（多词组合时保留，回填时拼接在选中名前） */
  private prefix = '';
  /** 补全前缀是否为 CJK（决定回填与显示用哪个语言名） */
  private queryIsCjk = false;

  constructor(private readonly cb: AutocompleteCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'autocomplete';
    this.el.style.cssText = boxStyle();
    document.body.appendChild(this.el);
    this.hide();
  }

  update(text: string): void {
    const t = text.trim();
    if (!t) {
      this.hide();
      return;
    }
    const isAdj = this.cb.isAdjectiveMode?.() ?? false;
    const inputIsCjk = /[㐀-鿿豈-]/u.test(t);

    // 多词组合补全：分离已确认前缀与正在输入的补全前缀
    let prefix: string;
    let query: string;
    let queryIsCjk: boolean;

    if (inputIsCjk) {
      // 中文：贪心匹配已确认词（形容词/名词 + 粒子），取剩余未确认后缀
      const seg = this.segmentCjkCommitted(t);
      prefix = seg.prefix;
      query = seg.remaining;
      queryIsCjk = /[㐀-鿿豈-]/u.test(query);
    } else {
      // 英文：按空格取最后一段
      const lastSpace = t.lastIndexOf(' ');
      if (lastSpace >= 0) {
        prefix = t.slice(0, lastSpace + 1);
        query = t.slice(lastSpace + 1);
      } else {
        prefix = '';
        query = t;
      }
      queryIsCjk = false;
    }

    if (!query) {
      this.hide();
      return;
    }

    this.prefix = prefix;
    this.queryIsCjk = queryIsCjk;

    // 根据补全前缀的脚本选择匹配函数
    let list: Completion[];
    if (isAdj) {
      list = queryIsCjk ? completeAdjCn(query, 6) : completeAdjEn(query, 6);
    } else {
      // spawn 模式：形容词 + 词条合并，形容词优先
      const nouns = queryIsCjk ? completeCn(query, 6) : completeEn(query, 6);
      const adjs = queryIsCjk ? completeAdjCn(query, 6) : completeAdjEn(query, 6);
      const seen = new Set<string>();
      const merged: Completion[] = [];
      for (const c of [...adjs, ...nouns]) {
        const key = queryIsCjk ? c.zh : c.en;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(c);
        if (merged.length >= 6) break;
      }
      list = merged;
    }

    this.completions = list;
    if (list.length === 0) {
      this.hide();
      return;
    }
    this.active = true;
    this.selected = 0;
    this.el.innerHTML = '';
    this.items = list.map((c, i) => {
      const div = document.createElement('div');
      // 输入英文时优先显示英文名，输入中文时优先显示中文名
      const primary = queryIsCjk ? c.zh : c.en;
      const secondary = queryIsCjk ? c.en : c.zh;
      div.textContent = `${primary}（${secondary}）`;
      div.style.cssText = itemStyle(i === this.selected);
      // pointerdown 统一鼠标与触摸，消除移动端 hover 死区与点击延迟
      div.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.select(i);
        this.confirm();
      });
      this.el.appendChild(div);
      return div;
    });
    this.el.style.display = 'block';
  }

  hide(): void {
    this.active = false;
    this.el.style.display = 'none';
  }

  get isActive(): boolean {
    return this.active;
  }

  move(delta: number): void {
    if (!this.active) return;
    this.selected = (this.selected + delta + this.completions.length) % this.completions.length;
    this.items.forEach((it, i) => (it.style.cssText = itemStyle(i === this.selected)));
  }

  confirm(): Completion | undefined {
    if (!this.active) return undefined;
    const c = this.completions[this.selected];
    // 按补全前缀的脚本选择回填语言名（非 UI 语言）
    const name = this.queryIsCjk ? c.zh : c.en;
    this.hide();
    this.cb.onPick(this.prefix + name);
    return c;
  }

  /**
   * CJK 贪心匹配已确认词：从前向后逐词匹配形容词/名词，跳过 的/地/得 粒子。
   * 最后一个匹配词视为"正在输入"（query），其前的词视为已确认前缀。
   * 这样用户输入"红"时，"红"是 query 而非 prefix，能看到"红色"等补全；
   * 输入"飞行的紫色的狗"时，"狗"是 query，前缀是"飞行的紫色的"。
   */
  private segmentCjkCommitted(s: string): { prefix: string; remaining: string } {
    let i = 0;
    let lastWordStart = -1;
    let lastWordEnd = -1;
    while (i < s.length) {
      // 跳过粒子
      if (ADJ_PARTICLES.has(s[i])) {
        i++;
        continue;
      }
      // 最长匹配（形容词或名词），限界 6 字
      let matched = false;
      for (let len = Math.min(s.length - i, MAX_WORD_LEN); len >= 1; len--) {
        const word = s.slice(i, i + len);
        if (lookupAdjByCn(word) || cnExactId(word)) {
          lastWordStart = i;
          lastWordEnd = i + len;
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) break;
    }
    // 最后一个匹配词视为正在输入 → query；之前的视为已确认 → prefix
    if (lastWordStart >= 0 && lastWordEnd === i) {
      // 游标恰停在最后一个匹配词末尾 → 最后一个词就是 query
      return { prefix: s.slice(0, lastWordStart), remaining: s.slice(lastWordStart) };
    }
    // 末尾有未匹配后缀或粒子 → 后缀为 query，匹配部分为 prefix
    return { prefix: s.slice(0, i), remaining: s.slice(i) };
  }

  private select(i: number): void {
    this.selected = i;
    this.items.forEach((it, j) => (it.style.cssText = itemStyle(j === this.selected)));
  }
}

function boxStyle(): string {
  return [
    'position:fixed',
    'left:50%',
    'bottom:max(80px,env(safe-area-inset-bottom))',
    'transform:translateX(-50%)',
    'width:min(560px,calc(92vw - 16px))',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:15px',
    'padding:6px',
    TORN_EDGE,
    'z-index:55',
    'display:none',
    'max-height:200px',
    'overflow-y:auto',
  ].join(';');
}

function itemStyle(selected: boolean): string {
  return [
    'padding:6px 10px',
    'cursor:pointer',
    `border-radius:6px`,
    selected ? `background:${INK_HIGHLIGHT}` : 'background:transparent',
  ].join(';');
}
