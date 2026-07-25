/**
 * HUD —— 顶部状态条，显示物体计数/提示等（涂鸦纸片风 + Lucide 图标）。
 */

import { ICON_OBJECTS } from './icons';
import { paperPanel, INK } from './paperStyle';

export class Hud {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = paperPanel([
      'top:16px',
      'left:16px',
      'padding:8px 14px',
      'font-size:14px',
      'z-index:50',
      'pointer-events:none',
    ], -0.6);
    document.body.appendChild(this.el);
    this.render(0);
  }

  render(count: number, extra?: string): void {
    this.el.innerHTML = `${ICON_OBJECTS}<span style="margin-left:6px;vertical-align:middle">物体 ${count}</span>${extra ? `<span style="margin:0 8px;opacity:0.5">|</span>${extra}` : ''}`;
    void INK;
  }
}
