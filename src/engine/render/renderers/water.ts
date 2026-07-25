/**
 * 水渲染器 —— 半透明蓝水体，表面正弦波（路径填充）+ 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { paperShadow } from '../VectorDraw';

export const water: VectorRenderer = {
  draw: (dc) => {
    const { g, state, seed } = dc;
    void seed;
    const t = state.animTime * 0.004;
    g.fillStyle(0x56a6eb, 0.78);
    g.lineStyle(1.5, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(-16, 0);
    for (let x = -16; x <= 16; x += 4) {
      g.lineTo(x, Math.sin(t + x * 0.3) * 1.5);
    }
    g.lineTo(16, 14);
    g.lineTo(-16, 14);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // 落地软影
    paperShadow(g, 16, 16, 0.14);
  },
  bounds: () => ({ minX: -16, minY: -4, maxX: 16, maxY: 16 }),
};
