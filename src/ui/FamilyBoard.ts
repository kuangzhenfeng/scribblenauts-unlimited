/**
 * 家庭头像板 —— 展示已帮助的兄弟姐妹与 Starite 里程碑头像，并提交换装意图。
 * 解锁资格由 WorldScene 提供的快照决定，本 UI 不自行修改存档。
 */

import { FAMILY_AVATARS, type FamilyProgressSnapshot } from '@/core/data/family/avatars';
import { getLang, t } from '@/core/i18n/I18n';
import { ICON_CHECK, ICON_CLOSE, ICON_LOCK, ICON_MAXWELL } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_BOTTOM, SAFE_TOP, UI_FONT } from './paperStyle';

const STYLE_ID = 'family-board-style';

export interface FamilyBoardCallbacks {
  onSelect: (avatarId: string) => void;
}

export class FamilyBoard {
  private readonly el: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly summary: HTMLParagraphElement;
  private readonly grid: HTMLDivElement;
  private snapshot: FamilyProgressSnapshot = {
    helpedCount: 0,
    starites: 0,
    completedObjectShardCount: 0,
    unlockedAvatarIds: ['maxwell'],
    selectedAvatarId: 'maxwell',
  };
  private open = false;

  constructor(private readonly cb: FamilyBoardCallbacks) {
    this.ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'family-board';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-hidden', 'true');

    const card = document.createElement('section');
    card.className = 'family-board__card';
    const header = document.createElement('header');
    header.className = 'family-board__header';
    const headingWrap = document.createElement('div');
    headingWrap.className = 'family-board__heading-wrap';
    const icon = document.createElement('span');
    icon.className = 'family-board__icon';
    icon.innerHTML = ICON_MAXWELL;
    icon.setAttribute('aria-hidden', 'true');
    this.title = document.createElement('h2');
    this.title.textContent = t('family.title');
    headingWrap.append(icon, this.title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'family-board__close';
    close.innerHTML = ICON_CLOSE;
    close.setAttribute('aria-label', t('family.close'));
    close.addEventListener('click', () => this.hide());
    header.append(headingWrap, close);

    this.summary = document.createElement('p');
    this.summary.className = 'family-board__summary';
    this.grid = document.createElement('div');
    this.grid.className = 'family-board__grid';
    card.append(header, this.summary, this.grid);
    this.el.appendChild(card);
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.render();
  }

  get isOpen(): boolean {
    return this.open;
  }

  update(snapshot: FamilyProgressSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  show(): void {
    this.open = true;
    this.el.style.display = 'grid';
    this.el.setAttribute('aria-hidden', 'false');
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
    this.el.setAttribute('aria-hidden', 'true');
  }

  destroy(): void {
    this.open = false;
    this.el.remove();
  }

  private render(): void {
    const lang = getLang();
    this.title.textContent = t('family.title');
    this.summary.textContent = `${t('family.helped', { current: this.snapshot.helpedCount })} · ${this.snapshot.starites} Starite`;
    this.grid.replaceChildren();
    for (const avatar of FAMILY_AVATARS) {
      const unlocked = this.snapshot.unlockedAvatarIds.includes(avatar.id);
      const selected = avatar.id === this.snapshot.selectedAvatarId;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `family-board__avatar${unlocked ? '' : ' is-locked'}${selected ? ' is-selected' : ''}`;
      button.disabled = !unlocked;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', unlocked ? `${t('family.select')} ${avatar[lang]}` : `${avatar[lang]} · ${t('family.locked')}`);

      const portrait = document.createElement('span');
      portrait.className = 'family-board__portrait';
      portrait.innerHTML = unlocked ? ICON_MAXWELL : ICON_LOCK;
      portrait.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'family-board__name';
      name.textContent = avatar[lang];
      const state = document.createElement('span');
      state.className = 'family-board__state';
      state.innerHTML = selected ? ICON_CHECK : unlocked ? '' : ICON_LOCK;
      state.setAttribute('aria-hidden', 'true');
      button.append(portrait, name, state);
      if (unlocked) button.addEventListener('click', () => this.cb.onSelect(avatar.id));
      this.grid.appendChild(button);
    }
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #family-board { position:fixed; inset:0; z-index:190; place-items:center; padding:${SAFE_TOP} 16px ${SAFE_BOTTOM}; background:rgba(18,27,20,.62); font-family:${UI_FONT}; color:${INK}; }
      #family-board *, #family-board *::before, #family-board *::after { box-sizing:border-box; }
      .family-board__card { width:min(760px,100%); max-height:min(82vh,720px); overflow:auto; padding:18px; background:${PAPER_BG}; border:2px solid ${INK}; border-radius:14px; box-shadow:${PAPER_SHADOW}; transform:rotate(-.35deg); }
      .family-board__header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .family-board__heading-wrap { display:flex; align-items:center; gap:9px; }
      .family-board__icon { display:grid; place-items:center; color:#805000; }
      .family-board__icon svg { width:28px; height:28px; }
      .family-board__card h2 { margin:0; color:#5a3205; font-size:clamp(22px,4vw,30px); }
      .family-board__close { display:grid; place-items:center; width:42px; height:42px; padding:8px; color:${INK}; background:${PAPER_BG_ALT}; border:1px solid #6a3d08; border-radius:8px; cursor:pointer; }
      .family-board__close svg { width:22px; height:22px; }
      .family-board__summary { margin:6px 0 14px; color:#766c5b; font-size:13px; font-weight:850; }
      .family-board__grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
      .family-board__avatar { min-height:76px; display:grid; grid-template-columns:34px 1fr 18px; align-items:center; gap:6px; padding:8px; color:#4f2f00; background:${PAPER_BG_ALT}; border:1px solid rgba(106,61,8,.3); border-radius:9px; font:inherit; text-align:left; cursor:pointer; }
      .family-board__avatar:hover,.family-board__avatar:focus-visible { background:#f0e3bb; transform:translateY(-1px); }
      .family-board__avatar.is-selected { border:2px solid #9f6a0a; background:#fff3c5; box-shadow:0 2px 0 rgba(159,106,10,.36); }
      .family-board__avatar.is-locked { color:#938a7a; background:#eee6d0; cursor:not-allowed; }
      .family-board__portrait { display:grid; place-items:center; width:32px; height:32px; color:#805000; border:1px solid rgba(106,61,8,.28); border-radius:50%; }
      .family-board__portrait svg { width:22px; height:22px; }
      .family-board__name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:900; }
      .family-board__state { display:grid; place-items:center; color:#3f7b3a; }
      .family-board__state svg { width:16px; height:16px; }
      @media(max-width:600px) { .family-board__card { padding:13px; } .family-board__grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; } .family-board__avatar { min-height:64px; padding:6px; } }
      @media(prefers-reduced-motion:reduce) { .family-board__avatar:hover,.family-board__avatar:focus-visible { transform:none; } }
    `;
    document.head.appendChild(style);
  }
}
