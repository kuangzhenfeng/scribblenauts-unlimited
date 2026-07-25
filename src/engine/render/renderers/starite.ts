/**
 * Starite 渲染器 —— 5 角星（金黄渐变 + 手绘抖动 + 轻旋浮动 + 折角高光）。
 *
 * 作为挑战完成 FX 实体（非物理体），由 SpawnFx.playStariteFly 创建并飞向 HUD。
 */

import type { VectorRenderer } from '../VectorDraw';
import { wobblePolygon, paperHighlight } from '../VectorDraw';

/** 5 角星顶点（外径 18，内径 8，尖端朝上） */
function starPoints(): (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 18 : 8;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export const starite: VectorRenderer = {
  draw: (dc) => {
    const { g, state, seed } = dc;
    const t = state.animTime * 0.003;
    const float = Math.sin(t * 2) * 2;
    g.save();
    g.translateCanvas(0, float);
    g.rotateCanvas(t);
    // 金黄渐变填充
    g.fillGradientStyle(0xffdc50, 0xffba08, 0xf59f00, 0xf59f00, 1, 1, 1, 1);
    wobblePolygon(g, starPoints(), 0.4, seed);
    g.fillPath();
    g.lineStyle(1.5, 0x1b2233, 0.55);
    g.strokePath();
    // 折角高光
    paperHighlight(g, -8, -10, 6, 8, 0.35);
    g.restore();
  },
  bounds: () => ({ minX: -18, minY: -18, maxX: 18, maxY: 18 }),
};
