/**
 * 装饰渲染器 —— 关卡 decorations 字段放置的手绘纸片装饰。
 *
 * 复用 VectorDraw 工具（wobble + paperHighlight + paperShadow），depth 0~5。
 * 每个 kind 一个绘制函数，经 registerDecorRenderers 注册为 VectorRenderer。
 * 种类：bush/flower/fence/stalactite/lantern/mushroom。
 */

import type { VectorRenderer } from '../VectorDraw';
import { registerRenderer } from '../registry';
import { hexToNum, wobblePolygon, paperHighlight, paperShadow } from '../VectorDraw';

const bush: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    g.fillStyle(0x4a8e3a, 1);
    g.lineStyle(2, 0x1b2233, 0.4);
    g.fillCircle(-8, 0, 10);
    g.strokeCircle(-8, 0, 10);
    g.fillCircle(8, 2, 12);
    g.strokeCircle(8, 2, 12);
    g.fillCircle(0, -4, 8);
    g.strokeCircle(0, -4, 8);
    paperHighlight(g, -12, -8, 8, 6, 0.18);
    paperShadow(g, 14, 12, 0.14);
    void seed;
  },
  bounds: () => ({ minX: -18, minY: -12, maxX: 20, maxY: 14 }),
};

const flower: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    void seed;
    // 茎
    g.lineStyle(2, 0x4a8e3a, 1);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(0, -2);
    g.strokePath();
    // 花瓣（5 瓣）
    g.fillStyle(0xe64980, 1);
    g.lineStyle(1.5, 0x1b2233, 0.4);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * 6, -6 + Math.sin(a) * 6, 4);
      g.strokeCircle(Math.cos(a) * 6, -6 + Math.sin(a) * 6, 4);
    }
    // 花心
    g.fillStyle(0xf59f00, 1);
    g.fillCircle(0, -6, 3);
    paperShadow(g, 8, 16, 0.1);
  },
  bounds: () => ({ minX: -10, minY: -12, maxX: 10, maxY: 18 }),
};

const fence: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    // 两根竖桩
    for (const x of [-10, 10]) {
      wobblePolygon(g, [[x - 2, -16], [x + 2, -16], [x + 2, 12], [x - 2, 12]], 0.4, seed + x);
      g.fillStyle(0xc9a36b, 1);
      g.lineStyle(1.5, 0x1b2233, 0.5);
      g.fillPath();
      g.strokePath();
    }
    // 横档
    g.fillStyle(0xc9a36b, 1);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.fillRect(-12, -10, 24, 3);
    g.strokeRect(-12, -10, 24, 3);
    g.fillRect(-12, 2, 24, 3);
    g.strokeRect(-12, 2, 24, 3);
    paperShadow(g, 12, 14, 0.12);
  },
  bounds: () => ({ minX: -14, minY: -16, maxX: 14, maxY: 14 }),
};

const stalactite: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    wobblePolygon(g, [[-8, -32], [8, -32], [4, 16], [0, 24], [-4, 16]], 0.6, seed);
    g.fillStyle(0x9a938a, 1);
    g.lineStyle(2, 0x1b2233, 0.5);
    g.fillPath();
    g.strokePath();
    paperHighlight(g, -6, -30, 5, 12, 0.18);
    void dc;
  },
  bounds: () => ({ minX: -8, minY: -32, maxX: 8, maxY: 24 }),
};

const lantern: VectorRenderer = {
  draw: (dc) => {
    const { g, state, seed } = dc;
    void seed;
    const t = state.animTime * 0.004;
    const glow = 0.7 + Math.sin(t) * 0.3;
    // 提手
    g.lineStyle(2, 0x2b2b2b, 1);
    g.beginPath();
    g.arc(0, -22, 4, Math.PI, 0);
    g.strokePath();
    // 灯笼罩
    g.fillStyle(0x2b2b2b, 1);
    g.fillRect(-8, -18, 16, 4);
    // 灯光
    g.fillStyle(0xffdc50, glow);
    g.fillEllipse(0, -6, 14, 16);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.strokeEllipse(0, -6, 14, 16);
    // 底
    g.fillStyle(0x2b2b2b, 1);
    g.fillRect(-8, 4, 16, 3);
  },
  bounds: () => ({ minX: -8, minY: -26, maxX: 8, maxY: 8 }),
};

const mushroom: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    // 茎
    g.fillStyle(0xf0e6d2, 1);
    g.lineStyle(1.5, 0x1b2233, 0.4);
    g.fillRect(-3, -4, 6, 12);
    g.strokeRect(-3, -4, 6, 12);
    // 伞盖
    wobblePolygon(g, [[-12, -4], [12, -4], [8, -14], [-8, -14]], 0.6, seed);
    g.fillStyle(0xe64980, 1);
    g.lineStyle(1.5, 0x1b2233, 0.5);
    g.fillPath();
    g.strokePath();
    // 白点
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-5, -8, 2);
    g.fillCircle(4, -10, 1.5);
    paperShadow(g, 8, 10, 0.14);
  },
  bounds: () => ({ minX: -12, minY: -14, maxX: 12, maxY: 10 }),
};

const cloud: VectorRenderer = {
  draw: (dc) => {
    const { g, seed } = dc;
    void seed;
    g.fillStyle(0xffffff, 0.9);
    g.lineStyle(1.5, 0x1b2233, 0.15);
    g.fillCircle(-14, 0, 12);
    g.fillCircle(0, -6, 16);
    g.fillCircle(14, 0, 12);
    g.fillCircle(0, 4, 14);
  },
  bounds: () => ({ minX: -26, minY: -12, maxX: 26, maxY: 14 }),
};

/** 装饰渲染器统一注册 */
export function registerDecorRenderers(): void {
  registerRenderer('bush', bush);
  registerRenderer('flower', flower);
  registerRenderer('fence', fence);
  registerRenderer('stalactite', stalactite);
  registerRenderer('lantern', lantern);
  registerRenderer('mushroom', mushroom);
  registerRenderer('cloud', cloud);
  void hexToNum; // 保留工具引用以备装饰扩展
}
