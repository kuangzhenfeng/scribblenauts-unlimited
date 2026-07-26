/**
 * 物体编辑器 UI —— 纸色撕边面板（基础词条 + 形容词输入 → 命名保存）。
 */

import { ObjectEditor } from '@/game/ObjectEditor';
import { getAdjective } from '@/core/data/dictionary/adjectives';
import { getCustomDef, getEntry } from '@/core/data/dictionary/Dictionary';
import { log } from '@/util/log';
import { t, entryName, getLang } from '@/core/i18n/I18n';
import { ICON_CLOSE } from './icons';
import { UI_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW, SAFE_RIGHT } from './paperStyle';

export interface ObjectEditorSubject {
  typeId: string;
}

export class ObjectEditorUi {
  private readonly el: HTMLDivElement;
  private readonly baseInput: HTMLInputElement;
  private readonly adjInput: HTMLInputElement;
  private readonly nameInput: HTMLInputElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly status: HTMLDivElement;

  constructor(private readonly editor: ObjectEditor) {
    this.el = document.createElement('div');
    this.el.id = 'object-editor';
    this.el.style.cssText = panelStyle();
    this.el.style.display = 'none';

    const title = document.createElement('div');
    title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px';
    const titleText = document.createElement('span');
    titleText.textContent = t('editor.title');
    titleText.style.cssText = `font-weight:700;letter-spacing:1px;color:${INK}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.title = t('editor.closeAria');
    close.setAttribute('aria-label', t('editor.closeAria'));
    close.innerHTML = ICON_CLOSE;
    close.style.cssText = `width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:${INK};cursor:pointer`;
    close.addEventListener('click', () => this.hide());
    title.append(titleText, close);

    const hint = document.createElement('div');
    hint.textContent = t('editor.hint');
    hint.style.cssText = `opacity:0.7;font-size:12px;margin-bottom:8px;color:${INK}`;

    this.baseInput = mkInput(t('editor.basePh'));
    this.adjInput = mkInput(t('editor.adjPh'));
    this.nameInput = mkInput(t('editor.namePh'));
    this.saveBtn = document.createElement('button');
    this.saveBtn.textContent = t('editor.save');
    this.saveBtn.style.cssText = btnStyle();
    this.status = document.createElement('div');
    this.status.style.cssText = 'opacity:0.85;font-size:12px;margin-top:6px';

    this.saveBtn.addEventListener('click', () => this.save());

    this.el.appendChild(title);
    this.el.appendChild(hint);
    this.el.appendChild(this.baseInput);
    this.el.appendChild(this.adjInput);
    this.el.appendChild(this.nameInput);
    this.el.appendChild(this.saveBtn);
    this.el.appendChild(this.status);
    document.body.appendChild(this.el);
  }

  toggle(): void {
    if (this.el.style.display === 'none') this.show();
    else this.hide();
  }

  show(): void {
    this.el.style.display = 'block';
    this.baseInput.focus();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  /** 从当前选中实体带入基础词条与自定义物体配置，减少重复输入。 */
  openForEntity(subject: ObjectEditorSubject): void {
    const custom = getCustomDef(subject.typeId);
    const baseId = custom?.baseTypeId ?? subject.typeId;
    const base = getEntry(baseId);
    // 基础词条与自定义名按当前语言回填；形容词用各词条当前语言名串接
    this.baseInput.value = base ? entryName(base) : '';
    this.adjInput.value = custom
      ? custom.adjectives.map((id) => entryName(getAdjective(id)) ?? id).join(' ')
      : '';
    this.nameInput.value = custom ? (getLang() === 'zh' ? custom.zh.name : custom.en.name) : '';
    this.status.textContent = custom ? t('editor.broughtCustom') : t('editor.broughtBase');
    this.show();
  }

  private async save(): Promise<void> {
    const baseText = this.baseInput.value.trim();
    const adjText = this.adjInput.value.trim();
    const name = this.nameInput.value.trim();
    if (!baseText || !name) {
      this.status.textContent = t('editor.requireFields');
      return;
    }
    const baseEntry = getEntry(baseText) ?? getEntry(baseText.toLowerCase());
    if (!baseEntry) {
      this.status.textContent = t('editor.notFoundBase', { name: baseText });
      return;
    }
    const result = await this.editor.save({
      zh: { name },
      en: { name: name.toLowerCase() },
      baseTypeId: baseEntry.id,
      adjectives: adjText ? adjText.split(/\s+/) : [],
    });
    if ('error' in result) {
      this.status.textContent = result.error;
    } else {
      this.status.textContent = t('editor.saved', { name });
      log.info('object editor saved', { name });
      this.baseInput.value = '';
      this.adjInput.value = '';
      this.nameInput.value = '';
    }
  }
}

function panelStyle(): string {
  return [
    'position:fixed',
    `top:max(60px,env(safe-area-inset-top))`,
    `right:${SAFE_RIGHT}`,
    // 窄屏兜底：不超出视口，预留 32px 边距
    'width:min(300px,calc(100vw - 32px))',
    'padding:16px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:14px',
    TORN_EDGE,
    'transform:rotate(0.5deg)',
    'z-index:50',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
  ].join(';');
}

function mkInput(placeholder: string): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'text';
  i.placeholder = placeholder;
  i.style.cssText = [
    'width:100%',
    'box-sizing:border-box',
    'padding:8px 10px',
    'font-size:14px',
    `color:${INK}`,
    'background:transparent',
    'border:none',
    `border-bottom:2px solid ${INK}`,
    'outline:none',
    `font-family:${UI_FONT}`,
  ].join(';');
  return i;
}

function btnStyle(): string {
  return [
    'padding:10px 14px',
    'border:none',
    'border-radius:6px',
    `background:${INK}`,
    'color:#f7f1e3',
    'font-weight:700',
    'cursor:pointer',
    `font-family:${UI_FONT}`,
  ].join(';');
}
