/**
 * 物体编辑器 UI —— 纸色撕边面板（基础词条 + 形容词输入 → 命名保存）。
 */

import { ObjectEditor } from '@/game/ObjectEditor';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { log } from '@/util/log';
import { HAND_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

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
    title.textContent = '物体编辑器';
    title.style.cssText = `font-weight:700;margin-bottom:8px;letter-spacing:1px;color:${INK}`;

    const hint = document.createElement('div');
    hint.textContent = '基础词条（中/英） | 形容词（空格分隔） | 新名称';
    hint.style.cssText = 'opacity:0.7;font-size:12px;margin-bottom:8px;color:${INK}';

    this.baseInput = mkInput('例: dog');
    this.adjInput = mkInput('例: flying purple');
    this.nameInput = mkInput('例: 飞天龙');
    this.saveBtn = document.createElement('button');
    this.saveBtn.textContent = '保存';
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
    this.el.style.display = this.el.style.display === 'none' ? 'block' : 'none';
  }

  private async save(): Promise<void> {
    const baseText = this.baseInput.value.trim();
    const adjText = this.adjInput.value.trim();
    const name = this.nameInput.value.trim();
    if (!baseText || !name) {
      this.status.textContent = '基础词条与新名称必填';
      return;
    }
    const baseEntry = getEntry(baseText) ?? getEntry(baseText.toLowerCase());
    if (!baseEntry) {
      this.status.textContent = `未找到基础词条：${baseText}`;
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
      this.status.textContent = `已保存：${name}（输入该名即可生成）`;
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
    'top:60px',
    'right:16px',
    'width:300px',
    'padding:16px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${HAND_FONT}`,
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
    `font-family:${HAND_FONT}`,
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
    `font-family:${HAND_FONT}`,
  ].join(';');
}
