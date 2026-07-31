/**
 * 候选菜单 —— 输入歧义时弹出多候选，用户选定后生成（涂鸦纸片风）。
 *
 * 单一高分候选可直接回车生成；多候选时以下拉呈现。
 * 键盘上下选/回车确认/Esc 取消。
 */

import type { ParseCandidate } from '@/core/lex/InputParser';
import type { DictEntry } from '@/core/types/dictionary';
import type { AdjectiveEntry } from '@/core/types/adjective';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { getAdjective } from '@/core/data/dictionary/adjectives';
import { entryName, getLang } from '@/core/i18n/I18n';
import { UI_FONT, PAPER_BG, INK, INK_HIGHLIGHT, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

export interface CandidateMenuCallbacks {
  onSelect: (candidate: ParseCandidate) => void;
}

export class CandidateMenu {
  private el: HTMLDivElement;
  private items: HTMLButtonElement[] = [];
  private candidates: ParseCandidate[] = [];
  private selected = 0;
  private active = false;
  private input?: HTMLInputElement;

  constructor(private readonly cb: CandidateMenuCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'candidate-menu';
    this.el.setAttribute('role', 'listbox');
    this.el.setAttribute('aria-label', '候选词');
    this.el.style.cssText = menuStyle();
    document.body.appendChild(this.el);
    this.hide();
  }

  /** 绑定输入框，建立 listbox 的 ARIA 控制关系。 */
  bindInput(input: HTMLInputElement): void {
    this.input = input;
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', [input.getAttribute('aria-controls'), this.el.id].filter(Boolean).join(' '));
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
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `${this.el.id}-option-${i}`;
      button.setAttribute('role', 'option');
      button.tabIndex = -1;
      button.textContent = this.labelFor(c);
      button.setAttribute('aria-label', button.textContent);
      button.setAttribute('aria-selected', String(i === this.selected));
      button.style.cssText = itemStyle(i === this.selected);
      const activate = (): void => {
        this.select(i);
        this.confirm();
      };
      // pointerdown 统一鼠标与触摸，消除移动端 hover 死区
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activate();
      });
      button.addEventListener('click', (e) => {
        e.preventDefault();
        activate();
      });
      this.el.appendChild(button);
      return button;
    });
    this.el.style.display = 'block';
    this.syncAria();
    return true;
  }

  hide(): void {
    this.active = false;
    this.el.style.display = 'none';
    this.input?.removeAttribute('aria-activedescendant');
    this.input?.setAttribute('aria-expanded', 'false');
  }

  get isActive(): boolean {
    return this.active;
  }

  move(delta: number): void {
    if (!this.active) return;
    this.selected = (this.selected + delta + this.candidates.length) % this.candidates.length;
    this.items.forEach((it, i) => {
      it.style.cssText = itemStyle(i === this.selected);
      it.setAttribute('aria-selected', String(i === this.selected));
    });
    this.syncAria();
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
    this.items.forEach((it, j) => {
      it.style.cssText = itemStyle(j === this.selected);
      it.setAttribute('aria-selected', String(j === this.selected));
    });
    this.syncAria();
  }

  private syncAria(): void {
    const active = this.items[this.selected];
    if (active) this.input?.setAttribute('aria-activedescendant', active.id);
    this.input?.setAttribute('aria-expanded', String(this.active));
  }

  private labelFor(c: ParseCandidate): string {
    const noun = getEntry(c.noun.entryId) as DictEntry | undefined;
    // 当前语言名为主，副语言名为注
    const lang = getLang();
    const nounPrimary = noun ? entryName(noun) : c.noun.text;
    const nounSecondary = noun ? (lang === 'zh' ? noun.en.name : noun.zh.name) : '';
    const nounLabel = nounSecondary ? `${nounPrimary}（${nounSecondary}）` : nounPrimary;
    const adjLabels = c.adjectives
      .map((a) => {
        const adj = getAdjective(a.adjId) as AdjectiveEntry | undefined;
        return adj ? entryName(adj) : a.text;
      })
      .join('·');
    return adjLabels ? `${adjLabels} ${nounLabel}` : nounLabel;
  }
}

function menuStyle(): string {
  return [
    'position:fixed',
    'left:50%',
    'bottom:max(96px,env(safe-area-inset-bottom))',
    'transform:translateX(-50%)',
    'width:min(560px,calc(92vw - 16px))',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:15px',
    'padding:6px',
    TORN_EDGE,
    'z-index:60',
    'display:none',
  ].join(';');
}

function itemStyle(selected: boolean): string {
  return [
    'display:block',
    'width:100%',
    'padding:8px 12px',
    'border:0',
    'font:inherit',
    'color:inherit',
    'text-align:left',
    'border-radius:6px',
    'cursor:pointer',
    selected ? `background:${INK_HIGHLIGHT}` : 'background:transparent',
  ].join(';');
}
