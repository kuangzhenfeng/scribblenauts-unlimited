/**
 * 简易问答顶栏 —— 承载导航、当前局状态与全局词频设置。
 *
 * 左侧返回、中央回合/得分/连胜/最高分、右侧词频设置与换题；最高分以低强调度常驻。
 */

import type { DifficultyStandard, DifficultyTier } from '@/core/types/question';
import { getLang, setLang, type Lang } from '@/core/i18n/I18n';
import {
  UI_FONT,
  SAFE_TOP,
  SAFE_LEFT,
  SAFE_RIGHT,
  QUIZ_CARD,
  QUIZ_CARD_BRIGHT,
  QUIZ_INK,
  QUIZ_INK_SOFT,
  QUIZ_ACCENT,
  QUIZ_ACCENT_PRESS,
  QUIZ_YELLOW,
  QUIZ_GOLD_DARK,
  QUIZ_BORDER,
  QUIZ_SHADOW,
  QUIZ_SHADOW_LIFT,
  QUIZ_RADIUS_SM,
  QUIZ_TIER_STYLES,
} from './quizStyle';
import { ICON_ARROW_LEFT, ICON_KEYBOARD, ICON_RESET, ICON_TROPHY, ICON_STAR, ICON_SETTINGS } from './icons';
import { t } from '@/core/i18n/I18n';
import { sfx } from '@/audio/SoundEffects';
import { loadSettings } from '@/core/data/settings/SettingsStore';

export interface QuizTopBarCallbacks {
  onBack: () => void;
  onReshuffle: () => void;
  onDifficulty: (tier: DifficultyTier, standard: DifficultyStandard) => void;
  onLanguage: (lang: Lang) => void;
  onSeedReset: () => void;
  onFilterBasicChange: (next: boolean) => void;
}

const TIER_I18N_KEY: Record<DifficultyTier, 'quiz.tierBasic' | 'quiz.tierIntermediate' | 'quiz.tierMaster'> = {
  1: 'quiz.tierBasic', 2: 'quiz.tierIntermediate', 3: 'quiz.tierMaster',
};
const TIERS: DifficultyTier[] = [1, 2, 3];
const STANDARDS: DifficultyStandard[] = ['cefr', 'frequency'];

export class QuizTopBar {
  private readonly el: HTMLDivElement;
  private readonly backButton: HTMLButtonElement;
  private readonly statsEl: HTMLDivElement;
  private readonly toolsEl: HTMLDivElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly reshuffleButton: HTMLButtonElement;
  private popoverEl: HTMLDivElement;
  private readonly tierBtns = new Map<DifficultyTier, HTMLButtonElement>();
  private readonly stdBtns = new Map<DifficultyStandard, HTMLButtonElement>();
  private readonly languageBtns = new Map<Lang, HTMLButtonElement>();
  private readonly cb: QuizTopBarCallbacks;
  private tier: DifficultyTier;
  private standard: DifficultyStandard;
  private language: Lang;
  private filterBasic: boolean;
  private readonly outsideListener: (event: PointerEvent) => void;
  private readonly keyListener: (event: KeyboardEvent) => void;

  constructor(tier: DifficultyTier, standard: DifficultyStandard, cb: QuizTopBarCallbacks) {
    this.tier = tier;
    this.standard = standard;
    this.language = getLang();
    this.filterBasic = loadSettings().filterBasicQuestions;
    this.cb = cb;
    QuizTopBar.injectStyle();

    this.el = document.createElement('div');
    this.el.id = 'quiz-topbar';
    this.el.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:70',
      'display:grid', 'grid-template-columns:auto minmax(0,1fr) auto', 'align-items:start', 'gap:12px',
      `padding:calc(${SAFE_TOP} + 8px) ${SAFE_RIGHT} 0 ${SAFE_LEFT}`,
      'background:transparent', 'border-bottom:0', 'box-shadow:none',
      `font-family:${UI_FONT}`, `color:${QUIZ_INK}`, 'box-sizing:border-box',
      'pointer-events:none',
    ].join(';');

    this.backButton = this._actionButton(ICON_ARROW_LEFT, t('quiz.back'), () => this.cb.onBack());
    this.el.appendChild(this.backButton);

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'quiz-topbar-stats';
    this.el.appendChild(this.statsEl);

    this.toolsEl = document.createElement('div');
    this.toolsEl.className = 'quiz-topbar-tools';
    this.settingsButton = this._buildSettingsButton();
    this.reshuffleButton = this._actionButton(ICON_RESET, t('quiz.reshuffle'), () => this.cb.onReshuffle());
    this.toolsEl.append(this.settingsButton, this.reshuffleButton);
    this.el.appendChild(this.toolsEl);

    this.popoverEl = this._buildPopover();
    document.body.appendChild(this.el);
    document.body.appendChild(this.popoverEl);

    this.outsideListener = (event) => {
      const target = event.target as Node;
      if (!this.popoverEl.hidden && !this.popoverEl.contains(target) && !this.settingsButton.contains(target)) {
        this._setPopoverOpen(false);
      }
    };
    this.keyListener = (event) => {
      if (event.key === 'Escape' && !this.popoverEl.hidden) {
        event.preventDefault();
        this._setPopoverOpen(false);
        this.settingsButton.focus();
      }
    };
    document.addEventListener('pointerdown', this.outsideListener);
    window.addEventListener('keydown', this.keyListener);

    this._syncDifficulty();
    this.render(0, 0, 0);
  }

  render(round: number, score: number, streak: number): void {
    this.statsEl.innerHTML = '';
    const identity = document.createElement('div');
    identity.className = 'quiz-topbar-identity';
    identity.innerHTML = `${ICON_KEYBOARD}<span>${this._escape(t('quiz.title'))}</span>`;
    this.statsEl.appendChild(identity);
    const scoreboard = document.createElement('div');
    scoreboard.className = 'quiz-scoreboard';
    scoreboard.appendChild(this._stat(t('quiz.roundLabel'), String(round), '', QUIZ_CARD, QUIZ_INK, 'round'));
    scoreboard.appendChild(this._stat(t('quiz.score'), String(score), ICON_TROPHY, QUIZ_YELLOW, QUIZ_INK, 'score'));
    scoreboard.appendChild(this._stat(t('quiz.streak'), `×${streak}`, ICON_STAR, QUIZ_CARD_BRIGHT, QUIZ_INK, 'streak'));
    scoreboard.appendChild(this._stat(t('quiz.best'), String(loadSettings().quizHighScore), ICON_TROPHY, QUIZ_CARD_BRIGHT, QUIZ_INK, 'best'));
    this.statsEl.appendChild(scoreboard);
  }

  /** 切换界面语言时只刷新文案，不重建问答场景与当前回合。 */
  refreshLocale(round: number, score: number, streak: number): void {
    this.backButton.querySelector('.quiz-action-label')!.textContent = t('quiz.back');
    this.backButton.setAttribute('aria-label', t('quiz.back'));
    this.reshuffleButton.querySelector('.quiz-action-label')!.textContent = t('quiz.reshuffle');
    this.reshuffleButton.setAttribute('aria-label', t('quiz.reshuffle'));

    this._setPopoverOpen(false);
    const oldPopover = this.popoverEl;
    this.popoverEl = this._buildPopover();
    oldPopover.replaceWith(this.popoverEl);
    this._syncDifficulty();
    this.render(round, score, streak);
  }

  getHeight(): number {
    return Math.max(0, this.el.getBoundingClientRect().bottom);
  }

  hide(): void {
    this.el.style.display = 'none';
    this._setPopoverOpen(false);
  }

  destroy(): void {
    document.removeEventListener('pointerdown', this.outsideListener);
    window.removeEventListener('keydown', this.keyListener);
    this.popoverEl.remove();
    this.el.remove();
  }

  static injectStyle(): void {
    if (document.getElementById('quiz-topbar-style')) return;
    const style = document.createElement('style');
    style.id = 'quiz-topbar-style';
    style.textContent = `
      #quiz-topbar .quiz-topbar-tools { display:flex; align-items:center; gap:5px; flex:none; pointer-events:auto; }
      #quiz-topbar .quiz-topbar-action:hover, #quiz-topbar #quiz-settings-button:hover { background:#f6e7b4 !important; color:${QUIZ_GOLD_DARK} !important; }
      #quiz-topbar .quiz-topbar-action:active, #quiz-topbar #quiz-settings-button:active { transform:translateY(2px); border-color:${QUIZ_ACCENT_PRESS}; box-shadow:none; }
      #quiz-topbar button:focus-visible, #quiz-difficulty-popover button:focus-visible { outline:3px solid #fff8dd; outline-offset:3px; }
      #quiz-topbar button:disabled, #quiz-difficulty-popover button:disabled { opacity:.5; cursor:not-allowed; pointer-events:none; }
      .quiz-topbar-stats { display:flex; align-items:center; justify-content:center; gap:8px; min-width:0; overflow:hidden; pointer-events:none; }
      .quiz-topbar-identity {
        display:inline-flex;
        align-items:center;
        gap:7px;
        min-height:44px;
        padding:6px 12px;
        box-sizing:border-box;
        color:${QUIZ_INK};
        background:${QUIZ_CARD};
        border:2px solid ${QUIZ_GOLD_DARK};
        border-radius:${QUIZ_RADIUS_SM};
        box-shadow:0 2px 0 ${QUIZ_GOLD_DARK};
        font-size:13px;
        font-weight:950;
        white-space:nowrap;
        transform:rotate(-.6deg);
      }
      .quiz-topbar-identity svg { width:20px; height:20px; color:${QUIZ_GOLD_DARK}; }
      .quiz-scoreboard { display:flex; align-items:stretch; gap:6px; min-width:0; }
      .quiz-topbar-stat { position:relative; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; min-width:56px; min-height:44px; overflow:hidden; text-overflow:ellipsis; }
      .quiz-topbar-stat .quiz-stat-label { color:${QUIZ_INK_SOFT}; font-size:10px; line-height:1; font-weight:800; white-space:nowrap; }
      .quiz-topbar-stat .quiz-stat-value { margin-top:3px; color:${QUIZ_INK}; font-size:16px; line-height:1; font-weight:950; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .quiz-topbar-stat svg { position:absolute; top:5px; right:6px; width:14px; height:14px; color:${QUIZ_GOLD_DARK}; }
      .quiz-topbar-stat[data-tone="score"] { border-color:${QUIZ_GOLD_DARK} !important; box-shadow:0 2px 0 ${QUIZ_GOLD_DARK}; }
      .quiz-topbar-stat[data-tone="round"] { background:${QUIZ_CARD} !important; }
      .quiz-topbar-stat[data-tone="round"] .quiz-stat-value { color:${QUIZ_ACCENT}; }
      .quiz-topbar-stat[data-tone="best"] { opacity:.78; }
      .quiz-choice-button { transition:background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out, transform 120ms ease-out; }
      .quiz-choice-button:hover { border-color:${QUIZ_ACCENT} !important; color:${QUIZ_ACCENT} !important; }
      .quiz-choice-button:active { transform:translateY(2px); }
      #quiz-difficulty-popover { animation:quizPopoverIn 180ms cubic-bezier(.22,1,.36,1); }
      @keyframes quizPopoverIn { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }
      @media (max-width:430px) {
        #quiz-topbar .quiz-action-label { display:none; }
        #quiz-topbar { gap:5px !important; grid-template-columns:auto minmax(0,1fr) auto !important; }
        #quiz-topbar .quiz-topbar-action, #quiz-topbar #quiz-settings-button { width:44px; padding:0 !important; }
        #quiz-topbar .quiz-topbar-tools { gap:3px; }
        .quiz-topbar-stats { gap:4px; }
        .quiz-scoreboard { gap:3px; }
        .quiz-topbar-stat { min-width:44px; min-height:44px; padding:5px 5px !important; }
        .quiz-topbar-stat .quiz-stat-label { font-size:9px !important; }
        .quiz-topbar-stat .quiz-stat-value { font-size:13px !important; }
        .quiz-topbar-stat svg { width:12px; height:12px; right:4px; }
        .quiz-topbar-identity { min-width:42px; width:42px; justify-content:center; padding:6px; }
        .quiz-topbar-identity span { display:none; }
        .quiz-topbar-stat[data-tone="best"] { display:none; }
      }
      @media (max-width:360px) {
        #quiz-topbar { gap:3px !important; }
        #quiz-topbar .quiz-topbar-stat { min-width:41px; padding-left:4px !important; padding-right:4px !important; }
      }
      @media (prefers-reduced-motion:reduce) {
        #quiz-topbar *, #quiz-difficulty-popover { transition:none !important; animation:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  private _actionButton(icon: string, label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-topbar-action';
    button.innerHTML = `${icon}<span class="quiz-action-label">${this._escape(label)}</span>`;
    button.setAttribute('aria-label', label);
    button.style.cssText = this._actionButtonStyle();
    button.addEventListener('click', (event) => {
      event.preventDefault();
      sfx.play('ui');
      action();
    });
    return button;
  }

  private _buildSettingsButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'quiz-settings-button';
    button.setAttribute('aria-controls', 'quiz-difficulty-popover');
    button.setAttribute('aria-expanded', 'false');
    button.style.cssText = this._actionButtonStyle();
    button.addEventListener('click', (event) => {
      event.preventDefault();
      sfx.play('ui');
      this._setPopoverOpen(this.popoverEl.hidden);
    });
    return button;
  }

  private _actionButtonStyle(): string {
    return [
      'min-width:44px', 'height:44px', 'padding:0 10px', 'display:inline-flex',
      'align-items:center', 'justify-content:center', 'gap:6px',
      'flex:none', 'box-sizing:border-box', `background:${QUIZ_YELLOW}`, `border:2px solid ${QUIZ_GOLD_DARK}`, `border-radius:${QUIZ_RADIUS_SM}`,
      `color:${QUIZ_INK}`, `font-family:${UI_FONT}`, 'font-size:12px', 'font-weight:700',
      'cursor:pointer', 'touch-action:manipulation', 'pointer-events:auto',
      `box-shadow:${QUIZ_SHADOW_LIFT}`,
      'transition:background 180ms cubic-bezier(.22,1,.36,1),color 180ms cubic-bezier(.22,1,.36,1),transform 120ms ease-out',
    ].join(';');
  }

  private _stat(label: string, value: string, icon: string, bg: string, fg: string, tone: 'round' | 'score' | 'streak' | 'best'): HTMLDivElement {
    const stat = document.createElement('div');
    stat.className = 'quiz-topbar-stat';
    stat.style.cssText = [
      'padding:5px 9px', `background:${bg}`, `color:${fg}`,
      `border:2px solid ${tone === 'score' ? QUIZ_GOLD_DARK : 'rgba(106,61,8,.26)'}`, `border-radius:${QUIZ_RADIUS_SM}`,
      'box-sizing:border-box',
    ].join(';');
    stat.dataset.tone = tone;
    stat.innerHTML = `${icon}<span class="quiz-stat-label">${this._escape(label)}</span><span class="quiz-stat-value">${this._escape(value)}</span>`;
    return stat;
  }

  private _buildPopover(): HTMLDivElement {
    const popover = document.createElement('div');
    popover.id = 'quiz-difficulty-popover';
    popover.hidden = true;
    popover.setAttribute('role', 'group');
    popover.setAttribute('aria-label', t('quiz.difficulty'));
    popover.style.cssText = [
      'position:fixed', 'z-index:80', 'width:min(320px,calc(100vw - 28px))', 'max-height:calc(100vh - 96px)', 'overflow:auto', 'padding:12px',
      `background:${QUIZ_CARD}`, `border:2px solid ${QUIZ_BORDER}`,
      `border-radius:${QUIZ_RADIUS_SM}`, `box-shadow:${QUIZ_SHADOW}`,
      `font-family:${UI_FONT}`, `color:${QUIZ_INK}`, 'box-sizing:border-box',
    ].join(';');

    popover.appendChild(this._groupLabel(t('quiz.standard')));
    const standardGroup = this._buttonGroup();
    for (const standard of STANDARDS) {
      const button = this._choiceButton(standard === 'cefr' ? t('quiz.stdCefr') : t('quiz.stdFreq'));
      button.addEventListener('click', () => this._choose(this.tier, standard));
      this.stdBtns.set(standard, button);
      standardGroup.appendChild(button);
    }
    popover.appendChild(standardGroup);

    popover.appendChild(this._groupLabel(t('quiz.tier')));
    const tierGroup = this._buttonGroup();
    for (const tier of TIERS) {
      const button = this._choiceButton(t(TIER_I18N_KEY[tier]));
      button.addEventListener('click', () => this._choose(tier, this.standard));
      this.tierBtns.set(tier, button);
      tierGroup.appendChild(button);
    }
    popover.appendChild(tierGroup);

    popover.appendChild(this._groupLabel(t('settings.language')));
    const languageGroup = this._buttonGroup();
    for (const language of ['zh', 'en'] as const) {
      const button = this._choiceButton(language === 'zh' ? t('settings.langZh') : t('settings.langEn'));
      button.addEventListener('click', () => this._chooseLanguage(language));
      this.languageBtns.set(language, button);
      languageGroup.appendChild(button);
    }
    popover.appendChild(languageGroup);

    // A1 基础题过滤开关
    popover.appendChild(this._groupLabel(t('quiz.filterBasic')));
    const filterBasicRow = document.createElement('div');
    filterBasicRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
    const filterBasicLabel = document.createElement('span');
    filterBasicLabel.style.cssText = `flex:1;font-size:12px;font-weight:700;color:${QUIZ_INK_SOFT}`;
    filterBasicLabel.textContent = this.filterBasic ? t('quiz.filterBasicOn') : t('quiz.filterBasicOff');
    filterBasicRow.appendChild(filterBasicLabel);
    const filterBasicToggle = this._buildToggle(this.filterBasic, (next) => {
      this.filterBasic = next;
      filterBasicLabel.textContent = next ? t('quiz.filterBasicOn') : t('quiz.filterBasicOff');
      sfx.play('ui');
      this.cb.onFilterBasicChange(next);
    });
    filterBasicRow.appendChild(filterBasicToggle);
    popover.appendChild(filterBasicRow);

    const seedButton = this._choiceButton(t('quiz.resetSeed'));
    seedButton.innerHTML = `${ICON_RESET}<span>${this._escape(t('quiz.resetSeed'))}</span>`;
    seedButton.style.display = 'flex';
    seedButton.style.alignItems = 'center';
    seedButton.style.justifyContent = 'center';
    seedButton.style.gap = '6px';
    seedButton.style.flex = 'none';
    seedButton.style.width = '100%';
    seedButton.addEventListener('click', () => {
      sfx.play('ui');
      this._setPopoverOpen(false);
      this.cb.onSeedReset();
    });
    popover.appendChild(seedButton);
    return popover;
  }

  private _groupLabel(label: string): HTMLDivElement {
    const element = document.createElement('div');
    element.textContent = label;
    element.style.cssText = `margin:4px 0 6px;color:${QUIZ_INK_SOFT};font-size:12px;font-weight:700`;
    return element;
  }

  private _buttonGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.style.cssText = 'display:flex;gap:6px;margin-bottom:8px';
    return group;
  }

  private _choiceButton(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-choice-button';
    button.textContent = label;
    button.style.cssText = [
      'flex:1', 'min-height:44px', 'padding:6px 8px', `background:${QUIZ_CARD}`,
      `border:2px solid ${QUIZ_BORDER}`, `border-radius:${QUIZ_RADIUS_SM}`,
      `color:${QUIZ_INK_SOFT}`, `font-family:${UI_FONT}`, 'font-size:12px',
      'font-weight:800', 'cursor:pointer', 'touch-action:manipulation', 'box-sizing:border-box',
    ].join(';');
    return button;
  }

  private _choose(tier: DifficultyTier, standard: DifficultyStandard): void {
    const changed = tier !== this.tier || standard !== this.standard;
    this.tier = tier;
    this.standard = standard;
    this._syncDifficulty();
    this._setPopoverOpen(false);
    this.settingsButton.focus();
    if (changed) {
      sfx.play('ui');
      this.cb.onDifficulty(tier, standard);
    }
  }

  private _chooseLanguage(language: Lang): void {
    if (language === this.language) return;
    this.language = language;
    setLang(language);
    this._syncDifficulty();
    this._setPopoverOpen(false);
    this.settingsButton.focus();
    this.cb.onLanguage(language);
  }

  private _syncDifficulty(): void {
    const standardLabel = this.standard === 'cefr' ? t('quiz.stdCefr') : t('quiz.stdFreq');
    this.settingsButton.innerHTML = ICON_SETTINGS;
    this.settingsButton.setAttribute('aria-label', `${t('quiz.settings')}：${standardLabel} · ${t(TIER_I18N_KEY[this.tier])}`);
    for (const [standard, button] of this.stdBtns) {
      const selected = standard === this.standard;
      button.style.background = selected ? QUIZ_ACCENT : QUIZ_CARD;
      button.style.color = selected ? '#ffffff' : QUIZ_INK_SOFT;
      button.setAttribute('aria-pressed', String(selected));
    }
    for (const [tier, button] of this.tierBtns) {
      const selected = tier === this.tier;
      const colors = QUIZ_TIER_STYLES[tier]!;
      button.style.background = selected ? colors.bg : QUIZ_CARD;
      button.style.color = selected ? colors.fg : QUIZ_INK_SOFT;
      button.setAttribute('aria-pressed', String(selected));
    }
    for (const [language, button] of this.languageBtns) {
      const selected = language === this.language;
      button.style.background = selected ? QUIZ_ACCENT : QUIZ_CARD;
      button.style.color = selected ? '#ffffff' : QUIZ_INK_SOFT;
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  private _setPopoverOpen(open: boolean): void {
    this.popoverEl.hidden = !open;
    this.settingsButton.setAttribute('aria-expanded', String(open));
    if (open) {
      this._positionPopover();
      const selected = this.stdBtns.get(this.standard);
      window.requestAnimationFrame(() => selected?.focus());
    }
  }

  private _positionPopover(): void {
    const anchor = this.settingsButton.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 28);
    const left = Math.min(window.innerWidth - width - 14, Math.max(14, anchor.right - width));
    this.popoverEl.style.left = `${left}px`;
    this.popoverEl.style.top = `${anchor.bottom + 6}px`;
  }

  /** toggle 开关组件：拨片位移 + 背景变化（与设置页 toggle 同语义，简易模式无注入样式） */
  private _buildToggle(checked: boolean, onToggle: (next: boolean) => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'switch';
    btn.className = 'quiz-toggle';
    btn.setAttribute('aria-label', t('quiz.filterBasic'));
    btn.setAttribute('aria-checked', String(checked));
    btn.style.cssText = [
      'position:relative', 'width:52px', 'height:44px', 'flex:none', 'padding:0',
      'border:0', 'border-radius:999px', 'background:transparent',
      'cursor:pointer', 'touch-action:manipulation', 'display:inline-flex',
      'align-items:center', 'justify-content:center',
    ].join(';');
    const track = document.createElement('span');
    track.className = 'quiz-toggle-track';
    track.style.cssText = [
      'position:relative', 'width:44px', 'height:26px', `border:2px solid ${QUIZ_BORDER}`,
      'border-radius:999px', `background:${checked ? QUIZ_ACCENT : QUIZ_CARD}`,
      'transition:background 180ms ease', 'box-sizing:border-box',
    ].join(';');
    const thumb = document.createElement('span');
    thumb.style.cssText = [
      'position:absolute', 'top:50%', 'left:2px', 'width:18px', 'height:18px',
      `border-radius:50%`, `background:${QUIZ_CARD}`, `transform:translateY(-50%)`,
      `transition:transform 200ms cubic-bezier(.22,1,.36,1)`,
      checked ? `transform:translateY(-50%) translateX(20px)` : '',
      'box-shadow:0 2px 4px rgba(0,0,0,0.3)',
    ].join(';');
    track.appendChild(thumb);
    btn.appendChild(track);
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      track.style.background = next ? QUIZ_ACCENT : QUIZ_CARD;
      thumb.style.transform = next ? 'translateY(-50%) translateX(20px)' : 'translateY(-50%)';
      onToggle(next);
    });
    return btn;
  }

  private _escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]!));
  }
}
