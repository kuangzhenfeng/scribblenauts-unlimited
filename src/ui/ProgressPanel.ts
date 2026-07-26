/**
 * 进度面板 —— 顶部居中金色横幅，显示关卡挑战进度（星星槽位）。
 * 对齐截图原版：Maxwell 头像 + 箭头 + N 个星星槽（完成=金实心，未完成=金轮廓）。
 * API 不变：setLevel(challenges) / render(starites, shards, completed)
 */

import { SAFE_TOP, UI_FONT } from './paperStyle';

/** 单个星星槽（五角星 SVG） */
function starSlot(filled: boolean): string {
  const fill = filled ? '#f5c518' : 'none';
  const shadow = filled ? ';filter:drop-shadow(0 0 5px #f5c51899)' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"` +
    ` fill="${fill}" stroke="#a05a00" stroke-width="2.2"` +
    ` stroke-linecap="round" stroke-linejoin="round"` +
    ` style="vertical-align:middle${shadow}">` +
    `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>` +
    `</svg>`
  );
}

/** Maxwell 小头像（顶栏左侧） */
const MAXWELL_HEAD =
  `<div style="display:inline-flex;align-items:center;justify-content:center;` +
  `width:30px;height:30px;` +
  `background:radial-gradient(circle at 40% 35%,#fddbb4 60%,#d4924a 100%);` +
  `border:2px solid #3d2200;border-radius:50%;` +
  `position:relative;overflow:hidden;flex-shrink:0">` +
  `<div style="position:absolute;top:0;left:0;right:0;height:38%;` +
  `background:linear-gradient(180deg,#cc2222 0%,#aa1818 100%);` +
  `border-radius:50% 50% 0 0/60% 60% 0 0"></div>` +
  `<div style="position:absolute;top:44%;display:flex;gap:5px;left:50%;transform:translateX(-50%)">` +
  `<div style="width:4px;height:4px;background:#1a1a1a;border-radius:50%"></div>` +
  `<div style="width:4px;height:4px;background:#1a1a1a;border-radius:50%"></div>` +
  `</div></div>`;

export class ProgressPanel {
  private readonly el: HTMLDivElement;
  private challenges: { id: string }[] = [];
  private toastTimer = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'progress';
    this.el.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:50',
      'pointer-events:none',
      // 金色横幅
      'background:linear-gradient(180deg,#f0b830 0%,#c8760a 55%,#f0b830 100%)',
      'border:3px solid #3d2200',
      'border-radius:28px',
      'padding:5px 16px 5px 10px',
      'display:flex',
      'align-items:center',
      'gap:7px',
      'box-shadow:0 4px 18px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,230,120,0.5),inset 0 -1px 0 rgba(80,30,0,0.3)',
      'min-width:160px',
      'max-width:calc(100vw - 32px)',
      'white-space:nowrap',
      'overflow:hidden',
    ].join(';');
    document.body.appendChild(this.el);
    this.redraw([]);
  }

  /** 设置当前关卡挑战列表（换关时调用） */
  setLevel(challenges: { id: string }[]): void {
    this.challenges = challenges;
    this.redraw([]);
  }

  render(starites: number, shards: number, completed: string[] = []): void {
    void starites; void shards; // 保留参数兼容性，星槽完全由 completed 驱动
    this.redraw(completed);
  }

  private redraw(completed: string[]): void {
    // 没有挑战时显示 3 个占位槽
    const list = this.challenges.length > 0 ? this.challenges : [{ id: '' }, { id: '' }, { id: '' }];
    const stars = list.map((c) => starSlot(c.id !== '' && completed.includes(c.id))).join('');

    this.el.innerHTML =
      MAXWELL_HEAD +
      `<span style="font-family:${UI_FONT};color:#3d2200;font-size:16px;font-weight:900;line-height:1;flex-shrink:0">&#9658;</span>` +
      `<div style="display:flex;align-items:center;gap:3px">${stars}</div>`;
  }

  toast(msg: string): void {
    clearTimeout(this.toastTimer);

    const prev = this.el.innerHTML;
    this.el.style.transition = 'transform 0.15s ease';
    this.el.style.transform = 'translateX(-50%) scale(1.08)';
    setTimeout(() => { this.el.style.transform = 'translateX(-50%) scale(1.0)'; }, 160);

    this.el.innerHTML =
      `<span style="font-family:${UI_FONT};font-size:13px;font-weight:700;color:#3d2200;` +
      `text-shadow:0 1px 0 rgba(255,230,120,0.6);padding:0 6px">` +
      `&#10022; ${msg} &#10022;</span>`;

    this.toastTimer = window.setTimeout(() => { this.el.innerHTML = prev; }, 2200);
  }
}
