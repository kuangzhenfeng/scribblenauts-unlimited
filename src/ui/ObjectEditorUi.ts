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
    hint.textContent = '基础词条 + 中英文名称/别名 + 形容词 ID；颜色、尺寸、行为均可组合。';
    hint.style.cssText = `opacity:0.7;font-size:12px;margin-bottom:8px;color:${INK}`;

    this.baseInput = mkInput(t('editor.basePh'));
    this.adjInput = mkInput('形容词 ID 或中英文名称（空格分隔）');
    this.sizeInput = mkInput('尺寸形容词（如 big / 大，可选）');
    this.behaviorInput = mkInput('行为形容词（如 flying / 飞行，可选）');
    this.zhNameInput = mkInput('中文规范名，例如：飞天龙');
    this.enNameInput = mkInput('English canonical name, e.g. flying dragon');
    this.zhAliasesInput = mkInput('中文别名（逗号分隔，可选）');
    this.enAliasesInput = mkInput('English aliases (comma-separated, optional)');
    this.colorInput = mkInput('颜色（可选，如 #E03131）');
    this.saveBtn = document.createElement('button');
    this.saveBtn.textContent = t('editor.save');
    this.saveBtn.style.cssText = btnStyle();
    this.status = document.createElement('div');
    this.status.style.cssText = 'opacity:0.85;font-size:12px;margin-top:6px';

    this.saveBtn.addEventListener('click', () => void this.save());

    this.el.appendChild(title);
    this.el.appendChild(hint);
    this.el.appendChild(field('基础词条', this.baseInput));
    this.el.appendChild(field('形容词', this.adjInput));
    this.el.appendChild(field('尺寸', this.sizeInput));
    this.el.appendChild(field('行为', this.behaviorInput));
    this.el.appendChild(field('中文名称', this.zhNameInput));
    this.el.appendChild(field('英文名称', this.enNameInput));
    this.el.appendChild(field('中文别名', this.zhAliasesInput));
    this.el.appendChild(field('英文别名', this.enAliasesInput));
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
    this.el.style.display = 'block';
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
      return;
    }

    const appearanceColor = this.colorInput.value.trim();
    const result = await this.editor.save({
      ...(this.editingId ? { id: this.editingId } : {}),
      zh: { name: zhName, aliases: this.zhAliasesInput.value },
      en: { name: enName, aliases: this.enAliasesInput.value },
      baseText,
      adjectives,
      ...(appearanceColor ? { appearanceOverrides: { color: appearanceColor } } : {}),
    });
    if ('error' in result) {
      this.status.textContent = result.error;
      return;
    }
    this.status.textContent = t('editor.saved', { name: getLang() === 'zh' ? result.zh.name : result.en.name });
    log.info('object editor saved', { name: result.zh.name, id: result.id });
    this.editingId = result.id;
    this.baseInput.value = result.baseTypeId;
    this.adjInput.value = result.adjectives.join(' ');
    this.sizeInput.value = '';
    this.behaviorInput.value = '';
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
  label.textContent = labelText;
  label.style.cssText = `display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:700;color:${INK}`;
  label.appendChild(input);
  return label;
}

function panelStyle(): string {
  return [
    'position:fixed',
    `top:max(60px,env(safe-area-inset-top))`,
    `right:${SAFE_RIGHT}`,
    // 窄屏兜底：不超出视口，预留 32px 边距
    'width:min(340px,calc(100vw - 32px))',
    'max-height:calc(100vh - 76px)',
    'overflow:auto',
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
