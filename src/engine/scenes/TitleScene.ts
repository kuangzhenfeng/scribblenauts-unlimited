/**
 * 标题场景 —— 游戏入口，使用完整 key art 的手绘纸片风格主屏。
 *
 * 设计要点：
 *  - DOM 浮层承载全部 UI（与 WorldScene 保持一致的 paperStyle 体系）
 *  - 完整主屏插画直接承载背景、Maxwell 与场景道具
 *  - 任意键 / 点击 → WorldScene
 */

import Phaser from 'phaser';
import { UI_FONT } from '@/ui/paperStyle';
import { ICON_PENCIL, ICON_SETTINGS, ICON_MAP, ICON_KEYBOARD } from '@/ui/icons';
import { music } from '@/audio/MusicDirector';
import { t } from '@/core/i18n/I18n';

export class TitleScene extends Phaser.Scene {
  private keyArt?: Phaser.GameObjects.Image;
  private keyArtTexture = '';
  private overlay!: HTMLDivElement;
  private buttonRow!: HTMLDivElement;
  private windowResizeListener?: () => void;
  private started = false;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Phaser 4 不自动调用 scene.shutdown()，须显式绑到 SHUTDOWN 事件，
    // 否则复用实例时 keyArt 残留已销毁对象，重进后不重建导致主屏纯蓝
    this.events.once('shutdown', this.shutdown, this);

    this._setKeyArtTexture(width, height);

    this._buildDomOverlay(width, height);

    this.windowResizeListener = () => this._handleResize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', this.windowResizeListener);

    // 键盘 / 鼠标触发
    this.input.keyboard?.on('keydown', () => this._startGame());
    this.input.on('pointerdown', () => this._startGame());

    this.cameras.main.setBackgroundColor('#5cb6d9');
  }

  private _buildDomOverlay(w: number, h: number): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'title-overlay';

    // 按钮容器（横屏并排，竖屏纵向堆叠）
    const btnRow = document.createElement('div');
    btnRow.style.cssText = [
      'position:absolute',
      'display:flex',
      'gap:14px',
      'align-items:center',
    ].join(';');
    this.buttonRow = btnRow;
    this._layoutButtonRow(w, h);

    const start = document.createElement('button');
    start.type = 'button';
    start.innerHTML = `${ICON_PENCIL}<span>${t('title.start')}</span>`;
    start.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:9px',
      `font-family:${UI_FONT}`,
      'font-size:clamp(18px,2.5vw,26px)',
      'font-weight:900',
      'letter-spacing:0.08em',
      'color:#fff8dd',
      'background:linear-gradient(135deg,#efad19,#d77a10)',
      'border:3px solid #3d2200',
      'border-radius:999px',
      'padding:11px 26px 12px',
      'box-shadow:0 7px 0 #8d4e0c,0 12px 24px rgba(62,45,12,0.28),inset 0 1px rgba(255,255,255,0.55)',
      'cursor:pointer',
      'pointer-events:auto',
      'transform:rotate(0.8deg)',
      'transition:transform 0.16s ease,filter 0.16s ease',
    ].join(';');
    start.addEventListener('mouseenter', () => {
      start.style.transform = 'translateY(-3px) rotate(0.8deg)';
      start.style.filter = 'brightness(1.08)';
    });
    start.addEventListener('mouseleave', () => {
      start.style.transform = 'rotate(0.8deg)';
      start.style.filter = '';
    });
    start.addEventListener('click', (event) => {
      event.stopPropagation();
      this._startGame();
    });
    btnRow.appendChild(start);

    const select = document.createElement('button');
    select.type = 'button';
    select.innerHTML = `${ICON_MAP}<span>${t('title.select')}</span>`;
    select.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:9px',
      `font-family:${UI_FONT}`,
      'font-size:clamp(18px,2.5vw,26px)',
      'font-weight:900',
      'letter-spacing:0.08em',
      'color:#f0fbff',
      'background:linear-gradient(135deg,#3ab5a0,#1a7a6a)',
      'border:3px solid #0d3a30',
      'border-radius:999px',
      'padding:11px 26px 12px',
      'box-shadow:0 7px 0 #14554a,0 12px 24px rgba(13,58,48,0.28),inset 0 1px rgba(255,255,255,0.45)',
      'cursor:pointer',
      'pointer-events:auto',
      'transform:rotate(-0.6deg)',
      'transition:transform 0.16s ease,filter 0.16s ease',
    ].join(';');
    select.addEventListener('mouseenter', () => {
      select.style.transform = 'translateY(-3px) rotate(-0.6deg)';
      select.style.filter = 'brightness(1.08)';
    });
    select.addEventListener('mouseleave', () => {
      select.style.transform = 'rotate(-0.6deg)';
      select.style.filter = '';
    });
    select.addEventListener('click', (event) => {
      event.stopPropagation();
      music.start('title');
      this.overlay.style.animation = 'titleFadeOut 0.4s ease forwards';
      this.cameras.main.fadeOut(400, 0, 0, 0);
      window.setTimeout(() => {
        this.overlay.remove();
        this.scene.start('LevelSelectScene');
      }, 420);
    });
    btnRow.appendChild(select);

    // 简易问答按钮
    const quiz = document.createElement('button');
    quiz.type = 'button';
    quiz.innerHTML = `${ICON_KEYBOARD}<span>${t('quiz.start')}</span>`;
    quiz.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:9px',
      `font-family:${UI_FONT}`,
      'font-size:clamp(18px,2.5vw,26px)',
      'font-weight:900',
      'letter-spacing:0.08em',
      'color:#fff8dd',
      'background:linear-gradient(135deg,#9b59d0,#6c3a8f)',
      'border:3px solid #3a1a4f',
      'border-radius:999px',
      'padding:11px 26px 12px',
      'box-shadow:0 7px 0 #4a1a5a,0 12px 24px rgba(58,26,79,0.28),inset 0 1px rgba(255,255,255,0.45)',
      'cursor:pointer',
      'pointer-events:auto',
      'transform:rotate(0.4deg)',
      'transition:transform 0.16s ease,filter 0.16s ease',
    ].join(';');
    quiz.addEventListener('mouseenter', () => {
      quiz.style.transform = 'translateY(-3px) rotate(0.4deg)';
      quiz.style.filter = 'brightness(1.08)';
    });
    quiz.addEventListener('mouseleave', () => {
      quiz.style.transform = 'rotate(0.4deg)';
      quiz.style.filter = '';
    });
    quiz.addEventListener('click', (event) => {
      event.stopPropagation();
      music.start('title');
      this.overlay.style.animation = 'titleFadeOut 0.4s ease forwards';
      this.cameras.main.fadeOut(400, 0, 0, 0);
      window.setTimeout(() => {
        this.overlay.remove();
        this.scene.start('QuizScene');
      }, 420);
    });
    btnRow.appendChild(quiz);

    this.overlay.appendChild(btnRow);

    const settings = document.createElement('button');
    settings.type = 'button';
    settings.title = t('title.settings');
    settings.innerHTML = ICON_SETTINGS;
    settings.style.cssText = [
      'position:absolute',
      'top:22px',
      'right:24px',
      'width:42px',
      'height:42px',
      'display:grid',
      'place-items:center',
      'color:#274e68',
      'background:rgba(247,241,227,0.72)',
      'border:2px solid rgba(39,78,104,0.72)',
      'border-radius:50%',
      'cursor:pointer',
      'pointer-events:auto',
      'transition:transform 0.16s ease,background 0.16s ease',
    ].join(';');
    settings.addEventListener('mouseenter', () => { settings.style.transform = 'rotate(45deg) scale(1.08)'; });
    settings.addEventListener('mouseleave', () => { settings.style.transform = ''; });
    settings.addEventListener('click', (event) => {
      event.stopPropagation();
      music.start('title');
      this.overlay.style.animation = 'titleFadeOut 0.4s ease forwards';
      this.cameras.main.fadeOut(400, 0, 0, 0);
      window.setTimeout(() => {
        this.overlay.remove();
        this.scene.start('SettingsScene');
      }, 420);
    });
    this.overlay.appendChild(settings);

    // 呼吸动效样式注入（只注一次）
    if (!document.getElementById('title-anim-style')) {
      const style = document.createElement('style');
      style.id = 'title-anim-style';
      style.textContent = `
        @keyframes titleFadeOut {
          to { opacity:0; transform:scale(1.04); }
        }
      `;
      document.head.appendChild(style);
    }

    this.overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:100',
    ].join(';');

    document.body.appendChild(this.overlay);
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

  private _layoutButtonRow(w: number, h: number): void {
    if (!this.buttonRow) return;
    const portrait = h > w;
    this.buttonRow.style.left = portrait ? '50%' : '10%';
    this.buttonRow.style.bottom = portrait ? 'max(5%,env(safe-area-inset-bottom))' : '9%';
    this.buttonRow.style.flexDirection = portrait ? 'column' : 'row';
    this.buttonRow.style.transform = portrait ? 'translateX(-50%)' : '';
  }

  private _handleResize(width: number, height: number): void {
    this._setKeyArtTexture(width, height);
    this._layoutButtonRow(width, height);
  }

  private _startGame(): void {
    if (this.started) return;
    this.started = true;
    music.start('title');

    // 淡出动效
    this.overlay.style.animation = 'titleFadeOut 0.4s ease forwards';
    this.cameras.main.fadeOut(400, 0, 0, 0);

    window.setTimeout(() => {
      this.overlay.remove();
      music.setMood('meadow');
      this.scene.start('WorldScene', { levelId: 'overworld-meadow' });
    }, 420);
  }

  shutdown(): void {
    if (this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
      this.windowResizeListener = undefined;
    }
    this.overlay?.remove();
    // keyArt 已被 Phaser 场景销毁，置空避免复用实例时 _setKeyArtTexture 误用已销毁对象
    this.keyArt = undefined;
    this.keyArtTexture = '';
  }

  resize(width: number, height: number): void {
    this._handleResize(width, height);
  }
}
