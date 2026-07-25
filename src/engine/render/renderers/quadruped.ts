/**
 * 四足动物渲染器 —— 狗/猫/牛等共用。
 *
 * 参数化：bodyColor、spots（奶牛斑）。本地坐标 (0,0) 为躯干中心。
 * 状态机按 locomotion 摆腿（正弦周期动画），跳跃纵向拉伸。
 * 涂鸦纸片质感：躯干手绘抖动 + 落地软影。
 */

import type { VectorRenderer, DrawContext } from '../VectorDraw';
import { hexToNum, shade, bezierQuadraticFrom, wobblePolygon, paperShadow } from '../VectorDraw';

export const quadruped: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    const bodyColor = state.colorOverride ?? (params.bodyColor as string) ?? '#8B5A2B';
    const spots = (params.spots as boolean) ?? false;
    const t = state.animTime;
    const walking = state.locomotion === 'walk' || state.locomotion === 'idle';
    const jumping = state.locomotion === 'jump';
    const swing = walking ? Math.sin(t * 0.012) * 0.35 : 0;
    const bodyNum = hexToNum(bodyColor);
    const legColor = shade(bodyColor, -0.25);

    g.save();
    if (jumping) g.scaleCanvas(0.9, 1.1);

    // 腿（后左/后右/前左/前右，对角相位差 π）
    g.lineStyle(6, legColor, 1);
    leg(g, -14, 4, swing, seed + 1);
    leg(g, -14, 4, -swing, seed + 2);
    leg(g, 14, 4, -swing, seed + 3);
    leg(g, 14, 4, swing, seed + 4);

    // 躯干（手绘抖动矩形）
    wobblePolygon(g, [[-22, -10], [18, -10], [18, 8], [-22, 8]], 0.6, seed + 5);
    g.fillStyle(bodyNum, 1);
    g.lineStyle(2, 0x1b2233, 0.45);
    g.fillPath();
    g.strokePath();

    // 奶牛斑
    if (spots) {
      g.fillStyle(0x2b2b2b, 1);
      g.fillEllipse(-8, -2, 10, 8);
      g.fillEllipse(6, 2, 12, 6);
    }

    // 头
    const hx = 18 * state.facing;
    g.fillStyle(bodyNum, 1);
    g.fillEllipse(hx, -12, 20, 16);
    g.lineStyle(2, 0x1b2233, 0.45);
    g.strokeEllipse(hx, -12, 20, 16);

    // 耳
    g.fillStyle(shade(bodyColor, -0.15), 1);
    g.fillEllipse(hx - 4 * state.facing, -20, 6, 10);
    g.fillEllipse(hx + 4 * state.facing, -20, 6, 10);

    // 眼
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(hx + 3 * state.facing, -13, 1.4);

    // 尾（路径 + 二次贝塞尔）
    g.lineStyle(4, shade(bodyColor, -0.15), 1);
    g.beginPath();
    g.moveTo(-22, -6);
    bezierQuadraticFrom(g, -22, -6, -30, -10 + swing * 6, -32, -16 + swing * 8);
    g.strokePath();

    g.restore();

    // 落地软影
    paperShadow(g, 24, 12, 0.16);
  },
  bounds: () => ({ minX: -32, minY: -22, maxX: 24, maxY: 14 }),
};

function leg(g: DrawContext['g'], x: number, y: number, phase: number, seed: number): void {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + phase * 8, y + 12);
  g.strokePath();
  void seed;
}
