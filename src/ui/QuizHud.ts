/**
 * 简易问答 toast —— 答对/答错瞬时反馈浮层。
 *
 * Atelier 风改版后，徽章职责已移至 QuizTopBar，本组件退化为纯 toast：
 * 仅在答对/答错时淡入淡出一条提示，浮于画布中部偏上，不遮挡任务卡题面与生物。
 * pointer-events:none，不拦截键盘。动画更精致（淡入+轻微上移+缩放）。
 */

import {
  UI_FONT,
  SAFE_TOP,
  QUIZ_RADIUS_PILL,
  QUIZ_SHADOW,
  QUIZ_BORDER,
  QUIZ_CARD,
  QUIZ_DANGER,
  QUIZ_SUCCESS,
} from './quizStyle';
import { t } from '@/core/i18n/I18n';

export class QuizHud {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'quiz-hud';
    this.el.style.cssText = [
      'position:fixed',
      `top:calc(${SAFE_TOP} + 110px)`,
      'left:0',
      'right:0',
      'z-index:50',
      'display:flex',
      'justify-content:center',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity 0.2s ease',
    ].join(';');
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
      this.el.innerHTML = '';
      return;
    }
    const correct = toast === t('quiz.correct');
    // 答对：浅绿底深绿字；答错：浅红底深红字
    const fg = correct ? QUIZ_SUCCESS : QUIZ_DANGER;
    const trail = correct
      ? '<div class="quiz-ink-trail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'
      : '';
    this.el.innerHTML = `${trail}<div class="quiz-toast-message" style="display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:${QUIZ_CARD};color:${fg};border:2px solid ${QUIZ_BORDER};border-radius:${QUIZ_RADIUS_PILL};box-shadow:${QUIZ_SHADOW};font-family:${UI_FONT};font-size:15px;font-weight:800;letter-spacing:0.02em;animation:quizToast 1.6s ease forwards">${this._escape(toast)}</div>`;
    this.el.style.opacity = '1';
  }

  /** 注入 toast 动画（仅注一次） */
  static injectStyle(): void {
    if (document.getElementById('quiz-hud-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-hud-style';
    // 淡入 + 轻微上移 + 缩放，更精致的反馈动效
    style.textContent = `
      @keyframes quizToast{0%{opacity:0;transform:translateY(-8px) scale(.96)}15%,75%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-4px) scale(1)}}
      .quiz-ink-trail{position:absolute;width:150px;height:76px;transform:translate(-28px,-38px) rotate(-10deg);animation:quizTrailFade 900ms ease-out forwards}
      .quiz-ink-trail:after{content:"";position:absolute;left:18px;top:50px;width:112px;border-top:2px dashed ${QUIZ_BORDER};transform:rotate(-18deg)}
      .quiz-ink-trail i{position:absolute;width:15px;height:15px;background:#ffd526;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 94%,50% 72%,21% 94%,32% 57%,2% 35%,39% 35%);filter:drop-shadow(1px 1px 0 ${QUIZ_BORDER})}
      .quiz-ink-trail i:nth-child(1){left:10px;top:48px}.quiz-ink-trail i:nth-child(2){left:39px;top:35px}.quiz-ink-trail i:nth-child(3){left:68px;top:27px}.quiz-ink-trail i:nth-child(4){left:98px;top:12px}.quiz-ink-trail i:nth-child(5){left:128px;top:0}
      @keyframes quizTrailFade{0%{opacity:0;transform:translate(-38px,-28px) rotate(-10deg)}18%,70%{opacity:1}100%{opacity:0;transform:translate(-18px,-48px) rotate(-10deg)}}
      @media (prefers-reduced-motion:reduce){.quiz-toast-message{animation:quizToastReduced 1.2s linear forwards!important}.quiz-ink-trail{display:none}@keyframes quizToastReduced{0%,100%{opacity:0}15%,80%{opacity:1}}}
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
