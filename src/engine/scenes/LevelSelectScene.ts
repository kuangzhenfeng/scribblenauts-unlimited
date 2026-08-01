/**
 * 选关场景 —— 用纸上路线表达关卡顺序、主题与解锁关系。
 *
 * 由标题页“选择关卡”按钮进入。展示 LevelManager.listLevels() 返回的全部关卡，
 * 按 SaveStore.unlockedLevels 判定解锁状态，按 completedSlots 判定完成状态。
 * 每个已解锁路线节点都可进入关卡；重置按钮与进入动作保持独立。
 */

import Phaser from 'phaser';
import { LevelManager } from '@/game/LevelManager';
import type { LevelData } from '@/core/types/level';
import { SaveStore } from '@/core/data/save/SaveStore';
import {
  INK,
  PAPER_BG,
  PAPER_BG_ALT,
  SAFE_BOTTOM,
  SAFE_LEFT,
  SAFE_RIGHT,
  SAFE_TOP,
  UI_FONT,
} from '@/ui/paperStyle';
import {
  ICON_ARROW_LEFT,
  ICON_FLAME,
  ICON_LOCK,
  ICON_PLAY,
  ICON_RESET,
  ICON_SHARD,
  ICON_SNOWFLAKE,
  ICON_STAR,
  ICON_SUN,
} from '@/ui/icons';
import { confirmDialog } from '@/ui/ConfirmDialog';
import { t, getLang, type Lang } from '@/core/i18n/I18n';

const LEVEL_SELECT_STYLE_ID = 'level-select-ui-style';

/** 主题 → 路线配色 + 图标 + 双语名 */
const THEME_META: Record<string, { color: string; icon: string; zh: string; en: string }> = {
  jungle: { color: '#3dac4a', icon: ICON_STAR, zh: '丛林草地', en: 'Jungle Meadow' },
  cave: { color: '#5a5a5a', icon: ICON_LOCK, zh: '洞穴探险', en: 'Cave Adventure' },
  snow: { color: '#b0d4e8', icon: ICON_SNOWFLAKE, zh: '雪原秘境', en: 'Snow Realm' },
  desert: { color: '#e6c36b', icon: ICON_SUN, zh: '沙漠迷城', en: 'Desert Maze' },
  volcano: { color: '#6b1a0a', icon: ICON_FLAME, zh: '火山熔炉', en: 'Volcano Forge' },
};

/** 关卡双语标题（按 id 映射，未命中时回退主题名） */
const LEVEL_TITLE: Record<string, { zh: string; en: string }> = {
  'overworld-meadow': { zh: '丛林草地', en: 'Jungle Meadow' },
  'stage-cave': { zh: '洞穴探险', en: 'Cave Adventure' },
  'stage-snow': { zh: '雪原秘境', en: 'Snow Realm' },
  'stage-desert': { zh: '沙漠迷城', en: 'Desert Maze' },
  'stage-volcano': { zh: '火山熔炉', en: 'Volcano Forge' },
};

/** 按当前语言取关卡标题，未命中 id 回退主题名 */
function levelTitleOf(levelId: string, theme: string): string {
  const entry = LEVEL_TITLE[levelId];
  const lang: Lang = getLang();
  if (entry) return entry[lang];
  const meta = THEME_META[theme];
  if (meta) return meta[lang];
  return levelId;
}

export class LevelSelectScene extends Phaser.Scene {
  private overlay!: HTMLDivElement;
  private route!: HTMLOListElement;
  private progressSummary!: HTMLDivElement;
  private difficultySummary!: HTMLDivElement;
  private readonly save = new SaveStore();

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#dfe9e2');
    this.events.once('shutdown', this.shutdown, this);
    this._ensureStyle();

    this.overlay = document.createElement('div');
    this.overlay.id = 'level-select-overlay';

    const shell = document.createElement('main');
    shell.className = 'level-select-shell';

    const nav = document.createElement('div');
    nav.className = 'level-select-nav';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'level-select-nav-button';
    back.innerHTML = `${ICON_ARROW_LEFT}<span></span>`;
    back.querySelector('span')!.textContent = t('common.back');
    back.setAttribute('aria-label', t('common.back'));
    back.addEventListener('click', (event) => {
      event.stopPropagation();
      this._backToTitle();
    });
    nav.appendChild(back);

    const resetAll = document.createElement('button');
    resetAll.type = 'button';
    resetAll.className = 'level-select-reset-all';
    resetAll.innerHTML = `${ICON_RESET}<span></span>`;
    resetAll.querySelector('span')!.textContent = t('levelSelect.resetAll');
    resetAll.setAttribute('aria-label', t('levelSelect.resetAll'));
    resetAll.addEventListener('click', async (event) => {
      event.stopPropagation();
      const ok = await confirmDialog({
        title: t('levelSelect.resetAllConfirmTitle'),
        message: t('levelSelect.resetAllConfirmMsg'),
        confirmText: t('levelSelect.resetAll'),
      });
      if (!ok) return;
      await this.save.resetAll();
      await this.renderCards();
    });
    nav.appendChild(resetAll);
    shell.appendChild(nav);

    const heading = document.createElement('header');
    heading.className = 'level-select-heading';
    const title = document.createElement('h1');
    title.textContent = t('levelSelect.title');
    heading.appendChild(title);
    const hint = document.createElement('p');
    hint.textContent = t('levelSelect.hint');
    heading.appendChild(hint);
    shell.appendChild(heading);

    const summary = document.createElement('div');
    summary.className = 'level-select-summary';
    this.progressSummary = document.createElement('div');
    this.progressSummary.className = 'level-select-progress-summary';
    this.difficultySummary = document.createElement('div');
    this.difficultySummary.className = 'level-select-difficulty-summary';
    summary.append(this.progressSummary, this.difficultySummary);
    shell.appendChild(summary);

    this.route = document.createElement('ol');
    this.route.className = 'level-select-route';
    shell.appendChild(this.route);

    this.overlay.appendChild(shell);
    document.body.appendChild(this.overlay);
    await this.renderCards();
  }

  private _ensureStyle(): void {
    if (document.getElementById(LEVEL_SELECT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LEVEL_SELECT_STYLE_ID;
    style.textContent = `
      #level-select-overlay {
        position:fixed;
        inset:0;
        z-index:100;
        pointer-events:none;
        overflow-y:auto;
        -webkit-overflow-scrolling:touch;
        background:#dfe9e2;
        color:${INK};
        font-family:${UI_FONT};
      }
      #level-select-overlay *, #level-select-overlay *::before, #level-select-overlay *::after { box-sizing:border-box; }
      .level-select-shell {
        width:min(1160px,100%);
        min-height:100%;
        margin:0 auto;
        padding:${SAFE_TOP} ${SAFE_RIGHT} ${SAFE_BOTTOM};
        pointer-events:auto;
      }
      .level-select-nav {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        min-height:56px;
      }
      .level-select-nav-button,
      .level-select-reset-all,
      .level-entry,
      .level-reset-button {
        appearance:none;
        -webkit-tap-highlight-color:transparent;
        font:inherit;
        cursor:pointer;
        transition:transform .16s ease,filter .16s ease,background-color .16s ease,box-shadow .16s ease;
      }
      .level-select-nav-button,
      .level-select-reset-all {
        min-height:46px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:9px 14px;
        border-radius:9px;
        font-size:15px;
        font-weight:900;
      }
      .level-select-nav-button {
        color:${INK};
        background:${PAPER_BG};
        border:2px solid ${INK};
        box-shadow:0 3px 0 rgba(43,43,43,.54);
      }
      .level-select-reset-all {
        color:#7e3018;
        background:${PAPER_BG};
        border:2px solid #a34b2c;
        box-shadow:0 3px 0 rgba(126,48,24,.36);
      }
      .level-select-heading { padding:24px 4px 8px; }
      .level-select-heading h1 {
        margin:0;
        font-size:42px;
        line-height:1.05;
        font-weight:950;
        letter-spacing:.02em;
        text-wrap:balance;
      }
      .level-select-heading p {
        max-width:68ch;
        margin:10px 0 0;
        color:#4f6257;
        font-size:15px;
        line-height:1.5;
      }
      .level-select-summary {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        flex-wrap:wrap;
        margin-top:18px;
        padding:13px 4px;
        border-top:2px solid rgba(62,91,72,.42);
        border-bottom:2px solid rgba(62,91,72,.42);
      }
      .level-select-progress-summary,
      .level-select-difficulty-summary {
        display:flex;
        align-items:center;
        gap:16px;
        flex-wrap:wrap;
      }
      .level-select-summary-metric {
        display:inline-flex;
        align-items:center;
        gap:6px;
        min-height:28px;
        color:#385343;
        font-size:14px;
        font-weight:900;
      }
      .level-select-summary-metric strong { color:${INK}; font-size:18px; line-height:1; }
      .level-select-difficulty-summary { justify-content:flex-end; color:#4f6257; font-size:13px; font-weight:850; }
      .level-select-route { position:relative; margin:28px 0 0; padding:0; list-style:none; }
      .level-route-item { display:grid; grid-template-columns:76px minmax(0,1fr); gap:18px; position:relative; min-height:132px; }
      .level-node-column { display:flex; flex-direction:column; align-items:center; min-height:100%; }
      .level-node {
        position:relative;
        z-index:1;
        width:54px;
        height:54px;
        display:grid;
        place-items:center;
        flex:none;
        margin-top:17px;
        color:#436050;
        background:#d5e0d8;
        border:2px solid #6f8878;
        border-radius:50%;
        font-size:18px;
        font-weight:950;
      }
      .level-node svg { width:20px; height:20px; }
      .level-route-connector { width:3px; flex:1; min-height:30px; margin:8px 0 0; background:#9db6a5; border-radius:999px; }
      .level-route-connector[data-open="false"] { opacity:.42; }
      .level-entry-frame { display:grid; grid-template-columns:minmax(0,1fr) 50px; align-items:center; gap:10px; min-width:0; padding-bottom:16px; }
      .level-entry {
        width:100%;
        min-height:116px;
        display:flex;
        flex-direction:column;
        gap:11px;
        padding:16px 18px 15px;
        text-align:left;
        color:${INK};
        background:rgba(247,241,227,.82);
        border:2px solid rgba(43,43,43,.24);
        border-radius:10px;
      }
      .level-route-item[data-current="true"] .level-entry { background:${PAPER_BG}; border-color:${INK}; box-shadow:5px 5px 0 var(--level-color); }
      .level-entry:disabled { cursor:not-allowed; filter:saturate(.58); opacity:.68; }
      .level-entry-top,
      .level-entry-body,
      .level-entry-theme,
      .level-entry-status,
      .level-entry-progress,
      .level-entry-action { display:flex; align-items:center; }
      .level-entry-top { justify-content:space-between; gap:14px; }
      .level-entry-theme { min-width:0; gap:8px; color:var(--level-color); font-size:13px; font-weight:950; letter-spacing:.03em; }
      .level-entry-theme svg { width:20px; height:20px; flex:none; }
      .level-entry-theme span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .level-entry-status { gap:5px; flex:none; color:#52685a; font-size:13px; font-weight:900; }
      .level-entry-status svg { width:17px; height:17px; }
      .level-entry-body { justify-content:space-between; gap:16px; min-width:0; }
      .level-entry-info { min-width:0; flex:1; display:flex; flex-direction:column; gap:8px; }
      .level-entry-number { color:#64776a; font-size:12px; font-weight:900; }
      .level-entry-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:23px; font-weight:950; letter-spacing:.02em; }
      .level-entry-progress { gap:8px; min-width:170px; color:#52685a; font-size:12px; font-weight:900; }
      .level-progress-track { height:7px; flex:1; min-width:70px; overflow:hidden; background:#d9dfd8; border-radius:999px; }
      .level-progress-fill { height:100%; background:var(--level-color); border-radius:inherit; }
      .level-entry-action {
        justify-content:center;
        gap:7px;
        flex:none;
        min-width:124px;
        min-height:42px;
        padding:8px 12px;
        color:#2f6242;
        background:#e4eee6;
        border:2px solid #5d866b;
        border-radius:8px;
        font-size:14px;
        font-weight:950;
      }
      .level-entry-action svg { width:17px; height:17px; }
      .level-reset-button {
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        padding:10px;
        color:#7e3018;
        background:${PAPER_BG};
        border:2px solid #a34b2c;
        border-radius:9px;
      }
      .level-reset-button:hover, .level-reset-button:focus-visible { background:${PAPER_BG_ALT}; }
      .level-select-nav-button:hover,
      .level-select-reset-all:hover,
      .level-entry:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.03); }
      .level-select-nav-button:active,
      .level-select-reset-all:active,
      .level-entry:active:not(:disabled),
      .level-reset-button:active { transform:translateY(2px); }
      .level-select-nav-button:focus-visible,
      .level-select-reset-all:focus-visible,
      .level-entry:focus-visible,
      .level-reset-button:focus-visible { outline:3px solid #fff; outline-offset:3px; }
      @media (max-width:720px) {
        .level-select-shell { padding-left:${SAFE_LEFT}; padding-right:${SAFE_RIGHT}; }
        .level-select-nav { align-items:flex-start; }
        .level-select-nav-button, .level-select-reset-all { min-height:44px; padding-inline:11px; }
        .level-select-nav-button span, .level-select-reset-all span { max-width:16vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .level-select-heading { padding-top:18px; }
        .level-select-heading h1 { font-size:32px; }
        .level-select-heading p { font-size:14px; }
        .level-select-summary { align-items:flex-start; gap:10px; }
        .level-select-progress-summary, .level-select-difficulty-summary { gap:10px; }
        .level-select-difficulty-summary { width:100%; justify-content:flex-start; }
        .level-route-item { grid-template-columns:48px minmax(0,1fr); gap:11px; min-height:0; }
        .level-node { width:42px; height:42px; margin-top:18px; font-size:15px; }
        .level-node svg { width:17px; height:17px; }
        .level-entry-frame { grid-template-columns:minmax(0,1fr) 46px; gap:8px; padding-bottom:13px; }
        .level-entry { min-height:0; padding:14px 13px; gap:10px; }
        .level-entry-top { align-items:flex-start; flex-direction:column; gap:5px; }
        .level-entry-body { align-items:stretch; flex-direction:column; gap:11px; }
        .level-entry-title { font-size:20px; }
        .level-entry-progress { min-width:0; }
        .level-entry-action { width:100%; min-height:44px; }
        .level-reset-button { width:44px; height:44px; padding:9px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .level-select-nav-button, .level-select-reset-all, .level-entry, .level-reset-button { transition:none; }
      }
    `;
    document.head.appendChild(style);
  }

  /** 读取最新存档并渲染路线（重置后复用） */
  private async renderCards(): Promise<void> {
    const data = await this.save.load();
    const completedSlots = new Set(data.completedSlots);
    const { tier, standard } = data.difficultySetting;
    const levels = LevelManager.listLevels();

    this._renderSummary(data, levels, completedSlots, tier, standard);
    this.route.innerHTML = '';

    const state = levels.map((lvl) => {
      const slots = lvl.challengeSlots ?? 3;
      const completedCount = Array.from({ length: slots }, (_, i) => `${lvl.id}:${tier}:${standard}:${i}`)
        .filter((sid) => completedSlots.has(sid)).length;
      return {
        slots,
        completedCount,
        isCompleted: completedCount === slots,
        isUnlocked: data.unlockedLevels.includes(lvl.id),
      };
    });
    const currentIndex = state.findIndex((item) => item.isUnlocked && !item.isCompleted);

    levels.forEach((lvl, idx) => {
      const levelState = state[idx];
      const meta = THEME_META[lvl.theme] ?? THEME_META.jungle;
      const cardTitle = levelTitleOf(lvl.id, lvl.theme);
      const nextUnlocked = state[idx + 1]?.isUnlocked ?? false;
      const isCurrent = currentIndex >= 0
        ? idx === currentIndex
        : levelState.isUnlocked && idx === state.findIndex((item) => item.isUnlocked);

      const item = document.createElement('li');
      item.className = 'level-route-item';
      item.dataset.current = String(isCurrent);
      item.dataset.unlocked = String(levelState.isUnlocked);
      item.dataset.completed = String(levelState.isCompleted);
      item.style.setProperty('--level-color', meta.color);

      const nodeColumn = document.createElement('span');
      nodeColumn.className = 'level-node-column';
      const node = document.createElement('span');
      node.className = 'level-node';
      node.style.color = levelState.isUnlocked ? meta.color : '#66756b';
      node.style.borderColor = levelState.isUnlocked ? meta.color : '#819086';
      node.innerHTML = levelState.isUnlocked ? String(idx + 1) : ICON_LOCK;
      node.setAttribute('aria-hidden', 'true');
      nodeColumn.appendChild(node);
      if (idx < levels.length - 1) {
        const connector = document.createElement('span');
        connector.className = 'level-route-connector';
        connector.dataset.open = String(nextUnlocked);
        connector.setAttribute('aria-hidden', 'true');
        nodeColumn.appendChild(connector);
      }
      item.appendChild(nodeColumn);

      const frame = document.createElement('span');
      frame.className = 'level-entry-frame';

      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'level-entry';
      entry.disabled = !levelState.isUnlocked;
      entry.setAttribute('aria-label', `${cardTitle} · ${levelState.isUnlocked ? t('levelSelect.enter') : t('levelSelect.locked')}`);
      entry.addEventListener('click', (event) => {
        event.stopPropagation();
        void this._enterLevel(lvl.id);
      });

      const top = document.createElement('span');
      top.className = 'level-entry-top';
      const theme = document.createElement('span');
      theme.className = 'level-entry-theme';
      theme.innerHTML = `${meta.icon}<span></span>`;
      theme.querySelector('span')!.textContent = meta[getLang()];
      top.appendChild(theme);

      const status = document.createElement('span');
      status.className = 'level-entry-status';
      if (!levelState.isUnlocked) {
        status.innerHTML = `${ICON_LOCK}<span></span>`;
        status.querySelector('span')!.textContent = t('levelSelect.locked');
      } else if (levelState.isCompleted) {
        status.innerHTML = `${ICON_STAR}<span></span>`;
        status.querySelector('span')!.textContent = t('levelSelect.completed');
      } else {
        status.textContent = t('levelSelect.enter');
      }
      top.appendChild(status);
      entry.appendChild(top);

      const body = document.createElement('span');
      body.className = 'level-entry-body';
      const info = document.createElement('span');
      info.className = 'level-entry-info';
      const number = document.createElement('span');
      number.className = 'level-entry-number';
      number.textContent = t('levelSelect.levelN', { n: idx + 1 });
      const title = document.createElement('span');
      title.className = 'level-entry-title';
      title.textContent = cardTitle;
      const progress = document.createElement('span');
      progress.className = 'level-entry-progress';
      progress.setAttribute('role', 'progressbar');
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', String(levelState.slots));
      progress.setAttribute('aria-valuenow', String(levelState.completedCount));
      progress.setAttribute('aria-label', `${t('levelSelect.completed')} ${levelState.completedCount}/${levelState.slots}`);
      const progressTrack = document.createElement('span');
      progressTrack.className = 'level-progress-track';
      const progressFill = document.createElement('span');
      progressFill.className = 'level-progress-fill';
      progressFill.style.width = `${Math.round((levelState.completedCount / levelState.slots) * 100)}%`;
      progressTrack.appendChild(progressFill);
      const progressText = document.createElement('span');
      progressText.textContent = `${levelState.completedCount}/${levelState.slots}`;
      progress.append(progressTrack, progressText);
      info.append(number, title, progress);

      const enterLabel = document.createElement('span');
      enterLabel.className = 'level-entry-action';
      enterLabel.innerHTML = `${ICON_PLAY}<span></span>`;
      enterLabel.querySelector('span')!.textContent = t('levelSelect.enter');
      body.append(info, enterLabel);
      entry.appendChild(body);
      frame.appendChild(entry);

      // 重置按钮仍对全部关卡提供，可清空本关当前难度的挑战进度。
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'level-reset-button';
      resetBtn.title = t('levelSelect.resetBtnAria');
      resetBtn.setAttribute('aria-label', `${t('levelSelect.resetBtnAria')}：${cardTitle}`);
      resetBtn.innerHTML = ICON_RESET;
      resetBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const ok = await confirmDialog({
          title: t('levelSelect.resetConfirmTitle', { name: cardTitle }),
          message: t('levelSelect.resetConfirmMsg'),
          confirmText: t('levelSelect.resetBtn'),
        });
        if (!ok) return;
        await this.resetLevel(lvl);
        await this.renderCards();
      });
      frame.appendChild(resetBtn);
      item.appendChild(frame);
      this.route.appendChild(item);
    });
  }

  private _renderSummary(
    data: Awaited<ReturnType<SaveStore['load']>>,
    levels: LevelData[],
    completedSlots: Set<string>,
    tier: number,
    standard: string,
  ): void {
    const totalSlots = levels.reduce((sum, level) => sum + (level.challengeSlots ?? 3), 0);
    const completedCount = levels.reduce((sum, level) => {
      const slots = level.challengeSlots ?? 3;
      return sum + Array.from({ length: slots }, (_, i) => `${level.id}:${tier}:${standard}:${i}`)
        .filter((sid) => completedSlots.has(sid)).length;
    }, 0);
    this.progressSummary.innerHTML = '';
    this.progressSummary.append(
      this._summaryMetric(ICON_STAR, t('levelSelect.completed'), `${completedCount}/${totalSlots}`),
      this._summaryMetric(ICON_STAR, 'Starite', String(data.starites)),
      this._summaryMetric(ICON_SHARD, getLang() === 'zh' ? '碎片' : 'Shards', String(data.shards)),
    );

    const tierLabel = tier === 1 ? t('levelSelect.tier1') : tier === 2 ? t('levelSelect.tier2') : t('levelSelect.tier3');
    const standardLabel = standard === 'cefr' ? t('levelSelect.stdCefr') : t('levelSelect.stdFrequency');
    this.difficultySummary.textContent = `${t('levelSelect.difficulty')} · ${tierLabel} · ${standardLabel}`;
  }

  private _summaryMetric(icon: string, label: string, value: string): HTMLSpanElement {
    const metric = document.createElement('span');
    metric.className = 'level-select-summary-metric';
    metric.innerHTML = `${icon}<span></span><strong></strong>`;
    metric.querySelector('span')!.textContent = label;
    metric.querySelector('strong')!.textContent = value;
    return metric;
  }

  /**
   * 重置单个关卡进度：从 completedSlots 移除该关全部 slot id。
   * slot id 格式 `{levelId}:{tier}:{standard}:{slot}`，重置时按当前难度设置匹配。
   */
  private async resetLevel(lvl: LevelData): Promise<void> {
    const data = await this.save.load();
    const { tier, standard } = data.difficultySetting;
    const slots = lvl.challengeSlots ?? 3;
    const removeIds = new Set(
      Array.from({ length: slots }, (_, i) => `${lvl.id}:${tier}:${standard}:${i}`),
    );
    // 重算 starites/shards：同时识别 authored challenge id 与随机题 slot id。
    const authoredRewards = new Map<string, { type: 'shard' | 'starite'; count: number }>();
    for (const level of LevelManager.listLevels()) {
      for (const challenge of level.authoredChallenges ?? []) authoredRewards.set(challenge.id, challenge.reward);
    }
    const resetLevelIds = new Set(removeIds);
    for (const challenge of lvl.authoredChallenges ?? []) resetLevelIds.add(challenge.id);
    const filteredRemaining = data.completedSlots.filter((id: string) => !resetLevelIds.has(id));
    let shards = 0;
    let starites = 0;
    for (const sid of filteredRemaining) {
      const authoredReward = authoredRewards.get(sid);
      if (authoredReward) {
        if (authoredReward.type === 'starite') starites += authoredReward.count;
        else shards += authoredReward.count;
        while (shards >= 10) { shards -= 10; starites += 1; }
        continue;
      }
      const parts = sid.split(':');
      const slotIdx = Number(parts[parts.length - 1]);
      const sourceLevel = LevelManager.listLevels().find((level) => level.id === parts[0]);
      const isGate = slotIdx === (sourceLevel?.challengeSlots ?? 3) - 1;
      if (isGate) {
        starites += 1;
      } else {
        shards += 4;
        while (shards >= 10) { shards -= 10; starites += 1; }
      }
    }

    await this.save.updateProgress(starites, shards, filteredRemaining);
  }

  private async _enterLevel(levelId: string): Promise<void> {
    this.overlay?.remove();
    this.scene.start('WorldScene', { levelId });
  }

  private _backToTitle(): void {
    this.overlay?.remove();
    this.scene.start('TitleScene');
  }

  shutdown(): void {
    this.overlay?.remove();
  }
}
