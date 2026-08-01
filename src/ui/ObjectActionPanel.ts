/**
 * 对象操作面板 —— 选中实体后的身份、形容词与动作层。
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

const ACTION_PANEL_STYLE_ID = 'object-action-panel-style';

function ensureStyle(): void {
  if (document.getElementById(ACTION_PANEL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ACTION_PANEL_STYLE_ID;
  style.textContent = `
    #object-action-panel {
      color:${INK};
      font-family:${UI_FONT};
      background:${PAPER_BG};
      box-shadow:${PAPER_SHADOW};
      ${TORN_EDGE};
    }
    #object-action-panel .object-action__header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }
    #object-action-panel .object-action__identity {
      display:flex;
      align-items:center;
      gap:10px;
      min-width:0;
    }
    #object-action-panel .object-action__badge {
      display:grid;
      place-items:center;
      width:40px;
      height:40px;
      flex:none;
      box-sizing:border-box;
      border-radius:10px;
      background:#3d2200;
      color:#fff8dd;
    }
    #object-action-panel .object-action__badge svg { width:22px; height:22px; }
    #object-action-panel .object-action__copy { min-width:0; }
    #object-action-panel .object-action__name {
      overflow:hidden;
      color:${INK};
      font-size:21px;
      font-weight:900;
      line-height:1.12;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #object-action-panel .object-action__detail {
      margin-top:3px;
      overflow:hidden;
      color:rgba(43,43,43,.62);
      font-size:11px;
      font-weight:700;
      line-height:1.3;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #object-action-panel .object-action__close {
      display:grid;
      place-items:center;
      width:44px;
      height:44px;
      flex:none;
      box-sizing:border-box;
      padding:0;
      border:2px solid rgba(43,43,43,.2);
      border-radius:10px;
      background:${PAPER_BG_ALT};
      color:${INK};
      cursor:pointer;
      transition:transform .16s ease,background .16s ease;
    }
    #object-action-panel .object-action__close:hover { transform:translateY(-1px); background:#f6e7b4; }
    #object-action-panel .object-action__note {
      display:flex;
      align-items:center;
      gap:7px;
      min-height:34px;
      box-sizing:border-box;
      padding:7px 9px;
      margin-bottom:12px;
      border-radius:8px;
      background:${PAPER_BG_ALT};
      color:rgba(43,43,43,.72);
      font-size:11px;
      font-weight:700;
      line-height:1.35;
    }
    #object-action-panel .object-action__note::before {
      content:'•';
      color:#9f6a0a;
      font-size:18px;
      line-height:1;
    }
    #object-action-panel .object-action__section-heading {
      margin:0 0 6px;
      color:#805000;
      font-size:10px;
      font-weight:900;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    #object-action-panel .object-action__adjectives {
      display:flex;
      flex-wrap:wrap;
      gap:5px;
      margin-bottom:12px;
    }
    #object-action-panel .object-action__tag {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      box-sizing:border-box;
      padding:3px 9px;
      border:1px solid rgba(43,43,43,.2);
      border-radius:999px;
      background:${INK_HIGHLIGHT};
      color:${INK};
      font-size:12px;
      font-weight:800;
    }
    #object-action-panel .object-action__actions {
      display:flex;
      flex-direction:column;
      gap:7px;
    }
    #object-action-panel .object-action__action {
      display:flex;
      align-items:center;
      gap:10px;
      width:100%;
      min-height:52px;
      box-sizing:border-box;
      padding:7px 10px;
      border:2px solid #9f6a0a;
      border-radius:9px;
      color:#4f2f00;
      font-family:inherit;
      font-size:15px;
      font-weight:900;
      text-align:left;
      cursor:pointer;
      transition:transform .16s ease,filter .16s ease,background .16s ease;
    }
    #object-action-panel .object-action__action--primary {
      border-color:#245c2c;
      background:#328c39;
      color:#f7ffe7;
    }
    #object-action-panel .object-action__action:not(.object-action__action--primary) { background:#efb933; }
    #object-action-panel .object-action__action:hover { transform:translateX(3px); filter:brightness(1.04); }
    #object-action-panel .object-action__action-icon {
      display:grid;
      place-items:center;
      width:30px;
      height:30px;
      flex:none;
      border-radius:7px;
      background:rgba(255,248,221,.2);
    }
    #object-action-panel .object-action__action-icon svg { width:20px; height:20px; }
    #object-action-panel .object-action__action-copy { min-width:0; flex:1; }
    #object-action-panel .object-action__action-hint {
      display:block;
      margin-top:2px;
      overflow:hidden;
      font-size:10px;
      font-weight:700;
      line-height:1.25;
      opacity:.7;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #object-action-panel .object-action__action-arrow { font-size:19px; line-height:1; opacity:.58; }
    #object-action-panel button:focus-visible {
      outline:3px solid #2b2b2b;
      outline-offset:3px;
    }
    @media (max-width:600px) {
      #object-action-panel {
        left:12px !important;
        width:calc(100vw - 24px) !important;
        max-height:calc(100vh - 116px) !important;
      }
      #object-action-panel .object-action__action { min-height:50px; }
    }
    @media (prefers-reduced-motion:reduce) {
      #object-action-panel *, #object-action-panel button { transition:none !important; }
      #object-action-panel .object-action__close:hover,
      #object-action-panel .object-action__action:hover { transform:none; }
    }
  `;
  document.head.appendChild(style);
}

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
  private readonly adjectivesSection: HTMLDivElement;
  private readonly adjectivesEl: HTMLDivElement;
  private readonly actionsEl: HTMLDivElement;
  private current?: GameEntity;

  constructor(private readonly cb: ObjectActionPanelCallbacks) {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'object-action-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', t('actionPanel.aria'));
    this.el.style.cssText = panelStyle();
    this.el.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      this.hide();
    });

    const header = document.createElement('div');
    header.className = 'object-action__header';

    const identity = document.createElement('div');
    identity.className = 'object-action__identity';

    const badge = document.createElement('div');
    badge.className = 'object-action__badge';
    badge.innerHTML = ICON_OBJECTS;
    badge.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'object-action__copy';
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'object-action__name';
    this.detailEl = document.createElement('div');
    this.detailEl.className = 'object-action__detail';
    copy.append(this.nameEl, this.detailEl);
    identity.append(badge, copy);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'object-action__close';
    close.title = t('actionPanel.closeAria');
    close.setAttribute('aria-label', t('actionPanel.closeAria'));
    close.innerHTML = ICON_CLOSE;
    close.addEventListener('click', () => this.hide());
    header.append(identity, close);

    const note = document.createElement('div');
    note.className = 'object-action__note';
    note.textContent = t('actionPanel.hint');

    this.adjectivesSection = document.createElement('div');
    const adjectiveHeading = document.createElement('div');
    adjectiveHeading.className = 'object-action__section-heading';
    adjectiveHeading.textContent = t('actionPanel.addAdj');
    this.adjectivesEl = document.createElement('div');
    this.adjectivesEl.className = 'object-action__adjectives';
    this.adjectivesSection.append(adjectiveHeading, this.adjectivesEl);

    const actionsHeading = document.createElement('div');
    actionsHeading.className = 'object-action__section-heading';
    actionsHeading.textContent = t('actionPanel.hint');
    this.actionsEl = document.createElement('div');
    this.actionsEl.className = 'object-action__actions';

    this.el.append(header, note, this.adjectivesSection, actionsHeading, this.actionsEl);
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
    this.nameEl.textContent = entryName(entry) || entity.typeId;
    // 详情行：中文模式附注英文名，英文模式无附注
    const enName = entry?.en.name ? ` · ${entry.en.name}` : '';
    this.detailEl.textContent = `${t('actionPanel.detail')}${enName}`;
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
    this.adjectivesSection.style.display = 'none';
    this.el.style.display = 'none';
  }

  /** 渲染实体当前被施加的形容词为小标签 */
  private renderAdjectives(entity: GameEntity): void {
    this.adjectivesEl.innerHTML = '';
    const ids = entity.appliedAdjectives;
    if (!ids || ids.size === 0) {
      this.adjectivesSection.style.display = 'none';
      return;
    }
    let count = 0;
    for (const id of ids) {
      const adj = getAdjective(id);
      if (!adj) continue;
      const tag = document.createElement('span');
      tag.className = 'object-action__tag';
      tag.textContent = entryName(adj);
      this.adjectivesEl.appendChild(tag);
      count += 1;
    }
    this.adjectivesSection.style.display = count > 0 ? 'block' : 'none';
  }

  private createAction(spec: ActionSpec): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `object-action__action${spec.primary ? ' object-action__action--primary' : ''}`;
    button.setAttribute('aria-label', spec.label);
    button.innerHTML =
      `<span class="object-action__action-icon" aria-hidden="true">${spec.icon}</span>` +
      `<span class="object-action__action-copy">${spec.label}<small class="object-action__action-hint">${spec.hint}</small></span>` +
      '<span class="object-action__action-arrow" aria-hidden="true">›</span>';
    button.addEventListener('click', () => {
      spec.onClick();
      this.hide();
    });
    return button;
  }
}

function panelStyle(): string {
  return [
    'position:fixed',
    'top:max(84px,env(safe-area-inset-top))',
    'left:max(14px,env(safe-area-inset-left))',
    'width:min(326px,calc(100vw - 28px))',
    'box-sizing:border-box',
    'padding:14px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:14px',
    TORN_EDGE,
    'transform:rotate(-0.6deg)',
    'z-index:52',
    'max-height:calc(100vh - 108px)',
    'overflow:auto',
    'overscroll-behavior:contain',
  ].join(';');
}
