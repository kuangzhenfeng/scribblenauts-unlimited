/**
 * 简易问答 toast —— 答对/答错瞬时反馈浮层。
 *
 * 徽章职责由 QuizTopBar 承载，本组件只负责答对/答错反馈：
 * 反馈落在任务条下方的自然情境空间，不遮挡题面与输入台，pointer-events:none，不拦截键盘。
 */

import {
  UI_FONT,
  SAFE_TOP,
  QUIZ_GOLD_DARK,
  QUIZ_DANGER,
  QUIZ_DANGER_SOFT,
  QUIZ_SUCCESS,
  QUIZ_SUCCESS_SOFT,
  QUIZ_RADIUS_SM,
  QUIZ_SHADOW,
} from './quizStyle';
import { ICON_CHECK, ICON_CLOSE } from './icons';
import { t } from '@/core/i18n/I18n';

export class QuizHud {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'quiz-hud';
    this.el.style.cssText = [
      'position:fixed',
      `top:calc(${SAFE_TOP} + 88px)`,
      'left:0',
      'right:0',
      'z-index:56',
      'display:flex',
      'justify-content:center',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity 180ms ease-out',
    ].join(';');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(this.el);
    QuizHud.injectStyle();
  }

  /**
   * 显示一条 toast。
   * @param toast 文案（答对/答错），空串则隐藏
   */
  render(toast: string): void {
    if (!toast) {
      this.el.style.opacity = '0';
      this.el.style.display = 'none';
      this.el.innerHTML = '';
      return;
    }
    const correct = toast === t('quiz.correct');
    const fg = correct ? QUIZ_SUCCESS : QUIZ_DANGER;
    const bg = correct ? QUIZ_SUCCESS_SOFT : QUIZ_DANGER_SOFT;
    const icon = correct ? ICON_CHECK : ICON_CLOSE;
    this.el.dataset.state = correct ? 'correct' : 'wrong';
    this.el.innerHTML = `<div class="quiz-toast-message" style="--quiz-feedback-fg:${fg};--quiz-feedback-bg:${bg}"><span class="quiz-toast-icon" aria-hidden="true">${icon}</span><span>${this._escape(toast)}</span></div>`;
    this.el.style.display = 'flex';
    this.el.style.opacity = '1';
  }

  /** 让反馈落在任务条下方的自然情境区域，不覆盖输入台。 */
  setTop(top: number): void {
    this.el.style.top = `${Math.max(0, top)}px`;
  }

  /** 注入 toast 动画（仅注一次） */
  static injectStyle(): void {
    if (document.getElementById('quiz-hud-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-hud-style';
    style.textContent = `
      .quiz-toast-message {
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:36px;
        box-sizing:border-box;
        padding:7px 15px;
        background:var(--quiz-feedback-bg);
        color:var(--quiz-feedback-fg);
        border:2px solid ${QUIZ_GOLD_DARK};
        border-radius:${QUIZ_RADIUS_SM};
        box-shadow:${QUIZ_SHADOW};
        font-family:${UI_FONT};
        font-size:15px;
        font-weight:950;
        letter-spacing:.02em;
        transform:rotate(-.6deg);
        animation:quizToast 1.6s ease-out forwards;
      }
      @keyframes quizToast{0%{opacity:0;transform:translateY(7px) rotate(-.6deg)}15%,75%{opacity:1;transform:translateY(0) rotate(-.6deg)}100%{opacity:0;transform:translateY(-5px) rotate(-.6deg)}}
      .quiz-toast-icon { display:inline-flex; align-items:center; justify-content:center; }
      .quiz-toast-icon svg { flex:none; }
      @media (max-width:390px) { .quiz-toast-message { max-width:calc(100vw - 32px); font-size:14px !important; } }
      @media (prefers-reduced-motion:reduce){.quiz-toast-message{animation:quizToastReduced 1.2s linear forwards!important}@keyframes quizToastReduced{0%,100%{opacity:0}15%,80%{opacity:1}}}
    `;
    document.head.appendChild(style);
  }

  hide(): void {
    this.el.style.opacity = '0';
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.el.remove();
  }

  private _escape(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]!));
  }
}
