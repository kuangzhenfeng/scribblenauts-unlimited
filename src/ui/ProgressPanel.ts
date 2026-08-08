/**
 * 挑战进度 HUD —— 顶部中轴的舞台槽位。
 * API 不变：setLevel(challenges) / render(starites, shards, completed)。
 * 资源数量仍由 Hud 展示，这里只把挑战完成状态做成一组可读的槽位。
 */

import { ICON_MAXWELL, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_TOP, UI_FONT } from './paperStyle';
import { getLang, t } from '@/core/i18n/I18n';
import { STORY_CURSE_BREAK_STARITES, type LilyCondition } from '@/core/game/StoryProgress';

const PROGRESS_STYLE_ID = 'progress-layout-style';
const GOLD_DARK = '#6a3d08';

function ensureStyle(): void {
  if (document.getElementById(PROGRESS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PROGRESS_STYLE_ID;
  style.textContent = `
    #progress {
      display:flex;
      align-items:center;
      gap:8px;
      box-sizing:border-box;
      min-height:50px;
      padding:6px 11px 6px 8px;
      color:${INK};
      font-family:${UI_FONT};
      background:${PAPER_BG};
      border:2px solid ${GOLD_DARK};
      border-radius:14px;
      box-shadow:0 2px 0 ${GOLD_DARK},${PAPER_SHADOW};
      user-select:none;
    }
    #progress .progress__identity {
      display:flex;
      align-items:center;
      gap:7px;
      flex:none;
    }
    #progress .progress__portrait {
      display:grid;
      place-items:center;
      width:34px;
      height:34px;
      box-sizing:border-box;
      border:2px solid ${GOLD_DARK};
      border-radius:50%;
      color:#c92c24;
      background:${PAPER_BG_ALT};
    }
    #progress .progress__portrait svg { width:24px; height:24px; }
    #progress .progress__summary {
      display:flex;
      flex-direction:column;
      gap:1px;
      line-height:1;
    }
    #progress .progress__label {
      color:#805000;
      font-size:10px;
      font-weight:900;
      letter-spacing:.11em;
      text-transform:uppercase;
    }
    #progress .progress__counter {
      color:${INK};
      font-size:15px;
      font-weight:900;
      letter-spacing:.02em;
    }
    #progress .progress__arrow {
      color:#805000;
      font-size:18px;
      font-weight:900;
      line-height:1;
    }
    #progress .progress__story {
      display:flex;
      flex-direction:column;
      gap:2px;
      min-width:76px;
      padding:0 7px;
      border-left:1px solid rgba(106,61,8,.22);
      border-right:1px solid rgba(106,61,8,.22);
      line-height:1;
    }
    #progress .progress__story-label {
      color:#805000;
      font-size:9px;
      font-weight:950;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    #progress .progress__story-count {
      color:${INK};
      font-size:13px;
      font-weight:950;
    }
    #progress .progress__story-state {
      color:#766c5b;
      font-size:9px;
      font-weight:850;
    }
    #progress .progress__slots {
      display:flex;
      align-items:center;
      gap:2px;
      min-width:0;
      padding:3px 5px;
      border-radius:9px;
      background:rgba(240,189,60,.22);
    }
    #progress .progress__slot {
      display:grid;
      place-items:center;
      width:28px;
      height:32px;
      color:#a05a00;
    }
    #progress .progress__slot svg { width:23px; height:23px; }
    #progress .progress__slot.is-filled { color:#d88a00; }
    #progress .progress__slot.is-filled svg { filter:drop-shadow(0 0 4px rgba(245,197,24,.58)); }
    #progress .progress__toast {
      display:inline-flex;
      align-items:center;
      gap:5px;
      min-height:34px;
      padding:0 7px;
      color:#3d2200;
      font-size:13px;
      font-weight:900;
    }
    #progress .progress__toast svg { width:18px; height:18px; }
    @media (max-width:600px) {
      #progress { top:68px!important; min-height:44px; gap:5px; padding:4px 7px; }
      #progress .progress__portrait { width:29px; height:29px; }
      #progress .progress__portrait svg { width:21px; height:21px; }
      #progress .progress__label { font-size:8px; letter-spacing:.08em; }
      #progress .progress__counter { font-size:13px; }
      #progress .progress__story { min-width:60px; padding-inline:5px; }
      #progress .progress__story-state { display:none; }
      #progress .progress__slot { width:23px; height:27px; }
      #progress .progress__slot svg { width:19px; height:19px; }
    }
    @media (prefers-reduced-motion:reduce) {
      #progress { transform:translateX(-50%); }
    }
  `;
  document.head.appendChild(style);
}

function starSlot(filled: boolean): string {
  return `<span class="progress__slot${filled ? ' is-filled' : ''}" aria-hidden="true">${ICON_STAR}</span>`;
}

export interface StoryStatus {
  starites: number;
  target: number;
  lilyCondition: LilyCondition;
}

export class ProgressPanel {
  private readonly el: HTMLDivElement;
  private challenges: { id: string }[] = [];
  private completedIds: string[] = [];
  private starites = 0;
  private shards = 0;
  private story: StoryStatus = {
    starites: 0,
    target: STORY_CURSE_BREAK_STARITES,
    lilyCondition: 'petrified',
  };
  private toastTimer = 0;

  constructor() {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'progress';
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuenow', '0');
    this.el.setAttribute('aria-valuemax', '3');
    this.el.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:49',
      'pointer-events:none',
      'max-width:calc(100vw - 32px)',
      'white-space:nowrap',
      'overflow:hidden',
    ].join(';');
    document.body.appendChild(this.el);
    this.redraw();
  }

  /** 设置当前关卡挑战列表（换关时调用） */
  setLevel(challenges: { id: string }[]): void {
    this.challenges = challenges;
    this.completedIds = [];
    this.redraw();
  }

  render(starites: number, shards: number, completed: string[] = []): void {
    this.starites = starites;
    this.shards = shards;
    this.completedIds = completed;
    this.redraw();
  }

  /** 设置 Lily 主线状态；与关卡挑战槽位分开渲染。 */
  setStoryStatus(status: StoryStatus): void {
    this.story = { ...status };
    this.redraw();
  }

  private redraw(): void {
    // 没有关卡挑战时保留 3 个空槽，避免顶栏在加载阶段跳动。
    const list = this.challenges.length > 0 ? this.challenges : [{ id: '' }, { id: '' }, { id: '' }];
    const completedCount = list.filter((challenge) => challenge.id !== '' && this.completedIds.includes(challenge.id)).length;
    const stars = list.map((challenge) => starSlot(challenge.id !== '' && this.completedIds.includes(challenge.id))).join('');
    const completedLabel = t('levelSelect.completed');
    const resourceLabels = getLang() === 'zh'
      ? { starites: 'Starite', shards: '碎片' }
      : { starites: 'Starites', shards: 'Shards' };
    const lilyState = this.story.lilyCondition === 'cured' ? t('story.cured') : t('story.petrified');
    const storyAria = t('story.progressAria', {
      current: this.story.starites,
      target: this.story.target,
      state: lilyState,
    });

    this.el.setAttribute('aria-valuenow', String(completedCount));
    this.el.setAttribute('aria-valuemax', String(list.length));
    this.el.setAttribute(
      'aria-label',
      `${t('settings.dataDesc')}: ${completedCount}/${list.length}; ${this.starites} ${resourceLabels.starites}, ${this.shards} ${resourceLabels.shards}; ${storyAria}`,
    );
    this.el.innerHTML =
      `<div class="progress__identity">
        <div class="progress__portrait" aria-hidden="true">${ICON_MAXWELL}</div>
        <div class="progress__summary">
          <span class="progress__label">${completedLabel}</span>
          <span class="progress__counter">${completedCount} / ${list.length}</span>
        </div>
      </div>
      <span class="progress__arrow" aria-hidden="true">›</span>
      <div class="progress__story" aria-label="${storyAria}">
        <span class="progress__story-label">${t('story.lily')}</span>
        <span class="progress__story-count">${this.story.starites}/${this.story.target}</span>
        <span class="progress__story-state">${lilyState}</span>
      </div>
      <span class="progress__arrow" aria-hidden="true">›</span>
      <div class="progress__slots" aria-hidden="true">${stars}</div>`;
  }

  toast(msg: string): void {
    clearTimeout(this.toastTimer);

    const prev = this.el.innerHTML;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      this.el.style.transition = 'transform 0.16s ease';
      this.el.style.transform = 'translateX(-50%) scale(1.04)';
      window.setTimeout(() => { this.el.style.transform = 'translateX(-50%)'; }, 170);
    }

    const toast = document.createElement('span');
    toast.className = 'progress__toast';
    toast.innerHTML = ICON_STAR;
    toast.appendChild(document.createTextNode(msg));
    this.el.replaceChildren(toast);

    this.toastTimer = window.setTimeout(() => {
      this.el.innerHTML = prev;
      this.redraw();
    }, 2200);
  }
}
