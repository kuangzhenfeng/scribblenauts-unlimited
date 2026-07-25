/**
 * 轮子渲染器 —— 橡胶胎（圆）+ 金属轮毂（圆）+ 轮辐线（随 spin 旋转）+ 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { paperShadow } from '../VectorDraw';

export const wheel: VectorRenderer = {
  draw: (dc) => {
    const { g, state, seed } = dc;
    void seed;
    const t = state.animTime * 0.02;
    const spin = state.locomotion === 'walk' || state.locomotion === 'jump' ? t : 0;

    // 轮胎
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(0, 0, 15);

    // 轮毂
    g.fillStyle(0xc9a23b, 1);
    g.fillCircle(0, 0, 7);

    // 轮辐（随 spin 旋转）
    g.lineStyle(2.5, 0x8b6b3a, 1);
    for (let i = 0; i < 4; i++) {
      const a = spin + (i / 4) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      g.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      g.strokePath();
    }
    // 落地软影
    paperShadow(g, 15, 16, 0.18);
  },
  bounds: () => ({ minX: -15, minY: -15, maxX: 15, maxY: 16 }),
};
