/**
 * 候选菜单 —— 输入歧义时弹出多候选，用户选定后生成（涂鸦纸片风）。
 *
 * 单一高分候选可直接回车生成；多候选时以下拉呈现。
 * 键盘上下选/回车确认/Esc 取消。
 */

import type { ParseCandidate } from '@/core/lex/InputParser';
import type { DictEntry } from '@/core/types/dictionary';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { getAdjective } from '@/core/data/dictionary/adjectives';
import { HAND_FONT, PAPER_BG, INK, INK_HIGHLIGHT, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

export interface CandidateMenuCallbacks {
  onSelect: (candidate: ParseCandidate) => void;
}

export class CandidateMenu {
  private el: HTMLDivElement;
  private items: HTMLDivElement[] = [];
  private candidates: ParseCandidate[] = [];
  private selected = 0;
  private active = false;

  constructor(private readonly cb: CandidateMenuCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'candidate-menu';
    this.el.style.cssText = menuStyle();
    document.body.appendChild(this.el);
    this.hide();
  }

  show(candidates: ParseCandidate[]): boolean {
    this.candidates = candidates;
    if (candidates.length === 0) {
      this.hide();
      return false;
    }
    if (candidates.length === 1) {
      this.hide();
      this.cb.onSelect(candidates[0]);
      return false;
    }
    this.active = true;
    this.selected = 0;
    this.el.innerHTML = '';
    this.items = candidates.map((c, i) => {
      const div = document.createElement('div');
      div.textContent = this.labelFor(c);
      div.style.cssText = itemStyle(i === this.selected);
      div.addEventListener('mouseenter', () => this.select(i));
      div.addEventListener('click', () => this.confirm());
      this.el.appendChild(div);
      return div;
    });
    this.el.style.display = 'block';
    return true;
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
    this.selected = (this.selected + delta + this.candidates.length) % this.candidates.length;
    this.items.forEach((it, i) => (it.style.cssText = itemStyle(i === this.selected)));
  }

  confirm(): void {
    if (!this.active) return;
    const c = this.candidates[this.selected];
    this.hide();
    this.cb.onSelect(c);
  }

  cancel(): void {
    this.hide();
  }

  private select(i: number): void {
    this.selected = i;
    this.items.forEach((it, j) => (it.style.cssText = itemStyle(j === this.selected)));
  }

  private labelFor(c: ParseCandidate): string {
    const noun = getEntry(c.noun.entryId) as DictEntry | undefined;
    const nounLabel = noun ? `${noun.zh.name}（${noun.en.name}）` : c.noun.text;
    const adjLabels = c.adjectives
      .map((a) => {
        const adj = getAdjective(a.adjId);
        return adj ? adj.zh.name : a.text;
      })
      .join('·');
    return adjLabels ? `${adjLabels} ${nounLabel}` : nounLabel;
  }
}

function menuStyle(): string {
  return [
    'position:fixed',
    'left:50%',
    'bottom:96px',
    'transform:translateX(-50%)',
    'width:min(560px,92vw)',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${HAND_FONT}`,
    'font-size:15px',
    'padding:6px',
    TORN_EDGE,
    'z-index:60',
    'display:none',
  ].join(';');
}

function itemStyle(selected: boolean): string {
  return [
    'padding:8px 12px',
    'border-radius:6px',
    'cursor:pointer',
    selected ? `background:${INK_HIGHLIGHT}` : 'background:transparent',
  ].join(';');
}
