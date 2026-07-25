/**
 * 鸟渲染器 —— 小型飞行生物。翅膀拍动（save/restore + rotateCanvas），身体椭圆。
 * 涂鸦纸片质感：描边加深 + 落地软影。
 */

import type { VectorRenderer } from '../VectorDraw';
import { hexToNum, shade, paperShadow } from '../VectorDraw';

export const bird: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    void seed;
    const bodyColor = state.colorOverride ?? (params.bodyColor as string) ?? '#4A90E2';
    const t = state.animTime * 0.02;
    const flap = Math.sin(t) * 0.5;
    const bodyNum = hexToNum(bodyColor);

    // 左翅
    g.save();
    g.translateCanvas(-6, -2);
    g.rotateCanvas(-flap);
    g.fillStyle(shade(bodyColor, 0.1), 1);
    g.fillEllipse(-8, 0, 20, 10);
    g.lineStyle(1.5, 0x1b2233, 0.4);
    g.strokeEllipse(-8, 0, 20, 10);
    g.restore();
    // 右翅
    g.save();
    g.translateCanvas(6, -2);
    g.rotateCanvas(flap);
    g.fillStyle(shade(bodyColor, 0.1), 1);
    g.fillEllipse(8, 0, 20, 10);
    g.lineStyle(1.5, 0x1b2233, 0.4);
    g.strokeEllipse(8, 0, 20, 10);
    g.restore();

    // 身体
    g.fillStyle(bodyNum, 1);
    g.fillEllipse(0, 0, 18, 14);
    g.lineStyle(1.5, 0x1b2233, 0.4);
    g.strokeEllipse(0, 0, 18, 14);

    // 头
    g.fillStyle(bodyNum, 1);
    g.fillCircle(7 * state.facing, -4, 5);
    g.lineStyle(1.5, 0x1b2233, 0.4);
    g.strokeCircle(7 * state.facing, -4, 5);
    // 喙
    g.fillStyle(0xf59f00, 1);
    g.beginPath();
    g.moveTo(11 * state.facing, -4);
    g.lineTo(16 * state.facing, -3);
    g.lineTo(11 * state.facing, -2);
    g.closePath();
    g.fillPath();
    // 眼
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(8 * state.facing, -5, 1);

    // 落地软影（飞行时也在下方留淡影）
    paperShadow(g, 9, 8, 0.1);
  },
  bounds: () => ({ minX: -18, minY: -10, maxX: 18, maxY: 10 }),
};
