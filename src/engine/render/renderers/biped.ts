/**
 * 两足人形渲染器 —— 人形用 biped。NPC 复用，玩家改用 maxwell 专属渲染器。
 *
 * 头/躯干/双臂/双腿。行走=腿正弦摆动、臂反向；待机=轻微上下浮动；
 * 跳跃=scaleCanvas 纵向拉伸（squash/stretch）；gender=female 加长发+裙摆。
 * 涂鸦纸片质感：躯干/裤管手绘抖动 + 落地软影。
 */

import type { VectorRenderer, DrawContext } from '../VectorDraw';
import { hexToNum, wobblePolygon, paperShadow } from '../VectorDraw';

export const biped: VectorRenderer = {
  draw: (dc, params) => {
    const { g, state, seed } = dc;
    const shirtColor = (params.shirtColor as string) ?? '#3B6EA5';
    const pantsColor = (params.pantsColor as string) ?? '#3A3A3A';
    const skinColor = (params.skinColor as string) ?? '#F2C9A0';
    const gender = (params.gender as string) ?? 'male';
    const hat = params.hat as string | undefined;
    const t = state.animTime;
    const walking = state.locomotion === 'walk';
    const idle = state.locomotion === 'idle';
    const jumping = state.locomotion === 'jump';
    const swing = walking ? Math.sin(t * 0.014) * 0.5 : 0;
    const bob = idle ? Math.sin(t * 0.005) * 1.2 : 0;
    const female = gender === 'female';

    g.save();
    if (jumping) g.scaleCanvas(0.88, 1.15); // 跳跃纵向拉伸
    g.translateCanvas(0, bob);

    // 腿（裤管）
    g.lineStyle(7, hexToNum(pantsColor), 1);
    leg(g, -5, 8, swing);
    leg(g, 5, 8, -swing);

    // 躯干（手绘抖动矩形）
    wobblePolygon(g, [[-10, -16], [10, -16], [10, 8], [-10, 8]], 0.5, seed + 3);
    g.fillStyle(hexToNum(shirtColor), 1);
    g.lineStyle(2, 0x1b2233, 0.45);
    g.fillPath();
    g.strokePath();

    // 女性裙摆
    if (female) {
      wobblePolygon(g, [[-12, 4], [12, 4], [14, 14], [-14, 14]], 0.6, seed + 4);
      g.fillStyle(hexToNum(shirtColor), 0.85);
      g.fillPath();
      g.strokePath();
    }

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

    // 女性长发束
    if (female) {
      g.fillStyle(hexToNum(pantsColor), 1);
      g.fillEllipse(-6, -22, 6, 14);
      g.fillEllipse(6, -22, 6, 14);
    }

    // 帽子（farmer 草帽 / miner 矿工帽）
    if (hat === 'straw') {
      g.fillStyle(0xd4a857, 1);
      g.lineStyle(1.5, 0x1b2233, 0.5);
      g.fillEllipse(0, -28, 22, 6);
      g.strokeEllipse(0, -28, 22, 6);
      g.fillStyle(0xc9932b, 1);
      g.fillEllipse(0, -32, 12, 8);
      g.strokeEllipse(0, -32, 12, 8);
    } else if (hat === 'miner') {
      g.fillStyle(0xf59f00, 1);
      g.lineStyle(1.5, 0x1b2233, 0.5);
      g.fillEllipse(0, -30, 16, 10);
      g.strokeEllipse(0, -30, 16, 10);
      // 矿灯
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(0, -33, 2.5);
    }

    // 眼
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(-2 + state.facing, -25, 1.2);
    g.fillCircle(3 + state.facing, -25, 1.2);

    g.restore();

    // 落地软影
    paperShadow(g, 10, 20, 0.16);
  },
  bounds: () => ({ minX: -14, minY: -34, maxX: 14, maxY: 22 }),
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
