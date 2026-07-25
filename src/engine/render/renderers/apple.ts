/**
 * 苹果渲染器 —— 红果 + 叶 + 梗（手绘抖动描边 + 纸片折角高光 + 落地软影）。
 */

import type { VectorRenderer } from '../VectorDraw';
import { paperHighlight, paperShadow } from '../VectorDraw';

export const apple: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    void seed;
    // 梗
    g.lineStyle(3, 0x6b4226, 1);
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(2, -16);
    g.strokePath();
    // 叶
    g.fillStyle(0x37b24d, 1);
    g.fillEllipse(6, -14, 8, 4);
    // 果体
    g.fillStyle(0xe03131, 1);
    g.lineStyle(1.5, 0x1b2233, 0.45);
    g.fillCircle(0, 2, 10);
    g.strokeCircle(0, 2, 10);
    // 折角高光
    paperHighlight(g, -5, -4, 6, 6, 0.32);
    // 落地软影
    paperShadow(g, 9, 14, 0.16);
  },
  bounds: () => ({ minX: -10, minY: -16, maxX: 10, maxY: 14 }),
};
