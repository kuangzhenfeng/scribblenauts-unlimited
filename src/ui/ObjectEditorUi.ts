/**
 * 物体编辑器 UI —— 收集基础词条、双语名称/别名、形容词 ID 与外观参数。
 *
 * 文本解析和校验下沉到 ObjectEditor，UI 只负责表单状态与用户反馈。
 */

import { ObjectEditor } from '@/game/ObjectEditor';
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
  private readonly sizeInput: HTMLInputElement;
  private readonly behaviorInput: HTMLInputElement;
  private readonly attachmentsInput: HTMLInputElement;
  private readonly zhNameInput: HTMLInputElement;
  private readonly enNameInput: HTMLInputElement;
  private readonly zhAliasesInput: HTMLInputElement;
  private readonly enAliasesInput: HTMLInputElement;
  private readonly colorInput: HTMLInputElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private editingId?: string;

  constructor(private readonly editor: ObjectEditor) {
    this.el = document.createElement('div');
    this.el.id = 'object-editor';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'false');
    this.el.style.cssText = panelStyle();
    this.el.style.display = 'none';

    const style = document.createElement('style');
    style.textContent = `
      #object-editor { gap:14px !important; }
      #object-editor :focus-visible { outline:3px solid #b56a0b; outline-offset:3px; }
      #object-editor .editor-title { display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(43,43,43,0.18); }
      #object-editor .editor-title h2 { margin:0;font-size:22px;line-height:1.15; }
      #object-editor .editor-hint { color:#514b42;font-size:12px;line-height:1.5; }
      #object-editor .editor-section { margin-top:2px;padding-top:12px;border-top:1px solid rgba(43,43,43,0.14); }
      #object-editor .editor-section-title { margin:0 0 8px;color:#8a5300;font-size:12px;font-weight:900;letter-spacing:.03em; }
      #object-editor .editor-field { display:flex;flex-direction:column;gap:6px;min-height:62px;font-size:12px;font-weight:800;color:${INK}; }
      #object-editor .editor-field input { min-height:44px; }
      #object-editor .editor-save { min-height:44px; }
      #object-editor .editor-status { min-height:20px;font-size:12px;line-height:1.45;color:#3f7b3a; }
      #object-editor .editor-status[data-state="error"] { color:#8b2f18; }
      @media (prefers-reduced-motion:reduce) { #object-editor button { transition:none !important; } }
    `;
    this.el.appendChild(style);

    const title = document.createElement('div');
    title.className = 'editor-title';
    const titleText = document.createElement('h2');
    titleText.id = 'object-editor-title';
    titleText.textContent = t('editor.title');
    this.el.setAttribute('aria-labelledby', titleText.id);
    const close = document.createElement('button');
    close.type = 'button';
    close.title = t('editor.closeAria');
    close.setAttribute('aria-label', t('editor.closeAria'));
    close.innerHTML = ICON_CLOSE;
    close.style.cssText = `width:44px;height:44px;padding:10px;border:1px solid rgba(43,43,43,0.24);border-radius:8px;background:${PAPER_BG};color:${INK};cursor:pointer;flex:none`;
    close.addEventListener('click', () => this.hide());
    title.append(titleText, close);

    const hint = document.createElement('div');
    hint.className = 'editor-hint';
    hint.textContent = t('editor.hint');

    this.baseInput = mkInput(t('editor.basePh'));
    this.adjInput = mkInput(t('editor.adjPh'));
    this.sizeInput = mkInput('尺寸形容词（如 big / 大，可选）');
    this.behaviorInput = mkInput('行为形容词（如 flying / 飞行，可选）');
    this.attachmentsInput = mkInput(t('editor.attachmentsPh'));
    this.zhNameInput = mkInput(t('editor.namePh'));
    this.enNameInput = mkInput(t('editor.namePh'));
    this.zhAliasesInput = mkInput('中文别名（逗号分隔，可选）');
    this.enAliasesInput = mkInput('English aliases (comma-separated, optional)');
    this.colorInput = mkInput('颜色（可选，如 #E03131）');
    this.saveBtn = document.createElement('button');
    this.saveBtn.className = 'editor-save';
    this.saveBtn.textContent = t('editor.save');
    this.saveBtn.style.cssText = btnStyle();
    this.status = document.createElement('div');
    this.status.className = 'editor-status';
    this.status.setAttribute('aria-live', 'polite');

    this.saveBtn.addEventListener('click', () => void this.save());

    this.el.appendChild(title);
    this.el.appendChild(hint);
    this.el.appendChild(sectionTitle('实体组成'));
    this.el.appendChild(field('基础词条', this.baseInput));
    this.el.appendChild(field('形容词', this.adjInput));
    this.el.appendChild(field('尺寸', this.sizeInput));
    this.el.appendChild(field('行为', this.behaviorInput));
    this.el.appendChild(sectionTitle(t('editor.attachmentsTitle')));
    this.el.appendChild(field(t('editor.attachmentsLabel'), this.attachmentsInput));
    this.el.appendChild(sectionTitle('名称与识别'));
    this.el.appendChild(field('中文名称', this.zhNameInput));
    this.el.appendChild(field('英文名称', this.enNameInput));
    this.el.appendChild(field('中文别名', this.zhAliasesInput));
    this.el.appendChild(field('英文别名', this.enAliasesInput));
    this.el.appendChild(sectionTitle('外观'));
    this.el.appendChild(field('外观颜色', this.colorInput));
    this.el.appendChild(this.saveBtn);
    this.el.appendChild(this.status);
    document.body.appendChild(this.el);
  }

  toggle(): void {
    if (this.el.style.display === 'none') this.show();
    else this.hide();
  }

  show(): void {
    this.el.style.display = 'flex';
    this.baseInput.focus();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  /** 从当前选中实体带入基础词条与自定义物体配置，减少重复输入。 */
  openForEntity(subject: ObjectEditorSubject): void {
    const custom = getCustomDef(subject.typeId);
    this.editingId = custom?.id;
    const baseId = custom?.baseTypeId ?? subject.typeId;
    const base = getEntry(baseId);

    this.baseInput.value = base ? entryName(base) : '';
    this.adjInput.value = custom?.adjectives.join(' ') ?? '';
    this.sizeInput.value = '';
    this.behaviorInput.value = '';
    this.attachmentsInput.value = custom?.attachments?.map((attachment) => `${attachment.childTypeId}@${attachment.anchor[0]}:${attachment.anchor[1]}`).join(', ') ?? '';
    this.zhNameInput.value = custom?.zh.name ?? '';
    this.enNameInput.value = custom?.en.name ?? '';
    this.zhAliasesInput.value = custom?.zh.aliases?.join('，') ?? '';
    this.enAliasesInput.value = custom?.en.aliases?.join(', ') ?? '';
    const appearance = custom?.appearanceOverrides;
    const color = appearance?.color ?? appearance?.bodyColor;
    this.colorInput.value = typeof color === 'string' ? color : '';
    this.status.textContent = custom ? t('editor.broughtCustom') : t('editor.broughtBase');
    this.show();
  }

  private async save(): Promise<void> {
    const baseText = this.baseInput.value.trim();
    const adjectives = [this.adjInput.value, this.sizeInput.value, this.behaviorInput.value]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ');
    const zhName = this.zhNameInput.value.trim();
    const enName = this.enNameInput.value.trim();
    if (!baseText || !zhName || !enName) {
      this.status.textContent = '基础词条、中文名称、英文名称均为必填项';
      this.status.dataset.state = 'error';
      return;
    }

    const appearanceColor = this.colorInput.value.trim();
    let result: Awaited<ReturnType<ObjectEditor['save']>>;
    try {
      result = await this.editor.save({
        ...(this.editingId ? { id: this.editingId } : {}),
        zh: { name: zhName, aliases: this.zhAliasesInput.value },
        en: { name: enName, aliases: this.enAliasesInput.value },
        baseText,
        adjectives,
        ...(this.attachmentsInput.value.trim() ? { attachments: this.attachmentsInput.value } : {}),
        ...(appearanceColor ? { appearanceOverrides: { color: appearanceColor } } : {}),
      });
    } catch {
      this.status.textContent = getLang() === 'zh' ? '保存失败，请重试' : 'Could not save. Try again.';
      this.status.dataset.state = 'error';
      return;
    }
    if ('error' in result) {
      this.status.textContent = result.error;
      this.status.dataset.state = 'error';
      return;
    }
    this.status.textContent = t('editor.saved', { name: getLang() === 'zh' ? result.zh.name : result.en.name });
    this.status.dataset.state = 'success';
    log.info('object editor saved', { name: result.zh.name, id: result.id });
    this.editingId = result.id;
    this.baseInput.value = result.baseTypeId;
    this.adjInput.value = result.adjectives.join(' ');
    this.sizeInput.value = '';
    this.behaviorInput.value = '';
    this.attachmentsInput.value = result.attachments?.map((attachment) => `${attachment.childTypeId}@${attachment.anchor[0]}:${attachment.anchor[1]}`).join(', ') ?? '';
    this.zhNameInput.value = result.zh.name;
    this.enNameInput.value = result.en.name;
    this.zhAliasesInput.value = result.zh.aliases?.join('，') ?? '';
    this.enAliasesInput.value = result.en.aliases?.join(', ') ?? '';
    const color = result.appearanceOverrides?.color;
    this.colorInput.value = typeof color === 'string' ? color : '';
  }
}

function field(labelText: string, input: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'editor-field';
  label.textContent = labelText;
  label.appendChild(input);
  return label;
}

function sectionTitle(text: string): HTMLDivElement {
  const title = document.createElement('div');
  title.className = 'editor-section';
  const label = document.createElement('h3');
  label.className = 'editor-section-title';
  label.textContent = text;
  title.appendChild(label);
  return title;
}

function panelStyle(): string {
  return [
    'position:fixed',
    `top:max(16px,env(safe-area-inset-top))`,
    `right:${SAFE_RIGHT}`,
    `bottom:max(16px,env(safe-area-inset-bottom))`,
    // 窄屏兜底：不超出视口，预留 32px 边距
    'width:min(390px,calc(100vw - 32px))',
    'max-height:calc(100vh - 32px)',
    'overflow:auto',
    'padding:20px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:14px',
    TORN_EDGE,
    'z-index:50',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
  ].join(';');
}

function mkInput(placeholder: string): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'text';
  i.placeholder = placeholder;
  i.style.cssText = [
    'width:100%',
    'box-sizing:border-box',
    'min-height:44px',
    'padding:8px 10px',
    'font-size:14px',
    `color:${INK}`,
    'border:1px solid rgba(43,43,43,0.28)',
    'border-radius:8px',
    'outline:none',
    `font-family:${UI_FONT}`,
    'background:#efe6cf',
  ].join(';');
  return i;
}

function btnStyle(): string {
  return [
    'min-height:44px',
    'padding:10px 14px',
    'border:1px solid #3d2200',
    'border-radius:8px',
    'background:#3d2200',
    'color:#f7f1e3',
    'font-weight:700',
    'cursor:pointer',
    `font-family:${UI_FONT}`,
  ].join(';');
}
