/**
 * 笔记本 UI —— Maxwell 的魔法笔记本，玩家输入入口。
 *
 * 涂鸦纸片质感：纸色撕边面板 + 手写字体 + 墨迹斑。
 * 接入 IME 合成态、自动补全、候选菜单、双语分词解析。
 * 单候选直接生成；多候选弹菜单选择。
 */

import type { ParseCandidate, ParsedAdjective } from '@/core/lex/InputParser';
import { parse } from '@/core/lex/InputParser';
import { ImeController } from './ime';
import { Autocomplete } from './Autocomplete';
import { CandidateMenu } from './CandidateMenu';
import { UI_FONT, PAPER_BG, INK, paperPanel, paperInput, TORN_EDGE, PAPER_SHADOW } from './paperStyle';
import { ICON_BOOK } from './icons';
import { log } from '@/util/log';
import { sfx } from '@/audio/SoundEffects';
import { t } from '@/core/i18n/I18n';

export interface NotebookCallbacks {
  /** 用户确定生成某个候选 */
  onSpawn: (candidate: ParseCandidate, screenX: number, screenY: number) => void;
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
  private readonly ime: ImeController;
  private readonly autocomplete: Autocomplete;
  private readonly menu: CandidateMenu;
  private mode: NotebookMode = 'spawn';

  constructor(private readonly cb: NotebookCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'notebook';
    this.el.style.cssText = paperPanel([
      'left:50%',
      `bottom:max(32px,env(safe-area-inset-bottom))`,
      'transform:translateX(-50%) rotate(-0.4deg)',
      'width:min(560px,calc(92vw - 16px))',
      'padding:18px 22px',
      'z-index:50',
    ]);

    const label = document.createElement('div');
    label.innerHTML = `${ICON_BOOK}<span style="margin-left:6px;vertical-align:middle;font-weight:700;letter-spacing:2px"></span>`;
    this.labelText = label.querySelector('span')!;
    this.labelText.textContent = t('notebook.label');
    label.style.cssText = `opacity:0.9;margin-bottom:10px;color:${INK}`;

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = t('notebook.placeholder');
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    // 提示浏览器/输入法使用英文输入模式：移动端弹出拉丁键盘，桌面端部分输入法据此
    // 在聚焦时切换到英文输入状态，减少用户手动切换输入法的频次（词条以英文为主）。
    this.input.lang = 'en';
    this.input.setAttribute('inputmode', 'latin');
    this.input.setAttribute('enterkeyhint', 'done');
    this.input.style.cssText = paperInput();

    // 墨迹斑（角落装饰）
    const blot = document.createElement('div');
    blot.style.cssText =
      'position:absolute;top:-8px;right:24px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(43,43,43,0.15),transparent 70%);pointer-events:none';

    this.autocomplete = new Autocomplete({
      // 回填完整文本（已确认前缀 + 选中名），保留多词组合
      onPick: (fullText: string) => {
        this.input.value = fullText;
        this.input.focus();
        this.autocomplete.hide();
      },
      isAdjectiveMode: () => this.mode === 'adjective',
    });

    this.menu = new CandidateMenu({
      onSelect: (c: ParseCandidate) => this.spawn(c),
    });

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
        if (this.autocomplete.isActive) {
          this.autocomplete.confirm();
        }
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

    this.el.appendChild(label);
    this.el.appendChild(this.input);
    this.el.appendChild(blot);
    // 默认隐藏，由外部 toggle() 控制显隐
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  private refreshAutocomplete(): void {
    this.autocomplete.update(this.input.value);
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
        return;
      }
    }
    const candidates = parse(text, 'spawn') as ParseCandidate[];
    if (candidates.length === 0) {
      log.warn('no parse result', { text });
      return;
    }
    this.menu.show(candidates);
  }

  private spawn(candidate: ParseCandidate): void {
    const sx = window.innerWidth / 2;
    const sy = window.innerHeight / 2;
    log.info('notebook spawn', {
      noun: candidate.noun.entryId,
      adj: candidate.adjectives.map((a) => a.adjId),
    });
    this.cb.onSpawn(candidate, sx, sy);
    this.hide();
  }

  focus(): void {
    this.input.focus();
  }

  show(mode: NotebookMode = 'spawn'): void {
    this.mode = mode;
    this.labelText.textContent = mode === 'adjective' ? t('notebook.labelAdj') : t('notebook.label');
    this.input.placeholder = mode === 'adjective' ? t('notebook.placeholderAdj') : t('notebook.placeholder');
    this.el.style.display = '';
    this.input.focus();
    sfx.play('ui');
  }

  hide(): void {
    this.mode = 'spawn';
    this.menu.cancel();
    this.autocomplete.hide();
    this.input.value = '';
    this.input.blur();
    this.el.style.display = 'none';
    this.labelText.textContent = t('notebook.label');
    this.input.placeholder = t('notebook.placeholder');
  }

  toggle(): void {
    if (this.el.style.display === 'none') this.show();
    else this.hide();
  }
}

// 保留导入供未来扩展（无衬线字体/纸色常量）
void UI_FONT;
void PAPER_BG;
void TORN_EDGE;
void PAPER_SHADOW;
