/**
 * 对话气泡 UI —— NPC 头顶需求陈述 + 操作提示。HTML 浮层，世界→屏幕定位。
 *
 * 涂鸦纸片质感：纸色撕边 + 手写体 + 小三角尾尖 + 手放感旋转。
 * 职责边界：只渲染文本与定位，不含触发逻辑（触发在 DialogSystem）。
 * pointer-events:none，不拦截鼠标；z-index 低于 Notebook/CandidateMenu。
 */

import type { Camera } from '@/engine/render/Camera';
import { HAND_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

export class SpeechBubble {
  private readonly el: HTMLDivElement;
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'transform:translateX(-50%) rotate(-0.6deg)',
      `background:${PAPER_BG}`,
      `color:${INK}`,
      `box-shadow:${PAPER_SHADOW}`,
      TORN_EDGE,
      `font-family:${HAND_FONT}`,
      'font-size:14px',
      'max-width:260px',
      'text-align:center',
      'pointer-events:none',
      'z-index:45',
      'display:none',
      'white-space:pre-wrap',
      'padding:12px 16px',
    ].join(';');
    document.body.appendChild(this.el);
  }

  show(text: string, hint?: string): void {
    const hintHtml = hint ? `<div style="margin-top:6px;font-style:italic;opacity:0.6;font-size:0.85em">${hint}</div>` : '';
    this.el.innerHTML = `${text}${hintHtml}`;
    this.el.style.display = 'block';
    this.visible = true;
  }

  /** 把气泡定位到世界坐标对应屏幕位置（头顶偏移） */
  positionAt(worldX: number, worldY: number, camera: Camera): void {
    if (!this.visible) return;
    const screen = camera.screenToWorld(0, 0); // 仅触发；用 getWorldPoint 反向
    void screen;
    // 直接用 Phaser Camera 投影世界→屏幕
    const p = camera.cam.getWorldPoint(worldX, worldY);
    // getWorldPoint 给出的是 CSS 像素；减去头顶偏移
    this.el.style.left = `${p.x}px`;
    this.el.style.top = `${p.y - 70}px`;
  }

  hide(): void {
    this.el.style.display = 'none';
    this.visible = false;
  }
}
