/**
 * 触手渲染器 —— 章鱼。8 触手多段正弦波动（二次贝塞尔离散化），整体上下浮动。
 * 涂鸦纸片质感：描边加深。
 */

import type { VectorRenderer } from '../VectorDraw';
import { hexToNum, shade, bezierQuadraticFrom, paperShadow } from '../VectorDraw';

export const tentacled: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    void seed;
    const bodyColor = state.colorOverride ?? (params.bodyColor as string) ?? '#E0567A';
    const t = state.animTime * 0.005;
    const float = Math.sin(t * 2) * 3;

    g.save();
    g.translateCanvas(0, float);

    // 8 触手
    g.lineStyle(5, shade(bodyColor, -0.1), 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const baseX = Math.cos(angle) * 12;
      const baseY = Math.sin(angle) * 6 + 4;
      const wave = Math.sin(t + i * 0.8) * 6;
      g.beginPath();
      g.moveTo(baseX, baseY);
      bezierQuadraticFrom(
        g,
        baseX, baseY,
        baseX + Math.cos(angle) * 8 + wave,
        baseY + Math.sin(angle) * 12,
        baseX + Math.cos(angle) * 4 + wave,
        baseY + 22,
      );
      g.strokePath();
    }

    // 头部
    g.fillStyle(hexToNum(bodyColor), 1);
    g.fillEllipse(0, -6, 36, 28);
    g.lineStyle(2, 0x1b2233, 0.4);
    g.strokeEllipse(0, -6, 36, 28);

    // 眼白
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-5, -8, 4);
    g.fillCircle(5, -8, 4);
    // 瞳
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(-5 + state.facing, -8, 1.8);
    g.fillCircle(5 + state.facing, -8, 1.8);

    g.restore();

    // 落地软影
    paperShadow(g, 18, 22, 0.12);
  },
  bounds: () => ({ minX: -24, minY: -22, maxX: 24, maxY: 28 }),
};
