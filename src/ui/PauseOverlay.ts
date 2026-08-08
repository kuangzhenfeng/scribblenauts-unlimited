/**
 * 暂停遮罩 —— 窗口失焦或按 ESC 时显示的全屏暂停界面。
 *
 * 纸片风全屏半透明遮罩 + 居中「已暂停」卡片 + 继续/返回主菜单按钮。
 * 点击遮罩空白处或「继续游戏」按钮 → onResume 回调；
 * 点击「返回主菜单」按钮 → onMainMenu 回调；
 * ESC 由 WorldScene 统一处理（避免与 Notebook/ConfirmDialog 的 ESC 冲突）。
 *
 * z-index 180：高于所有游戏内 UI（HUD/Notebook/进度面板等 ≤ 60），
 * 低于 ConfirmDialog（200），二者不会同时出现。
 */

import { UI_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from './paperStyle';
import { ICON_PAUSE } from './icons';
import { t } from '@/core/i18n/I18n';

export class PauseOverlay {
  private readonly el: HTMLDivElement;
  private readonly resumeButton: HTMLButtonElement;
  private open = false;

  constructor(
    private readonly onResume: () => void,
    private readonly onMainMenu: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.id = 'pause-overlay';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100vw',
      'height:100vh',
      'z-index:180',
      'display:grid',
      'place-items:center',
      'background:rgba(20,12,4,0.62)',
      'pointer-events:auto',
      'animation:pauseFadeIn 0.16s ease',
    ].join(';');

    const card = document.createElement('div');
    card.setAttribute('role', 'document');
    card.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      `background:${PAPER_BG}`,
      `box-shadow:${PAPER_SHADOW}`,
      TORN_EDGE,
      `color:${INK}`,
      `font-family:${UI_FONT}`,
      'padding:28px 30px 26px',
      'max-width:390px',
      'width:calc(100% - 48px)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:14px',
      'transform:translate(-50%,-50%)',
      'animation:pausePop 0.2s ease',
    ].join(';');

    const icon = document.createElement('div');
    icon.innerHTML = ICON_PAUSE;
    icon.style.cssText = `color:#3d2200;width:48px;height:48px;display:grid;place-items:center`;

    const title = document.createElement('div');
    title.id = 'pause-overlay-title';
    this.el.setAttribute('aria-labelledby', title.id);
    title.textContent = t('pause.title');
    title.style.cssText = 'font-size:30px;font-weight:900;letter-spacing:0.06em;color:#3d2200';

    const hint = document.createElement('div');
    hint.id = 'pause-overlay-hint';
    this.el.setAttribute('aria-describedby', hint.id);
    hint.textContent = t('pause.hint');
    hint.style.cssText = 'font-size:14px;opacity:0.7;text-align:center';

    const resumeBtn = document.createElement('button');
    this.resumeButton = resumeBtn;
    resumeBtn.type = 'button';
    resumeBtn.id = 'pause-overlay-resume';
    resumeBtn.textContent = t('pause.resume');
    resumeBtn.style.cssText = [
      'margin-top:6px',
      'width:min(100%,270px)',
      'min-height:44px',
      'padding:11px 28px',
      `font-family:${UI_FONT}`,
      'font-size:17px',
      'font-weight:900',
      'color:#fff8dd',
      'background:#3f7b3a',
      'border:1px solid #1f4d22',
      'border-radius:10px',
      'cursor:pointer',
      'box-shadow:0 3px 0 #1f4d22',
      'transition:transform 0.12s ease,filter 0.12s ease',
    ].join(';');
    resumeBtn.addEventListener('mouseenter', () => {
      resumeBtn.style.transform = 'translateY(-1px)';
      resumeBtn.style.filter = 'brightness(1.08)';
    });
    resumeBtn.addEventListener('mouseleave', () => {
      resumeBtn.style.transform = 'translateY(0)';
      resumeBtn.style.filter = 'brightness(1)';
    });

    const mainMenuBtn = document.createElement('button');
    mainMenuBtn.type = 'button';
    mainMenuBtn.id = 'pause-overlay-main-menu';
    mainMenuBtn.textContent = t('pause.mainMenu');
    mainMenuBtn.style.cssText = [
      'width:min(100%,270px)',
      'min-height:40px',
      'padding:9px 28px',
      `font-family:${UI_FONT}`,
      'font-size:15px',
      'font-weight:800',
      'color:#3d2200',
      'background:transparent',
      'border:2px solid #b28b4d',
      'border-radius:10px',
      'cursor:pointer',
      'box-shadow:0 2px 0 #b28b4d',
      'transition:transform 0.12s ease,background 0.12s ease,color 0.12s ease',
    ].join(';');
    mainMenuBtn.addEventListener('mouseenter', () => {
      mainMenuBtn.style.transform = 'translateY(-1px)';
      mainMenuBtn.style.background = '#fff8dd';
    });
    mainMenuBtn.addEventListener('mouseleave', () => {
      mainMenuBtn.style.transform = 'translateY(0)';
      mainMenuBtn.style.background = 'transparent';
    });

    card.append(icon, title, hint, resumeBtn, mainMenuBtn);
    this.el.appendChild(card);

    // 入场动画样式只服务暂停遮罩，避免与确认对话框共享变换原点。
    if (!document.getElementById('pause-overlay-style')) {
      const style = document.createElement('style');
      style.id = 'pause-overlay-style';
      style.textContent = `
        #pause-overlay button:focus-visible { outline:3px solid #f0bd3c; outline-offset:3px; }
        @keyframes pauseFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pausePop { from{opacity:0;transform:translate(-50%,-50%) scale(.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @media (prefers-reduced-motion:reduce) { #pause-overlay, #pause-overlay button { animation:none !important; transition:none !important; } }
      `;
      document.head.appendChild(style);
    }
    this.el.style.animation = 'pauseFadeIn 0.16s ease';
    card.style.animation = 'pausePop 0.18s ease';

    // 点击遮罩空白处（非卡片）继续
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.onResume();
    });
    resumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onResume();
    });
    mainMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onMainMenu();
    });

    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.el.style.display = '';
    this.resumeButton.focus();
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }
}
