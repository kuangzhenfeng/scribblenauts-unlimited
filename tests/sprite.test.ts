import { describe, expect, it } from 'vitest';
import { registerAllRenderers } from '@/engine/render/renderers';
import { getRendererEntry } from '@/engine/render/registry';
import { SPRITE_ATLASES } from '@/engine/render/SpriteSheet';
import { SPRITE_SPECS } from '../scripts/sprite-specs.js';
import { bleedTransparentEdges, removeNeutralBackground } from '../scripts/sprite-processing.js';

describe('Sprite atlas registration', () => {
  it('registers file-backed atlases for preload and entity rendering', () => {
    registerAllRenderers();

    expect(getRendererEntry('maxwell')).toBeDefined();
    expect(getRendererEntry('ruin-pillar')).toBeDefined();
    expect(SPRITE_ATLASES.map((atlas) => atlas.atlasKey)).toEqual(
      expect.arrayContaining(['maxwell', 'bird', 'fish', 'sword', 'ruin-pillar']),
    );
  });

  it('registers creature renderers as sprite with renderer===id (no vector path)', () => {
    registerAllRenderers();

    // vector paper-doll 路由已废弃删除，所有 creature renderer===id 且 kind=sprite
    // 抽样：各家族代表物种均注册为 sprite
    for (const r of ['dog', 'cat', 'tiger', 'horse', 'bear', 'dragon', 'human', 'ghost', 'eagle', 'cow', 'monkey']) {
      expect(getRendererEntry(r)?.kind).toBe('sprite');
    }
  });

  it('derives single-frame static sprites from SPRITE_SPECS (no hand-maintained list)', () => {
    registerAllRenderers();

    // SPRITE_SPECS 中所有单帧条目都应派生注册为 sprite 渲染器，
    // 消除"spec 新增条目 → 忘改手工清单"的漂移。
    const singleFrameKeys = Object.entries(SPRITE_SPECS)
      .filter(([, spec]) => spec.frames.length === 1)
      .map(([key]) => key);
    expect(singleFrameKeys.length).toBeGreaterThan(100);

    // 抽样：新增的 food/nature/objects 条目均应注册
    expect(getRendererEntry('apricot')?.kind).toBe('sprite');
    expect(getRendererEntry('bamboo')?.kind).toBe('sprite');
    expect(getRendererEntry('couch')?.kind).toBe('sprite');
    expect(getRendererEntry('starfish')?.kind).toBe('sprite');
    // 复用目标已注册（amulet→gem 等改动后，复用目标必须在册）
    expect(getRendererEntry('gem')?.kind).toBe('sprite');
    expect(getRendererEntry('crystal')?.kind).toBe('sprite');
    expect(getRendererEntry('totem')?.kind).toBe('sprite');
  });
});

describe('Sprite pixel processing', () => {
  it('removes only boundary-connected neutral background', () => {
    const width = 7;
    const height = 7;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
      rgba[i + 3] = 255;
    }

    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) {
        const index = (y * width + x) * 4;
        const isOutline = x === 2 || x === 4 || y === 2 || y === 4;
        rgba[index] = isOutline ? 0 : 255;
        rgba[index + 1] = isOutline ? 0 : 255;
        rgba[index + 2] = isOutline ? 0 : 255;
      }
    }

    removeNeutralBackground(rgba, width, height);

    expect(rgba[3]).toBe(0);
    expect(rgba[(3 * width + 3) * 4 + 3]).toBe(255);
    expect(rgba[(2 * width + 2) * 4 + 3]).toBe(255);
  });

  it('preserves saturated glow while removing faint neutral fringe', () => {
    const width = 5;
    const height = 5;
    const rgba = new Uint8Array(width * height * 4);
    const setPixel = (x: number, y: number, color: [number, number, number, number]) => {
      rgba.set(color, (y * width + x) * 4);
    };

    setPixel(2, 2, [0, 0, 0, 255]);
    setPixel(2, 1, [255, 255, 255, 4]);
    setPixel(1, 2, [255, 230, 0, 4]);
    setPixel(3, 2, [255, 255, 255, 255]);

    removeNeutralBackground(rgba, width, height, { neutralRange: 16, maxAlpha: 8 });

    expect(rgba[(1 * width + 2) * 4 + 3]).toBe(0);
    expect(rgba[(2 * width + 1) * 4 + 3]).toBe(4);
    expect(rgba[(2 * width + 3) * 4 + 3]).toBe(255);
  });

  it('bleeds RGB inside each frame without changing alpha or crossing frames', () => {
    const rgba = new Uint8Array(6 * 1 * 4);
    rgba.set([255, 0, 0, 255], 0);
    rgba.set([0, 0, 255, 255], 12);

    bleedTransparentEdges(rgba, {
      width: 6,
      height: 1,
      frameWidth: 3,
      frameHeight: 1,
      frameCount: 2,
      radius: 1,
    });

    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 0, 0, 0]);
    expect(Array.from(rgba.slice(8, 12))).toEqual([0, 0, 0, 0]);
    expect(Array.from(rgba.slice(16, 20))).toEqual([0, 0, 255, 0]);
  });
});
