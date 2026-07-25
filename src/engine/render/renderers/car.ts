/**
 * 汽车渲染器 —— 车身（手绘抖动多边形）+ 车窗 + 轮子（圆 + 轮辐线）+ 折角高光 + 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { hexToNum, wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

export const car: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    const bodyColor = state.colorOverride ?? (params.bodyColor as string) ?? '#E03131';
    const t = state.animTime * 0.02;
    const wheelSpin = state.locomotion === 'walk' || state.locomotion === 'jump' ? Math.sin(t) * 0.3 : 0;

    // 车身（手绘抖动）
    wobblePolygon(
      g,
      [[-36, 0], [-28, -8], [-10, -16], [12, -16], [28, -8], [36, 0], [36, 8], [-36, 8]],
      0.6,
      seed,
    );
    g.fillStyle(hexToNum(bodyColor), 1);
    g.lineStyle(2, 0x1b2233, 0.55);
    g.fillPath();
    g.strokePath();

    // 车窗
    g.fillStyle(0x96c8eb, 0.8);
    g.beginPath();
    g.moveTo(-24, -6);
    g.lineTo(-12, -14);
    g.lineTo(10, -14);
    g.lineTo(24, -6);
    g.closePath();
    g.fillPath();

    // 折角高光
    paperHighlight(g, -34, -6, 18, 6, 0.18);

    // 轮子
    for (const wx of [-22, 22]) {
      g.fillStyle(0x1a1a1a, 1);
      g.fillCircle(wx, 10, 8);
      // 轮辐
      g.lineStyle(1.5, 0x888888, 1);
      g.beginPath();
      g.moveTo(wx + Math.cos(wheelSpin) * 6, 10 + Math.sin(wheelSpin) * 6);
      g.lineTo(wx - Math.cos(wheelSpin) * 6, 10 - Math.sin(wheelSpin) * 6);
      g.strokePath();
    }
    // 落地软影
    paperShadow(g, 36, 18, 0.18);
  },
  bounds: () => ({ minX: -36, minY: -16, maxX: 36, maxY: 18 }),
};
