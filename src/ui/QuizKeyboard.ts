/**
 * 定制化问答键盘 —— 简易问答模式的下屏输入界面。
 *
 * 涂鸦纸片质感（复用 paperStyle 体系，圆角卡片替代撕边锯齿）：
 *  - 顶部墨水纸条显示当前输入缓冲 + 光标（缓冲即完整输入文本，含已确认形容词）
 *  - 中部实时候选词区（复用 completionQuery 的形容词+名词合并补全）
 *  - 下部 QWERTY 字母键 + 空格键 + 功能键（清空 / 退格 / 生成）
 *
 * 仅英文输入：自绘 QWERTY 字母键 + 空格键，自维护 buffer 字符串。
 * 桌面端额外支持物理键盘（keydown 拼接字母 / 空格 / 退格 / 回车提交）。
 *
 * 候选词复用 completionQuery.computeCompletions —— 同时支持名词与形容词补全，
 * 与主游戏 Notebook→Autocomplete 同一补全路径（DRY，不独立实现）。
 * 点形容词候选回填 buffer（继续输入名词），点名词候选上抛完整文本由外部
 * 复用 parse() 统一解析出形容词+名词构造 candidate（与 Notebook 同构）。
 *
 * 职责边界：只管输入与候选展示，不含解析与判定（点名词候选/生成经 onPick 上抬文本）。
 */

import { computeCompletions, type TaggedCompletion } from './completionQuery';
import { UI_FONT, PAPER_BG, PAPER_BG_ALT, INK, INK_HIGHLIGHT, PAPER_SHADOW, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT } from './paperStyle';
import { ICON_BACKSPACE, ICON_CLEAR, ICON_CHECK } from './icons';
import { t } from '@/core/i18n/I18n';
import { sfx } from '@/audio/SoundEffects';
import { log } from '@/util/log';

export interface QuizKeyboardCallbacks {
  /** 玩家点选名词候选或按生成，外部据完整文本复用 parse() 解析并判定 */
  onPick: (fullText: string) => void;
}

/** QWERTY 三行字母布局 */
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** 候选词最大显示数量 */
const MAX_CANDIDATES = 8;

/** 缓冲最大长度（含形容词+名词+空格） */
const MAX_BUFFER = 40;

export class QuizKeyboard {
  private readonly el: HTMLDivElement;
  private readonly displayEl: HTMLDivElement;
  private readonly candidateEl: HTMLDivElement;
  private readonly keysEl: HTMLDivElement;
  private buffer = '';
  private candidates: TaggedCompletion[] = [];
  private selectedCandidate = 0;
  /** 当前补全的已确认前缀（点选时 prefix + 选中名重建完整文本） */
  private completionPrefix = '';
  private readonly cb: QuizKeyboardCallbacks;
  /** 物理键盘 keydown 监听器引用，destroy 时移除 */
  private keydownListener: ((e: KeyboardEvent) => void) | undefined;

  constructor(cb: QuizKeyboardCallbacks) {
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.id = 'quiz-keyboard';
    this.el.style.cssText = [
      'position:fixed',
      `left:${SAFE_LEFT}`,
      `right:${SAFE_RIGHT}`,
      `bottom:${SAFE_BOTTOM}`,
      'z-index:60',
      'pointer-events:auto',
      `background:${PAPER_BG}`,
      `box-shadow:${PAPER_SHADOW}`,
      `color:${INK}`,
      `font-family:${UI_FONT}`,
      'border-radius:18px',
      'padding:10px 12px 14px',
      'box-sizing:border-box',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      // 默认宽度：竖屏占满，横屏/桌面居中限宽
      'width:calc(100vw - 28px)',
      'max-width:720px',
      'margin:0 auto',
    ].join(';');

    // 顶部：输入显示区（墨水纸条）
    this.displayEl = document.createElement('div');
    this.displayEl.style.cssText = [
      'min-height:34px',
      'padding:6px 12px',
      `border-bottom:2px solid ${INK}`,
      'font-size:18px',
      'font-weight:700',
      'letter-spacing:0.04em',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'display:flex',
      'align-items:center',
      'gap:2px',
    ].join(';');
    this.el.appendChild(this.displayEl);

    // 中部：候选词区
    this.candidateEl = document.createElement('div');
    this.candidateEl.style.cssText = [
      'min-height:40px',
      'max-height:64px',
      'display:flex',
      'gap:6px',
      'overflow-x:auto',
      'overflow-y:hidden',
      'padding:4px 2px',
      `background:${PAPER_BG_ALT}`,
      'border-radius:8px',
      'scrollbar-width:thin',
    ].join(';');
    this.el.appendChild(this.candidateEl);

    // 下部：键盘按键区
    this.keysEl = document.createElement('div');
    this.keysEl.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:6px',
    ].join(';');
    this._buildKeys();
    this.el.appendChild(this.keysEl);

    document.body.appendChild(this.el);
    this._injectCaretStyle();
    this._refreshDisplay();
    this._refreshCandidates();

    // 桌面端物理键盘支持
    this._attachPhysicalKeyboard();
  }

  /** 注入光标闪烁 keyframes（仅注一次） */
  private _injectCaretStyle(): void {
    if (document.getElementById('quiz-keyboard-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-keyboard-style';
    style.textContent = `
      @keyframes quizCaret { 0%,50% { opacity:1 } 51%,100% { opacity:0 } }
      #quiz-keyboard button:active { transform:scale(0.94); filter:brightness(1.1) }
      #quiz-keyboard button:hover { filter:brightness(1.06) }
    `;
    document.head.appendChild(style);
  }

  /** 显示键盘 */
  show(): void {
    this.el.style.display = 'flex';
  }

  /** 隐藏键盘 */
  hide(): void {
    this.el.style.display = 'none';
  }

  /** 销毁：移除 DOM 与物理键盘监听 */
  destroy(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = undefined;
    }
    this.el.remove();
  }

  /** 清空输入缓冲 */
  clear(): void {
    this.buffer = '';
    this._refreshDisplay();
    this._refreshCandidates();
  }

  /**
   * 测量键盘实际占据的下屏空间高度（含 `bottom` 安全区间距），供 QuizScene 划分上屏视口用。
   *
   * 键盘为 `position:fixed; bottom:SAFE_BOTTOM`，占据的屏幕空间从视口底部延伸到元素顶部；
   * 若只返回 offsetHeight 会漏掉 bottom 间距，导致上屏视口底部延伸到键盘背后被遮挡。
   * 这里直接用 getBoundingClientRect 测量元素顶部 y，反推总占据高度，准确且无 CSS 解析。
   */
  getHeight(): number {
    const rect = this.el.getBoundingClientRect();
    return Math.max(0, window.innerHeight - rect.top);
  }

  // ---- 内部：按键构建 ----

  private _buildKeys(): void {
    // 字母三行
    for (const row of ROWS) {
      const rowEl = document.createElement('div');
      rowEl.style.cssText = ['display:flex', 'gap:6px', 'justify-content:center'].join(';');
      for (const ch of row) {
        rowEl.appendChild(this._makeLetterKey(ch));
      }
      this.keysEl.appendChild(rowEl);
    }
    // 空格行
    const spaceRow = document.createElement('div');
    spaceRow.style.cssText = ['display:flex', 'gap:6px', 'justify-content:center'].join(';');
    spaceRow.appendChild(this._makeSpaceKey());
    this.keysEl.appendChild(spaceRow);
    // 功能行：清空 / 退格 / 生成
    const fnRow = document.createElement('div');
    fnRow.style.cssText = ['display:flex', 'gap:8px', 'justify-content:center', 'margin-top:4px'].join(';');
    fnRow.appendChild(this._makeClearKey());
    fnRow.appendChild(this._makeBackspaceKey());
    fnRow.appendChild(this._makeSubmitKey());
    this.keysEl.appendChild(fnRow);
  }

  private _makeLetterKey(ch: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = ch;
    btn.setAttribute('aria-label', ch);
    btn.style.cssText = this._letterKeyStyle();
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._typeChar(ch);
    });
    return btn;
  }

  private _makeSpaceKey(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t('quiz.space');
    btn.setAttribute('aria-label', t('quiz.space'));
    btn.style.cssText = this._spaceKeyStyle();
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._typeSpace();
    });
    return btn;
  }

  private _makeClearKey(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `${ICON_CLEAR}<span style="margin-left:4px;font-weight:900;font-size:13px">${t('quiz.clear')}</span>`;
    btn.setAttribute('aria-label', t('quiz.clear'));
    btn.style.cssText = this._fnKeyStyle('#e74c3c', '#5a1a04', 'flex:1.2');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.clear();
      sfx.play('ui');
    });
    return btn;
  }

  private _makeBackspaceKey(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = ICON_BACKSPACE;
    btn.setAttribute('aria-label', 'backspace');
    btn.style.cssText = this._fnKeyStyle('#f7f1e3', '#2b2b2b', 'flex:1.2');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._backspace();
    });
    return btn;
  }

  private _makeSubmitKey(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `${ICON_CHECK}<span style="margin-left:4px;font-weight:900;font-size:13px">${t('quiz.submit')}</span>`;
    btn.setAttribute('aria-label', t('quiz.submit'));
    btn.style.cssText = this._fnKeyStyle('#efad19', '#3d2200', 'flex:1.6');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._submit();
    });
    return btn;
  }

  // ---- 内部：输入逻辑 ----

  private _typeChar(ch: string): void {
    if (this.buffer.length >= MAX_BUFFER) return;
    this.buffer += ch.toLowerCase();
    sfx.play('ui');
    this._refreshDisplay();
    this._refreshCandidates();
  }

  private _typeSpace(): void {
    if (this.buffer.length >= MAX_BUFFER) return;
    // 空格分隔形容词+名词
    this.buffer += ' ';
    sfx.play('ui');
    this._refreshDisplay();
    this._refreshCandidates();
  }

  private _backspace(): void {
    if (!this.buffer) return;
    this.buffer = this.buffer.slice(0, -1);
    sfx.play('ui');
    this._refreshDisplay();
    this._refreshCandidates();
  }

  /** 生成按钮 / Enter：提交当前完整缓冲，外部 parse 解析 */
  private _submit(): void {
    const text = this.buffer.trim();
    if (!text) return;
    log.info('quiz keyboard submit', { text });
    this.cb.onPick(text);
    // 生成后清空缓冲，准备下一题输入
    this.buffer = '';
    this._refreshDisplay();
    this._refreshCandidates();
  }

  /** 点选候选：形容词回填继续输入，名词直接提交生成 */
  private _pickCandidate(index: number): void {
    const c = this.candidates[index];
    if (!c) return;
    const fullText = this.completionPrefix + c.en;
    log.info('quiz keyboard pick', { id: c.id, kind: c.kind, zh: c.zh, en: c.en, fullText });
    if (c.kind === 'adj') {
      // 形容词候选：回填到 buffer 并补一个空格，继续输入名词
      this.buffer = fullText + ' ';
      this._refreshDisplay();
      this._refreshCandidates();
      return;
    }
    // 名词候选：提交完整文本，外部 parse 解析出形容词+名词
    this.cb.onPick(fullText);
    this.buffer = '';
    this._refreshDisplay();
    this._refreshCandidates();
  }

  // ---- 内部：显示与候选刷新 ----

  private _refreshDisplay(): void {
    const text = this.buffer || t('quiz.inputPh');
    const color = this.buffer ? INK : 'rgba(43,43,43,0.4)';
    // 光标用闪烁竖线模拟
    const cursor = this.buffer ? '<span style="display:inline-block;width:2px;height:1.1em;background:#2b2b2b;margin-left:2px;animation:quizCaret 1s steps(1) infinite"></span>' : '';
    this.displayEl.innerHTML = `<span style="color:${color}">${this._escape(text)}</span>${cursor}`;
  }

  private _refreshCandidates(): void {
    const { completions, prefix } = computeCompletions(this.buffer, 'spawn', MAX_CANDIDATES);
    this.candidates = completions;
    this.completionPrefix = prefix;
    this.selectedCandidate = 0;
    this._renderCandidates();
  }

  private _renderCandidates(): void {
    if (this.candidates.length === 0) {
      this.candidateEl.innerHTML = `<span style="color:rgba(43,43,43,0.4);padding:8px 12px;font-size:14px">${t('quiz.noCandidate')}</span>`;
      return;
    }
    this.candidateEl.innerHTML = '';
    this.candidates.forEach((c, i) => {
      // 英文输入 → 英文名为主、中文为辅（与 Autocomplete 同构：按补全前缀脚本选主显）
      const primary = c.en;
      const secondary = c.zh;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.innerHTML = `<span style="font-weight:900">${this._escape(primary)}</span><span style="margin-left:4px;font-size:12px;opacity:0.6">${this._escape(secondary)}</span>`;
      chip.style.cssText = [
        'flex:none',
        'padding:6px 12px',
        `background:${i === this.selectedCandidate ? INK_HIGHLIGHT : 'transparent'}`,
        `border:2px solid ${i === this.selectedCandidate ? INK : 'rgba(43,43,43,0.2)'}`,
        'border-radius:8px',
        `color:${INK}`,
        `font-family:${UI_FONT}`,
        'font-size:14px',
        'cursor:pointer',
        'white-space:nowrap',
        'pointer-events:auto',
      ].join(';');
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._pickCandidate(i);
      });
      this.candidateEl.appendChild(chip);
    });
  }

  // ---- 内部：样式与工具 ----

  private _letterKeyStyle(): string {
    return [
      'flex:1',
      'min-width:32px',
      'height:42px',
      `background:${PAPER_BG_ALT}`,
      `border:2px solid rgba(43,43,43,0.3)`,
      'border-radius:8px',
      `color:${INK}`,
      `font-family:${UI_FONT}`,
      'font-size:18px',
      'font-weight:900',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 0.08s ease,filter 0.08s ease',
      'touch-action:manipulation',
    ].join(';');
  }

  private _spaceKeyStyle(): string {
    return [
      'flex:6',
      'min-width:120px',
      'height:42px',
      `background:${PAPER_BG_ALT}`,
      `border:2px solid rgba(43,43,43,0.3)`,
      'border-radius:8px',
      `color:${INK}`,
      `font-family:${UI_FONT}`,
      'font-size:14px',
      'font-weight:700',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 0.08s ease,filter 0.08s ease',
      'touch-action:manipulation',
    ].join(';');
  }

  private _fnKeyStyle(glow: string, border: string, flex = 'flex:1'): string {
    return [
      flex,
      'min-width:48px',
      'height:42px',
      `background:${glow}`,
      `border:2px solid ${border}`,
      'border-radius:8px',
      `color:${border === '#2b2b2b' ? INK : '#fff8dd'}`,
      `font-family:${UI_FONT}`,
      'font-size:14px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 0.08s ease,filter 0.08s ease',
      'touch-action:manipulation',
    ].join(';');
  }

  private _escape(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]!));
  }

  // ---- 物理键盘支持（桌面端） ----

  private _attachPhysicalKeyboard(): void {
    this.keydownListener = (e: KeyboardEvent) => {
      // 忽略修饰键组合
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key;
      if (/^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        this._typeChar(key);
      } else if (key === 'Backspace') {
        e.preventDefault();
        this._backspace();
      } else if (key === 'Enter') {
        e.preventDefault();
        this._submit();
      } else if (key === ' ') {
        e.preventDefault();
        this._typeSpace();
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }
}
