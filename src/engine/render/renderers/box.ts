/**
 * 方块渲染器 —— 以本地 (0,0) 为中心绘制带圆角与描边的方块。
 *
 * 涂鸦纸片质感：手绘抖动描边 + 纸片折角高光 + 落地软影。
 * 颜色由 params.color 或 state.colorOverride 覆盖，大小由 params.w/h（默认 48）决定。
 */

import type { VectorRenderer } from '../VectorDraw';
import { hexToNum, wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

const DEFAULT_W = 48;
const DEFAULT_H = 48;
const DEFAULT_COLOR = '#E2A65B';

export const box: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    const w = (params.w as number) ?? DEFAULT_W;
    const h = (params.h as number) ?? DEFAULT_H;
    const color = state.colorOverride ?? (params.color as string) ?? DEFAULT_COLOR;
    const num = hexToNum(color);
    const hw = w / 2;
    const hh = h / 2;

    // 主体（手绘抖动矩形路径）
    wobblePolygon(g, [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], 0.7, seed);
    g.fillStyle(num, 1);
    g.fillPath();
    g.lineStyle(2, 0x1b2233, 0.55);
    g.strokePath();

    // 纸片折角高光（左上斜亮带）
    paperHighlight(g, -hw + 4, -hh + 4, w * 0.3, h * 0.3, 0.2);
    // 落地软影
    paperShadow(g, hw, hh + 4, 0.16);
  },
  bounds: (params) => {
    const w = (params.w as number) ?? DEFAULT_W;
    const h = (params.h as number) ?? DEFAULT_H;
    return { minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 };
  },
};
