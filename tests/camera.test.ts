import { describe, expect, it } from 'vitest';
import { Camera } from '@/engine/render/Camera';

function fakeCamera(): {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  setLerp: () => void;
  setBounds: () => void;
  setScroll: (x: number, y: number) => void;
  setZoom: (value: number) => void;
  getWorldPoint: (x: number, y: number) => { x: number; y: number };
} {
  const state = {
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    zoom: 1,
    scrollX: 100,
    scrollY: 80,
  };
  return {
    ...state,
    setLerp: () => undefined,
    setBounds: () => undefined,
    setScroll(x, y) {
      state.scrollX = x;
      state.scrollY = y;
    },
    setZoom(value) {
      state.zoom = value;
    },
    getWorldPoint(x, y) {
      return {
        // Phaser 4 的 scroll 是相对视口中心的未缩放偏移；zoom 只影响
        // 屏幕坐标到中心两侧的世界距离。
        x: state.scrollX + state.width / 2 + (x - state.width / 2) / state.zoom,
        y: state.scrollY + state.height / 2 + (y - state.height / 2) / state.zoom,
      };
    },
    get x() { return state.x; },
    get y() { return state.y; },
    get centerX() { return state.x + state.width / 2; },
    get centerY() { return state.y + state.height / 2; },
    get width() { return state.width; },
    get height() { return state.height; },
    get zoom() { return state.zoom; },
    get scrollX() { return state.scrollX; },
    get scrollY() { return state.scrollY; },
  };
}

describe('Camera keyboard and wheel controls', () => {
  it('keeps the viewport center stable while zooming', () => {
    const raw = fakeCamera();
    const camera = new Camera(raw as never);
    const before = raw.getWorldPoint(raw.width / 2, raw.height / 2);
    camera.zoomBy(0.1);
    const after = raw.getWorldPoint(raw.width / 2, raw.height / 2);
    expect(raw.zoom).toBeCloseTo(1.1);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('keeps a followed target centered after zooming', () => {
    const raw = fakeCamera();
    const camera = new Camera(raw as never);
    const target = raw.getWorldPoint(raw.width / 2, raw.height / 2);

    camera.zoomBy(0.5);
    camera.followUpdate(target.x, target.y);

    const targetScreen = camera.worldToScreen(target.x, target.y);
    expect(targetScreen.x).toBeCloseTo(raw.width / 2);
    expect(targetScreen.y).toBeCloseTo(raw.height / 2);
  });

  it('clamps zoom to a usable range', () => {
    const raw = fakeCamera();
    const camera = new Camera(raw as never);
    camera.zoomBy(-10);
    expect(raw.zoom).toBeCloseTo(0.75);
    camera.zoomBy(10);
    expect(raw.zoom).toBeCloseTo(1.5);
  });

  it('clears manual pan when snapping the camera to a target', () => {
    const raw = fakeCamera();
    const camera = new Camera(raw as never);
    camera.panBy(160, -80);
    camera.snapTo(500, 400);
    expect(raw.scrollX).toBeCloseTo(100);
    expect(raw.scrollY).toBeCloseTo(100);
  });
});
