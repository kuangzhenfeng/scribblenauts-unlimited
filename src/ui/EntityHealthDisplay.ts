/**
 * 世界对象生命显示 —— 只在对象受伤后，把四个生命圆点贴在对象上方。
 *
 * 原版把对象生命作为局部反馈，不把玩家血量做成常驻 RPG 状态栏；
 * 因此这里不显示名称、数值或心形图标，只保留短小的生命圆点。
 */

import type { Entity } from '@/core/entity/Entity';
import type { Camera } from '@/engine/render/Camera';

const STYLE_ID = 'entity-health-display-style';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #entity-health-display {
      position:fixed;
      z-index:42;
      display:flex;
      gap:3px;
      padding:3px 5px;
      border:2px solid #2f2116;
      border-radius:7px;
      background:rgba(255,248,226,.94);
      box-shadow:0 2px 0 rgba(47,33,22,.72);
      pointer-events:none;
      transform:translate(-50%,-100%);
      transform-origin:center bottom;
      transition:opacity .12s ease;
    }
    #entity-health-display[data-low="true"] { border-color:#8f302b; }
    #entity-health-display .entity-health-display__cell {
      width:9px;
      height:9px;
      box-sizing:border-box;
      border:2px solid #4e7b44;
      border-radius:50%;
      background:#e9dfc3;
    }
    #entity-health-display .entity-health-display__cell--filled {
      background:#70ad50;
    }
    #entity-health-display[data-low="true"] .entity-health-display__cell {
      border-color:#a0443b;
    }
    #entity-health-display[data-low="true"] .entity-health-display__cell--filled {
      background:#df574d;
    }
    @media (prefers-reduced-motion:reduce) {
      #entity-health-display { transition:none; }
    }
  `;
  document.head.appendChild(style);
}

export class EntityHealthDisplay {
  private readonly el: HTMLDivElement;

  constructor() {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'entity-health-display';
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }

  /** 受伤对象才显示局部生命反馈；满血对象保持画面干净。 */
  render(entity: Entity | undefined, camera: Camera): void {
    const maxHealth = entity?.maxHealth ?? 0;
    const health = entity?.health ?? 0;
    if (!entity || entity.dead || entity.hidden || maxHealth <= 0 || health >= maxHealth) {
      this.hide();
      return;
    }

    const screen = camera.worldToScreen(entity.bodyPositionX, entity.bodyPositionY - 48);
    const filledCells = Math.ceil(Math.max(0, Math.min(maxHealth, health)) / maxHealth * 4);
    const low = health / maxHealth <= 0.5;
    this.el.hidden = false;
    this.el.dataset.low = low ? 'true' : 'false';
    this.el.setAttribute('aria-label', `生命: ${health}/${maxHealth}`);
    this.el.style.left = `${screen.x}px`;
    this.el.style.top = `${screen.y}px`;
    this.el.innerHTML = Array.from({ length: 4 }, (_, index) =>
      `<span class="entity-health-display__cell${index < filledCells ? ' entity-health-display__cell--filled' : ''}" aria-hidden="true"></span>`,
    ).join('');
  }

  hide(): void {
    this.el.hidden = true;
  }

  destroy(): void {
    this.el.remove();
  }
}
