/**
 * HUD —— 左上角三图标组：背包计数 + 星星计数 + Maxwell 头像。
 * 对齐截图原版样式：三个圆形/方形胶囊按钮并排，深色轮廓，涂鸦卡通质感。
 */

import { ICON_BACKPACK, ICON_STAR } from './icons';
import { SAFE_TOP, SAFE_LEFT, UI_FONT } from './paperStyle';

/** 单个资源图标的 HTML：保留原版三项资源栏的轻量层级。 */
function iconBtn(icon: string, label: string, extraStyle = ''): string {
  return `
    <div style="
      position:relative;display:grid;place-items:center;
      width:46px;height:46px;box-sizing:border-box;
      background:#f4c54f;
      border:2px solid #6a3d08;
      border-radius:10px;
      padding:0;
      box-shadow:0 2px 0 #6a3d08,0 4px 8px rgba(48,34,18,0.18),inset 0 1px 0 rgba(255,255,255,0.48);
      ${extraStyle}
    ">
      ${icon}
      <span style="position:absolute;right:-6px;bottom:-6px;min-width:17px;height:17px;box-sizing:border-box;padding:1px 4px;border:2px solid #6a3d08;border-radius:9px;background:#fff2b2;font-family:${UI_FONT};font-size:10px;font-weight:900;line-height:12px;color:#5a3105;text-align:center">${label}</span>
    </div>
  `.trim();
}

export class Hud {
  private readonly el: HTMLDivElement;
  private lastObjectCount: number | undefined;
  private lastStariteCount: number | undefined;

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
      'gap:7px',
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
    if (this.lastObjectCount === objectCount && this.lastStariteCount === stariteCount) return;
    this.lastObjectCount = objectCount;
    this.lastStariteCount = stariteCount;

    // 背包（物体数量）
    const bag = iconBtn(
      `<span style="color:#1676b8;filter:drop-shadow(0 1px 0 rgba(255,255,255,0.55))">${ICON_BACKPACK}</span>`,
      String(objectCount),
    );

    // 星星（Starite 数）
    const star = iconBtn(
      `<span style="color:#fff3a4;filter:drop-shadow(0 1px 1px #a05a00)">${ICON_STAR}</span>`,
      String(stariteCount),
    );
    // 碎片仍由进度系统维护，但不在默认游玩 HUD 单独占格，避免资源栏变成工具条。
    void shardCount;

    // Maxwell 头像（圆形人脸）
    const maxwellPortrait = `
      <div style="
        display:inline-flex;align-items:center;justify-content:center;
        width:40px;height:40px;
        background:radial-gradient(circle at 40% 35%, #fddbb4 60%, #d4924a 100%);
        border:2.5px solid #6a3d08;
        border-radius:50%;
        box-shadow:0 2px 0 #6a3d08,0 4px 8px rgba(48,34,18,0.18);
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

    this.el.innerHTML = bag + star + maxwellPortrait;
  }
}
