/**
 * 刀渲染器 —— 短刀身（手绘抖动多边形）+ 木质柄（矩形）+ 折角高光 + 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

export const knife: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    // 刀身（手绘抖动）
    wobblePolygon(g, [[0, -16], [3, -10], [3, 4], [-3, 4], [-3, -10]], 0.5, seed);
    g.fillStyle(0xd8dee6, 1);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.fillPath();
    g.strokePath();
    // 护手
    g.fillStyle(0x8b6b3a, 1);
    g.fillRect(-5, 4, 10, 3);
    // 柄
    g.fillStyle(0x6b4226, 1);
    g.fillRect(-2, 7, 4, 10);
    // 折角高光
    paperHighlight(g, -2, -14, 3, 6, 0.3);
    // 落地软影
    paperShadow(g, 4, 18, 0.14);
  },
  bounds: () => ({ minX: -5, minY: -16, maxX: 5, maxY: 18 }),
};
