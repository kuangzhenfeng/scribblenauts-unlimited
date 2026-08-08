/**
 * Starite 门槛达成后的胜利卡。
 *
 * 只负责胜利状态的展示和出口事件；世界暂停、地图切换和音乐恢复由 WorldScene 负责。
 */

import { ICON_MAP, ICON_MAXWELL, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_BOTTOM, SAFE_TOP, UI_FONT } from './paperStyle';
import { t } from '@/core/i18n/I18n';

const STYLE_ID = 'victory-overlay-style';

export interface VictoryOverlayCallbacks {
  onContinue: () => void;
  onMap: () => void;
}

export type VictoryOverlayVariant = 'curse' | 'collection';

export class VictoryOverlay {
  private readonly el: HTMLDivElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly eyebrow: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly description: HTMLParagraphElement;
  private readonly rewardText: HTMLSpanElement;
  private readonly revealTitle: HTMLElement;
  private readonly revealText: HTMLSpanElement;
  private open = false;

  constructor(private readonly cb: VictoryOverlayCallbacks) {
    this.ensureStyle();

    this.el = document.createElement('div');
    this.el.id = 'victory-overlay';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'victory-overlay-title');
    this.el.setAttribute('aria-describedby', 'victory-overlay-description');

    const card = document.createElement('section');
    card.className = 'victory-overlay__card';

    const star = document.createElement('div');
    star.className = 'victory-overlay__star';
    star.innerHTML = ICON_STAR;
    star.setAttribute('aria-hidden', 'true');

    this.eyebrow = document.createElement('div');
    this.eyebrow.className = 'victory-overlay__eyebrow';

    this.title = document.createElement('h1');
    this.title.id = 'victory-overlay-title';

    this.description = document.createElement('p');
    this.description.id = 'victory-overlay-description';

    const reward = document.createElement('div');
    reward.className = 'victory-overlay__reward';
    this.rewardText = document.createElement('span');
    reward.innerHTML = ICON_STAR;
    reward.appendChild(this.rewardText);

    const reveal = document.createElement('div');
    reveal.className = 'victory-overlay__reveal';
    const revealIcon = document.createElement('span');
    revealIcon.className = 'victory-overlay__reveal-icon';
    revealIcon.innerHTML = ICON_MAXWELL;
    revealIcon.setAttribute('aria-hidden', 'true');
    const revealCopy = document.createElement('div');
    this.revealTitle = document.createElement('strong');
    this.revealText = document.createElement('span');
    revealCopy.append(this.revealTitle, this.revealText);
    reveal.append(revealIcon, revealCopy);

    const actions = document.createElement('div');
    actions.className = 'victory-overlay__actions';

    this.continueButton = document.createElement('button');
    this.continueButton.type = 'button';
    this.continueButton.className = 'victory-overlay__continue';
    this.continueButton.setAttribute('aria-label', t('victory.continue'));
    this.continueButton.textContent = t('victory.continue');
    this.continueButton.addEventListener('click', () => this.cb.onContinue());

    const mapButton = document.createElement('button');
    mapButton.type = 'button';
    mapButton.className = 'victory-overlay__map';
    mapButton.setAttribute('aria-label', t('victory.map'));
    mapButton.innerHTML = `${ICON_MAP}<span>${t('victory.map')}</span>`;
    mapButton.addEventListener('click', () => this.cb.onMap());

    actions.append(this.continueButton, mapButton);
    card.append(star, this.eyebrow, this.title, this.description, reward, reveal, actions);
    this.el.appendChild(card);
    this.el.style.display = 'none';
    this.el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.el);
    this.applyVariant('curse');
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(variant: VictoryOverlayVariant = 'curse'): void {
    this.applyVariant(variant);
    this.open = true;
    this.el.style.display = 'grid';
    this.el.setAttribute('aria-hidden', 'false');
    this.continueButton.focus();
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

  private applyVariant(variant: VictoryOverlayVariant): void {
    const copy = variant === 'collection'
      ? {
          eyebrow: t('victory.collectionEyebrow'),
          title: t('victory.collectionTitle'),
          description: t('victory.collectionDescription'),
          reward: t('victory.collectionReward'),
          revealTitle: t('victory.collectionRevealTitle'),
          reveal: t('victory.collectionReveal'),
        }
      : {
          eyebrow: t('victory.eyebrow'),
          title: t('victory.title'),
          description: t('victory.description'),
          reward: t('victory.reward'),
          revealTitle: t('victory.revealTitle'),
          reveal: t('victory.reveal'),
        };
    this.eyebrow.textContent = copy.eyebrow;
    this.title.textContent = copy.title;
    this.description.textContent = copy.description;
    this.rewardText.textContent = copy.reward;
    this.revealTitle.textContent = copy.revealTitle;
    this.revealText.textContent = copy.reveal;
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #victory-overlay {
        position:fixed;
        inset:0;
        z-index:185;
        display:grid;
        place-items:center;
        padding:${SAFE_TOP} 18px ${SAFE_BOTTOM};
        overflow:auto;
        background:rgba(18,27,20,.62);
        font-family:${UI_FONT};
        color:${INK};
      }
      #victory-overlay *, #victory-overlay *::before, #victory-overlay *::after { box-sizing:border-box; }
      .victory-overlay__card {
        width:min(500px,100%);
        padding:25px 22px 21px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:11px;
        background:${PAPER_BG};
        border:2px solid ${INK};
        border-radius:14px;
        box-shadow:${PAPER_SHADOW};
        transform:rotate(.55deg);
        animation:victoryOverlayPop .22s ease both;
        text-align:center;
      }
      .victory-overlay__star {
        display:grid;
        place-items:center;
        width:68px;
        height:68px;
        color:#d58b08;
        background:#fff0a7;
        border:2px solid #9a5a08;
        border-radius:50%;
        box-shadow:0 4px 0 #9a5a08;
      }
      .victory-overlay__star svg { width:40px; height:40px; stroke-width:1.7; }
      .victory-overlay__eyebrow {
        margin-top:-5px;
        color:#9a5a08;
        font-size:11px;
        font-weight:950;
        letter-spacing:.16em;
      }
      .victory-overlay__card h1 {
        margin:0;
        color:#5a3205;
        font-size:clamp(25px,4vw,35px);
        line-height:1.08;
        letter-spacing:.03em;
      }
      .victory-overlay__card p {
        max-width:420px;
        margin:0;
        color:#554b3d;
        font-size:15px;
        line-height:1.55;
      }
      .victory-overlay__reward {
        display:inline-flex;
        align-items:center;
        gap:7px;
        min-height:36px;
        padding:6px 13px;
        color:#6a3d08;
        background:${PAPER_BG_ALT};
        border:1px solid rgba(106,61,8,.28);
        border-radius:999px;
        font-size:13px;
        font-weight:900;
      }
      .victory-overlay__reward svg { width:18px; height:18px; color:#d58b08; }
      .victory-overlay__reveal {
        width:100%;
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 11px;
        color:#4e3b20;
        background:#fff8de;
        border:1px solid rgba(106,61,8,.3);
        border-radius:10px;
        font-size:12px;
        line-height:1.45;
        text-align:left;
      }
      .victory-overlay__reveal-icon {
        display:grid;
        place-items:center;
        flex:none;
        width:28px;
        height:28px;
        color:#7b4e18;
      }
      .victory-overlay__reveal-icon svg { width:25px; height:25px; }
      .victory-overlay__reveal strong,
      .victory-overlay__reveal span { display:block; }
      .victory-overlay__reveal strong { margin-bottom:2px; color:#6a3d08; font-size:11px; letter-spacing:.08em; }
      .victory-overlay__actions {
        width:100%;
        display:grid;
        grid-template-columns:1.2fr 1fr;
        gap:9px;
        margin-top:5px;
      }
      .victory-overlay__actions button {
        min-height:48px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:10px 13px;
        border-radius:9px;
        font:inherit;
        font-size:14px;
        font-weight:950;
        cursor:pointer;
        transition:transform .14s ease,filter .14s ease,box-shadow .14s ease;
      }
      .victory-overlay__continue {
        color:#fff8dd;
        background:#3f7b3a;
        border:2px solid #1f4d22;
        box-shadow:0 4px 0 #1f4d22;
      }
      .victory-overlay__map {
        color:#4f2f00;
        background:#efb933;
        border:2px solid #9f6a0a;
        box-shadow:0 4px 0 #9f6a0a;
      }
      .victory-overlay__actions button:hover,
      .victory-overlay__actions button:focus-visible { transform:translateY(-2px); filter:brightness(1.06); }
      .victory-overlay__actions button:active { transform:translateY(2px); box-shadow:0 1px 0 currentColor; }
      .victory-overlay__actions button:focus-visible { outline:3px solid #f0bd3c; outline-offset:3px; }
      .victory-overlay__actions svg { width:18px; height:18px; }
      @keyframes victoryOverlayPop { from { opacity:0; transform:rotate(.55deg) scale(.97); } to { opacity:1; transform:rotate(.55deg) scale(1); } }
      @media (max-width:560px) {
        #victory-overlay { align-items:end; padding-inline:12px; }
        .victory-overlay__card { padding:21px 14px 15px; gap:8px; }
        .victory-overlay__card p { font-size:13px; }
        .victory-overlay__actions { grid-template-columns:1fr; }
      }
      @media (prefers-reduced-motion:reduce) {
        .victory-overlay__card, .victory-overlay__actions button { animation:none; transition:none; }
      }
    `;
    document.head.appendChild(style);
  }
}
