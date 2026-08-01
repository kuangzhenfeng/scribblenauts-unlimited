/**
 * 首次进入关卡的基础入门卡片。
 *
 * 只负责展示原版核心循环的三步提示并通知场景开始游戏，
 * 不持有存档、物理或关卡状态，避免把引导逻辑侵入 UI 职责之外。
 */

import { ICON_BOOK, ICON_PENCIL, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_BOTTOM, SAFE_TOP, UI_FONT } from './paperStyle';
import { t } from '@/core/i18n/I18n';

const STYLE_ID = 'basics-overlay-style';

export class BasicsOverlay {
  private readonly el: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;
  private open = false;

  constructor(private readonly onStart: () => void) {
    this.ensureStyle();

    this.el = document.createElement('div');
    this.el.id = 'basics-overlay';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'basics-overlay-title');
    this.el.setAttribute('aria-describedby', 'basics-overlay-description');

    const card = document.createElement('section');
    card.className = 'basics-overlay__card';

    const preview = document.createElement('div');
    preview.className = 'basics-overlay__preview';
    preview.setAttribute('aria-hidden', 'true');

    const eyebrow = document.createElement('div');
    eyebrow.className = 'basics-overlay__eyebrow';
    eyebrow.textContent = t('basics.eyebrow');

    const title = document.createElement('h1');
    title.id = 'basics-overlay-title';
    title.textContent = t('basics.title');

    const description = document.createElement('p');
    description.id = 'basics-overlay-description';
    description.textContent = t('basics.description');

    const steps = document.createElement('div');
    steps.className = 'basics-overlay__steps';
    steps.append(
      this.createStep(ICON_PENCIL, t('basics.stepWrite')),
      this.createStep(ICON_BOOK, t('basics.stepSummon')),
      this.createStep(ICON_STAR, t('basics.stepHelp')),
    );

    this.startButton = document.createElement('button');
    this.startButton.type = 'button';
    this.startButton.className = 'basics-overlay__start';
    this.startButton.setAttribute('aria-label', t('basics.start'));
    this.startButton.textContent = t('basics.start');
    this.startButton.addEventListener('click', () => this.onStart());

    const hint = document.createElement('div');
    hint.className = 'basics-overlay__hint';
    hint.textContent = t('basics.hint');

    card.append(preview, eyebrow, title, description, steps, this.startButton, hint);
    this.el.appendChild(card);
    this.el.style.display = 'none';
    this.el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.el.style.display = 'grid';
    this.el.setAttribute('aria-hidden', 'false');
    this.startButton.focus();
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

  private createStep(icon: string, label: string): HTMLDivElement {
    const step = document.createElement('div');
    step.className = 'basics-overlay__step';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'basics-overlay__step-icon';
    iconWrap.innerHTML = icon;
    const text = document.createElement('span');
    text.textContent = label;
    step.append(iconWrap, text);
    return step;
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #basics-overlay {
        position:fixed;
        inset:0;
        z-index:175;
        display:grid;
        place-items:center;
        padding:${SAFE_TOP} 18px ${SAFE_BOTTOM};
        overflow:auto;
        background:rgba(18,27,20,.58);
        font-family:${UI_FONT};
        color:${INK};
      }
      #basics-overlay *, #basics-overlay *::before, #basics-overlay *::after { box-sizing:border-box; }
      .basics-overlay__card {
        width:min(560px,100%);
        padding:14px 16px 18px;
        display:flex;
        flex-direction:column;
        align-items:stretch;
        gap:11px;
        background:${PAPER_BG};
        border:2px solid ${INK};
        border-radius:14px;
        box-shadow:${PAPER_SHADOW};
        transform:rotate(-.45deg);
        animation:basicsOverlayPop .22s ease both;
      }
      .basics-overlay__preview {
        min-height:154px;
        border:2px solid #6a3d08;
        border-radius:10px;
        background-image:linear-gradient(180deg,rgba(20,41,31,.04),rgba(20,41,31,.32)),url('assets/backgrounds/bg-far-jungle.png');
        background-position:center 64%;
        background-size:cover;
        box-shadow:inset 0 -18px 0 rgba(45,87,44,.24);
      }
      .basics-overlay__eyebrow {
        align-self:center;
        margin-top:-26px;
        padding:5px 16px;
        color:#fff8dd;
        background:#9a5a08;
        border:2px solid #5f3606;
        border-radius:7px;
        box-shadow:0 3px 0 #5f3606;
        font-size:12px;
        font-weight:950;
        letter-spacing:.14em;
      }
      .basics-overlay__card h1 {
        margin:0;
        text-align:center;
        color:#5a3205;
        font-size:clamp(25px,4vw,34px);
        line-height:1;
        letter-spacing:.04em;
      }
      .basics-overlay__card p {
        max-width:470px;
        margin:0 auto;
        color:#554b3d;
        font-size:15px;
        line-height:1.55;
        text-align:center;
      }
      .basics-overlay__steps {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:2px;
      }
      .basics-overlay__step {
        min-height:64px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:5px;
        padding:8px 6px;
        color:#6a3d08;
        background:${PAPER_BG_ALT};
        border:1px solid rgba(106,61,8,.28);
        border-radius:9px;
        font-size:12px;
        font-weight:850;
        text-align:center;
      }
      .basics-overlay__step-icon { display:grid; place-items:center; width:22px; height:22px; }
      .basics-overlay__step-icon svg { width:21px; height:21px; }
      .basics-overlay__start {
        min-height:50px;
        margin-top:2px;
        padding:10px 18px;
        color:#fff8dd;
        background:#3f7b3a;
        border:2px solid #1f4d22;
        border-radius:9px;
        box-shadow:0 4px 0 #1f4d22;
        font:inherit;
        font-size:18px;
        font-weight:950;
        letter-spacing:.04em;
        cursor:pointer;
        transition:transform .14s ease,filter .14s ease,box-shadow .14s ease;
      }
      .basics-overlay__start:hover,
      .basics-overlay__start:focus-visible { transform:translateY(-2px); filter:brightness(1.06); }
      .basics-overlay__start:active { transform:translateY(2px); box-shadow:0 1px 0 #1f4d22; }
      .basics-overlay__start:focus-visible { outline:3px solid #f0bd3c; outline-offset:3px; }
      .basics-overlay__hint { color:#766c5b; font-size:11px; text-align:center; }
      @keyframes basicsOverlayPop { from { opacity:0; transform:rotate(-.45deg) scale(.97); } to { opacity:1; transform:rotate(-.45deg) scale(1); } }
      @media (max-width:560px) {
        #basics-overlay { align-items:end; padding-inline:12px; }
        .basics-overlay__card { padding:10px 11px 14px; gap:8px; }
        .basics-overlay__preview { min-height:112px; }
        .basics-overlay__card p { font-size:13px; }
        .basics-overlay__step { min-height:58px; font-size:11px; }
        .basics-overlay__start { min-height:48px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .basics-overlay__card,.basics-overlay__start { animation:none; transition:none; }
      }
    `;
    document.head.appendChild(style);
  }
}
