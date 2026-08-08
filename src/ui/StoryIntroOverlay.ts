/**
 * 首次进入世界的叙事卡。
 *
 * 只负责把 Maxwell、Lily、烂苹果和 Starite 的因果关系交给玩家，
 * 叙事状态由 WorldScene 与 SaveStore 持有，避免 UI 自己修改存档。
 */

import { ICON_BOOK, ICON_MAXWELL, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_BOTTOM, SAFE_TOP, UI_FONT } from './paperStyle';
import { t } from '@/core/i18n/I18n';

const STYLE_ID = 'story-intro-overlay-style';

export interface StoryIntroOverlayCallbacks {
  onContinue: () => void;
}

export class StoryIntroOverlay {
  private readonly el: HTMLDivElement;
  private readonly continueButton: HTMLButtonElement;
  private open = false;

  constructor(private readonly cb: StoryIntroOverlayCallbacks) {
    this.ensureStyle();

    this.el = document.createElement('div');
    this.el.id = 'story-intro-overlay';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'story-intro-title');
    this.el.setAttribute('aria-describedby', 'story-intro-description');

    const card = document.createElement('section');
    card.className = 'story-intro-overlay__card';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'story-intro-overlay__eyebrow';
    eyebrow.textContent = t('storyIntro.eyebrow');

    const title = document.createElement('h1');
    title.id = 'story-intro-title';
    title.textContent = t('storyIntro.title');

    const description = document.createElement('p');
    description.id = 'story-intro-description';
    description.textContent = t('storyIntro.description');

    const beats = document.createElement('div');
    beats.className = 'story-intro-overlay__beats';
    beats.append(
      this.createBeat(ICON_MAXWELL, t('storyIntro.prank')),
      this.createBeat(ICON_BOOK, t('storyIntro.curse')),
      this.createBeat(ICON_STAR, t('storyIntro.mission')),
    );

    this.continueButton = document.createElement('button');
    this.continueButton.type = 'button';
    this.continueButton.className = 'story-intro-overlay__continue';
    this.continueButton.setAttribute('aria-label', t('storyIntro.continue'));
    this.continueButton.textContent = t('storyIntro.continue');
    this.continueButton.addEventListener('click', () => this.cb.onContinue());

    const hint = document.createElement('div');
    hint.className = 'story-intro-overlay__hint';
    hint.textContent = t('storyIntro.hint');

    card.append(eyebrow, title, description, beats, this.continueButton, hint);
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

  private createBeat(icon: string, text: string): HTMLDivElement {
    const beat = document.createElement('div');
    beat.className = 'story-intro-overlay__beat';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'story-intro-overlay__beat-icon';
    iconWrap.innerHTML = icon;
    iconWrap.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.textContent = text;
    beat.append(iconWrap, copy);
    return beat;
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #story-intro-overlay {
        position:fixed;
        inset:0;
        z-index:180;
        display:grid;
        place-items:center;
        padding:${SAFE_TOP} 18px ${SAFE_BOTTOM};
        overflow:auto;
        background:rgba(18,27,20,.66);
        font-family:${UI_FONT};
        color:${INK};
      }
      #story-intro-overlay *, #story-intro-overlay *::before, #story-intro-overlay *::after { box-sizing:border-box; }
      .story-intro-overlay__card {
        width:min(620px,100%);
        padding:26px 23px 20px;
        display:flex;
        flex-direction:column;
        align-items:stretch;
        gap:12px;
        background:${PAPER_BG};
        border:2px solid ${INK};
        border-radius:14px;
        box-shadow:${PAPER_SHADOW};
        transform:rotate(-.55deg);
        animation:storyIntroOverlayPop .22s ease both;
      }
      .story-intro-overlay__eyebrow {
        align-self:center;
        padding:5px 14px;
        color:#fff8dd;
        background:#9a5a08;
        border:2px solid #5f3606;
        border-radius:7px;
        box-shadow:0 3px 0 #5f3606;
        font-size:11px;
        font-weight:950;
        letter-spacing:.14em;
      }
      .story-intro-overlay__card h1 {
        margin:0;
        color:#5a3205;
        font-size:clamp(26px,4vw,38px);
        line-height:1.05;
        letter-spacing:.03em;
        text-align:center;
      }
      .story-intro-overlay__card > p {
        max-width:520px;
        margin:0 auto;
        color:#554b3d;
        font-size:15px;
        line-height:1.6;
        text-align:center;
      }
      .story-intro-overlay__beats {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:4px;
      }
      .story-intro-overlay__beat {
        min-height:118px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:11px 9px;
        color:#6a3d08;
        background:${PAPER_BG_ALT};
        border:1px solid rgba(106,61,8,.28);
        border-radius:10px;
        font-size:13px;
        font-weight:850;
        line-height:1.4;
        text-align:center;
      }
      .story-intro-overlay__beat-icon { display:grid; place-items:center; width:30px; height:30px; }
      .story-intro-overlay__beat-icon svg { width:28px; height:28px; }
      .story-intro-overlay__continue {
        min-height:50px;
        margin-top:4px;
        padding:10px 18px;
        color:#fff8dd;
        background:#3f7b3a;
        border:2px solid #1f4d22;
        border-radius:9px;
        box-shadow:0 4px 0 #1f4d22;
        font:inherit;
        font-size:17px;
        font-weight:950;
        letter-spacing:.04em;
        cursor:pointer;
        transition:transform .14s ease,filter .14s ease,box-shadow .14s ease;
      }
      .story-intro-overlay__continue:hover,
      .story-intro-overlay__continue:focus-visible { transform:translateY(-2px); filter:brightness(1.06); }
      .story-intro-overlay__continue:active { transform:translateY(2px); box-shadow:0 1px 0 #1f4d22; }
      .story-intro-overlay__continue:focus-visible { outline:3px solid #f0bd3c; outline-offset:3px; }
      .story-intro-overlay__hint { color:#766c5b; font-size:11px; text-align:center; }
      @keyframes storyIntroOverlayPop { from { opacity:0; transform:rotate(-.55deg) scale(.97); } to { opacity:1; transform:rotate(-.55deg) scale(1); } }
      @media (max-width:560px) {
        #story-intro-overlay { align-items:end; padding-inline:12px; }
        .story-intro-overlay__card { padding:20px 13px 15px; gap:9px; }
        .story-intro-overlay__card > p { font-size:13px; }
        .story-intro-overlay__beats { grid-template-columns:1fr; gap:6px; }
        .story-intro-overlay__beat { min-height:0; flex-direction:row; justify-content:flex-start; text-align:left; }
        .story-intro-overlay__beat-icon { flex:none; width:25px; height:25px; }
        .story-intro-overlay__beat-icon svg { width:23px; height:23px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .story-intro-overlay__card,.story-intro-overlay__continue { animation:none; transition:none; }
      }
    `;
    document.head.appendChild(style);
  }
}
