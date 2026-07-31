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
const HEAD_OFFSET = 98;

export class SpeechBubble {
  private readonly el: HTMLDivElement;
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'speech-bubble';
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
      'font-size:14.5px',
      'font-weight:800',
      'line-height:1.32',
      'width:min(276px,calc(100vw - 32px))',
      // 窄屏兜底：不超出视口宽度，留 32px 两侧边距
      'max-width:min(276px,calc(100vw - 32px))',
      'text-align:center',
      'pointer-events:none',
      'z-index:45',
      'display:none',
      'white-space:pre-wrap',
      'padding:10px 14px',
      'border:2px solid rgba(43,43,43,0.28)',
      'box-sizing:border-box',
    ].join(';');
    const responsiveStyle = document.createElement('style');
    responsiveStyle.id = 'speech-bubble-layout-style';
    responsiveStyle.textContent = '@media (max-width:600px){#speech-bubble{width:240px!important;font-size:12px!important;line-height:1.25!important;padding:8px 10px!important;}}';
    document.head.appendChild(responsiveStyle);
    document.body.appendChild(this.el);
  }

  show(text: string, hint?: string): void {
    const compact = window.innerWidth <= 600;
    const textStyle = compact ? 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' : '';
    const hintHtml = hint && !compact ? `<div style="margin-top:5px;font-style:italic;opacity:0.72;font-size:0.74em;line-height:1.3;font-weight:700">${hint}</div>` : '';
    this.el.innerHTML = `<div style="${textStyle}">${text}</div>${hintHtml}`;
    this.el.style.display = 'block';
    document.body.dataset.speechBubbleActive = 'true';
    document.getElementById('world-controls-hint')?.setAttribute('data-speech-active', 'true');
    this.visible = true;
  }

  /** 把气泡定位到世界坐标对应屏幕位置（头顶上方，底边中点对齐） */
  positionAt(worldX: number, worldY: number, camera: Camera): void {
    if (!this.visible) return;
    const cam = camera.cam;
    // 世界坐标 → 屏幕 CSS 像素（getWorldPoint 方向相反，不可用）
    const screenX = (worldX - cam.scrollX) * cam.zoom + cam.x;
    const screenY = (worldY - cam.scrollY) * cam.zoom + cam.y;
    // 气泡向 NPC 的外侧偏移，避免默认居中时压住传送门/角色活动线；再按视口边界回收。
    const side = screenX < window.innerWidth / 2 ? -1 : 1;
    const rect = this.el.getBoundingClientRect();
    const preferredX = screenX + side * Math.max(96, rect.width * 0.34);
    const minX = rect.width / 2 + 12;
    const maxX = window.innerWidth - rect.width / 2 - 12;
    const anchorX = Math.max(minX, Math.min(maxX, preferredX));
    const minY = rect.height + 12;
    const safeTop = window.innerWidth <= 600 ? Math.max(minY, rect.height + 120) : minY;
    const maxY = window.innerHeight - 12;
    const anchorY = Math.max(safeTop, Math.min(maxY, screenY - HEAD_OFFSET));
    this.el.style.left = `${anchorX}px`;
    this.el.style.top = `${anchorY}px`;
  }

  hide(): void {
    this.el.style.display = 'none';
    delete document.body.dataset.speechBubbleActive;
    document.getElementById('world-controls-hint')?.removeAttribute('data-speech-active');
    this.visible = false;
  }
}
