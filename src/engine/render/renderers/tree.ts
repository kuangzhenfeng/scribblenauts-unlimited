/**
 * 树渲染器 —— 树干（手绘抖动多边形）+ 球状树冠（多圆）+ 纸片折角高光。
 */

import type { VectorRenderer } from '../VectorDraw';
import { wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

export const tree: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    // 树干（手绘抖动）
    wobblePolygon(g, [[-6, 40], [-4, -10], [4, -10], [6, 40]], 0.6, seed);
    g.fillStyle(0x6b4226, 1);
    g.lineStyle(2, 0x1b2233, 0.5);
    g.fillPath();
    g.strokePath();
    // 树冠（三层球，描边略抖动由 strokeCircle 本身圆滑）
    g.fillStyle(0x37b24d, 1);
    g.lineStyle(2, 0x1b2233, 0.4);
    g.fillCircle(0, -20, 20);
    g.strokeCircle(0, -20, 20);
    g.fillCircle(-14, -8, 14);
    g.strokeCircle(-14, -8, 14);
    g.fillCircle(14, -8, 14);
    g.strokeCircle(14, -8, 14);
    // 折角高光叶簇
    paperHighlight(g, -14, -34, 14, 14, 0.18);
    // 落地软影
    paperShadow(g, 8, 42, 0.2);
  },
  bounds: () => ({ minX: -28, minY: -40, maxX: 28, maxY: 42 }),
};
