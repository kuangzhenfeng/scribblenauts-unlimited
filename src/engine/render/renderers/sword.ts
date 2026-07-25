/**
 * 剑渲染器 —— 刀身（手绘抖动多边形）+ 护手/柄（矩形）+ 柄首（圆）+ 折角高光 + 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

export const sword: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    // 刀身（手绘抖动）
    wobblePolygon(g, [[0, -28], [4, -20], [4, 8], [-4, 8], [-4, -20]], 0.5, seed);
    g.fillStyle(0xd8dee6, 1);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.fillPath();
    g.strokePath();
    // 刀脊高光
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(-1, -20, 2, 26);
    // 护手
    g.fillStyle(0xc9a23b, 1);
    g.fillRect(-8, 8, 16, 4);
    // 柄
    g.fillStyle(0x6b4226, 1);
    g.fillRect(-2, 12, 4, 12);
    // 柄首
    g.fillStyle(0xc9a23b, 1);
    g.fillCircle(0, 26, 3);
    // 折角高光
    paperHighlight(g, -2, -26, 4, 8, 0.3);
    // 落地软影
    paperShadow(g, 6, 30, 0.14);
  },
  bounds: () => ({ minX: -8, minY: -28, maxX: 8, maxY: 30 }),
};
