/**
 * 简易问答任务条 —— 在舞台上方呈现当前题面与操作提示。
 *
 * 难度标准与档位属于全局设置，统一由 QuizTopBar 的词频设置按钮承载。
 */

import {
  UI_FONT,
  SAFE_LEFT,
  SAFE_RIGHT,
  QUIZ_CARD,
  QUIZ_INK,
  QUIZ_INK_SOFT,
  QUIZ_BORDER,
  QUIZ_SHADOW,
  QUIZ_RADIUS_MD,
} from './quizStyle';
import { t } from '@/core/i18n/I18n';

export class QuizQuestionCard {
  private readonly el: HTMLDivElement;
  private readonly taskEl: HTMLElement;
  private readonly promptEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;

  constructor() {
    QuizQuestionCard.injectStyle();

    this.el = document.createElement('div');
    this.el.id = 'quiz-question-card';
    this.el.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'z-index:55',
      `margin:6px ${SAFE_LEFT} 0 ${SAFE_RIGHT}`, 'padding:10px 12px 11px',
      `background:${QUIZ_CARD}`, `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_RADIUS_MD}`, `box-shadow:${QUIZ_SHADOW}`,
      `font-family:${UI_FONT}`, `color:${QUIZ_INK}`, 'box-sizing:border-box',
      'pointer-events:auto',
    ].join(';');

    this.taskEl = document.createElement('strong');
    this.taskEl.textContent = t('quiz.task');
    this.taskEl.style.cssText = `display:block;margin-bottom:6px;font-size:13px;color:${QUIZ_INK};letter-spacing:.02em`;
    this.el.appendChild(this.taskEl);

    this.promptEl = document.createElement('div');
    this.promptEl.style.cssText = [
      'font-size:17px', 'font-weight:800', 'line-height:1.35', 'text-wrap:pretty',
      'word-break:break-word', `color:${QUIZ_INK}`, 'max-width:70ch',
    ].join(';');
    this.el.appendChild(this.promptEl);

    this.hintEl = document.createElement('div');
    this.hintEl.style.cssText = `margin-top:4px;color:${QUIZ_INK_SOFT};font-size:12px;line-height:1.35`;
    this.el.appendChild(this.hintEl);

    document.body.appendChild(this.el);
  }

  setQuestion(prompt: string, hint: string): void {
    this.promptEl.textContent = prompt;
    this.hintEl.textContent = hint;
    this.hintEl.style.display = hint ? 'block' : 'none';
  }

  /** 切换界面语言时刷新任务标题与当前题面，不改变题目本身。 */
  refreshLocale(prompt: string, hint: string): void {
    this.taskEl.textContent = t('quiz.task');
    this.setQuestion(prompt, hint);
  }

  getHeight(): number {
    const rect = this.el.getBoundingClientRect();
    return Math.max(0, rect.height + 6);
  }

  getTop(): number {
    return Math.max(0, this.el.getBoundingClientRect().top);
  }

  setTop(top: number): void {
    this.el.style.top = `${top}px`;
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.el.remove();
  }

  static injectStyle(): void {
    if (document.getElementById('quiz-question-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-question-style';
    style.textContent = `
      #quiz-question-card { pointer-events:none; }
      @media (max-height:720px) {
        #quiz-question-card { padding-top:7px !important; padding-bottom:8px !important; }
      }
      @media (prefers-reduced-motion:reduce) { #quiz-question-card * { transition:none !important; } }
    `;
    document.head.appendChild(style);
  }
}
