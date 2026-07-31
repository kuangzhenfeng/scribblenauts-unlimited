/**
 * 对象操作面板 —— 选中实体后展开，承接参考图中的四个即时操作入口。
 *
 * 面板只负责展示当前实体与转发用户意图；生成、施加形容词和保存自定义物体
 * 分别复用 Notebook、AdjectiveSystem 与 ObjectEditor 的既有逻辑。
 */

import type { GameEntity } from '@/game/Entity';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { getAdjective } from '@/core/data/dictionary/adjectives';
import { t, entryName } from '@/core/i18n/I18n';
import {
  ICON_BOOK,
  ICON_CLOSE,
  ICON_EDIT,
  ICON_OBJECTS,
  ICON_PLUS,
  ICON_SPARKLES,
} from './icons';
import { UI_FONT, INK, INK_HIGHLIGHT, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, TORN_EDGE } from './paperStyle';

export interface ObjectActionPanelCallbacks {
  onUseNotebook: () => void;
  onCreateObject: () => void;
  onAddAdjective: () => void;
  onEditObject: (entity: GameEntity) => void;
}

interface ActionSpec {
  label: string;
  hint: string;
  icon: string;
  primary?: boolean;
  onClick: () => void;
}

export class ObjectActionPanel {
  private readonly el: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly detailEl: HTMLDivElement;
  private readonly adjectivesEl: HTMLDivElement;
  private readonly actionsEl: HTMLDivElement;
  private current?: GameEntity;

  constructor(private readonly cb: ObjectActionPanelCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'object-action-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', t('actionPanel.aria'));
    this.el.style.cssText = panelStyle();

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px';

    const identity = document.createElement('div');
    identity.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0';

    const badge = document.createElement('div');
    badge.innerHTML = ICON_OBJECTS;
    badge.style.cssText = `width:34px;height:34px;display:grid;place-items:center;flex:none;color:#fff8dd;background:#3d2200;border-radius:8px`;

    const copy = document.createElement('div');
    copy.style.cssText = 'min-width:0';
    this.nameEl = document.createElement('div');
    this.nameEl.style.cssText = `font-size:20px;font-weight:900;line-height:1.15;color:${INK};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    this.detailEl = document.createElement('div');
    this.detailEl.style.cssText = 'font-size:12px;line-height:1.4;opacity:0.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    copy.append(this.nameEl, this.detailEl);
    identity.append(badge, copy);

    const close = document.createElement('button');
    close.type = 'button';
    close.title = t('actionPanel.closeAria');
    close.setAttribute('aria-label', t('actionPanel.closeAria'));
    close.innerHTML = ICON_CLOSE;
    close.style.cssText = closeStyle();
    close.addEventListener('click', () => this.hide());
    header.append(identity, close);

    const note = document.createElement('div');
    note.textContent = t('actionPanel.hint');
    note.style.cssText = `padding:7px 10px;margin-bottom:9px;background:${PAPER_BG_ALT};border-radius:6px;color:rgba(43,43,43,0.7);font-size:12px`;

    this.adjectivesEl = document.createElement('div');
    this.adjectivesEl.style.cssText = `display:flex;flex-wrap:wrap;gap:4px;margin-bottom:9px;min-height:0`;

    this.actionsEl = document.createElement('div');
    this.actionsEl.style.cssText = 'display:flex;flex-direction:column;gap:7px';

    this.el.append(header, note, this.adjectivesEl, this.actionsEl);
    document.body.appendChild(this.el);
    this.hide();
  }

  show(entity: GameEntity): void {
    if (entity.isPlayer || entity.dead) {
      this.hide();
      return;
    }
    this.current = entity;
    const entry = getEntry(entity.typeId);
    this.nameEl.textContent = entryName(entry) ?? entity.typeId;
    // 详情行：中文模式附注英文名，英文模式无附注
    const enName = entry?.en.name ? ` · ${entry.en.name}` : '';
    this.detailEl.textContent = `${t('actionPanel.detail')}${enName}`;
    // 形容词标签：渲染实体被施加的形容词（颜色/大小/状态/行为/材质）
    this.renderAdjectives(entity);
    this.actionsEl.innerHTML = '';

    const specs: ActionSpec[] = [
      { label: t('actionPanel.use'), hint: t('actionPanel.useHint'), icon: ICON_BOOK, primary: true, onClick: this.cb.onUseNotebook },
      { label: t('actionPanel.create'), hint: t('actionPanel.createHint'), icon: ICON_PLUS, onClick: this.cb.onCreateObject },
      { label: t('actionPanel.addAdj'), hint: t('actionPanel.addAdjHint'), icon: ICON_SPARKLES, onClick: this.cb.onAddAdjective },
      { label: t('actionPanel.edit'), hint: t('actionPanel.editHint'), icon: ICON_EDIT, onClick: () => this.current && this.cb.onEditObject(this.current) },
    ];
    for (const spec of specs) this.actionsEl.appendChild(this.createAction(spec));

    this.el.style.display = 'block';
  }

  hide(): void {
    this.current = undefined;
    this.adjectivesEl.innerHTML = '';
    this.el.style.display = 'none';
  }

  /** 渲染实体当前被施加的形容词为小标签 */
  private renderAdjectives(entity: GameEntity): void {
    this.adjectivesEl.innerHTML = '';
    const ids = entity.appliedAdjectives;
    if (!ids || ids.size === 0) return;
    for (const id of ids) {
      const adj = getAdjective(id);
      if (!adj) continue;
      const tag = document.createElement('span');
      tag.textContent = entryName(adj);
      tag.style.cssText = [
        'padding:2px 8px',
        'border-radius:999px',
        'font-size:11px',
        'font-weight:700',
        `background:${INK_HIGHLIGHT}`,
        `color:${INK}`,
      ].join(';');
      this.adjectivesEl.appendChild(tag);
    }
  }

  private createAction(spec: ActionSpec): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', spec.label);
    button.style.cssText = actionStyle(spec.primary ?? false);
    button.innerHTML =
      `<span style="width:25px;height:25px;display:grid;place-items:center;flex:none">${spec.icon}</span>` +
      `<span style="min-width:0;flex:1;text-align:left">${spec.label}<small style="display:block;margin-top:2px;font-size:11px;font-weight:600;opacity:0.62">${spec.hint}</small></span>` +
      '<span aria-hidden="true" style="font-size:20px;line-height:1;opacity:0.48">›</span>';
    button.addEventListener('click', () => {
      spec.onClick();
      this.hide();
    });
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(3px)';
      button.style.background = spec.primary ? '#3f9a43' : '#f3c44a';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(0)';
      button.style.background = spec.primary ? '#328c39' : '#efb933';
    });
    button.addEventListener('focus', () => {
      button.style.outline = '3px solid #2b2b2b';
      button.style.outlineOffset = '2px';
    });
    button.addEventListener('blur', () => {
      button.style.outline = 'none';
    });
    return button;
  }
}

function panelStyle(): string {
  return [
    'position:fixed',
    `top:max(78px,env(safe-area-inset-top))`,
    `left:max(18px,env(safe-area-inset-left))`,
    'width:min(300px,calc(100vw - 32px))',
    'box-sizing:border-box',
    'padding:13px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:14px',
    TORN_EDGE,
    'transform:rotate(-0.6deg)',
    'z-index:52',
    'max-height:calc(100vh - 98px)',
    'overflow:auto',
  ].join(';');
}

function actionStyle(primary: boolean): string {
  return [
    'width:100%',
    'display:flex',
    'align-items:center',
    'gap:9px',
    'padding:8px 10px',
    'border:2px solid #9f6a0a',
    'border-radius:7px',
    `background:${primary ? '#328c39' : '#efb933'}`,
    `color:${primary ? '#f7ffe7' : '#4f2f00'}`,
    'font-family:inherit',
    'font-size:15px',
    'font-weight:900',
    'text-align:left',
    'cursor:pointer',
    'transition:transform 0.16s ease,background 0.16s ease',
  ].join(';');
}

function closeStyle(): string {
  return [
    'width:30px',
    'height:30px',
    'display:grid',
    'place-items:center',
    'padding:0',
    'border:0',
    'border-radius:50%',
    'background:transparent',
    `color:${INK}`,
    'cursor:pointer',
    'flex:none',
  ].join(';');
}
