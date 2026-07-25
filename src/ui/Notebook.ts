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
import { HAND_FONT, PAPER_BG, INK, paperPanel, paperInput, TORN_EDGE, PAPER_SHADOW } from './paperStyle';
import { ICON_BOOK } from './icons';
import { log } from '@/util/log';

export interface NotebookCallbacks {
  /** 用户确定生成某个候选 */
  onSpawn: (candidate: ParseCandidate, screenX: number, screenY: number) => void;
  /** 纯形容词模式：对选中实体施加形容词（可选，未接线则不启用该模式） */
  onApplyAdjectives?: (entityId: string, adjectives: ParsedAdjective[]) => void;
  /** 当前选中实体 id（供纯形容词模式取目标；动态取值） */
  selectedEntityId?: () => string | undefined;
}

export class Notebook {
  private composing = false;
  private readonly el: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly ime: ImeController;
  private readonly autocomplete: Autocomplete;
  private readonly menu: CandidateMenu;

  constructor(private readonly cb: NotebookCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'notebook';
    this.el.style.cssText = paperPanel([
      'left:50%',
      'bottom:32px',
      'transform:translateX(-50%) rotate(-0.4deg)',
      'width:min(560px,92vw)',
      'padding:18px 22px',
      'z-index:50',
    ]);

    const label = document.createElement('div');
    label.innerHTML = `${ICON_BOOK}<span style="margin-left:6px;vertical-align:middle;font-weight:700;letter-spacing:2px">笔记本</span>`;
    label.style.cssText = `opacity:0.9;margin-bottom:10px;color:${INK}`;

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = '输入一个词（中/英），回车生成…';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.style.cssText = paperInput();

    // 墨迹斑（角落装饰）
    const blot = document.createElement('div');
    blot.style.cssText =
      'position:absolute;top:-8px;right:24px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(43,43,43,0.15),transparent 70%);pointer-events:none';

    this.autocomplete = new Autocomplete({
      onPick: (c) => {
        this.input.value = c.zh;
        this.input.focus();
        this.autocomplete.hide();
      },
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
        if (this.composing) return;
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
        this.menu.cancel();
        this.autocomplete.hide();
      }
    });

    this.el.appendChild(label);
    this.el.appendChild(this.input);
    this.el.appendChild(blot);
    document.body.appendChild(this.el);
  }

  private refreshAutocomplete(): void {
    this.autocomplete.update(this.input.value);
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (!text) return;
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
    this.input.value = '';
    this.autocomplete.hide();
  }

  focus(): void {
    this.input.focus();
  }
}

// 保留导入供未来扩展（手写体/纸色常量）
void HAND_FONT;
void PAPER_BG;
void TORN_EDGE;
void PAPER_SHADOW;
