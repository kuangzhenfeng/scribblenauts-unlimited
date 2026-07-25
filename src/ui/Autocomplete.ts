/**
 * 自动补全 —— 输入时实时前缀补全下拉（涂鸦纸片风）。
 *
 * 中文优先 completeCn，英文 completeEn，合并 Top-N。
 * 选中后回调，把词条名回填到输入框（便于用户回车生成）。
 */

import { completeCn, completeEn, type Completion } from '@/core/data/dictionary/Dictionary';
import { HAND_FONT, PAPER_BG, INK, INK_HIGHLIGHT, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

export interface AutocompleteCallbacks {
  onPick: (c: Completion) => void;
}

export class Autocomplete {
  private el: HTMLDivElement;
  private items: HTMLDivElement[] = [];
  private selected = 0;
  private active = false;
  private completions: Completion[] = [];

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
    const isCjk = /[㐀-鿿豈-]/u.test(t);
    const list = isCjk ? completeCn(t, 6) : completeEn(t, 6);
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
      div.textContent = `${c.zh}（${c.text}）`;
      div.style.cssText = itemStyle(i === this.selected);
      div.addEventListener('mouseenter', () => this.select(i));
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
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
    this.hide();
    this.cb.onPick(c);
    return c;
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
    'bottom:80px',
    'transform:translateX(-50%)',
    'width:min(560px,92vw)',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${HAND_FONT}`,
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
