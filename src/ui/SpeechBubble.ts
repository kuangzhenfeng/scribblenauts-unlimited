/**
 * 对话气泡 UI —— NPC 头顶需求陈述 + 操作提示。HTML 浮层，世界→屏幕定位。
 *
 * 气泡先尝试置于 NPC 上方；当顶部空间不足时，按实体左右两侧的可用空间
 * 横向避让。职责边界仍只渲染文本与定位，不含触发逻辑（触发在 DialogSystem）。
 */

import type { Camera } from '@/engine/render/Camera';
import { UI_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from './paperStyle';

const SPEECH_STYLE_ID = 'speech-bubble-layout-style';
/** 气泡底边距 NPC 质心的垂直偏移（屏幕像素），避免覆盖实体轮廓。 */
const HEAD_OFFSET = 96;
const VIEWPORT_MARGIN = 12;
const ENTITY_GAP = 22;

function ensureStyle(): void {
  if (document.getElementById(SPEECH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SPEECH_STYLE_ID;
  style.textContent = `
    #speech-bubble {
      box-sizing:border-box;
      width:min(286px,calc(100vw - 32px));
      max-width:min(286px,calc(100vw - 32px));
      max-height:min(190px,calc(100vh - 24px));
      overflow:hidden;
      padding:11px 14px;
      border:2px solid rgba(43,43,43,.28);
      background:${PAPER_BG};
      color:${INK};
      box-shadow:${PAPER_SHADOW};
      ${TORN_EDGE};
      font-family:${UI_FONT};
      font-size:14px;
      font-weight:800;
      line-height:1.35;
      text-align:center;
      pointer-events:none;
      user-select:none;
    }
    #speech-bubble[data-placement="above"] { transform:translate(-50%,-100%) rotate(-.6deg); }
    #speech-bubble[data-placement="side-left"],
    #speech-bubble[data-placement="side-right"] { transform:translate(-50%,-50%) rotate(-.6deg); }
    #speech-bubble[data-placement="side-left"]::after,
    #speech-bubble[data-placement="side-right"]::after {
      content:'';
      position:absolute;
      top:50%;
      width:12px;
      height:12px;
      box-sizing:border-box;
      background:${PAPER_BG};
      border-top:2px solid rgba(43,43,43,.28);
      border-right:2px solid rgba(43,43,43,.28);
      transform:translateY(-50%) rotate(45deg);
    }
    #speech-bubble[data-placement="side-left"]::after { right:-7px; }
    #speech-bubble[data-placement="side-right"]::after { left:-7px; transform:translateY(-50%) rotate(225deg); }
    #speech-bubble .speech-bubble__text {
      overflow:hidden;
      white-space:pre-wrap;
    }
    #speech-bubble .speech-bubble__hint {
      margin-top:5px;
      color:rgba(43,43,43,.7);
      font-size:.76em;
      font-style:italic;
      font-weight:700;
      line-height:1.3;
    }
    @media (max-width:600px) {
      #speech-bubble {
        width:min(240px,calc(100vw - 24px));
        max-width:min(240px,calc(100vw - 24px));
        padding:8px 10px;
        font-size:12px;
        line-height:1.25;
      }
      #speech-bubble .speech-bubble__text {
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
      }
      #speech-bubble .speech-bubble__hint { display:none; }
    }
    @media (prefers-reduced-motion:reduce) {
      #speech-bubble { transition:none !important; }
    }
  `;
  document.head.appendChild(style);
}

export class SpeechBubble {
  private readonly el: HTMLDivElement;
  private visible = false;
  private lastText = '';
  private lastHint = '';

  constructor() {
    ensureStyle();
    this.el = document.createElement('div');
    this.el.id = 'speech-bubble';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    this.el.dataset.placement = 'above';
    this.el.style.cssText = [
      'position:fixed',
      'z-index:45',
      'display:none',
    ].join(';');
    document.body.appendChild(this.el);
  }

  show(text: string, hint?: string): void {
    const nextHint = hint ?? '';
    if (this.lastText !== text || this.lastHint !== nextHint) {
      this.el.innerHTML = '';
      const textEl = document.createElement('div');
      textEl.className = 'speech-bubble__text';
      textEl.textContent = text;
      this.el.appendChild(textEl);
      if (nextHint) {
        const hintEl = document.createElement('div');
        hintEl.className = 'speech-bubble__hint';
        hintEl.textContent = nextHint;
        this.el.appendChild(hintEl);
      }
      this.lastText = text;
      this.lastHint = nextHint;
    }
    this.el.style.display = 'block';
    document.body.dataset.speechBubbleActive = 'true';
    document.getElementById('world-controls-hint')?.setAttribute('data-speech-active', 'true');
    this.visible = true;
  }

  /** 把气泡定位到世界坐标对应屏幕位置，优先上方，空间不足时横向避让。 */
  positionAt(worldX: number, worldY: number, camera: Camera): void {
    if (!this.visible) return;
    const cam = camera.cam;
    // 世界坐标 → 屏幕 CSS 像素（getWorldPoint 方向相反，不可用）
    const screenX = (worldX - cam.scrollX) * cam.zoom + cam.x;
    const screenY = (worldY - cam.scrollY) * cam.zoom + cam.y;
    const rect = this.el.getBoundingClientRect();
    const safeTop = window.innerWidth <= 600 ? 70 : VIEWPORT_MARGIN;
    const minCenterX = rect.width / 2 + VIEWPORT_MARGIN;
    const maxCenterX = window.innerWidth - rect.width / 2 - VIEWPORT_MARGIN;
    const aboveAnchorY = screenY - HEAD_OFFSET;
    const aboveFits = aboveAnchorY - rect.height >= safeTop;

    if (aboveFits) {
      this.el.dataset.placement = 'above';
      this.el.style.left = `${Math.max(minCenterX, Math.min(maxCenterX, screenX))}px`;
      this.el.style.top = `${aboveAnchorY}px`;
      return;
    }

    // 横向放置时，气泡的边缘与实体中心之间至少保留 ENTITY_GAP，避免压住实体。
    const leftCenter = screenX - rect.width / 2 - ENTITY_GAP;
    const rightCenter = screenX + rect.width / 2 + ENTITY_GAP;
    const canLeft = leftCenter - rect.width / 2 >= VIEWPORT_MARGIN;
    const canRight = rightCenter + rect.width / 2 <= window.innerWidth - VIEWPORT_MARGIN;
    const preferRight = screenX >= window.innerWidth / 2;
    const useRight = preferRight ? canRight || !canLeft : !canLeft && canRight;

    if (canLeft || canRight) {
      this.el.dataset.placement = useRight ? 'side-right' : 'side-left';
      const centerX = useRight ? rightCenter : leftCenter;
      const minCenterY = safeTop + rect.height / 2;
      const maxCenterY = window.innerHeight - rect.height / 2 - VIEWPORT_MARGIN;
      this.el.style.left = `${Math.max(minCenterX, Math.min(maxCenterX, centerX))}px`;
      this.el.style.top = `${Math.max(minCenterY, Math.min(maxCenterY, screenY))}px`;
      return;
    }

    // 极窄视口两侧都没有空间时，仍保持上方定位并贴在安全区内；此分支只会在
    // 气泡几乎占满视口时触发，避免用横向位置把实体推入不可见区域。
    this.el.dataset.placement = 'above';
    this.el.style.left = `${Math.max(minCenterX, Math.min(maxCenterX, screenX))}px`;
    this.el.style.top = `${Math.max(safeTop + rect.height, aboveAnchorY)}px`;
  }

  hide(): void {
    this.el.style.display = 'none';
    delete document.body.dataset.speechBubbleActive;
    document.getElementById('world-controls-hint')?.removeAttribute('data-speech-active');
    this.visible = false;
    this.lastText = '';
    this.lastHint = '';
  }
}
