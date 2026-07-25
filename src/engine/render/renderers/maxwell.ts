/**
 * Maxwell 渲染器 —— 玩家专属形象（罗纹帽 + 背包带 + 表情眼 + 走路 bounce）。
 *
 * 基于 biped 比例，但独立渲染器：biped 是通用两足人形模板（NPC 复用），
 * Maxwell 是 IP 主角有独立视觉身份。跳跃=scaleCanvas 纵向拉伸（squash/stretch）。
 * 涂鸦纸片质感：躯干手绘抖动 + 落地软影。
 */

import type { VectorRenderer, DrawContext } from '../VectorDraw';
import { hexToNum, wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

export const maxwell: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    const shirtColor = (params.shirtColor as string) ?? '#E74C3C';
    const pantsColor = (params.pantsColor as string) ?? '#3A3A3A';
    const skinColor = (params.skinColor as string) ?? '#F2C9A0';
    const t = state.animTime;
    const walking = state.locomotion === 'walk';
    const idle = state.locomotion === 'idle';
    const jumping = state.locomotion === 'jump';
    const swing = walking ? Math.sin(t * 0.014) * 0.5 : 0;
    const bob = idle ? Math.sin(t * 0.005) * 1.2 : 0;
    const bounce = walking ? Math.abs(Math.sin(t * 0.014)) * -2 : 0;

    g.save();
    if (jumping) g.scaleCanvas(0.88, 1.15);
    g.translateCanvas(0, bob + bounce);

    // 腿
    g.lineStyle(7, hexToNum(pantsColor), 1);
    leg(g, -5, 8, swing);
    leg(g, 5, 8, -swing);

    // 躯干（手绘抖动矩形）
    wobblePolygon(g, [[-10, -16], [10, -16], [10, 8], [-10, 8]], 0.5, seed + 3);
    g.fillStyle(hexToNum(shirtColor), 1);
    g.lineStyle(2, 0x1b2233, 0.45);
    g.fillPath();
    g.strokePath();

    // 背包带（斜跨深色带）
    g.fillStyle(0x2b2b2b, 0.85);
    g.beginPath();
    g.moveTo(-10, -16);
    g.lineTo(10, -10);
    g.lineTo(10, -6);
    g.lineTo(-10, -12);
    g.closePath();
    g.fillPath();

    // 臂
    g.lineStyle(6, hexToNum(shirtColor), 1);
    arm(g, -12, -10, -swing);
    arm(g, 12, -10, swing);

    // 手
    g.fillStyle(hexToNum(skinColor), 1);
    g.fillCircle(-12 + -swing * 8, 4, 3);
    g.fillCircle(12 + swing * 8, 4, 3);

    // 头
    g.fillStyle(hexToNum(skinColor), 1);
    g.fillCircle(0, -24, 8);
    g.lineStyle(2, 0x1b2233, 0.45);
    g.strokeCircle(0, -24, 8);

    // 罗纹帽（红色锯齿冠）
    g.fillStyle(0xe03131, 1);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.beginPath();
    g.moveTo(-7, -30);
    g.lineTo(-5, -34);
    g.lineTo(-2, -30);
    g.lineTo(0, -35);
    g.lineTo(2, -30);
    g.lineTo(5, -34);
    g.lineTo(7, -30);
    g.closePath();
    g.fillPath();
    g.strokePath();
    paperHighlight(g, -5, -33, 4, 3, 0.3);

    // 表情眼（加大眼白+瞳孔，facing 偏移）
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-3 + state.facing, -25, 1.6);
    g.fillCircle(4 + state.facing, -25, 1.6);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(-3 + state.facing * 1.3, -25, 0.9);
    g.fillCircle(4 + state.facing * 1.3, -25, 0.9);

    g.restore();

    // 落地软影
    paperShadow(g, 10, 20, 0.18);
  },
  bounds: () => ({ minX: -14, minY: -36, maxX: 14, maxY: 22 }),
};

function leg(g: DrawContext['g'], x: number, y: number, phase: number): void {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + phase * 6, y + 12);
  g.strokePath();
}
function arm(g: DrawContext['g'], x: number, y: number, phase: number): void {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + phase * 8, y + 12);
  g.strokePath();
}
