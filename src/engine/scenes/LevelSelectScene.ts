/**
 * 选关场景 —— 独立关卡选择界面，纸片风卡片网格。
 *
 * 由标题页"选择关卡"按钮进入。展示 LevelManager.listLevels() 返回的全部关卡，
 * 按 SaveStore.unlockedLevels 判定解锁状态，按 completedChallenges 判定完成状态。
 * 顺序解锁：首关默认解锁，完成上一关 starite-gate 后解锁下一关。
 * 点击已解锁卡片 → scene.start('WorldScene', { levelId })；返回按钮 → TitleScene。
 * 每张已解锁卡片提供「重置」按钮；顶部提供「重置所有」按钮。
 */

import Phaser from 'phaser';
import { LevelManager } from '@/game/LevelManager';
import type { LevelData } from '@/core/types/level';
import { SaveStore } from '@/core/data/save/SaveStore';
import { UI_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from '@/ui/paperStyle';
import { ICON_SNOWFLAKE, ICON_SUN, ICON_FLAME, ICON_LOCK, ICON_STAR, ICON_RESET } from '@/ui/icons';
import { confirmDialog } from '@/ui/ConfirmDialog';
import { t, getLang, type Lang } from '@/core/i18n/I18n';

/** 主题 → 卡片配色 + 图标 + 双语名 */
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
  private grid!: HTMLDivElement;
  private readonly save = new SaveStore();

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  async create(): Promise<void> {
    // 程序化背景：暖色渐变纸面
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#f7f1e3');

    // Phaser 4 不自动调用 scene.shutdown()，须显式绑到 SHUTDOWN 事件，
    // 否则切场景时 DOM 浮层残留不清理（对齐 Phaser 生命周期标准用法）
    this.events.once('shutdown', this.shutdown, this);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:100',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'padding:32px 24px 24px',
      'box-sizing:border-box',
      'overflow-y:auto',
    ].join(';');

    // 标题
    const title = document.createElement('div');
    title.textContent = t('levelSelect.title');
    title.style.cssText = [
      `font-family:${UI_FONT}`,
      'font-size:clamp(34px,5vw,52px)',
      'font-weight:900',
      `color:${INK}`,
      'letter-spacing:0.1em',
      'text-shadow:2px 2px 0 rgba(60,40,20,0.18)',
      'margin-bottom:8px',
    ].join(';');
    this.overlay.appendChild(title);

    // 副标题提示
    const hint = document.createElement('div');
    hint.textContent = t('levelSelect.hint');
    hint.style.cssText = [
      `font-family:${UI_FONT}`,
      'font-size:clamp(14px,1.6vw,18px)',
      'color:#5a554c',
      'margin-bottom:28px',
    ].join(';');
    this.overlay.appendChild(hint);

    // 卡片网格容器
    this.grid = document.createElement('div');
    this.grid.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(auto-fill,minmax(240px,1fr))',
      'gap:22px',
      'width:100%',
      'max-width:1080px',
      'pointer-events:none',
    ].join(';');
    this.overlay.appendChild(this.grid);

    // 返回按钮
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = `◂ ${t('common.back')}`;
    back.style.cssText = [
      'position:fixed',
      'top:22px',
      'left:24px',
      `font-family:${UI_FONT}`,
      'font-size:18px',
      'font-weight:900',
      `color:${INK}`,
      `background:${PAPER_BG}`,
      'border:2px solid rgba(43,43,43,0.4)',
      'border-radius:999px',
      'padding:8px 20px',
      'cursor:pointer',
      'pointer-events:auto',
      `box-shadow:${PAPER_SHADOW}`,
      'transition:transform 0.16s ease',
    ].join(';');
    back.addEventListener('mouseenter', () => { back.style.transform = 'translateX(-2px)'; });
    back.addEventListener('mouseleave', () => { back.style.transform = ''; });
    back.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._backToTitle();
    });
    this.overlay.appendChild(back);

    // 重置所有按钮（右上角）
    const resetAll = document.createElement('button');
    resetAll.type = 'button';
    resetAll.innerHTML = `${ICON_RESET}<span style="margin-left:6px">${t('levelSelect.resetAll')}</span>`;
    resetAll.style.cssText = [
      'position:fixed',
      'top:22px',
      'right:24px',
      'display:flex',
      'align-items:center',
      `font-family:${UI_FONT}`,
      'font-size:16px',
      'font-weight:900',
      'color:#5a1a04',
      `background:${PAPER_BG}`,
      'border:2px solid #b8360a',
      'border-radius:999px',
      'padding:8px 18px',
      'cursor:pointer',
      'pointer-events:auto',
      `box-shadow:${PAPER_SHADOW}`,
      'transition:transform 0.16s ease,filter 0.16s ease',
    ].join(';');
    resetAll.addEventListener('mouseenter', () => { resetAll.style.transform = 'translateY(-2px)'; resetAll.style.filter = 'brightness(1.06)'; });
    resetAll.addEventListener('mouseleave', () => { resetAll.style.transform = ''; resetAll.style.filter = ''; });
    resetAll.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const ok = await confirmDialog({
        title: t('levelSelect.resetAllConfirmTitle'),
        message: t('levelSelect.resetAllConfirmMsg'),
        confirmText: t('levelSelect.resetAll'),
      });
      if (!ok) return;
      await this.save.resetAll();
      await this.renderCards();
    });
    this.overlay.appendChild(resetAll);

    document.body.appendChild(this.overlay);
    void width;
    void height;

    // 首次渲染卡片
    await this.renderCards();
  }

  /** 读取最新存档并渲染全部关卡卡片（重置后局部刷新复用） */
  private async renderCards(): Promise<void> {
    const data = await this.save.load();
    const completedSlots = new Set(data.completedSlots);
    const { tier, standard } = data.difficultySetting;
    const levels = LevelManager.listLevels();

    this.grid.innerHTML = '';

    levels.forEach((lvl, idx) => {
      // 完成判定：该关该难度全部 slot 已完成
      const slots = lvl.challengeSlots ?? 3;
      const allDone = Array.from({ length: slots }, (_, i) => `${lvl.id}:${tier}:${standard}:${i}`)
        .every((sid) => completedSlots.has(sid));
      const isCompleted = allDone;

      const meta = THEME_META[lvl.theme] ?? THEME_META.jungle;
      const cardTitle = levelTitleOf(lvl.id, lvl.theme);

      const card = document.createElement('div');
      card.style.cssText = [
        'position:relative',
        `background:${PAPER_BG}`,
        `box-shadow:${PAPER_SHADOW}`,
        TORN_EDGE,
        'border-radius:14px',
        'padding:0',
        'display:flex',
        'flex-direction:column',
        'overflow:hidden',
        'cursor:pointer',
        'pointer-events:auto',
        'transition:transform 0.2s ease,box-shadow 0.2s ease',
        'transform:rotate(' + ((idx % 2 === 0 ? -0.6 : 0.5) + 'deg') + ')',
      ].join(';');

      // 主题色条
      const band = document.createElement('div');
      band.style.cssText = [
        `background:linear-gradient(135deg,${meta.color},${meta.color}cc)`,
        'height:10px',
        'width:100%',
      ].join(';');
      card.appendChild(band);

      // 卡片主体
      const body = document.createElement('div');
      body.style.cssText = [
        'padding:18px 20px 20px',
        'display:flex',
        'flex-direction:column',
        'gap:10px',
        'align-items:center',
      ].join(';');

      // 序号 + 主题图标
      const iconRow = document.createElement('div');
      iconRow.style.cssText = ['display:flex', 'align-items:center', 'gap:10px', `color:${meta.color === '#b0d4e8' ? '#3a6b8a' : meta.color}`].join(';');
      iconRow.innerHTML = `<span style="font-family:${UI_FONT};font-size:14px;color:#5a554c;font-weight:900">${t('levelSelect.levelN', { n: idx + 1 })}</span>${meta.icon}`;
      body.appendChild(iconRow);

      // 关卡名
      const nameEl = document.createElement('div');
      nameEl.textContent = cardTitle;
      nameEl.style.cssText = [
        `font-family:${UI_FONT}`,
        'font-size:clamp(22px,2.4vw,30px)',
        'font-weight:900',
        `color:${INK}`,
        'letter-spacing:0.06em',
        'text-align:center',
      ].join(';');
      body.appendChild(nameEl);

      // 状态
      const status = document.createElement('div');
      status.style.cssText = ['margin-top:4px', 'min-height:26px', 'display:flex', 'align-items:center', 'justify-content:center', 'gap:6px', `font-family:${UI_FONT}`, 'font-size:15px'].join(';');
      if (isCompleted) {
        status.innerHTML = `${ICON_STAR}<span style="color:#9a5a00;font-weight:900">${t('levelSelect.completed')}</span>`;
      } else {
        status.innerHTML = `<span style="color:#286a32;font-weight:900">${t('levelSelect.go')}</span>`;
      }
      body.appendChild(status);

      card.appendChild(body);

      // 卡片右下角重置按钮（全部关卡都显示，可清空本关进度重玩）
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.title = t('levelSelect.resetBtnAria');
      resetBtn.innerHTML = ICON_RESET;
      resetBtn.style.cssText = [
        'position:absolute',
        'right:10px',
        'bottom:8px',
        'width:32px',
        'height:32px',
        'display:grid',
        'place-items:center',
        'color:rgba(90,26,4,0.75)',
        `background:${PAPER_BG}`,
        'border:2px solid rgba(184,54,10,0.5)',
        'border-radius:50%',
        'cursor:pointer',
        'z-index:2',
        'transition:transform 0.14s ease,filter 0.14s ease',
      ].join(';');
      resetBtn.addEventListener('mouseenter', () => { resetBtn.style.transform = 'scale(1.15)'; resetBtn.style.filter = 'brightness(1.1)'; });
      resetBtn.addEventListener('mouseleave', () => { resetBtn.style.transform = ''; resetBtn.style.filter = ''; });
      resetBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const ok = await confirmDialog({
          title: t('levelSelect.resetConfirmTitle', { name: cardTitle }),
          message: t('levelSelect.resetConfirmMsg'),
          confirmText: t('levelSelect.resetBtn'),
        });
        if (!ok) return;
        await this.resetLevel(lvl);
        await this.renderCards();
      });
      card.appendChild(resetBtn);

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'scale(1.03) rotate(0deg)';
        card.style.boxShadow = '0 14px 32px rgba(60,40,20,0.32)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'rotate(' + ((idx % 2 === 0 ? -0.6 : 0.5) + 'deg') + ')';
        card.style.boxShadow = PAPER_SHADOW;
      });
      card.addEventListener('click', (ev) => {
        ev.stopPropagation();
        void this._enterLevel(lvl.id);
      });

      this.grid.appendChild(card);
    });
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
    const remaining = data.completedSlots.filter((id: string) => !removeIds.has(id));

    // 重算 starites/shards：按 slot id 解析 reward（最后一个 slot=starite，其余=shard×4）
    let shards = 0;
    let starites = 0;
    for (const sid of remaining) {
      const parts = sid.split(':');
      const slotIdx = Number(parts[parts.length - 1]);
      const totalSlots = Number(parts[3]) ?? 3;
      const isGate = slotIdx === totalSlots - 1;
      if (isGate) {
        starites += 1;
      } else {
        shards += 4;
        while (shards >= 10) { shards -= 10; starites += 1; }
      }
    }

    await this.save.updateProgress(starites, shards, remaining);
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
