/**
 * 简易问答 HUD —— 左上角积分 + 题序 + 最高分。
 *
 * 复用 Hud 的涂鸦胶囊样式，但内容专为问答模式：奖杯图标 + 当前分 +
 * 最高分 + 题序。pointer-events:none，不拦截键盘区域。
 */

import { ICON_TROPHY, ICON_CHECK } from './icons';
import { SAFE_TOP, SAFE_LEFT, UI_FONT } from './paperStyle';
import { t } from '@/core/i18n/I18n';

export class QuizHud {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'quiz-hud';
    this.el.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      `left:${SAFE_LEFT}`,
      'z-index:50',
      'pointer-events:none',
      'display:flex',
      'align-items:center',
      'gap:6px',
    ].join(';');
    document.body.appendChild(this.el);
    this.render(0, 0, 0, '');
  }

  /**
   * @param score 当前局答对题数
   * @param best 历史最高分
   * @param round 当前题序（从 1 起）
   * @param toast 临时提示文案（答对/答错）
   */
  render(score: number, best: number, round: number, toast: string): void {
    const scoreChip = `
      <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(10,20,8,0.72);border:2.5px solid #1a1a1a;border-radius:22px;padding:5px 12px 5px 7px;box-shadow:0 3px 10px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.12)">
        <span style="color:#f5c518;filter:drop-shadow(0 0 4px #f5c51888)">${ICON_TROPHY}</span>
        <span style="font-family:${UI_FONT};font-size:15px;font-weight:700;color:#f5f0e0;letter-spacing:0.03em">${score}</span>
      </div>
    `.trim();
    const bestChip = `
      <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(10,20,8,0.5);border:2px solid #1a1a1a;border-radius:22px;padding:5px 10px 5px 6px;box-shadow:0 3px 10px rgba(0,0,0,0.4)">
        <span style="color:#a8e4ff">${ICON_CHECK}</span>
        <span style="font-family:${UI_FONT};font-size:13px;font-weight:700;color:#cdbfa0">${t('quiz.best')}:${best}</span>
      </div>
    `.trim();
    const roundChip = `
      <div style="display:inline-flex;align-items:center;background:rgba(10,20,8,0.5);border:2px solid #1a1a1a;border-radius:22px;padding:5px 12px;box-shadow:0 3px 10px rgba(0,0,0,0.4)">
        <span style="font-family:${UI_FONT};font-size:13px;font-weight:700;color:#cdbfa0">${t('quiz.round', { n: round })}</span>
      </div>
    `.trim();
    const toastChip = toast
      ? `<div style="display:inline-flex;align-items:center;background:rgba(10,20,8,0.72);border:2.5px solid #1a1a1a;border-radius:22px;padding:5px 14px;box-shadow:0 3px 10px rgba(0,0,0,0.55);animation:quizToast 1.6s ease forwards"><span style="font-family:${UI_FONT};font-size:14px;font-weight:900;color:#f5c518;letter-spacing:0.04em">${toast}</span></div>`
      : '';
    this.el.innerHTML = scoreChip + bestChip + roundChip + toastChip;
  }

  /** 注入 toast 动画（仅注一次） */
  static injectStyle(): void {
    if (document.getElementById('quiz-hud-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-hud-style';
    style.textContent = `@keyframes quizToast{0%,70%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-8px)}}`;
    document.head.appendChild(style);
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
