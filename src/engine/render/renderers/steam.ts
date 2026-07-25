/**
 * 蒸汽渲染器 —— 半透明白雾（4 圆缓慢上升扩散）。
 */

import type { VectorRenderer } from '../VectorDraw';

export const steam: VectorRenderer = {
  draw: (dc) => {
    const { g, state, seed } = dc;
    void seed;
    const t = state.animTime * 0.003;
    g.fillStyle(0xf0f0f0, 0.55);
    for (let i = 0; i < 4; i++) {
      const x = Math.sin(t + i) * 6;
      const y = -i * 4 - Math.abs(Math.sin(t + i * 2)) * 4;
      const r = 5 + i * 1.5;
      g.fillCircle(x, y, r);
    }
  },
  bounds: () => ({ minX: -12, minY: -24, maxX: 12, maxY: 6 }),
};
