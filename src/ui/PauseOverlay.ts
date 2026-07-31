/**
 * 暂停遮罩 —— 窗口失焦或按 ESC 时显示的全屏暂停界面。
 *
 * 纸片风全屏半透明遮罩 + 居中「已暂停」卡片 + 继续按钮。
 * 点击遮罩空白处或「继续游戏」按钮 → onResume 回调；
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
  private open = false;

  constructor(private readonly onResume: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'pause-overlay';
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100vw',
      'height:100vh',
      'z-index:180',
      'display:grid',
      'place-items:center',
      'background:rgba(10,18,8,0.6)',
      'pointer-events:auto',
      'animation:confirmFadeIn 0.16s ease',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      `background:${PAPER_BG}`,
      `box-shadow:${PAPER_SHADOW}`,
      TORN_EDGE,
      `color:${INK}`,
      `font-family:${UI_FONT}`,
      'padding:30px 36px 26px',
      'max-width:360px',
      'width:calc(100% - 48px)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:14px',
      'transform:translate(-50%,-50%) rotate(-0.6deg)',
      'animation:confirmPop 0.2s ease',
    ].join(';');

    const icon = document.createElement('div');
    icon.innerHTML = ICON_PAUSE;
    icon.style.cssText = `color:#3d2200;width:48px;height:48px;display:grid;place-items:center`;

    const title = document.createElement('div');
    title.textContent = t('pause.title');
    title.style.cssText = 'font-size:30px;font-weight:900;letter-spacing:0.06em;color:#3d2200';

    const hint = document.createElement('div');
    hint.textContent = t('pause.hint');
    hint.style.cssText = 'font-size:14px;opacity:0.7;text-align:center';

    const resumeBtn = document.createElement('button');
    resumeBtn.type = 'button';
    resumeBtn.textContent = t('pause.resume');
    resumeBtn.style.cssText = [
      'margin-top:6px',
      'padding:11px 28px',
      `font-family:${UI_FONT}`,
      'font-size:17px',
      'font-weight:900',
      'color:#fff8dd',
      'background:linear-gradient(135deg,#3f9a43,#2f7a33)',
      'border:2.5px solid #1f4d22',
      'border-radius:10px',
      'cursor:pointer',
      'box-shadow:0 4px 0 #1f4d22,0 6px 14px rgba(31,77,34,0.3)',
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

    card.append(icon, title, hint, resumeBtn);
    this.el.appendChild(card);

    // 入场动画样式（复用 ConfirmDialog 的 keyframes，若已注入则跳过）
    if (!document.getElementById('confirm-anim-style')) {
      const style = document.createElement('style');
      style.id = 'confirm-anim-style';
      style.textContent = `
        @keyframes confirmFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes confirmPop { from{opacity:0;transform:translate(-50%,-50%) rotate(-0.6deg) scale(0.92)} to{opacity:1;transform:translate(-50%,-50%) rotate(-0.6deg) scale(1)} }
      `;
      document.head.appendChild(style);
    }

    // 点击遮罩空白处（非卡片）继续
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.onResume();
    });
    resumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onResume();
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
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }
}
