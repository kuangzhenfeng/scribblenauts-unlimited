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
import { ICON_PENCIL, ICON_SETTINGS, ICON_MAP } from '@/ui/icons';
import { music } from '@/audio/MusicDirector';
import { t } from '@/core/i18n/I18n';

export class TitleScene extends Phaser.Scene {
  private keyArt!: Phaser.GameObjects.Image;
  private overlay!: HTMLDivElement;
  private started = false;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    if (this.textures.exists('title-key-art')) {
      this.keyArt = this.add.image(0, 0, 'title-key-art');
      this.keyArt.setOrigin(0, 0).setDepth(-35);
      this._fitKeyArt(width, height);
    }

    this._buildDomOverlay(width, height);

    // 键盘 / 鼠标触发
    this.input.keyboard?.on('keydown', () => this._startGame());
    this.input.on('pointerdown', () => this._startGame());

    this.cameras.main.setBackgroundColor('#5cb6d9');
  }

  private _buildDomOverlay(w: number, h: number): void {
    void w; void h;
    this.overlay = document.createElement('div');
    this.overlay.id = 'title-overlay';

    // 按钮容器（"开始探索" + "选择关卡"并排）
    const btnRow = document.createElement('div');
    btnRow.style.cssText = [
      'position:absolute',
      'left:10%',
      'bottom:9%',
      'display:flex',
      'gap:14px',
      'align-items:center',
    ].join(';');

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
    this.overlay?.remove();
  }

  resize(_width: number, _height: number): void {
    this._fitKeyArt(this.scale.width, this.scale.height);
  }
}
