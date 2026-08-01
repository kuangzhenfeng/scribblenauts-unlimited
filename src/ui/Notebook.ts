/**
 * 笔记本 UI —— Maxwell 的魔法笔记本，玩家输入入口。
 *
 * 纸片面板承载输入本身；自动补全与候选菜单仍由各自模块管理，
 * 这里只负责它们的层级、键盘/IME 协作和生成回调。
 */

import type { ParseCandidate, ParsedAdjective } from '@/core/lex/InputParser';
import { parse } from '@/core/lex/InputParser';
import { ImeController } from './ime';
import { Autocomplete } from './Autocomplete';
import { CandidateMenu } from './CandidateMenu';
import { ICON_BOOK, ICON_CLOSE, ICON_PLAY } from './icons';
import {
  INK,
  PAPER_BG,
  PAPER_BG_ALT,
  PAPER_SHADOW,
  TORN_EDGE,
  UI_FONT,
  paperInput,
  paperPanel,
} from './paperStyle';
import { log } from '@/util/log';
import { sfx } from '@/audio/SoundEffects';
import { t } from '@/core/i18n/I18n';

const NOTEBOOK_STYLE_ID = 'notebook-layout-style';

function ensureStyle(): void {
  if (document.getElementById(NOTEBOOK_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = NOTEBOOK_STYLE_ID;
  style.textContent = `
    #notebook {
      box-sizing:border-box;
      display:grid;
      gap:10px;
      border:2px solid rgba(43,43,43,.2);
      background:${PAPER_BG};
      color:${INK};
      font-family:${UI_FONT};
      box-shadow:${PAPER_SHADOW};
      ${TORN_EDGE};
    }
    #notebook .notebook__header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      min-height:44px;
    }
    #notebook .notebook__title {
      display:flex;
      align-items:center;
      min-width:0;
      color:${INK};
      font-size:14px;
      font-weight:900;
      letter-spacing:.08em;
    }
    #notebook .notebook__title svg { flex:none; width:21px; height:21px; }
    #notebook .notebook__title-label { margin-left:7px; }
    #notebook .notebook__close {
      display:grid;
      place-items:center;
      width:44px;
      height:44px;
      box-sizing:border-box;
      padding:0;
      border:2px solid rgba(43,43,43,.2);
      border-radius:10px;
      background:${PAPER_BG_ALT};
      color:${INK};
      cursor:pointer;
      transition:transform .16s ease,background .16s ease;
    }
    #notebook .notebook__close:hover { transform:translateY(-1px); background:#f6e7b4; }
    #notebook .notebook__input {
      min-height:48px;
      border-bottom-color:${INK};
      background:rgba(255,255,255,.24);
      border-radius:7px 7px 0 0;
    }
    #notebook .notebook__input:focus { box-shadow:0 2px 0 ${INK}; }
    #notebook .notebook__blot {
      position:absolute;
      top:-8px;
      right:24px;
      width:40px;
      height:40px;
      border-radius:50%;
      background:radial-gradient(circle,rgba(43,43,43,.15),transparent 70%);
      pointer-events:none;
    }
    #notebook[data-state="error"] .notebook__input { border-bottom-color:#9d3a27; }
    #notebook .notebook__footer {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      min-height:44px;
    }
    #notebook .notebook__hint {
      min-width:0;
      color:rgba(43,43,43,.64);
      font-size:11px;
      font-weight:700;
      line-height:1.25;
    }
    #notebook .notebook__submit {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      min-width:110px;
      min-height:44px;
      box-sizing:border-box;
      padding:8px 13px;
      border:2px solid #245c2c;
      border-radius:9px;
      background:#328c39;
      color:#f7ffe7;
      font:inherit;
      font-size:14px;
      font-weight:900;
      cursor:pointer;
      transition:transform .16s ease,filter .16s ease,opacity .16s ease;
    }
    #notebook .notebook__submit:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.06); }
    #notebook .notebook__submit:disabled { cursor:not-allowed; opacity:.46; }
    #notebook .notebook__submit svg { width:18px; height:18px; }
    #notebook button:focus-visible,
    #notebook input:focus-visible {
      outline:3px solid #2b2b2b;
      outline-offset:3px;
    }
    /* 候选菜单属于同一输入台，给触控条目保留足够的命中高度。 */
    #autocomplete button,
    #candidate-menu button {
      min-height:44px;
    }
    #autocomplete { bottom:calc(132px + env(safe-area-inset-bottom)) !important; }
    #candidate-menu { bottom:calc(142px + env(safe-area-inset-bottom)) !important; }
    @media (max-width:600px) {
      #notebook {
        width:min(520px,calc(100vw - 20px)) !important;
        bottom:max(18px,env(safe-area-inset-bottom)) !important;
        padding:13px 14px !important;
      }
      #notebook .notebook__hint { font-size:10px; }
      #notebook .notebook__submit { min-width:96px; }
    }
    @media (prefers-reduced-motion:reduce) {
      #notebook *, #notebook button { transition:none !important; }
      #notebook .notebook__close:hover,
      #notebook .notebook__submit:hover:not(:disabled) { transform:none; }
    }
  `;
  document.head.appendChild(style);
}

export interface NotebookCallbacks {
  /** 用户确定生成某个候选 */
  /** 返回 false 表示主线程拒绝生成，不记录到 Magic Backpack。 */
  onSpawn: (candidate: ParseCandidate, screenX: number, screenY: number) => void | boolean;
  /** 主线程确认生成成功后记录到 Magic Backpack；不接线时不影响既有玩法。 */
  onObjectSpawned?: (candidate: ParseCandidate) => void;
  /** 纯形容词模式：对选中实体施加形容词（可选，未接线则不启用该模式） */
  onApplyAdjectives?: (entityId: string, adjectives: ParsedAdjective[]) => void;
  /** 当前选中实体 id（供纯形容词模式取目标；动态取值） */
  selectedEntityId?: () => string | undefined;
}

export type NotebookMode = 'spawn' | 'adjective';

export class Notebook {
  private composing = false;
  /** 最近一次 IME 合成结束时间戳，用于过滤确认候选词后紧随的余波 Enter */
  private lastComposeEnd = 0;
  private readonly el: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly labelText: HTMLSpanElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly ime: ImeController;
  private readonly autocomplete: Autocomplete;
  private readonly menu: CandidateMenu;
  private mode: NotebookMode = 'spawn';

  constructor(private readonly cb: NotebookCallbacks) {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'notebook';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'false');
    this.el.style.cssText = paperPanel([
      'left:50%',
      'bottom:max(32px,env(safe-area-inset-bottom))',
      'transform:translateX(-50%) rotate(-0.4deg)',
      'width:min(560px,calc(92vw - 16px))',
      'padding:16px 20px',
      'z-index:50',
    ]);

    const label = document.createElement('div');
    label.id = 'notebook-label';
    label.className = 'notebook__title';
    label.innerHTML = `${ICON_BOOK}<span class="notebook__title-label"></span>`;
    this.labelText = label.querySelector('.notebook__title-label')!;
    this.labelText.textContent = t('notebook.label');
    this.el.setAttribute('aria-labelledby', label.id);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notebook__close';
    close.title = t('common.close');
    close.setAttribute('aria-label', t('common.close'));
    close.innerHTML = ICON_CLOSE;
    close.addEventListener('click', () => this.hide());

    const header = document.createElement('div');
    header.className = 'notebook__header';
    header.append(label, close);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'notebook__input';
    this.input.placeholder = t('notebook.placeholder');
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    // 提示浏览器/输入法使用英文输入模式：移动端弹出拉丁键盘，桌面端部分输入法据此
    // 在聚焦时切换到英文输入状态，减少用户手动切换输入法的频次（词条以英文为主）。
    this.input.lang = 'en';
    this.input.setAttribute('inputmode', 'latin');
    this.input.setAttribute('enterkeyhint', 'done');
    this.input.setAttribute('aria-label', t('notebook.placeholder'));
    this.input.style.cssText = paperInput(['min-height:48px']);

    const hint = document.createElement('span');
    hint.className = 'notebook__hint';
    hint.textContent = `${t('notebook.placeholder')} · ${t('actionPanel.useHint')}`;
    hint.id = 'notebook-hint';
    this.input.setAttribute('aria-describedby', hint.id);

    this.submitButton = document.createElement('button');
    this.submitButton.type = 'button';
    this.submitButton.className = 'notebook__submit';
    this.submitButton.innerHTML = `${ICON_PLAY}<span>${t('actionPanel.useHint')}</span>`;
    this.submitButton.addEventListener('click', () => this.submit());

    const footer = document.createElement('div');
    footer.className = 'notebook__footer';
    footer.append(hint, this.submitButton);

    // 墨迹斑（角落装饰）
    const blot = document.createElement('div');
    blot.className = 'notebook__blot';

    this.autocomplete = new Autocomplete({
      // 回填完整文本（已确认前缀 + 选中名），保留多词组合
      onPick: (fullText: string) => {
        this.input.value = fullText;
        this.input.focus();
        this.autocomplete.hide();
        this.updateSubmitState();
      },
      isAdjectiveMode: () => this.mode === 'adjective',
    });

    this.menu = new CandidateMenu({
      onSelect: (c: ParseCandidate) => this.spawn(c),
    });
    this.autocomplete.bindInput(this.input);
    this.menu.bindInput(this.input);

    this.ime = new ImeController({
      onComposeStart: () => {
        this.composing = true;
        this.autocomplete.hide();
      },
      onComposeUpdate: () => {
        // 合成期不解析
      },
      onComposeEnd: () => {
        this.composing = false;
        // 记录合成结束时间：紧随其后 300ms 内的 Enter 视为 IME 确认余波，忽略
        this.lastComposeEnd = performance.now();
        this.refreshAutocomplete();
      },
    });
    this.ime.attach(this.input);

    this.input.addEventListener('input', () => {
      this.el.dataset.state = '';
      this.input.removeAttribute('aria-invalid');
      this.updateSubmitState();
      if (this.composing) return;
      this.refreshAutocomplete();
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // IME 合成中：合成未结束，直接忽略（浏览器通常已 isComposing=true）
        if (this.composing) { e.preventDefault(); return; }
        // 紧随合成结束的 Enter 余波：keyCode 13 且距合成结束 < 300ms，视为确认候选词，忽略
        if (e.keyCode === 13 && this.lastComposeEnd > 0 && performance.now() - this.lastComposeEnd < 300) {
          e.preventDefault();
          this.lastComposeEnd = 0;
          return;
        }
        e.preventDefault();
        if (this.menu.isActive) {
          this.menu.confirm();
          return;
        }
        // 输入本身已经是完整词条时，优先提交精确结果。
        // 例如“枪”同时是“枪乌贼”的前缀，不能先被自动补全改写后再提交。
        const exactCandidates = parse(this.input.value.trim(), 'spawn') as ParseCandidate[];
        if (exactCandidates.length > 0) {
          this.submit();
          return;
        }
        if (this.autocomplete.isActive) this.autocomplete.confirm();
        this.submit();
        return;
      }
      if (e.key === 'ArrowDown') {
        if (this.menu.isActive) {
          e.preventDefault();
          this.menu.move(1);
        } else if (this.autocomplete.isActive) {
          e.preventDefault();
          this.autocomplete.move(1);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        if (this.menu.isActive) {
          e.preventDefault();
          this.menu.move(-1);
        } else if (this.autocomplete.isActive) {
          e.preventDefault();
          this.autocomplete.move(-1);
        }
        return;
      }
      if (e.key === 'Escape') {
        // 阻止 ESC 冒泡到 window，避免触发游戏全局 ESC 暂停（Notebook 已消费此键）
        e.stopPropagation();
        this.hide();
      }
    });

    this.el.append(header, this.input, footer, blot);
    // 默认隐藏，由外部 toggle() 控制显隐
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.updateSubmitState();
  }

  private refreshAutocomplete(): void {
    this.autocomplete.update(this.input.value);
  }

  private updateSubmitState(): void {
    this.submitButton.disabled = this.input.value.trim().length === 0;
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (!text) return;
    if (this.mode === 'adjective') {
      const targetId = this.cb.selectedEntityId?.();
      const adjs = parse(text, 'adjectives-only') as ParsedAdjective[];
      if (targetId && adjs.length > 0) {
        this.cb.onApplyAdjectives?.(targetId, adjs);
        log.info('notebook apply adjectives', { target: targetId, adj: adjs.map((a) => a.adjId) });
        this.hide();
      } else {
        this.markInvalid();
        log.warn('no adjective result', { text });
      }
      return;
    }
    // 纯形容词模式：对选中实体施加形容词
    if (this.cb.onApplyAdjectives && this.cb.selectedEntityId) {
      const targetId = this.cb.selectedEntityId();
      const adjs = parse(text, 'adjectives-only') as ParsedAdjective[];
      if (targetId && adjs.length > 0) {
        this.cb.onApplyAdjectives(targetId, adjs);
        log.info('notebook apply adjectives', { target: targetId, adj: adjs.map((a) => a.adjId) });
        this.input.value = '';
        this.autocomplete.hide();
        this.updateSubmitState();
        return;
      }
    }
    const candidates = parse(text, 'spawn') as ParseCandidate[];
    if (candidates.length === 0) {
      this.markInvalid();
      log.warn('no parse result', { text });
      return;
    }
    this.el.dataset.state = '';
    this.menu.show(candidates);
  }

  private markInvalid(): void {
    this.el.dataset.state = 'error';
    this.input.setAttribute('aria-invalid', 'true');
  }

  private spawn(candidate: ParseCandidate): void {
    const sx = window.innerWidth / 2;
    const sy = window.innerHeight / 2;
    log.info('notebook spawn', {
      noun: candidate.noun.entryId,
      adj: candidate.adjectives.map((a) => a.adjId),
    });
    const accepted = this.cb.onSpawn(candidate, sx, sy);
    if (accepted !== false) this.cb.onObjectSpawned?.(candidate);
    this.hide();
  }

  focus(): void {
    this.input.focus();
  }

  show(mode: NotebookMode = 'spawn'): void {
    this.mode = mode;
    this.el.dataset.mode = mode;
    this.el.dataset.state = '';
    this.labelText.textContent = mode === 'adjective' ? t('notebook.labelAdj') : t('notebook.label');
    this.input.placeholder = mode === 'adjective' ? t('notebook.placeholderAdj') : t('notebook.placeholder');
    this.input.setAttribute('aria-label', this.input.placeholder);
    this.el.style.display = 'grid';
    this.input.focus();
    this.updateSubmitState();
    sfx.play('ui');
  }

  hide(): void {
    this.mode = 'spawn';
    this.menu.cancel();
    this.autocomplete.hide();
    this.input.value = '';
    this.input.removeAttribute('aria-invalid');
    this.input.blur();
    this.el.style.display = 'none';
    this.el.dataset.mode = 'spawn';
    this.el.dataset.state = '';
    this.labelText.textContent = t('notebook.label');
    this.input.placeholder = t('notebook.placeholder');
    this.updateSubmitState();
  }

  toggle(): void {
    if (this.el.style.display === 'none') this.show();
    else this.hide();
  }
}
