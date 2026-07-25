/**
 * 火焰渲染器 —— 程序化跳动火苗（多段正弦叠加 + 渐变填充）。
 *
 * 涂鸦纸片质感：火苗用二次贝塞尔离散化做手绘曲线。
 */

import type { VectorRenderer } from '../VectorDraw';
import { bezierQuadraticFrom } from '../VectorDraw';

export const fire: VectorRenderer = {
  draw: (dc) => {
    const { g, state, seed } = dc;
    void seed;
    const t = state.animTime * 0.006;
    // 外焰 3 段（用二次贝塞尔离散化做火苗曲线）
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(t + i * 2.1) * 4;
      const h = 36 - i * 6;
      const sx = ox - 10 + i * 2;
      const ex = ox + 10 - i * 2;
      g.fillGradientStyle(0xff5a00, 0xff8c00, 0xffdc50, 0xffdc50, 0, 0.85, 0.98, 0.98);
      g.beginPath();
      g.moveTo(sx, 12);
      bezierQuadraticFrom(g, sx, 12, ox - 6, -h * 0.6, ox, -h);
      bezierQuadraticFrom(g, ox, -h, ox + 6, -h * 0.6, ex, 12);
      g.closePath();
      g.fillPath();
    }
    // 焦黑芯
    g.fillStyle(0x782800, 0.6);
    g.fillEllipse(0, 6, 10, 8);
  },
  bounds: () => ({ minX: -14, minY: -38, maxX: 14, maxY: 14 }),
};
