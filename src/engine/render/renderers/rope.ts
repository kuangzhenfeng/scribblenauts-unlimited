/**
 * 绳子渲染器 —— 多股麻绳（手绘抖动绳身 + 股纹短线 + 绳结），可被切断。
 */

import type { VectorRenderer } from '../VectorDraw';
import { mulberry32 } from '../VectorDraw';

export const rope: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    const rnd = mulberry32(seed);
    // 绳身（手绘抖动竖线）
    g.lineStyle(6, 0xc9a36b, 1);
    g.beginPath();
    g.moveTo((rnd() - 0.5) * 1.2, -36);
    for (let y = -32; y <= 36; y += 8) {
      g.lineTo((rnd() - 0.5) * 1.2, y);
    }
    g.strokePath();
    // 股纹
    g.lineStyle(1.5, 0xa07840, 1);
    for (let y = -32; y <= 32; y += 8) {
      g.beginPath();
      g.moveTo(-3, y);
      g.lineTo(3, y + 4);
      g.strokePath();
    }
    // 绳结
    g.fillStyle(0x8b6b3a, 1);
    g.fillCircle(0, -36, 4);
  },
  bounds: () => ({ minX: -5, minY: -40, maxX: 5, maxY: 40 }),
};
