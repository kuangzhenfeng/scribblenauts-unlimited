/**
 * 对话气泡 UI —— 原版挑战条，展示 NPC 需求陈述与笔记本入口提示。
 *
 * DialogSystem 仍按世界实体距离决定显示时机；本组件只负责把对话定位到 NPC
 * 上方或侧边，避免文本层覆盖 NPC、玩家和正在观察的交互结果。
 */

import type { Camera } from '@/engine/render/Camera';
import { UI_FONT, PAPER_BG, INK, PAPER_SHADOW } from './paperStyle';
import { ICON_MAXWELL, ICON_PENCIL } from './icons';
import { t } from '@/core/i18n/I18n';

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
      width:min(320px,calc(100vw - 32px));
      max-width:min(320px,calc(100vw - 32px));
      max-height:min(190px,calc(100vh - 24px));
      display:flex;
      flex-direction:column;
      overflow:hidden;
      border:3px solid #6a3d08;
      border-radius:10px;
      background:#f1bd3b;
      color:${INK};
      box-shadow:0 4px 0 rgba(61,34,0,.72),${PAPER_SHADOW};
      font-family:${UI_FONT};
      text-align:center;
      pointer-events:none;
      user-select:none;
    }
    #speech-bubble[data-placement="above"] { transform:translate(-50%,-100%) rotate(-.2deg); }
    #speech-bubble[data-placement="side-left"],
    #speech-bubble[data-placement="side-right"] { transform:translate(-50%,-50%) rotate(-.2deg); }
    #speech-bubble[data-placement="side-left"]::after,
    #speech-bubble[data-placement="side-right"]::after {
      content:'';
      position:absolute;
      top:50%;
      width:12px;
      height:12px;
      box-sizing:border-box;
      background:#f1bd3b;
      border-top:2px solid #6a3d08;
      border-right:2px solid #6a3d08;
      transform:translateY(-50%) rotate(45deg);
    }
    #speech-bubble[data-placement="side-left"]::after { right:-7px; }
    #speech-bubble[data-placement="side-right"]::after { left:-7px; transform:translateY(-50%) rotate(225deg); }
    #speech-bubble .speech-bubble__main {
      display:grid;
      grid-template-columns:58px minmax(0,1fr);
      align-items:center;
      min-height:58px;
      background:#f5ca56;
      text-align:left;
    }
    #speech-bubble .speech-bubble__avatar {
      display:grid;
      place-items:center;
      align-self:stretch;
      color:#c92c24;
      background:${PAPER_BG};
      border-right:2px solid #6a3d08;
    }
    #speech-bubble .speech-bubble__avatar svg { width:34px; height:34px; }
    #speech-bubble .speech-bubble__copy {
      min-width:0;
      padding:8px 14px 7px;
    }
    #speech-bubble .speech-bubble__text {
      overflow:hidden;
      white-space:pre-wrap;
      color:#4e2f06;
      font-size:15px;
      font-weight:950;
      line-height:1.3;
    }
    #speech-bubble .speech-bubble__hint {
      margin-top:3px;
      overflow:hidden;
      color:#7f5a18;
      font-size:11px;
      font-weight:800;
      line-height:1.25;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #speech-bubble .speech-bubble__cue {
      display:flex;
      align-items:center;
      justify-content:flex-start;
      gap:8px;
      min-height:34px;
      padding:5px 12px;
      color:#fff5ce;
      background:#d98e16;
      border-top:2px solid #6a3d08;
      font-size:12px;
      font-weight:900;
      letter-spacing:.02em;
      text-align:left;
    }
    #speech-bubble .speech-bubble__cue-icon {
      display:grid;
      place-items:center;
      width:20px;
      height:20px;
      flex:none;
    }
    #speech-bubble .speech-bubble__cue-key {
      display:inline-grid;
      place-items:center;
      min-width:42px;
      min-height:22px;
      padding:2px 7px;
      margin-left:auto;
      color:#4e2f06;
      background:#f8dfa0;
      border:1px solid #6a3d08;
      border-radius:5px;
      font-size:11px;
      font-weight:950;
    }
    @media (max-width:600px) {
      #speech-bubble {
        width:min(260px,calc(100vw - 24px));
        max-width:min(260px,calc(100vw - 24px));
      }
      #speech-bubble .speech-bubble__main {
        grid-template-columns:44px minmax(0,1fr);
        min-height:50px;
      }
      #speech-bubble .speech-bubble__avatar svg { width:28px; height:28px; }
      #speech-bubble .speech-bubble__copy { padding:6px 9px 5px; }
      #speech-bubble .speech-bubble__text {
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
        font-size:12px;
        line-height:1.25;
      }
      #speech-bubble .speech-bubble__hint {
        display:none;
      }
    }
    @media (prefers-reduced-motion:reduce) {
      #speech-bubble[data-placement="above"] { transform:translate(-50%,-100%); }
      #speech-bubble[data-placement="side-left"],
      #speech-bubble[data-placement="side-right"] { transform:translate(-50%,-50%); }
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
      const main = document.createElement('div');
      main.className = 'speech-bubble__main';
      const avatar = document.createElement('div');
      avatar.className = 'speech-bubble__avatar';
      avatar.innerHTML = ICON_MAXWELL;
      main.appendChild(avatar);

      const copy = document.createElement('div');
      copy.className = 'speech-bubble__copy';
      const textEl = document.createElement('div');
      textEl.className = 'speech-bubble__text';
      textEl.textContent = text;
      copy.appendChild(textEl);
      if (nextHint) {
        const hintEl = document.createElement('div');
        hintEl.className = 'speech-bubble__hint';
        hintEl.textContent = nextHint;
        copy.appendChild(hintEl);
      }
      main.appendChild(copy);
      this.el.appendChild(main);

      const cue = document.createElement('div');
      cue.className = 'speech-bubble__cue';
      cue.innerHTML = `<span class="speech-bubble__cue-icon">${ICON_PENCIL}</span><span>${t('actionPanel.use')}</span><span class="speech-bubble__cue-key">${t('actionPanel.useHint')}</span>`;
      this.el.appendChild(cue);
      this.lastText = text;
      this.lastHint = nextHint;
    }
    this.el.style.display = 'block';
    document.body.dataset.speechBubbleActive = 'true';
    document.getElementById('world-controls-hint')?.setAttribute('data-speech-active', 'true');
    this.visible = true;
  }

  /** 把气泡定位到 NPC 对应的屏幕位置，优先上方，空间不足时横向避让。 */
  positionAt(worldX: number, worldY: number, camera: Camera): void {
    if (!this.visible) return;
    const screen = camera.worldToScreen(worldX, worldY);
    const screenX = screen.x;
    const screenY = screen.y;
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

    // 横向放置时，气泡边缘与实体中心之间保留间距，避免压住实体。
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

    // 极窄视口两侧都没有空间时，仍保持上方定位并贴在安全区内。
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
