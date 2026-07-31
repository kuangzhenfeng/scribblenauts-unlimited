/**
 * 自动补全 —— 输入时实时前缀补全下拉（涂鸦纸片风）。
 *
 * 多词组合补全（前缀分离 + CJK 贪心分词）已抽到 completionQuery，
 * 这里只负责下拉渲染与键盘导航。多词组合语义见 completionQuery 文档。
 * 输入英文时优先按英文匹配与显示，输入中文时优先按中文。
 */

import { computeCompletions, type CompletionMode } from './completionQuery';
import type { Completion } from '@/core/data/dictionary/Dictionary';
import { UI_FONT, PAPER_BG, INK, INK_HIGHLIGHT, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

export interface AutocompleteCallbacks {
  /** 选中候选后回填完整输入文本（已确认前缀 + 选中名） */
  onPick: (fullText: string) => void;
  /** 当前是否处于纯形容词输入模式（笔记本 adjective 模式时补全形容词而非词条） */
  isAdjectiveMode?: () => boolean;
}

export class Autocomplete {
  private el: HTMLDivElement;
  private items: HTMLButtonElement[] = [];
  private selected = 0;
  private active = false;
  private completions: Completion[] = [];
  private input?: HTMLInputElement;
  /** 已确认前缀（多词组合时保留，回填时拼接在选中名前） */
  private prefix = '';

  constructor(private readonly cb: AutocompleteCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'autocomplete';
    this.el.setAttribute('role', 'listbox');
    this.el.setAttribute('aria-label', '自动补全');
    this.el.style.cssText = boxStyle();
    document.body.appendChild(this.el);
    this.hide();
  }

  /** 绑定输入框，建立 listbox 的 ARIA 控制关系。 */
  bindInput(input: HTMLInputElement): void {
    this.input = input;
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', [input.getAttribute('aria-controls'), this.el.id].filter(Boolean).join(' '));
  }

  update(text: string): void {
    const isAdj = this.cb.isAdjectiveMode?.() ?? false;
    const mode: CompletionMode = isAdj ? 'adjective' : 'spawn';
    // 复用 completionQuery 的前缀分离 + 形容词/名词合并补全（DRY）
    const { completions, prefix, queryIsCjk } = computeCompletions(text, mode, 6);
    if (completions.length === 0) {
      this.hide();
      return;
    }
    this.completions = completions;
    this.prefix = prefix;
    this.active = true;
    this.selected = 0;
    this.el.innerHTML = '';
    this.items = completions.map((c, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `${this.el.id}-option-${i}`;
      button.setAttribute('role', 'option');
      button.tabIndex = -1;
      // 保留用户命中的名/别名作为主显示文本，另一语言显示规范名
      const primary = c.text;
      const secondary = queryIsCjk ? c.en : c.zh;
      button.textContent = `${primary}（${secondary}）`;
      button.setAttribute('aria-label', button.textContent);
      button.setAttribute('aria-selected', String(i === this.selected));
      button.style.cssText = itemStyle(i === this.selected);
      const activate = (): void => {
        this.select(i);
        this.confirm();
      };
      // pointerdown 统一鼠标与触摸，消除移动端 hover 死区与点击延迟
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
    this.selected = (this.selected + delta + this.completions.length) % this.completions.length;
    this.items.forEach((it, i) => {
      it.style.cssText = itemStyle(i === this.selected);
      it.setAttribute('aria-selected', String(i === this.selected));
    });
    this.syncAria();
  }

  confirm(): Completion | undefined {
    if (!this.active) return undefined;
    const c = this.completions[this.selected];
    // 回填用户命中的名/别名，确保别名补全不会被规范名替换
    const name = c.text;
    this.hide();
    this.cb.onPick(this.prefix + name);
    return c;
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
    'display:block',
    'width:100%',
    'padding:6px 10px',
    'border:0',
    'font:inherit',
    'color:inherit',
    'text-align:left',
    'cursor:pointer',
    `border-radius:6px`,
    selected ? `background:${INK_HIGHLIGHT}` : 'background:transparent',
  ].join(';');
}
