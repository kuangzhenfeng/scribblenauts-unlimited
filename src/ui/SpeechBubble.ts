/**
 * 对话气泡 UI —— NPC 头顶需求陈述 + 操作提示。HTML 浮层，世界→屏幕定位。
 *
 * 涂鸦纸片质感：纸色撕边 + 手写体 + 手放感旋转。
 * 定位锚点为气泡底边中点，置于 NPC 头顶上方，气泡向上生长，避免遮挡 NPC 本体。
 * 职责边界：只渲染文本与定位，不含触发逻辑（触发在 DialogSystem）。
 * pointer-events:none，不拦截鼠标；z-index 低于 Notebook/CandidateMenu。
 */

import type { Camera } from '@/engine/render/Camera';
import { UI_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

/** 气泡底边距 NPC 质心的垂直偏移（屏幕像素），置于头顶之上，留出余量避免遮挡 */
const HEAD_OFFSET = 82;

export class SpeechBubble {
  private readonly el: HTMLDivElement;
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      // 锚点改为底边中点：translate(-50%,-100%) 使元素底边中点落在 (left,top)，
      // 气泡向上生长，底边贴在 NPC 头顶上方，不遮挡 NPC 本体
      'transform:translate(-50%,-100%) rotate(-0.6deg)',
      `background:${PAPER_BG}`,
      `color:${INK}`,
      `box-shadow:${PAPER_SHADOW}`,
      TORN_EDGE,
      `font-family:${UI_FONT}`,
      'font-size:14px',
      // 窄屏兜底：不超出视口宽度，留 32px 两侧边距
      'max-width:min(260px,calc(100vw - 32px))',
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

  /** 把气泡定位到世界坐标对应屏幕位置（头顶上方，底边中点对齐） */
  positionAt(worldX: number, worldY: number, camera: Camera): void {
    if (!this.visible) return;
    const cam = camera.cam;
    // 世界坐标 → 屏幕 CSS 像素（getWorldPoint 方向相反，不可用）
    const screenX = (worldX - cam.scrollX) * cam.zoom + cam.x;
    const screenY = (worldY - cam.scrollY) * cam.zoom + cam.y;
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY - HEAD_OFFSET}px`;
  }

  hide(): void {
    this.el.style.display = 'none';
    this.visible = false;
  }
}
