/**
 * 简易问答任务条 —— 在自然情境上方只呈现当前题面与有意义的文字提示。
 *
 * 难度标准与档位属于全局设置，统一由 QuizTopBar 的词频设置按钮承载。
 */

import {
  UI_FONT,
  QUIZ_INK,
  QUIZ_INK_SOFT,
  QUIZ_GOLD_DARK,
  QUIZ_DANGER,
  QUIZ_SUCCESS,
  QUIZ_SHADOW,
  QUIZ_RADIUS_MD,
} from './quizStyle';

export class QuizQuestionCard {
  private readonly el: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private feedbackTimer: number | undefined;

  constructor() {
    QuizQuestionCard.injectStyle();

    this.el = document.createElement('div');
    this.el.id = 'quiz-question-card';
    this.el.style.cssText = [
      'position:fixed', 'left:50%', 'z-index:55',
      'width:min(1560px,calc(100vw - 32px))', 'transform:translateX(-50%)',
      'margin:10px 0 0', 'padding:0',
      `background:rgba(247,241,227,.97)`, `border:2px solid ${QUIZ_GOLD_DARK}`,
      `border-radius:${QUIZ_RADIUS_MD}`, `box-shadow:${QUIZ_SHADOW}`,
      `font-family:${UI_FONT}`, `color:${QUIZ_INK}`, 'box-sizing:border-box',
      'pointer-events:none', 'overflow:hidden',
    ].join(';');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');

    const main = document.createElement('div');
    main.className = 'quiz-question-main';

    const copy = document.createElement('div');
    copy.className = 'quiz-question-copy';

    this.promptEl = document.createElement('div');
    this.promptEl.className = 'quiz-question-prompt';
    this.promptEl.style.cssText = [
      'font-size:19px', 'font-weight:900', 'line-height:1.25', 'text-wrap:pretty',
      'word-break:break-word', `color:${QUIZ_INK}`, 'max-width:70ch',
    ].join(';');
    copy.appendChild(this.promptEl);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'quiz-question-hint';
    this.hintEl.style.cssText = `margin-top:5px;color:${QUIZ_INK_SOFT};font-size:12px;line-height:1.35;font-weight:700`;
    copy.appendChild(this.hintEl);
    main.appendChild(copy);
    this.el.appendChild(main);

    document.body.appendChild(this.el);
  }

  setQuestion(prompt: string, hint: string): void {
    this.promptEl.textContent = prompt;
    this.hintEl.textContent = hint;
    this.hintEl.style.display = hint ? 'block' : 'none';
    this.setState('idle');
  }

  /** 将答案状态反馈到任务条，和情境 toast 形成同一条反馈链。 */
  setState(state: 'idle' | 'correct' | 'wrong'): void {
    if (this.feedbackTimer !== undefined) {
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = undefined;
    }
    this.el.dataset.state = state;
    if (state !== 'idle') {
      this.feedbackTimer = window.setTimeout(() => {
        this.el.dataset.state = 'idle';
        this.feedbackTimer = undefined;
      }, 900);
    }
  }

  /** 切换界面语言时刷新当前题面与提示，不改变题目本身。 */
  refreshLocale(prompt: string, hint: string): void {
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
    if (this.feedbackTimer !== undefined) window.clearTimeout(this.feedbackTimer);
    this.el.remove();
  }

  static injectStyle(): void {
    if (document.getElementById('quiz-question-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-question-style';
    style.textContent = `
      #quiz-question-card { pointer-events:none; }
      #quiz-question-card .quiz-question-main {
        display:block;
        min-height:76px;
        background:transparent;
        border-radius:${QUIZ_RADIUS_MD};
        overflow:hidden;
      }
      #quiz-question-card .quiz-question-copy { min-width:0; padding:12px 18px 11px; }
      #quiz-question-card .quiz-question-prompt {
        overflow:hidden;
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
      }
      #quiz-question-card[data-state="correct"] { border-color:${QUIZ_SUCCESS}; animation:quizQuestionCorrect 260ms cubic-bezier(.22,1,.36,1); }
      #quiz-question-card[data-state="wrong"] { border-color:${QUIZ_DANGER}; animation:quizQuestionWrong 260ms ease-out; }
      @keyframes quizQuestionCorrect { 50% { transform:translateX(-50%) scale(1.012); } }
      @keyframes quizQuestionWrong { 25% { transform:translateX(-50%) translateX(-3px); } 60% { transform:translateX(-50%) translateX(3px); } }
      @media (max-height:720px) {
        #quiz-question-card .quiz-question-main { min-height:68px !important; }
        #quiz-question-card .quiz-question-copy { padding-top:7px !important; padding-bottom:6px !important; }
        #quiz-question-card .quiz-question-prompt { font-size:17px !important; }
      }
      @media (max-width:600px) {
        #quiz-question-card { width:calc(100vw - 24px) !important; }
        #quiz-question-card .quiz-question-main { min-height:70px; }
        #quiz-question-card .quiz-question-copy { padding:9px 12px 8px; }
        #quiz-question-card .quiz-question-prompt { font-size:16px !important; line-height:1.25; }
        #quiz-question-card .quiz-question-hint { font-size:11px !important; }
      }
      @media (prefers-reduced-motion:reduce) {
        #quiz-question-card *, #quiz-question-card { transition:none !important; animation:none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}
