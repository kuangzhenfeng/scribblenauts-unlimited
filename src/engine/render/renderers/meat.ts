/**
 * 肉渲染器 —— 带骨的肉块（椭圆 + 骨线 + 折角高光 + 落地软影）。
 */

import type { VectorRenderer } from '../VectorDraw';
import { paperHighlight, paperShadow } from '../VectorDraw';

export const meat: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    void seed;
    // 骨
    g.lineStyle(4, 0xf0e6d2, 1);
    g.beginPath();
    g.moveTo(-12, -6);
    g.lineTo(-16, -10);
    g.strokePath();
    g.beginPath();
    g.moveTo(12, -6);
    g.lineTo(16, -10);
    g.strokePath();
    // 肉块
    g.fillStyle(0xc9402b, 1);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.fillEllipse(0, 2, 28, 18);
    g.strokeEllipse(0, 2, 28, 18);
    // 脂肪纹理
    g.fillStyle(0xfff0dc, 0.5);
    g.fillEllipse(0, 4, 16, 6);
    // 折角高光
    paperHighlight(g, -10, -4, 10, 6, 0.22);
    // 落地软影
    paperShadow(g, 14, 12, 0.16);
  },
  bounds: () => ({ minX: -16, minY: -12, maxX: 16, maxY: 12 }),
};
