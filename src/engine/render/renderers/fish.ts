/**
 * 鱼渲染器 —— 流线身体 + 尾鳍摆动（save/restore + rotateCanvas）+ 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { hexToNum, paperShadow } from '../VectorDraw';

export const fish: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    void seed;
    const bodyColor = state.colorOverride ?? (params.bodyColor as string) ?? '#F59F00';
    const t = state.animTime * 0.015;
    const tail = Math.sin(t) * 0.4;

    g.fillStyle(hexToNum(bodyColor), 1);
    g.lineStyle(1.5, 0x1b2233, 0.4);

    // 身体
    g.fillEllipse(0, 0, 32, 14);
    g.strokeEllipse(0, 0, 32, 14);

    // 尾鳍
    g.save();
    g.translateCanvas(-14, 0);
    g.rotateCanvas(tail);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-8, -6);
    g.lineTo(-8, 6);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.restore();

    // 眼
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(8 * state.facing, -2, 1.5);

    // 落地软影
    paperShadow(g, 16, 8, 0.1);
  },
  bounds: () => ({ minX: -22, minY: -8, maxX: 18, maxY: 8 }),
};
