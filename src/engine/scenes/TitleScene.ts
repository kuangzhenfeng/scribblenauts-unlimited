/**
 * 标题场景 —— 以完整 key art 承载品牌，纸片操作条承载入口。
 *
 * 设计要点：
 *  - DOM 浮层承载全部 UI（与 WorldScene 保持一致的 paperStyle 体系）
 *  - key art 保持为完整世界画布，不额外叠加大面积装饰层
 *  - 「开始探索」是唯一主操作，选择关卡/简易问答为次级入口
 *  - 所有入口支持键盘焦点、触控目标与 reduced-motion
 */

import Phaser from 'phaser';
import { INK, SAFE_BOTTOM, SAFE_RIGHT, SAFE_TOP, UI_FONT } from '@/ui/paperStyle';
import { ICON_KEYBOARD, ICON_MAP, ICON_PENCIL, ICON_SETTINGS } from '@/ui/icons';
import { music } from '@/audio/MusicDirector';
import { getLang, t } from '@/core/i18n/I18n';

const TITLE_STYLE_ID = 'title-ui-style';

export class TitleScene extends Phaser.Scene {
  private keyArt?: Phaser.GameObjects.Image;
  private keyArtTexture = '';
  private overlay!: HTMLDivElement;
  private actionRail!: HTMLDivElement;
  private windowResizeListener?: () => void;
  private started = false;
  private transitioning = false;
  private reducedMotion = false;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.started = false;
    this.transitioning = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // Phaser 4 不自动调用 scene.shutdown()，须显式绑到 SHUTDOWN 事件，
    // 否则复用实例时 keyArt 残留已销毁对象，重进后不重建导致主屏纯蓝
    this.events.once('shutdown', this.shutdown, this);

    this._setKeyArtTexture(width, height);
    this._buildDomOverlay(width, height);

    this.windowResizeListener = () => this._handleResize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', this.windowResizeListener);

    // 保留原版“任意键开始”，但不让画布空白区域绕过标题页入口。
    this.input.keyboard?.on('keydown', this._handleKeyDown, this);

    this.cameras.main.setBackgroundColor('#5cb6d9');
  }

  private _buildDomOverlay(w: number, h: number): void {
    this._ensureStyle();

    this.overlay = document.createElement('div');
    this.overlay.id = 'title-overlay';
    this.overlay.setAttribute('aria-label', getLang() === 'zh' ? '涂鸦冒险家 无限' : 'Scribblenauts Unlimited');

    this.actionRail = document.createElement('div');
    this.actionRail.className = 'title-action-rail';
    this._layoutActionRail(w, h);

    const brand = document.createElement('div');
    brand.className = 'title-brand';
    const brandName = document.createElement('span');
    brandName.className = 'title-brand-name';
    brandName.textContent = getLang() === 'zh' ? '涂鸦冒险家' : 'Scribblenauts';
    const brandSub = document.createElement('span');
    brandSub.className = 'title-brand-sub';
    brandSub.textContent = getLang() === 'zh' ? '无限' : 'Unlimited';
    brand.append(brandName, brandSub);
    this.actionRail.appendChild(brand);

    const primary = this._makeButton('title-primary-action', ICON_PENCIL, t('title.start'));
    primary.setAttribute('aria-label', t('title.start'));
    primary.addEventListener('click', (event) => {
      event.stopPropagation();
      this._startGame();
    });
    this.actionRail.appendChild(primary);

    const secondaryActions = document.createElement('div');
    secondaryActions.className = 'title-secondary-actions';

    const select = this._makeButton('title-secondary-action', ICON_MAP, t('title.select'));
    select.setAttribute('aria-label', t('title.select'));
    select.addEventListener('click', (event) => {
      event.stopPropagation();
      music.start('title');
      this._transitionTo('LevelSelectScene');
    });

    const quiz = this._makeButton('title-secondary-action', ICON_KEYBOARD, t('quiz.start'));
    quiz.setAttribute('aria-label', t('quiz.start'));
    quiz.addEventListener('click', (event) => {
      event.stopPropagation();
      music.start('title');
      this._transitionTo('QuizScene');
    });

    secondaryActions.append(select, quiz);
    this.actionRail.appendChild(secondaryActions);
    this.overlay.appendChild(this.actionRail);

    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'title-settings-action';
    settings.title = t('title.settings');
    settings.setAttribute('aria-label', t('title.settings'));
    settings.innerHTML = ICON_SETTINGS;
    settings.addEventListener('click', (event) => {
      event.stopPropagation();
      music.start('title');
      this._transitionTo('SettingsScene');
    });
    this.overlay.appendChild(settings);

    document.body.appendChild(this.overlay);
  }

  private _makeButton(className: string, icon: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'title-button-icon';
    iconWrap.innerHTML = icon;
    const text = document.createElement('span');
    text.className = 'title-button-label';
    text.textContent = label;
    button.append(iconWrap, text);
    return button;
  }

  private _ensureStyle(): void {
    if (document.getElementById(TITLE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TITLE_STYLE_ID;
    style.textContent = `
      #title-overlay {
        position:fixed;
        inset:0;
        z-index:100;
        pointer-events:none;
        font-family:${UI_FONT};
        color:${INK};
      }
      #title-overlay *, #title-overlay *::before, #title-overlay *::after { box-sizing:border-box; }
      .title-action-rail {
        position:absolute;
        left:clamp(24px,6vw,92px);
        bottom:max(28px,6vh);
        width:min(430px,calc(100vw - 48px));
        padding:18px 18px 16px;
        display:flex;
        flex-direction:column;
        gap:14px;
        pointer-events:auto;
        background:rgba(247,241,227,.95);
        border:2px solid ${INK};
        border-radius:12px;
        box-shadow:0 5px 0 rgba(43,43,43,.72);
        transform:rotate(-.6deg);
      }
      .title-brand {
        display:flex;
        align-items:baseline;
        gap:10px;
        padding:0 2px 2px;
      }
      .title-brand-name {
        font-size:26px;
        line-height:1;
        font-weight:950;
        letter-spacing:.04em;
      }
      .title-brand-sub {
        color:#48657a;
        font-size:15px;
        font-weight:900;
        letter-spacing:.08em;
      }
      .title-primary-action,
      .title-secondary-action,
      .title-settings-action {
        appearance:none;
        -webkit-tap-highlight-color:transparent;
        font:inherit;
        cursor:pointer;
        transition:transform .16s ease,filter .16s ease,background-color .16s ease,box-shadow .16s ease;
      }
      .title-primary-action,
      .title-secondary-action {
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        min-height:52px;
        padding:10px 16px;
        border-radius:9px;
        font-size:18px;
        font-weight:900;
        letter-spacing:.04em;
      }
      .title-primary-action {
        width:100%;
        color:#2b2b2b;
        background:#f2bd2f;
        border:2px solid #2b2b2b;
        box-shadow:0 4px 0 #8d4e0c;
      }
      .title-secondary-actions {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }
      .title-secondary-action {
        color:#274e68;
        background:rgba(255,255,255,.28);
        border:2px solid #52718a;
        box-shadow:0 3px 0 rgba(39,78,104,.38);
      }
      .title-button-icon {
        display:grid;
        place-items:center;
        width:21px;
        height:21px;
        flex:none;
      }
      .title-settings-action {
        position:absolute;
        top:${SAFE_TOP};
        right:${SAFE_RIGHT};
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        padding:10px;
        pointer-events:auto;
        color:${INK};
        background:rgba(247,241,227,.93);
        border:2px solid ${INK};
        border-radius:9px;
        box-shadow:0 3px 0 rgba(43,43,43,.62);
      }
      .title-primary-action:hover,
      .title-secondary-action:hover,
      .title-settings-action:hover {
        transform:translateY(-2px);
        filter:brightness(1.04);
      }
      .title-primary-action:active,
      .title-secondary-action:active,
      .title-settings-action:active {
        transform:translateY(2px);
        box-shadow:0 1px 0 rgba(43,43,43,.58);
      }
      .title-primary-action:focus-visible,
      .title-secondary-action:focus-visible,
      .title-settings-action:focus-visible {
        outline:3px solid #fff;
        outline-offset:3px;
      }
      #title-overlay.is-leaving { animation:title-ui-leave .36s ease both; }
      @keyframes title-ui-leave {
        to { opacity:0; transform:scale(1.015); }
      }
      @media (max-width:720px) {
        .title-action-rail {
          left:50%;
          bottom:${SAFE_BOTTOM};
          width:calc(100vw - 28px);
          padding:15px 14px 14px;
          transform:translateX(-50%) rotate(-.4deg);
        }
        .title-brand-name { font-size:22px; }
        .title-brand-sub { font-size:13px; }
        .title-primary-action { min-height:54px; font-size:18px; }
        .title-secondary-action { min-height:48px; padding-inline:10px; font-size:15px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .title-primary-action,
        .title-secondary-action,
        .title-settings-action { transition:none; }
        #title-overlay.is-leaving { animation:none; }
      }
    `;
    document.head.appendChild(style);
  }

  private _fitKeyArt(w: number, h: number): void {
    if (!this.keyArt) return;
    const sourceW = this.keyArt.width;
    const sourceH = this.keyArt.height;
    const scale = Math.max(w / sourceW, h / sourceH);
    this.keyArt.setScale(scale);
    this.keyArt.setPosition((w - sourceW * scale) / 2, (h - sourceH * scale) / 2);
  }

  private _setKeyArtTexture(w: number, h: number): void {
    const portrait = h > w;
    const preferred = portrait ? 'title-key-art-portrait' : 'title-key-art';
    const texture = this.textures.exists(preferred) ? preferred : 'title-key-art';
    if (!this.textures.exists(texture)) return;

    if (!this.keyArt) {
      this.keyArt = this.add.image(0, 0, texture);
      this.keyArt.setOrigin(0, 0).setDepth(-35);
    } else if (this.keyArtTexture !== texture) {
      this.keyArt.setTexture(texture);
    }
    this.keyArtTexture = texture;
    this._fitKeyArt(w, h);
  }

  private _layoutActionRail(w: number, h: number): void {
    if (!this.actionRail) return;
    this.actionRail.classList.toggle('is-portrait', h > w);
  }

  private _handleResize(width: number, height: number): void {
    this._setKeyArtTexture(width, height);
    this._layoutActionRail(width, height);
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab') return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button,input,select,textarea,a,[contenteditable="true"]')) return;
    this._startGame();
  }

  private _transitionTo(sceneKey: string, beforeStart?: () => void): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const duration = this.reducedMotion ? 0 : 360;
    this.overlay?.classList.add('is-leaving');
    this.cameras.main.fadeOut(duration, 0, 0, 0);
    window.setTimeout(() => {
      beforeStart?.();
      this.overlay?.remove();
      this.scene.start(sceneKey);
      // Phaser 4 在异步计时器回调中不会自动处理场景切换队列，
      // 立即冲刷才能保证标题页按钮真正进入目标场景。
      this.scene.manager.processQueue();
    }, duration);
  }

  private _startGame(): void {
    if (this.started || this.transitioning) return;
    this.started = true;
    music.start('title');
    this._transitionTo('WorldScene', () => music.setMood('meadow'));
  }

  shutdown(): void {
    if (this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
      this.windowResizeListener = undefined;
    }
    this.input.keyboard?.off('keydown', this._handleKeyDown, this);
    this.overlay?.remove();
    // keyArt 已被 Phaser 场景销毁，置空避免复用实例时 _setKeyArtTexture 误用已销毁对象
    this.keyArt = undefined;
    this.keyArtTexture = '';
  }

  resize(width: number, height: number): void {
    this._handleResize(width, height);
  }
}
