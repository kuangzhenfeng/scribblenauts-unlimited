/**
 * 进度面板 —— 显示 Starite/碎片计数与挑战提示（涂鸦纸片风 + Lucide 图标）。
 */

import { ICON_STAR, ICON_SHARD } from './icons';
import { paperPanel } from './paperStyle';

export class ProgressPanel {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'progress';
    this.el.style.cssText = paperPanel([
      'top:16px',
      'right:16px',
      'padding:10px 14px',
      'font-size:14px',
      'font-weight:600',
      'z-index:50',
      'pointer-events:none',
      'min-width:140px',
      'text-align:right',
    ], 0.6);
    document.body.appendChild(this.el);
    this.render(0, 0);
  }

  render(starites: number, shards: number): void {
    this.el.innerHTML =
      `<span style="color:#f59f00">${ICON_STAR}</span>` +
      `<span style="margin-left:6px;vertical-align:middle">Starite ${starites}</span>` +
      `<span style="margin:0 8px;opacity:0.5">|</span>` +
      `<span style="color:#4a90e2">${ICON_SHARD}</span>` +
      `<span style="margin-left:6px;vertical-align:middle">碎片 ${shards}/10</span>`;
  }

  toast(msg: string): void {
    this.el.textContent = msg;
  }
}
