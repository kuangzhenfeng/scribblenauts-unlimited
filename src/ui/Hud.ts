/**
 * HUD —— 左上角三图标组：背包计数 + 星星计数 + Maxwell 头像。
 * 对齐截图原版样式：三个圆形/方形胶囊按钮并排，深色轮廓，涂鸦卡通质感。
 */

import { ICON_BACKPACK, ICON_STAR, ICON_SHARD } from './icons';
import { SAFE_TOP, SAFE_LEFT, UI_FONT } from './paperStyle';

/** 单个图标胶囊按钮的 HTML */
function iconBtn(icon: string, label: string, extraStyle = ''): string {
  return `
    <div style="
      display:inline-flex;align-items:center;gap:5px;
      background:rgba(10,20,8,0.72);
      border:2.5px solid #1a1a1a;
      border-radius:22px;
      padding:5px 10px 5px 7px;
      box-shadow:0 3px 10px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.12);
      ${extraStyle}
    ">
      ${icon}
      <span style="font-family:${UI_FONT};font-size:15px;font-weight:700;color:#f5f0e0;text-shadow:0 1px 3px rgba(0,0,0,0.8);letter-spacing:0.03em;min-width:14px;text-align:center">${label}</span>
    </div>
  `.trim();
}

export class Hud {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      `left:${SAFE_LEFT}`,
      'z-index:50',
      'pointer-events:none',
      'display:flex',
      'align-items:center',
      'gap:6px',
    ].join(';');
    document.body.appendChild(this.el);
    this.render(0, 0);
  }

  /**
   * @param objectCount 当前场景物体数
   * @param stariteCount 已收集 Starite 数
   * @param shardCount 已收集碎片数
   */
  render(objectCount: number, stariteCount = 0, shardCount = 0): void {
    // 背包（物体数量）
    const bag = iconBtn(
      `<span style="color:#4ab3e8">${ICON_BACKPACK}</span>`,
      String(objectCount),
    );

    // 星星（Starite 数）
    const star = iconBtn(
      `<span style="color:#f5c518;filter:drop-shadow(0 0 4px #f5c51888)">${ICON_STAR}</span>`,
      String(stariteCount),
    );

    // 碎片（Shard 数）
    const shard = iconBtn(
      `<span style="color:#a8e4ff;filter:drop-shadow(0 0 3px #a8e4ff88)">${ICON_SHARD}</span>`,
      String(shardCount),
    );

    // Maxwell 头像（圆形人脸）
    const maxwellPortrait = `
      <div style="
        display:inline-flex;align-items:center;justify-content:center;
        width:36px;height:36px;
        background:radial-gradient(circle at 40% 35%, #fddbb4 60%, #d4924a 100%);
        border:2.5px solid #1a1a1a;
        border-radius:50%;
        box-shadow:0 3px 10px rgba(0,0,0,0.55);
        position:relative;overflow:hidden;
      ">
        <!-- 红色罗纹帽 -->
        <div style="
          position:absolute;top:0;left:0;right:0;height:38%;
          background:linear-gradient(180deg,#cc2222 0%,#aa1818 100%);
          border-radius:50% 50% 0 0 / 60% 60% 0 0;
        "></div>
        <!-- 眼睛 -->
        <div style="position:absolute;top:43%;display:flex;gap:6px;left:50%;transform:translateX(-50%)">
          <div style="width:5px;height:5px;background:#1a1a1a;border-radius:50%"></div>
          <div style="width:5px;height:5px;background:#1a1a1a;border-radius:50%"></div>
        </div>
      </div>
    `.trim();

    this.el.innerHTML = bag + star + shard + maxwellPortrait;
  }
}
