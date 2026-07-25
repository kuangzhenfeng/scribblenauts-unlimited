/**
 * 石头渲染器 —— 不规则多边形岩石（手绘抖动路径 + 纸片折角高光 + 落地软影）。
 */

import type { VectorRenderer } from '../VectorDraw';
import { wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

const PTS: readonly (readonly [number, number])[] = [
  [-18, 4], [-12, -10], [2, -14], [14, -8], [18, 4], [10, 12], [-6, 12],
];

export const stone: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    wobblePolygon(g, PTS, 0.8, seed);
    g.fillStyle(0x9a938a, 1);
    g.lineStyle(2, 0x1b2233, 0.5);
    g.fillPath();
    g.strokePath();
    // 纸片折角高光
    paperHighlight(g, -12, -10, 12, 8, 0.2);
    // 落地软影
    paperShadow(g, 18, 14, 0.18);
  },
  bounds: () => ({ minX: -18, minY: -14, maxX: 18, maxY: 12 }),
};
