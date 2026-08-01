/**
 * 定制化问答键盘 —— 漫画召唤台的下屏输入界面。
 *
 * 浅青/米白纸面背景 + 米白实体键帽 + 亮黄生成键。
 * 逻辑全部保留：自维护 buffer 字符串 + 复用 completionQuery 候选补全 +
 * 桌面端物理键盘支持 + 形容词回填/名词提交。
 *
 * 结构：
 *  - 顶部输入行（白底+细底边框+光标）
 *  - 中部实时候选词区（复用 completionQuery 的形容词+名词合并补全）
 *  - 下部 QWERTY 字母键 + 空格键 + 功能键（清空 / 退格 / 提交）
 *
 * 职责边界：只管输入与候选展示，不含解析与判定（点名词候选/生成经 onPick 上抬文本）。
 */

import { computeCompletions, type TaggedCompletion } from './completionQuery';
import {
  UI_FONT,
  SAFE_BOTTOM,
  SAFE_LEFT,
  SAFE_RIGHT,
  QUIZ_CARD_BRIGHT,
  QUIZ_PANEL,
  QUIZ_INK,
  QUIZ_INK_SOFT,
  QUIZ_BORDER,
  QUIZ_RADIUS_SM,
  QUIZ_RADIUS_MD,
  QUIZ_ACCENT,
  QUIZ_ACCENT_SOFT,
  QUIZ_YELLOW,
  QUIZ_KB_BG,
  QUIZ_KB_KEY,
  QUIZ_KB_KEY_SPECIAL,
  QUIZ_KB_KEY_TEXT,
  QUIZ_KB_RADIUS,
  QUIZ_KB_GAP,
  QUIZ_KB_KEY_HEIGHT,
  QUIZ_SHADOW_LIFT,
} from './quizStyle';
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
  private readonly appZoneEl: HTMLDivElement;
  private readonly kbZoneEl: HTMLDivElement;
  private readonly displayEl: HTMLDivElement;
  private readonly candidateEl: HTMLDivElement;
  private readonly keysEl: HTMLDivElement;
  private spaceButton!: HTMLButtonElement;
  private clearButton!: HTMLButtonElement;
  private submitButton!: HTMLButtonElement;
  private buffer = '';
  private candidates: TaggedCompletion[] = [];
  private selectedCandidate = 0;
  /** 当前补全的已确认前缀（点选时 prefix + 选中名重建完整文本） */
  private completionPrefix = '';
  private readonly cb: QuizKeyboardCallbacks;
  /** 物理键盘 keydown 监听器引用，destroy 时移除 */
  private keydownListener: ((e: KeyboardEvent) => void) | undefined;
  /** 退格长按连删 timer（delay 首字延迟 + repeat 连删间隔），destroy/松手时清理 */
  private backspaceDelay: number | undefined;
  private backspaceRepeat: number | undefined;

  constructor(cb: QuizKeyboardCallbacks) {
    this.cb = cb;

    // 定位壳同时承载独立下屏背景；键帽保持实色以确保文字对比度。
    this.el = document.createElement('div');
    this.el.id = 'quiz-keyboard';
    this.el.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',
      'z-index:60',
      'pointer-events:auto',
      `color:${QUIZ_INK}`,
      `font-family:${UI_FONT}`,
      'box-sizing:border-box',
      'display:flex',
      'flex-direction:column',
      'gap:7px',
      // 默认宽度：竖屏占满，横屏/桌面居中限宽
      'width:100vw',
      'max-width:none',
      'margin:0',
      'align-items:center',
      `padding:8px ${SAFE_RIGHT} ${SAFE_BOTTOM} ${SAFE_LEFT}`,
      `background:${QUIZ_KB_BG} url("assets/quiz/quiz-lower-bg.png") center/cover no-repeat`,
      `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_RADIUS_MD} ${QUIZ_RADIUS_MD} 0 0`,
      'box-shadow:0 -4px 0 rgba(23,37,53,0.12)',
    ].join(';');

    // 上区：输入显示 + 候选词，以纸面分区承载，不叠加悬浮卡片。
    this.appZoneEl = document.createElement('div');
    this.appZoneEl.style.cssText = [
      `background:${QUIZ_PANEL}`,
      `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_RADIUS_SM}`,
      'padding:8px 10px 7px',
      'box-sizing:border-box',
      'display:flex',
      'flex-direction:column',
      'gap:7px',
      'width:min(720px,100%)',
      `box-shadow:${QUIZ_SHADOW_LIFT}`,
    ].join(';');
    this.el.appendChild(this.appZoneEl);

    // 顶部：输入显示区（iOS 文本框：灰底圆角无边框）
    this.displayEl = document.createElement('div');
    this.displayEl.style.cssText = [
      'min-height:36px',
      'padding:8px 12px',
      `background:${QUIZ_CARD_BRIGHT}`,
      `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_RADIUS_SM}`,
      'font-size:17px',
      'font-weight:600',
      'letter-spacing:0.02em',
      // 保留形容词与名词之间的空格；仍保持单行并由 overflow/text-overflow 截断。
      'white-space:pre',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'display:flex',
      'align-items:center',
      'gap:2px',
      'box-sizing:border-box',
    ].join(';');
    this.displayEl.setAttribute('role', 'textbox');
    this.displayEl.setAttribute('aria-live', 'polite');
    this.displayEl.setAttribute('aria-label', t('quiz.inputPh'));
    this.appZoneEl.appendChild(this.displayEl);

    // 中部：候选词区
    this.candidateEl = document.createElement('div');
    this.candidateEl.style.cssText = [
      'min-height:40px',
      'max-height:56px',
      'display:flex',
      'gap:6px',
      'overflow-x:auto',
      'overflow-y:hidden',
      'padding:4px 2px',
      'scrollbar-width:thin',
    ].join(';');
    this.candidateEl.setAttribute('role', 'listbox');
    this.candidateEl.setAttribute('aria-label', t('quiz.inputPh'));
    this.appZoneEl.appendChild(this.candidateEl);

    // 下区：透明键盘区，让浅青纸纹贯穿输入台。
    this.kbZoneEl = document.createElement('div');
    this.kbZoneEl.style.cssText = [
      'background:transparent',
      'padding:2px 0 0',
      'box-sizing:border-box',
      'display:flex',
      'flex-direction:column',
      `gap:${QUIZ_KB_GAP}`,
      'width:min(720px,100%)',
      'min-width:0',
    ].join(';');
    this.el.appendChild(this.kbZoneEl);

    // 按键区
    this.keysEl = document.createElement('div');
    this.keysEl.style.cssText = [
      'display:flex',
      'flex-direction:column',
      `gap:${QUIZ_KB_GAP}`,
    ].join(';');
    this._buildKeys();
    this.kbZoneEl.appendChild(this.keysEl);

    document.body.appendChild(this.el);
    this._injectKeyStyle();
    this._refreshDisplay();
    this._refreshCandidates();

    // 桌面端物理键盘支持
    this._attachPhysicalKeyboard();
  }

  /** 注入光标闪烁与按键反馈 keyframes（仅注一次） */
  private _injectKeyStyle(): void {
    if (document.getElementById('quiz-keyboard-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-keyboard-style';
    style.textContent = `
      @keyframes quizCaret { 0%,50% { opacity:1 } 51%,100% { opacity:0 } }
      #quiz-keyboard button:hover:not(:disabled) { filter:brightness(.97); }
      #quiz-keyboard button:focus-visible { outline:3px solid ${QUIZ_YELLOW}; outline-offset:2px; }
      #quiz-keyboard button:active:not(:disabled) { transform:translateY(2px); box-shadow:none !important; }
      #quiz-keyboard button:disabled { opacity:.5; cursor:not-allowed; filter:none; box-shadow:none !important; }
      #quiz-keyboard .quiz-candidate-chip:hover:not(:disabled) { border-color:${QUIZ_ACCENT} !important; }
      #quiz-keyboard .quiz-candidate-chip:active:not(:disabled) { transform:translateY(2px); }
      @media (max-height:720px) {
        #quiz-keyboard { padding-top:6px !important; gap:5px !important; }
        #quiz-keyboard > div:first-child { padding-top:6px !important; padding-bottom:6px !important; gap:5px !important; }
        #quiz-keyboard > div:first-child > div:nth-child(2) { min-height:44px !important; }
      }
      @media (max-width:390px) {
        #quiz-keyboard .quiz-clear-label { display:none; }
      }
      @media (orientation:landscape) and (max-height:520px) {
        #quiz-keyboard { border-radius:0 !important; }
        #quiz-keyboard > div:first-child { width:min(720px,100%); }
      }
      @media (orientation:portrait) {
        #quiz-keyboard { top:auto !important; height:auto !important; max-height:none !important; min-height:0 !important; overflow-y:visible !important; }
      }
      @media (prefers-reduced-motion:reduce) {
        #quiz-keyboard *, #quiz-keyboard *::before, #quiz-keyboard *::after { animation:none !important; transition:none !important; }
      }
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
    this._stopBackspaceRepeat();
    this.el.remove();
  }

  /** 清空输入缓冲 */
  clear(): void {
    this.buffer = '';
    this._refreshDisplay();
    this._refreshCandidates();
  }

  /** 切换界面语言时刷新按键、占位提示与候选提示，保留当前输入缓冲。 */
  refreshLocale(): void {
    this.spaceButton.textContent = t('quiz.space');
    this.spaceButton.setAttribute('aria-label', t('quiz.space'));
    this._setClearButtonLabel(this.clearButton);
    this._setSubmitButtonLabel(this.submitButton);
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

  /** 横屏高度不足时，输入台从委托条下方开始并在自身内部滚动。 */
  setLandscapeTop(top: number | undefined): void {
    if (top === undefined) {
      this.el.style.top = '';
      this.el.style.height = '';
      this.el.style.maxHeight = '';
      this.el.style.minHeight = '';
      this.el.style.overflowY = 'visible';
      return;
    }
    this.el.style.top = `${top}px`;
    this.el.style.height = `calc(100vh - ${top}px)`;
    this.el.style.maxHeight = `calc(100vh - ${top}px)`;
    this.el.style.minHeight = '0';
    this.el.style.overflowY = 'auto';
  }

  // ---- 内部：按键构建 ----

  /** 按键行容器（flex + gap + 居中） */
  private _makeRow(): HTMLDivElement {
    const rowEl = document.createElement('div');
    rowEl.style.cssText = ['display:flex', `gap:${QUIZ_KB_GAP}`, 'justify-content:center'].join(';');
    return rowEl;
  }

  private _buildKeys(): void {
    // 行1-2：字母
    for (const row of ROWS.slice(0, 2)) {
      const rowEl = this._makeRow();
      for (const ch of row) rowEl.appendChild(this._makeLetterKey(ch));
      this.keysEl.appendChild(rowEl);
    }
    // 行3：清空 + Z X C V B N M + 退格（清空占 iOS shift 左槽，退格占右槽）
    const row3 = this._makeRow();
    this.clearButton = this._makeClearKey();
    row3.appendChild(this.clearButton);
    for (const ch of ROWS[2]!) row3.appendChild(this._makeLetterKey(ch));
    row3.appendChild(this._makeBackspaceKey());
    this.keysEl.appendChild(row3);
    // 行4：空格 + 生成（生成占 iOS return 位，用品牌绿）
    const row4 = this._makeRow();
    this.spaceButton = this._makeSpaceKey();
    this.submitButton = this._makeSubmitKey();
    row4.appendChild(this.spaceButton);
    row4.appendChild(this.submitButton);
    this.keysEl.appendChild(row4);
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
      this._showKeyPopup(btn, ch);
    });
    return btn;
  }

  /** iOS 风按键弹起预览：pointerdown 时在键上方显示大字母气泡，pointerup/leave 移除 */
  private _showKeyPopup(btn: HTMLButtonElement, ch: string): void {
    const popup = document.createElement('div');
    popup.textContent = ch;
    popup.style.cssText = [
      'position:absolute',
      'bottom:calc(100% + 6px)',
      'left:50%',
      'transform:translateX(-50%)',
      `background:${QUIZ_KB_KEY}`,
      `color:${QUIZ_KB_KEY_TEXT}`,
      `border-radius:${QUIZ_KB_RADIUS}`,
      'padding:6px 14px',
      'font-size:30px',
      'font-weight:600',
      `font-family:${UI_FONT}`,
      'box-shadow:0 2px 10px rgba(0,0,0,0.2)',
      'pointer-events:none',
      'z-index:100',
    ].join(';');
    btn.appendChild(popup);
    const remove = (): void => {
      popup.remove();
      btn.removeEventListener('pointerup', remove);
      btn.removeEventListener('pointerleave', remove);
    };
    btn.addEventListener('pointerup', remove);
    btn.addEventListener('pointerleave', remove);
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
    this._setClearButtonLabel(btn);
    btn.setAttribute('aria-label', t('quiz.clear'));
    btn.style.cssText = this._fnKeyStyle(QUIZ_KB_KEY_SPECIAL, QUIZ_KB_KEY_TEXT, 'flex:1.35');
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
    btn.style.cssText = this._fnKeyStyle(QUIZ_KB_KEY_SPECIAL, QUIZ_KB_KEY_TEXT, 'flex:1.35');
    // iOS 长按连删：pointerdown 立即删 1 字 → 400ms 后每 80ms 重复
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._backspace();
      this._stopBackspaceRepeat();
      this.backspaceDelay = window.setTimeout(() => {
        this.backspaceRepeat = window.setInterval(() => this._backspace(), 80);
      }, 400);
    });
    btn.addEventListener('pointerup', () => this._stopBackspaceRepeat());
    btn.addEventListener('pointerleave', () => this._stopBackspaceRepeat());
    return btn;
  }

  /** 停止退格长按连删 timer（松手/离开/销毁时调用） */
  private _stopBackspaceRepeat(): void {
    if (this.backspaceDelay !== undefined) {
      window.clearTimeout(this.backspaceDelay);
      this.backspaceDelay = undefined;
    }
    if (this.backspaceRepeat !== undefined) {
      window.clearInterval(this.backspaceRepeat);
      this.backspaceRepeat = undefined;
    }
  }

  private _makeSubmitKey(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    this._setSubmitButtonLabel(btn);
    btn.setAttribute('aria-label', t('quiz.submit'));
    btn.style.cssText = this._fnKeyStyle(QUIZ_YELLOW, QUIZ_KB_KEY_TEXT, 'flex:2');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._submit();
    });
    return btn;
  }

  private _setClearButtonLabel(button: HTMLButtonElement): void {
    button.innerHTML = `${ICON_CLEAR}<span class="quiz-clear-label" style="margin-left:4px;font-weight:700;font-size:12px">${this._escape(t('quiz.clear'))}</span>`;
    button.setAttribute('aria-label', t('quiz.clear'));
  }

  private _setSubmitButtonLabel(button: HTMLButtonElement): void {
    button.innerHTML = `${ICON_CHECK}<span style="margin-left:4px;font-weight:600;font-size:13px">${this._escape(t('quiz.submit'))}</span>`;
    button.setAttribute('aria-label', t('quiz.submit'));
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
    const fullText = this.completionPrefix + c.text;
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
    const color = this.buffer ? QUIZ_INK : QUIZ_INK_SOFT;
    // 光标用闪烁竖线模拟（靛蓝光标，替代原深灰）
    const cursor = this.buffer ? `<span style="display:inline-block;width:2px;height:1.1em;background:${QUIZ_ACCENT};margin-left:2px;animation:quizCaret 1s steps(1) infinite"></span>` : '';
    this.displayEl.innerHTML = `<span style="color:${color}">${this._escape(text)}</span>${cursor}`;
    this.displayEl.setAttribute('aria-label', this.buffer || t('quiz.inputPh'));
    this.clearButton.disabled = !this.buffer;
    this.submitButton.disabled = !this.buffer.trim();
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
      this.candidateEl.innerHTML = `<span role="status" style="color:${QUIZ_INK_SOFT};padding:8px 12px;font-size:14px">${t('quiz.noCandidate')}</span>`;
      return;
    }
    this.candidateEl.innerHTML = '';
    this.candidates.forEach((c, i) => {
      // 保留用户命中的英文名/别名，中文显示规范译名
      const primary = c.text;
      const secondary = c.zh;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quiz-candidate-chip';
      chip.setAttribute('role', 'option');
      chip.innerHTML = `<span style="font-weight:800">${this._escape(primary)}</span><span style="margin-left:4px;font-size:12px;opacity:0.55">${this._escape(secondary)}</span>`;
      const selected = i === this.selectedCandidate;
      chip.setAttribute('aria-selected', String(selected));
      chip.style.cssText = [
        'flex:none',
        'min-height:44px',
        'padding:6px 12px',
        `background:${selected ? QUIZ_ACCENT_SOFT : QUIZ_CARD_BRIGHT}`,
        `border:2px solid ${selected ? QUIZ_ACCENT : QUIZ_BORDER}`,
        `border-radius:${QUIZ_KB_RADIUS}`,
        `color:${QUIZ_INK}`,
        `font-family:${UI_FONT}`,
        'font-size:14px',
        'cursor:pointer',
        'white-space:nowrap',
        'pointer-events:auto',
        'transition:filter 160ms ease-out, transform 120ms ease-out',
        'touch-action:manipulation',
        'box-sizing:border-box',
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
      'min-width:0',
      `height:${QUIZ_KB_KEY_HEIGHT}`,
      `background:${QUIZ_CARD_BRIGHT}`,
      `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_KB_RADIUS}`,
      `color:${QUIZ_KB_KEY_TEXT}`,
      `font-family:${UI_FONT}`,
      'font-size:19px',
      'font-weight:700',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 120ms ease-out,filter 160ms ease-out',
      'touch-action:manipulation',
      `box-shadow:${QUIZ_SHADOW_LIFT}`,
      'position:relative',
    ].join(';');
  }

  private _spaceKeyStyle(): string {
    return [
      'flex:5',
      'min-width:0',
      `height:${QUIZ_KB_KEY_HEIGHT}`,
      `background:${QUIZ_CARD_BRIGHT}`,
      `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_KB_RADIUS}`,
      `color:${QUIZ_KB_KEY_TEXT}`,
      `font-family:${UI_FONT}`,
      'font-size:15px',
      'font-weight:700',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 120ms ease-out,filter 160ms ease-out',
      'touch-action:manipulation',
      `box-shadow:${QUIZ_SHADOW_LIFT}`,
    ].join(';');
  }

  private _fnKeyStyle(bg: string, fg: string, flex = 'flex:1'): string {
    return [
      flex,
      'min-width:38px',
      `height:${QUIZ_KB_KEY_HEIGHT}`,
      `background:${bg}`,
      `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_KB_RADIUS}`,
      `color:${fg}`,
      `font-family:${UI_FONT}`,
      'font-size:15px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 120ms ease-out,filter 160ms ease-out',
      'touch-action:manipulation',
      `box-shadow:${QUIZ_SHADOW_LIFT}`,
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
