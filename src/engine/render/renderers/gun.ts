/**
 * 枪渲染器 —— 枪管/枪膛/握把/扳机护圈（手绘抖动描边 + 落地软影）。
 */

import type { VectorRenderer } from '../VectorDraw';
import { paperHighlight, paperShadow } from '../VectorDraw';

export const gun: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    void seed;
    g.fillStyle(0x3a3a3a, 1);
    g.lineStyle(1.5, 0x1b2233, 0.55);
    // 枪管
    g.fillRect(-14, -4, 22, 6);
    g.strokeRect(-14, -4, 22, 6);
    // 枪膛
    g.fillRect(-14, -2, 8, 10);
    g.strokeRect(-14, -2, 8, 10);
    // 握把
    g.fillStyle(0x6b4226, 1);
    g.beginPath();
    g.moveTo(-12, 8);
    g.lineTo(-16, 16);
    g.lineTo(-10, 16);
    g.lineTo(-8, 8);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // 扳机护圈
    g.lineStyle(2, 0x3a3a3a, 1);
    g.beginPath();
    g.arc(-8, 10, 3, 0, Math.PI * 2);
    g.strokePath();
    // 折角高光
    paperHighlight(g, -14, -4, 8, 3, 0.25);
    // 落地软影
    paperShadow(g, 10, 18, 0.14);
  },
  bounds: () => ({ minX: -16, minY: -4, maxX: 8, maxY: 16 }),
};
