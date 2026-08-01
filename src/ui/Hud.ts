/**
 * 世界 HUD —— 左上角资源栏：物体数量、Starite、碎片与 Maxwell 状态头像。
 *
 * 这是贴在世界画面边缘的舞台框线：信息可读但不抢输入焦点，挑战进度由
 * ProgressPanel 在顶部中轴承接，避免把所有状态挤成一排工具按钮。
 */

import { ICON_BACKPACK, ICON_MAXWELL, ICON_SHARD, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_LEFT, SAFE_TOP, UI_FONT } from './paperStyle';
import { getLang, t } from '@/core/i18n/I18n';

const HUD_STYLE_ID = 'world-hud-style';
const GOLD = '#f0bd3c';
const GOLD_DARK = '#6a3d08';

function ensureStyle(): void {
  if (document.getElementById(HUD_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HUD_STYLE_ID;
  style.textContent = `
    #hud {
      display:flex;
      align-items:center;
      gap:7px;
      padding:6px 8px 6px 7px;
      color:${INK};
      font-family:${UI_FONT};
      background:${PAPER_BG};
      border:2px solid ${GOLD_DARK};
      border-radius:14px;
      box-shadow:0 2px 0 ${GOLD_DARK},${PAPER_SHADOW};
      transform:rotate(-1deg);
      user-select:none;
    }
    #hud .world-hud__resources {
      display:flex;
      align-items:center;
      gap:4px;
    }
    #hud .world-hud__chip {
      position:relative;
      display:grid;
      place-items:center;
      width:46px;
      height:46px;
      box-sizing:border-box;
      border:2px solid ${GOLD_DARK};
      border-radius:10px;
      background:${GOLD};
      box-shadow:inset 0 1px 0 rgba(255,255,255,.48);
    }
    #hud .world-hud__chip--objects { color:#1676b8; }
    #hud .world-hud__chip--starite { color:#8b5a00; }
    #hud .world-hud__chip--shards { color:#6b3ca3; }
    #hud .world-hud__chip svg { filter:drop-shadow(0 1px 0 rgba(255,255,255,.45)); }
    #hud .world-hud__count {
      position:absolute;
      right:-7px;
      bottom:-7px;
      min-width:20px;
      height:20px;
      box-sizing:border-box;
      padding:1px 5px;
      border:2px solid ${GOLD_DARK};
      border-radius:10px;
      background:#fff2b2;
      color:#5a3105;
      font-size:11px;
      font-weight:900;
      line-height:15px;
      text-align:center;
    }
    #hud .world-hud__portrait {
      display:grid;
      place-items:center;
      width:42px;
      height:42px;
      box-sizing:border-box;
      border:2px solid ${GOLD_DARK};
      border-radius:50%;
      color:#c92c24;
      background:${PAPER_BG_ALT};
      box-shadow:0 2px 0 ${GOLD_DARK},inset 0 1px 0 rgba(255,255,255,.62);
    }
    #hud button.world-hud__portrait {
      padding:0;
      font:inherit;
      cursor:pointer;
      pointer-events:auto;
      transition:transform .14s ease,background .14s ease,box-shadow .14s ease;
    }
    #hud button.world-hud__portrait:hover,
    #hud button.world-hud__portrait:focus-visible {
      transform:translateY(-1px) scale(1.03);
      background:#f6e7b4;
    }
    #hud button.world-hud__portrait:focus-visible {
      outline:3px solid ${INK};
      outline-offset:3px;
    }
    #hud .world-hud__portrait svg { width:28px; height:28px; }
    @media (max-width:600px) {
      #hud { gap:4px; padding:5px 6px; }
      #hud .world-hud__resources { gap:3px; }
      #hud .world-hud__chip { width:42px; height:42px; }
      #hud .world-hud__portrait { width:38px; height:38px; }
      #hud .world-hud__portrait svg { width:25px; height:25px; }
    }
    @media (prefers-reduced-motion:reduce) {
      #hud { transform:none; }
      #hud button.world-hud__portrait:hover,
      #hud button.world-hud__portrait:focus-visible { transform:none; }
    }
  `;
  document.head.appendChild(style);
}

/** 单个资源格：图标负责类别，数字负责状态，不依赖颜色区分。 */
function resourceChip(icon: string, count: number, kind: string, label: string): string {
  return `<div class="world-hud__chip world-hud__chip--${kind}" role="img" aria-label="${label}: ${count}">
    ${icon}<span class="world-hud__count">${count}</span>
  </div>`;
}

export class Hud {
  private readonly el: HTMLDivElement;
  private lastObjectCount: number | undefined;
  private lastStariteCount: number | undefined;
  private lastShardCount: number | undefined;

  constructor(private readonly onPortraitClick?: () => void) {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      `left:${SAFE_LEFT}`,
      'z-index:48',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(this.el);
    this.render(0, 0, 0);
  }

  /**
   * @param objectCount 当前场景物体数
   * @param stariteCount 已收集 Starite 数
   * @param shardCount 已收集碎片数
   */
  render(objectCount: number, stariteCount = 0, shardCount = 0): void {
    if (
      this.lastObjectCount === objectCount &&
      this.lastStariteCount === stariteCount &&
      this.lastShardCount === shardCount
    ) return;
    this.lastObjectCount = objectCount;
    this.lastStariteCount = stariteCount;
    this.lastShardCount = shardCount;

    const labels = getLang() === 'zh'
      ? { objects: '物体', starites: 'Starite', shards: '碎片' }
      : { objects: 'Objects', starites: 'Starites', shards: 'Shards' };

    const resources = [
      resourceChip(ICON_BACKPACK, objectCount, 'objects', labels.objects),
      resourceChip(ICON_STAR, stariteCount, 'starite', labels.starites),
      resourceChip(ICON_SHARD, shardCount, 'shards', labels.shards),
    ].join('');

    const portrait = this.onPortraitClick
      ? `<button type="button" class="world-hud__portrait" aria-label="${t('playerPanel.openAria')}" title="${t('playerPanel.openAria')}">${ICON_MAXWELL}</button>`
      : `<div class="world-hud__portrait" role="img" aria-label="Maxwell">${ICON_MAXWELL}</div>`;
    this.el.innerHTML =
      `<div class="world-hud__resources">${resources}</div>` + portrait;
    this.el.querySelector<HTMLButtonElement>('.world-hud__portrait')?.addEventListener('click', () => this.onPortraitClick?.());
  }
}
