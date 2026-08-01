/**
 * Merit Board —— 关卡挑战进度面板。
 *
 * 只消费宿主传入的挑战和完成集合，不自行读写存档；update() 可在挑战完成后直接刷新。
 */

import { ICON_CHECK, ICON_CLOSE, ICON_SHARD, ICON_STAR, ICON_TROPHY } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, TORN_EDGE, UI_FONT } from './paperStyle';

export interface MeritChallenge {
  id: string;
  title?: string;
  description?: string;
  hint?: string;
  reward: { type: 'shard' | 'starite'; count: number };
}

export type MeritCompletionState = ReadonlySet<string> | readonly string[];

export interface MeritCompletion {
  completed: number;
  total: number;
  percentage: number;
}

export interface MeritBoardLabels {
  title: string;
  hint: string;
  close: string;
  task: string;
  reward: string;
  hintLabel: string;
  completed: string;
  pending: string;
  empty: string;
  completion: string;
  shard: string;
  starite: string;
}

export interface MeritBoardOptions {
  challenges: readonly MeritChallenge[];
  completedChallengeIds: MeritCompletionState;
  levelTitle?: string;
  onClose?: () => void;
  labels?: Partial<MeritBoardLabels>;
}

const DEFAULT_LABELS: MeritBoardLabels = {
  title: '挑战面板',
  hint: '查看当前区域的挑战、奖励和提示',
  close: '关闭挑战面板',
  task: '挑战',
  reward: '奖励',
  hintLabel: '提示',
  completed: '已完成',
  pending: '待完成',
  empty: '当前区域还没有挑战',
  completion: '完成率',
  shard: '碎片',
  starite: 'Starite',
};

let instanceCount = 0;

function toSet(values: MeritCompletionState): Set<string> {
  return values instanceof Set ? new Set(values) : new Set(values);
}

export function calculateMeritCompletion(
  challenges: readonly MeritChallenge[],
  completedChallengeIds: MeritCompletionState,
): MeritCompletion {
  const completed = toSet(completedChallengeIds);
  const total = challenges.length;
  const completedCount = challenges.reduce((count, challenge) => count + (completed.has(challenge.id) ? 1 : 0), 0);
  return {
    completed: completedCount,
    total,
    percentage: total === 0 ? 0 : Math.round((completedCount / total) * 100),
  };
}

function rewardText(challenge: MeritChallenge, labels: MeritBoardLabels): string {
  const name = challenge.reward.type === 'starite' ? labels.starite : labels.shard;
  return `${Math.max(0, challenge.reward.count)} ${name}`;
}

export class MeritBoard {
  private readonly el: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly levelEl: HTMLDivElement;
  private readonly completionLabelEl: HTMLDivElement;
  private readonly completionBarEl: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly labels: MeritBoardLabels;
  private readonly onClose?: () => void;
  private readonly keyListener: (event: KeyboardEvent) => void;
  private challenges: readonly MeritChallenge[];
  private completedChallengeIds: Set<string>;
  private levelTitle: string | undefined;
  private open = false;

  constructor(options: MeritBoardOptions) {
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.onClose = options.onClose;
    this.challenges = options.challenges;
    this.completedChallengeIds = toSet(options.completedChallengeIds);
    this.levelTitle = options.levelTitle;

    instanceCount += 1;
    const titleId = `merit-board-title-${instanceCount}`;
    this.el = document.createElement('div');
    this.el.className = 'merit-board';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', titleId);
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:165',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:clamp(12px,3vw,30px)',
      'box-sizing:border-box',
      'background:rgba(45,34,18,0.54)',
      'font-family:' + UI_FONT,
      'color:' + INK,
      'pointer-events:auto',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      .merit-board__panel {
        position:relative;display:flex;flex-direction:column;gap:14px;
        width:min(760px,100%);max-height:100%;box-sizing:border-box;padding:clamp(18px,3vw,30px);
        background:${PAPER_BG};box-shadow:${PAPER_SHADOW};${TORN_EDGE};overflow:auto;
      }
      .merit-board__header { display:flex;align-items:flex-start;gap:12px; }
      .merit-board__badge { display:grid;place-items:center;width:34px;height:34px;flex:none;color:#fff8dd;background:#3d2200;border-radius:9px; }
      .merit-board__heading { min-width:0;flex:1; }
      .merit-board__title { margin:0;font-size:clamp(24px,4vw,34px);font-weight:900;line-height:1.1;letter-spacing:.04em; }
      .merit-board__hint { margin-top:5px;color:#5a554c;font-size:14px;line-height:1.4; }
      .merit-board__level { margin-top:1px;color:#8a5300;font-size:13px;font-weight:800; }
      .merit-board__close { width:42px;height:42px;padding:8px;display:grid;place-items:center;color:${INK};background:${PAPER_BG_ALT};border:2px solid #6a3d08;border-radius:10px;cursor:pointer;transition:transform .16s ease,filter .16s ease; }
      .merit-board__close:hover,.merit-board__close:focus-visible { transform:translateY(-1px);filter:brightness(1.06); }
      .merit-board__summary { display:flex;align-items:center;gap:12px;padding:10px 12px;background:${PAPER_BG_ALT};border-radius:8px; }
      .merit-board__summary-icon { display:grid;place-items:center;width:30px;height:30px;color:#a05a00;flex:none; }
      .merit-board__summary-copy { min-width:0;flex:1; }
      .merit-board__completion-label { display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:900; }
      .merit-board__meter { height:9px;margin-top:6px;overflow:hidden;background:#d8ccb3;border-radius:99px; }
      .merit-board__meter-fill { height:100%;background:#d49b20;border-radius:inherit;transition:width .2s ease; }
      .merit-board__list { display:flex;flex-direction:column;gap:9px;min-height:0; }
      .merit-board__empty { padding:26px 14px;text-align:center;color:#5a554c;background:${PAPER_BG_ALT};border-radius:8px; }
      .merit-board__item { display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px 13px;background:#fbf7ec;border:2px solid #c2b494;border-radius:9px; }
      .merit-board__item[data-completed="true"] { background:#edf5df;border-color:#83a66b; }
      .merit-board__item-status { display:grid;place-items:center;width:28px;height:28px;color:#6a3d08;background:#e7dcc4;border-radius:50%; }
      .merit-board__item[data-completed="true"] .merit-board__item-status { color:#fff8dd;background:#3f9a43; }
      .merit-board__item-copy { min-width:0; }
      .merit-board__item-title { font-size:16px;font-weight:900;line-height:1.25; }
      .merit-board__item-description { margin-top:4px;color:#4f4a40;font-size:13px;line-height:1.45; }
      .merit-board__item-hint { margin-top:7px;padding:6px 8px;color:#6a5b39;background:#f6edc9;border-radius:6px;font-size:12px;line-height:1.35; }
      .merit-board__item-state { margin-top:5px;color:#5a554c;font-size:11px;font-weight:800; }
      .merit-board__reward { display:flex;align-items:center;gap:4px;min-width:68px;justify-content:flex-end;color:#8a5300;font-size:12px;font-weight:900;text-align:right; }
      .merit-board__reward-icon { display:grid;place-items:center;width:20px;height:20px; }
      .merit-board button:focus-visible { outline:3px solid #f0bd3c;outline-offset:3px; }
      @media (max-width:560px) {
        .merit-board__panel { padding:16px 14px;gap:11px; }
        .merit-board__item { grid-template-columns:28px minmax(0,1fr); }
        .merit-board__reward { grid-column:2;justify-content:flex-start;text-align:left; }
      }
      @media (prefers-reduced-motion:reduce) {
        .merit-board__close,.merit-board__meter-fill { transition:none; }
      }
    `;
    this.el.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'merit-board__panel';
    panel.addEventListener('click', (event) => event.stopPropagation());

    const header = document.createElement('div');
    header.className = 'merit-board__header';
    const badge = document.createElement('div');
    badge.className = 'merit-board__badge';
    badge.innerHTML = ICON_TROPHY;
    const heading = document.createElement('div');
    heading.className = 'merit-board__heading';
    this.titleEl = document.createElement('h2');
    this.titleEl.id = titleId;
    this.titleEl.className = 'merit-board__title';
    this.titleEl.textContent = this.labels.title;
    const hint = document.createElement('div');
    hint.className = 'merit-board__hint';
    hint.textContent = this.labels.hint;
    this.levelEl = document.createElement('div');
    this.levelEl.className = 'merit-board__level';
    heading.append(this.titleEl, hint, this.levelEl);
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'merit-board__close';
    this.closeButton.innerHTML = ICON_CLOSE;
    this.closeButton.title = this.labels.close;
    this.closeButton.setAttribute('aria-label', this.labels.close);
    this.closeButton.addEventListener('click', () => this.close());
    header.append(badge, heading, this.closeButton);

    const summary = document.createElement('div');
    summary.className = 'merit-board__summary';
    const summaryIcon = document.createElement('div');
    summaryIcon.className = 'merit-board__summary-icon';
    summaryIcon.innerHTML = ICON_STAR;
    const summaryCopy = document.createElement('div');
    summaryCopy.className = 'merit-board__summary-copy';
    this.completionLabelEl = document.createElement('div');
    this.completionLabelEl.className = 'merit-board__completion-label';
    this.completionBarEl = document.createElement('div');
    this.completionBarEl.className = 'merit-board__meter-fill';
    this.completionBarEl.setAttribute('role', 'progressbar');
    this.completionBarEl.setAttribute('aria-valuemin', '0');
    this.completionBarEl.setAttribute('aria-valuemax', '100');
    const meter = document.createElement('div');
    meter.className = 'merit-board__meter';
    meter.appendChild(this.completionBarEl);
    summaryCopy.append(this.completionLabelEl, meter);
    summary.append(summaryIcon, summaryCopy);

    this.listEl = document.createElement('div');
    this.listEl.className = 'merit-board__list';
    this.listEl.setAttribute('role', 'list');

    panel.append(header, summary, this.listEl);
    this.el.appendChild(panel);
    this.el.addEventListener('click', () => this.close());
    this.el.style.display = 'none';
    this.keyListener = (event) => {
      if (!this.open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        return;
      }
      const target = event.target;
      if (!(target instanceof Node) || !this.el.contains(target)) return;
    };
    window.addEventListener('keydown', this.keyListener);
    document.body.appendChild(this.el);
    this.render();
  }

  get element(): HTMLDivElement {
    return this.el;
  }

  get isOpen(): boolean {
    return this.open;
  }

  get completion(): MeritCompletion {
    return calculateMeritCompletion(this.challenges, this.completedChallengeIds);
  }

  /** 更新挑战和完成状态；完成集合由宿主维护，本组件不会持久化。 */
  update(challenges: readonly MeritChallenge[], completedChallengeIds: MeritCompletionState): void {
    this.challenges = challenges;
    this.completedChallengeIds = toSet(completedChallengeIds);
    this.render();
  }

  setCompleted(completedChallengeIds: MeritCompletionState): void {
    this.completedChallengeIds = toSet(completedChallengeIds);
    this.render();
  }

  setLevelTitle(levelTitle: string | undefined): void {
    this.levelTitle = levelTitle;
    this.render();
  }

  show(): void {
    this.open = true;
    this.el.style.display = 'flex';
    this.closeButton.focus();
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.open = false;
    window.removeEventListener('keydown', this.keyListener);
    this.el.remove();
  }

  private render(): void {
    const completion = this.completion;
    this.levelEl.textContent = this.levelTitle ? `当前区域：${this.levelTitle}` : '';
    this.completionLabelEl.textContent = `${this.labels.completion} ${completion.completed}/${completion.total} · ${completion.percentage}%`;
    this.completionBarEl.style.width = `${completion.percentage}%`;
    this.completionBarEl.setAttribute('aria-valuenow', String(completion.percentage));
    this.listEl.innerHTML = '';

    if (this.challenges.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'merit-board__empty';
      empty.textContent = this.labels.empty;
      this.listEl.appendChild(empty);
      return;
    }

    this.challenges.forEach((challenge, index) => {
      const done = this.completedChallengeIds.has(challenge.id);
      const item = document.createElement('div');
      item.className = 'merit-board__item';
      item.dataset.completed = String(done);
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `${this.labels.task} ${index + 1}: ${challenge.title ?? challenge.id}`);

      const status = document.createElement('div');
      status.className = 'merit-board__item-status';
      status.innerHTML = done ? ICON_CHECK : ICON_STAR;

      const copy = document.createElement('div');
      copy.className = 'merit-board__item-copy';
      const title = document.createElement('div');
      title.className = 'merit-board__item-title';
      title.textContent = challenge.title ?? `${this.labels.task} ${index + 1}`;
      const description = document.createElement('div');
      description.className = 'merit-board__item-description';
      description.textContent = challenge.description ?? '';
      description.style.display = challenge.description ? 'block' : 'none';
      const hint = document.createElement('div');
      hint.className = 'merit-board__item-hint';
      hint.textContent = `${this.labels.hintLabel}：${challenge.hint ?? ''}`;
      hint.style.display = challenge.hint ? 'block' : 'none';
      const state = document.createElement('div');
      state.className = 'merit-board__item-state';
      state.textContent = done ? this.labels.completed : this.labels.pending;
      copy.append(title, description, hint, state);

      const reward = document.createElement('div');
      reward.className = 'merit-board__reward';
      const rewardIcon = document.createElement('span');
      rewardIcon.className = 'merit-board__reward-icon';
      rewardIcon.innerHTML = challenge.reward.type === 'starite' ? ICON_STAR : ICON_SHARD;
      const rewardLabel = document.createElement('span');
      rewardLabel.textContent = rewardText(challenge, this.labels);
      reward.append(rewardIcon, rewardLabel);

      item.append(status, copy, reward);
      this.listEl.appendChild(item);
    });
  }

  private close(): void {
    if (!this.open) return;
    this.hide();
    this.onClose?.();
  }
}
