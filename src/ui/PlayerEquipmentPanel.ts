/**
 * Maxwell 装备与骑乘面板 —— 只读展示 PlayerController 的三类附着关系。
 *
 * 面板不直接接触 Attachment，也不把“解除手持”复用为投掷；所有关系变化
 * 通过 PlayerController 的显式意图 API 完成，保证 UI 与物理状态只有一个事实来源。
 */

import type { GameEntity } from '@/game/Entity';
import type { PlayerEquipmentSlot, PlayerEquipmentSnapshot } from '@/game/PlayerController';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { entryName, t } from '@/core/i18n/I18n';
import {
  ICON_CLOSE,
  ICON_BOOK,
  ICON_HAND,
  ICON_MAXWELL,
  ICON_RIDE,
  ICON_SPARKLES,
  ICON_WING,
} from './icons';
import { INK, INK_HIGHLIGHT, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_LEFT, SAFE_TOP, TORN_EDGE, UI_FONT } from './paperStyle';

const PLAYER_EQUIPMENT_PANEL_STYLE_ID = 'player-equipment-panel-style';

export interface PlayerEquipmentPanelCallbacks {
  getEquipment: () => PlayerEquipmentSnapshot;
  onUnequip: (slot: PlayerEquipmentSlot) => void;
  onUnequipAll: () => void;
  onUseNotebook: () => void;
  onAddAdjective: () => void;
}

interface SlotSpec {
  slot: PlayerEquipmentSlot;
  label: string;
  empty: string;
  icon: string;
  entity?: GameEntity;
}

function ensureStyle(): void {
  if (document.getElementById(PLAYER_EQUIPMENT_PANEL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PLAYER_EQUIPMENT_PANEL_STYLE_ID;
  style.textContent = `
    #player-equipment-panel {
      color:${INK};
      font-family:${UI_FONT};
      background:${PAPER_BG};
      box-shadow:${PAPER_SHADOW};
      ${TORN_EDGE};
    }
    #player-equipment-panel .player-equipment__header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }
    #player-equipment-panel .player-equipment__identity {
      display:flex;
      align-items:center;
      gap:10px;
      min-width:0;
    }
    #player-equipment-panel .player-equipment__portrait {
      display:grid;
      place-items:center;
      width:42px;
      height:42px;
      flex:none;
      box-sizing:border-box;
      border:2px solid #6a3d08;
      border-radius:50%;
      background:${PAPER_BG_ALT};
      color:#c92c24;
    }
    #player-equipment-panel .player-equipment__portrait svg { width:28px; height:28px; }
    #player-equipment-panel .player-equipment__copy { min-width:0; }
    #player-equipment-panel .player-equipment__title {
      overflow:hidden;
      font-size:20px;
      font-weight:950;
      line-height:1.12;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #player-equipment-panel .player-equipment__subtitle {
      margin-top:3px;
      overflow:hidden;
      color:rgba(43,43,43,.64);
      font-size:11px;
      font-weight:750;
      line-height:1.3;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #player-equipment-panel .player-equipment__close {
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
    #player-equipment-panel .player-equipment__close:hover { transform:translateY(-1px); background:#f6e7b4; }
    #player-equipment-panel .player-equipment__summary {
      min-height:34px;
      box-sizing:border-box;
      padding:8px 10px;
      margin-bottom:13px;
      border-left:4px solid #d5911e;
      border-radius:7px;
      background:${PAPER_BG_ALT};
      color:#5c3b08;
      font-size:12px;
      font-weight:800;
      line-height:1.35;
    }
    #player-equipment-panel .player-equipment__heading {
      margin:0 0 7px;
      color:#805000;
      font-size:10px;
      font-weight:950;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    #player-equipment-panel .player-equipment__slots {
      display:flex;
      flex-direction:column;
      gap:7px;
    }
    #player-equipment-panel .player-equipment__slot {
      display:flex;
      align-items:center;
      gap:9px;
      min-height:64px;
      box-sizing:border-box;
      padding:7px 8px;
      border:1px solid rgba(43,43,43,.18);
      border-radius:10px;
      background:rgba(255,255,255,.28);
    }
    #player-equipment-panel .player-equipment__slot[data-filled="true"] {
      border-color:#9f6a0a;
      background:${INK_HIGHLIGHT};
    }
    #player-equipment-panel .player-equipment__slot-icon {
      display:grid;
      place-items:center;
      width:38px;
      height:38px;
      flex:none;
      border-radius:9px;
      background:#ead7a9;
      color:#5c3b08;
    }
    #player-equipment-panel .player-equipment__slot-icon svg { width:21px; height:21px; }
    #player-equipment-panel .player-equipment__slot-copy { min-width:0; flex:1; }
    #player-equipment-panel .player-equipment__slot-label {
      color:#805000;
      font-size:10px;
      font-weight:950;
      letter-spacing:.08em;
    }
    #player-equipment-panel .player-equipment__slot-name {
      overflow:hidden;
      margin-top:1px;
      font-size:15px;
      font-weight:900;
      line-height:1.2;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #player-equipment-panel .player-equipment__slot-status {
      display:block;
      margin-top:2px;
      overflow:hidden;
      color:rgba(43,43,43,.64);
      font-size:10px;
      font-weight:750;
      line-height:1.2;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #player-equipment-panel .player-equipment__remove,
    #player-equipment-panel .player-equipment__action {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      min-height:44px;
      box-sizing:border-box;
      padding:7px 10px;
      border:2px solid #9f6a0a;
      border-radius:8px;
      background:#efb933;
      color:#4f2f00;
      font:inherit;
      font-size:12px;
      font-weight:900;
      cursor:pointer;
      transition:transform .16s ease,filter .16s ease,background .16s ease;
    }
    #player-equipment-panel .player-equipment__remove { min-width:62px; flex:none; }
    #player-equipment-panel .player-equipment__remove svg { width:15px; height:15px; }
    #player-equipment-panel .player-equipment__remove:hover,
    #player-equipment-panel .player-equipment__action:hover { transform:translateY(-1px); filter:brightness(1.04); }
    #player-equipment-panel .player-equipment__remove:disabled {
      border-color:rgba(43,43,43,.14);
      background:rgba(43,43,43,.06);
      color:rgba(43,43,43,.42);
      cursor:default;
      transform:none;
      filter:none;
    }
    #player-equipment-panel .player-equipment__footer {
      display:flex;
      flex-wrap:wrap;
      gap:7px;
      margin-top:12px;
    }
    #player-equipment-panel .player-equipment__action--primary {
      border-color:#245c2c;
      background:#328c39;
      color:#f7ffe7;
    }
    #player-equipment-panel .player-equipment__action--wide { flex:1 1 100%; }
    #player-equipment-panel .player-equipment__action svg { width:17px; height:17px; }
    #player-equipment-panel .player-equipment__live {
      min-height:18px;
      margin-top:8px;
      color:#245c2c;
      font-size:11px;
      font-weight:800;
      line-height:1.35;
    }
    #player-equipment-panel button:focus-visible {
      outline:3px solid #2b2b2b;
      outline-offset:3px;
    }
    @media (max-width:600px) {
      #player-equipment-panel {
        left:12px !important;
        width:calc(100vw - 24px) !important;
        max-height:calc(100vh - 132px) !important;
      }
      #player-equipment-panel .player-equipment__slot { min-height:62px; }
      #player-equipment-panel .player-equipment__remove { min-height:44px; }
    }
    @media (prefers-reduced-motion:reduce) {
      #player-equipment-panel *, #player-equipment-panel button { transition:none !important; }
      #player-equipment-panel .player-equipment__close:hover,
      #player-equipment-panel .player-equipment__remove:hover,
      #player-equipment-panel .player-equipment__action:hover { transform:none; }
    }
  `;
  document.head.appendChild(style);
}

export class PlayerEquipmentPanel {
  private readonly el: HTMLDivElement;
  private readonly subtitleEl: HTMLDivElement;
  private readonly summaryEl: HTMLDivElement;
  private readonly slotsEl: HTMLDivElement;
  private readonly liveEl: HTMLDivElement;
  private readonly allButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private open = false;

  constructor(private readonly cb: PlayerEquipmentPanelCallbacks) {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'player-equipment-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'false');
    this.el.setAttribute('aria-labelledby', 'player-equipment-title');
    this.el.style.cssText = panelStyle();

    const header = document.createElement('div');
    header.className = 'player-equipment__header';
    const identity = document.createElement('div');
    identity.className = 'player-equipment__identity';
    const portrait = document.createElement('div');
    portrait.className = 'player-equipment__portrait';
    portrait.innerHTML = ICON_MAXWELL;
    portrait.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'player-equipment__copy';
    const title = document.createElement('div');
    title.id = 'player-equipment-title';
    title.className = 'player-equipment__title';
    title.textContent = t('playerPanel.title');
    this.subtitleEl = document.createElement('div');
    this.subtitleEl.className = 'player-equipment__subtitle';
    copy.append(title, this.subtitleEl);
    identity.append(portrait, copy);

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'player-equipment__close';
    this.closeButton.innerHTML = ICON_CLOSE;
    this.closeButton.title = t('playerPanel.closeAria');
    this.closeButton.setAttribute('aria-label', t('playerPanel.closeAria'));
    this.closeButton.addEventListener('click', () => this.hide());
    header.append(identity, this.closeButton);

    this.summaryEl = document.createElement('div');
    this.summaryEl.className = 'player-equipment__summary';

    const heading = document.createElement('div');
    heading.className = 'player-equipment__heading';
    heading.textContent = t('playerPanel.equipmentHeading');
    this.slotsEl = document.createElement('div');
    this.slotsEl.className = 'player-equipment__slots';

    this.liveEl = document.createElement('div');
    this.liveEl.className = 'player-equipment__live';
    this.liveEl.setAttribute('role', 'status');
    this.liveEl.setAttribute('aria-live', 'polite');

    const footer = document.createElement('div');
    footer.className = 'player-equipment__footer';
    this.allButton = this.createActionButton(t('playerPanel.unequipAll'), ICON_CLOSE, 'player-equipment__action player-equipment__action--wide');
    this.allButton.addEventListener('click', () => {
      this.cb.onUnequipAll();
      this.liveEl.textContent = t('playerPanel.unequipAllDone');
      this.render();
    });
    const notebookButton = this.createActionButton(t('actionPanel.use'), ICON_BOOK, 'player-equipment__action player-equipment__action--primary');
    notebookButton.addEventListener('click', () => this.cb.onUseNotebook());
    const adjectiveButton = this.createActionButton(t('actionPanel.addAdj'), ICON_SPARKLES, 'player-equipment__action');
    adjectiveButton.addEventListener('click', () => this.cb.onAddAdjective());
    footer.append(this.allButton, notebookButton, adjectiveButton);

    this.el.append(header, this.summaryEl, heading, this.slotsEl, this.liveEl, footer);
    this.el.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      this.hide();
    });
    document.body.appendChild(this.el);
    this.hide();
  }

  show(): void {
    this.open = true;
    this.render();
    this.el.style.display = 'block';
    this.closeButton.focus();
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  refresh(): void {
    if (this.open) this.render();
  }

  isOpen(): boolean {
    return this.open;
  }

  private render(): void {
    const snapshot = this.cb.getEquipment();
    const filled = [snapshot.hand, snapshot.back, snapshot.mount].filter(Boolean).length;
    this.subtitleEl.textContent = filled > 0
      ? t('playerPanel.subtitleFilled', { count: filled })
      : t('playerPanel.subtitleEmpty');
    this.summaryEl.textContent = capabilitySummary(snapshot);
    this.slotsEl.innerHTML = '';

    const specs: SlotSpec[] = [
      { slot: 'hand', label: t('playerPanel.hand'), empty: t('playerPanel.handEmpty'), icon: ICON_HAND, entity: snapshot.hand },
      { slot: 'back', label: t('playerPanel.back'), empty: t('playerPanel.backEmpty'), icon: ICON_WING, entity: snapshot.back },
      { slot: 'mount', label: t('playerPanel.mount'), empty: t('playerPanel.mountEmpty'), icon: ICON_RIDE, entity: snapshot.mount },
    ];
    for (const spec of specs) this.slotsEl.appendChild(this.createSlot(spec));
    this.allButton.disabled = filled === 0;
    this.allButton.setAttribute('aria-label', `${t('playerPanel.unequipAll')}（${filled}）`);
  }

  private createSlot(spec: SlotSpec): HTMLDivElement {
    const filled = Boolean(spec.entity);
    const row = document.createElement('div');
    row.className = 'player-equipment__slot';
    row.dataset.filled = String(filled);

    const icon = document.createElement('div');
    icon.className = 'player-equipment__slot-icon';
    icon.innerHTML = spec.icon;
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'player-equipment__slot-copy';
    const label = document.createElement('div');
    label.className = 'player-equipment__slot-label';
    label.textContent = spec.label;
    const name = document.createElement('div');
    name.className = 'player-equipment__slot-name';
    name.textContent = spec.entity ? entityName(spec.entity) : spec.empty;
    const status = document.createElement('small');
    status.className = 'player-equipment__slot-status';
    status.textContent = slotStatus(spec);
    copy.append(label, name, status);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'player-equipment__remove';
    remove.innerHTML = `${ICON_CLOSE}<span>${removeLabel(spec.slot)}</span>`;
    remove.disabled = !filled;
    remove.setAttribute('aria-label', filled
      ? `${removeLabel(spec.slot)}：${entityName(spec.entity!)}`
      : `${removeLabel(spec.slot)}（${spec.empty}）`);
    remove.addEventListener('click', () => {
      if (!filled) return;
      this.cb.onUnequip(spec.slot);
      this.liveEl.textContent = t('playerPanel.unequipDone', { name: entityName(spec.entity!) });
      this.render();
    });

    row.append(icon, copy, remove);
    return row;
  }

  private createActionButton(label: string, icon: string, className: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.innerHTML = `${icon}<span>${label}</span>`;
    button.setAttribute('aria-label', label);
    return button;
  }
}

function entityName(entity: GameEntity): string {
  return entryName(getEntry(entity.typeId)) || entity.typeId;
}

function slotStatus(spec: SlotSpec): string {
  if (!spec.entity) return spec.empty;
  if (spec.slot === 'hand') {
    return spec.entity.tags.hasFlag('ranged') ? t('playerPanel.handRanged') : t('playerPanel.handEquipped');
  }
  if (spec.slot === 'back') return t('playerPanel.backFlying');
  return spec.entity.tags.behavior.has('flying') ? t('playerPanel.mountFlying') : t('playerPanel.mountGround');
}

function capabilitySummary(snapshot: PlayerEquipmentSnapshot): string {
  const capabilities: string[] = [];
  if (snapshot.hand?.tags.hasFlag('ranged')) capabilities.push(t('playerPanel.capabilityRanged'));
  if (snapshot.back) capabilities.push(t('playerPanel.capabilityFlyBack'));
  if (snapshot.mount) capabilities.push(snapshot.mount.tags.behavior.has('flying')
    ? t('playerPanel.capabilityFlyMount')
    : t('playerPanel.capabilityMount'));
  return capabilities.length > 0
    ? `${t('playerPanel.active')}${capabilities.join(t('playerPanel.separator'))}`
    : t('playerPanel.noActive');
}

function removeLabel(slot: PlayerEquipmentSlot): string {
  if (slot === 'hand') return t('playerPanel.unequipHand');
  if (slot === 'back') return t('playerPanel.unequipBack');
  return t('playerPanel.dismount');
}

function panelStyle(): string {
  return [
    'position:fixed',
    `top:calc(${SAFE_TOP} + 58px)`,
    `left:${SAFE_LEFT}`,
    'width:min(390px,calc(100vw - 28px))',
    'box-sizing:border-box',
    'padding:14px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    TORN_EDGE,
    'z-index:53',
    'max-height:calc(100vh - 146px)',
    'overflow:auto',
    'overscroll-behavior:contain',
  ].join(';');
}
