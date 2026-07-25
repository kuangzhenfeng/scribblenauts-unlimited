/**
 * 环境背景系统 —— 分层视差 + 可见地面 + 平台 + 传送门门户 + 主题调色。
 *
 * 与 Camera/EntityGraphics 同层（engine/render），不内联进 WorldScene（深模块：
 * WorldScene.create 已是装配+布线胖方法，再塞 6 层视差会耦合场景装配与背景渲染）。
 * 物理地面/平台仍由 LevelManager.buildTerrain 创建不可见静态矩形，本类只画可见视觉。
 *
 * 视差用 Phaser 原生 setScrollFactor（零自写 scroll 数学），不加 zoom/deadzone
 *（zoom 会破坏 Notebook 以屏幕中心生成的 screenToWorld 逻辑）。
 * 远/中/地面层静态 → generateTexture 烘焙 → TileSprite，零 per-frame 重绘。
 */

import Phaser from 'phaser';
import type { AABB, Decoration, LevelData } from '@/core/types/level';
import { getRenderer } from './registry';
import { registerAllRenderers } from './renderers';
import { log } from '@/util/log';

/** 主题调色板：天空/远山/云/草/泥/装饰种类权重 */
interface EnvTheme {
  skyTop: number;
  skyBottom: number;
  mountain: number;
  cloud: number;
  grass: number;
  grassDark: number;
  dirt: number;
  cloudDensity: number; // 0~1，云层密度
}

const THEMES: Record<string, EnvTheme> = {
  meadow: {
    skyTop: 0x8ec5e8,
    skyBottom: 0xd7eefb,
    mountain: 0x7a93a8,
    cloud: 0xffffff,
    grass: 0x5fa83a,
    grassDark: 0x3d7a28,
    dirt: 0x6b4226,
    cloudDensity: 0.6,
  },
  cave: {
    skyTop: 0x2a2d3a,
    skyBottom: 0x3d3f4a,
    mountain: 0x4a4d5a,
    cloud: 0x6a6d7a,
    grass: 0x5a5a5a,
    grassDark: 0x3a3a3a,
    dirt: 0x3a2d22,
    cloudDensity: 0,
  },
};

/** 层 depth 常量 */
const DEPTH = {
  sky: -40,
  paper: -35,
  mountain: -30,
  cloud: -25,
  midground: -20,
  ground: -10,
  decor: 2,
  portal: 5,
} as const;

export class Environment {
  private readonly scene: Phaser.Scene;
  private theme: EnvTheme = THEMES.meadow;
  private bounds: AABB = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private gameObjects: Phaser.GameObjects.GameObject[] = [];
  private cloudTiles: Phaser.GameObjects.TileSprite | undefined;
  private cloudOffset = 0;
  private portalGfx: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 关卡加载后重建所有层（由 WorldScene.create 与关卡切换调用） */
  build(level: LevelData): void {
    this.dispose();
    this.theme = THEMES[level.theme] ?? THEMES.meadow;
    this.bounds = level.bounds;
    const { width, height } = this.scene.scale;

    this.buildSky(width, height);
    this.buildMountain(width, height);
    this.buildClouds(width, height);
    this.buildMidground(width, height);
    this.buildGround();
    this.buildPlatforms(level.terrain);
    this.buildDecorations(level.decorations);
    this.buildPortals(level.transitions);

    log.info('environment built', { theme: level.theme, layers: this.gameObjects.length });
  }

  /** 每帧更新：云朵漂移、门户脉动 */
  update(_time: number, delta: number): void {
    this.cloudOffset += delta * 0.004;
    if (this.cloudTiles) {
      this.cloudTiles.tilePositionX = this.cloudOffset;
    }
    const pulse = 0.5 + Math.sin(this.scene.time.now * 0.003) * 0.5;
    for (const g of this.portalGfx) {
      g.alpha = 0.7 + pulse * 0.3;
    }
  }

  /** 窗口尺寸变化时重铺固定屏层（由 WorldScene.resize 调用） */
  resize(width: number, height: number): void {
    this.buildSky(width, height);
  }

  private dispose(): void {
    for (const go of this.gameObjects) go.destroy();
    this.gameObjects = [];
    this.cloudTiles = undefined;
    this.portalGfx = [];
  }

  private add<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.gameObjects.push(go);
    return go;
  }

  /** 天空：固定屏渐变（用 Gradient + ColorRamp 双色带） */
  private buildSky(width: number, height: number): void {
    const sky = this.scene.add.gradient(undefined, 0, 0, width, height * 2);
    sky.ramp.setBands([
      { colorStart: this.theme.skyTop, colorEnd: this.theme.skyTop, start: 0, end: 0.5 },
      { colorStart: this.theme.skyTop, colorEnd: this.theme.skyBottom, start: 0.5, end: 1 },
    ]);
    sky.setOrigin(0, 0);
    sky.setScrollFactor(0, 0);
    sky.setDepth(DEPTH.sky);
    this.add(sky);
  }

  /** 远山：烘焙山脊折线 → TileSprite，scrollFactor 0.2 */
  private buildMountain(width: number, _height: number): void {
    const texKey = `env-mountain-${this.bounds.maxX}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(this.theme.mountain, 0.6);
      g.beginPath();
      g.moveTo(0, 200);
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * 600;
        const y = 200 - Math.abs(Math.sin(i * 1.3)) * 80 - (i % 2) * 20;
        g.lineTo(x, y);
      }
      g.lineTo(600, 200);
      g.lineTo(0, 200);
      g.closePath();
      g.fillPath();
      // 第二层更近的山
      g.fillStyle(this.theme.mountain, 0.8);
      g.beginPath();
      g.moveTo(0, 200);
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * 600;
        const y = 200 - Math.abs(Math.sin(i * 0.7 + 1)) * 50 - (i % 2) * 10;
        g.lineTo(x, y);
      }
      g.lineTo(600, 200);
      g.lineTo(0, 200);
      g.closePath();
      g.fillPath();
      g.generateTexture(texKey, 600, 200);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(0, this.bounds.maxY - 30 - 200, width, 200, texKey);
    tile.setOrigin(0, 0);
    tile.setScrollFactor(0.2, 0.2);
    tile.setDepth(DEPTH.mountain);
    this.add(tile);
  }

  /** 云：烘焙云团椭圆 → TileSprite，scrollFactor 0.4，每帧 tilePositionX 漂移 */
  private buildClouds(width: number, _height: number): void {
    if (this.theme.cloudDensity <= 0) return;
    const texKey = 'env-cloud';
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(20, 20, 16);
      g.fillCircle(40, 16, 18);
      g.fillCircle(60, 20, 16);
      g.fillCircle(80, 22, 14);
      g.generateTexture(texKey, 100, 40);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(0, 60, width, 40, texKey);
    tile.setOrigin(0, 0);
    tile.setScrollFactor(0.4, 0.4);
    tile.setDepth(DEPTH.cloud);
    tile.setAlpha(this.theme.cloudDensity);
    this.cloudTiles = tile;
    this.add(tile);
  }

  /** 中景低丘：烘焙连绵低丘 → TileSprite，scrollFactor 0.6 */
  private buildMidground(width: number, _height: number): void {
    const texKey = `env-mid-${this.theme.grass}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(this.theme.grassDark, 0.7);
      g.beginPath();
      g.moveTo(0, 120);
      for (let i = 0; i <= 20; i++) {
        const x = (i / 20) * 600;
        const y = 120 - Math.abs(Math.sin(i * 0.9 + 0.3)) * 40;
        g.lineTo(x, y);
      }
      g.lineTo(600, 120);
      g.lineTo(0, 120);
      g.closePath();
      g.fillPath();
      g.generateTexture(texKey, 600, 120);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(0, this.bounds.maxY - 30 - 120, width, 120, texKey);
    tile.setOrigin(0, 0);
    tile.setScrollFactor(0.6, 0.6);
    tile.setDepth(DEPTH.midground);
    this.add(tile);
  }

  /** 地面：烘焙草带+泥带 → TileSprite，scrollFactor 1.0（世界），顶边对齐静态矩形顶边 */
  private buildGround(): void {
    const groundTopY = this.bounds.maxY - 30;
    const groundH = 240;
    const texKey = `env-ground-${this.theme.grass}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      // 草带（顶沿用折线起伏）
      g.fillStyle(this.theme.grass, 1);
      g.beginPath();
      g.moveTo(0, 20);
      for (let x = 0; x <= 600; x += 20) {
        g.lineTo(x, 20 + Math.sin(x * 0.1) * 2);
      }
      g.lineTo(600, 40);
      g.lineTo(0, 40);
      g.closePath();
      g.fillPath();
      // 草深色
      g.fillStyle(this.theme.grassDark, 1);
      g.fillRect(0, 36, 600, 8);
      // 泥带
      g.fillStyle(this.theme.dirt, 1);
      g.fillRect(0, 44, 600, groundH - 44);
      // 泥纹斑点
      g.fillStyle(0x000000, 0.12);
      for (let i = 0; i < 40; i++) {
        const x = (i * 37) % 600;
        const y = 50 + ((i * 23) % (groundH - 50));
        g.fillCircle(x, y, 2);
      }
      g.generateTexture(texKey, 600, groundH);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(this.bounds.minX, groundTopY, this.bounds.maxX - this.bounds.minX, groundH, texKey);
    tile.setOrigin(0, 0);
    tile.setScrollFactor(1, 1);
    tile.setDepth(DEPTH.ground);
    this.add(tile);
  }

  /** terrain 平台：每项一个可见平台，对齐其静态矩形 */
  private buildPlatforms(terrain?: { x: number; y: number; w: number; h: number }[]): void {
    if (!terrain) return;
    for (const t of terrain) {
      const texKey = `env-plat-${this.theme.grass}-${t.w}x${t.h}`;
      if (!this.scene.textures.exists(texKey)) {
        const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
        // 草顶
        g.fillStyle(this.theme.grass, 1);
        g.fillRect(0, 0, t.w, 14);
        g.fillStyle(this.theme.grassDark, 1);
        g.fillRect(0, 12, t.w, 4);
        // 泥身
        g.fillStyle(this.theme.dirt, 1);
        g.fillRect(0, 16, t.w, t.h - 16);
        g.fillStyle(0x000000, 0.1);
        for (let i = 0; i < t.w / 20; i++) {
          g.fillCircle((i * 20 + 10) % t.w, 24 + (i % 3) * 10, 2);
        }
        g.generateTexture(texKey, t.w, t.h);
        g.destroy();
      }
      const plat = this.scene.add.tileSprite(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, texKey);
      plat.setOrigin(0, 0);
      plat.setScrollFactor(1, 1);
      plat.setDepth(DEPTH.ground + 0.1);
      this.add(plat);
    }
  }

  /** 装饰：按 decorations 放置，用 decor 渲染器绘制 */
  private buildDecorations(decorations?: Decoration[]): void {
    if (!decorations) return;
    registerAllRenderers(); // 确保 decor 渲染器已注册
    for (const d of decorations) {
      const renderer = getRenderer(d.kind);
      if (!renderer) {
        log.warn('unknown decoration kind', { kind: d.kind });
        continue;
      }
      const g = this.scene.add.graphics();
      g.setPosition(d.x, d.y);
      g.setScale(d.scale ?? 1, d.scale ?? 1);
      g.setScrollFactor(1, 1);
      g.setDepth(DEPTH.decor + (d.y * 0.001));
      const dc = {
        g,
        transform: { x: d.x, y: d.y, rotation: 0, scale: d.scale ?? 1 },
        state: {
          animTime: 0,
          locomotion: 'idle' as const,
          facing: 1,
          stateLayer: new Set<string>(),
        },
        camera: { zoom: 1 },
        seed: Math.floor(d.x * 1.7 + d.y * 3.3),
      };
      renderer.draw(dc, {});
      this.add(g);
    }
  }

  /** 传送门门户：对每个 transition 画手绘石柱+拱+暖光+Glow */
  private buildPortals(transitions?: { toLevelId: string; at: AABB }[]): void {
    if (!transitions) return;
    for (const t of transitions) {
      const cx = (t.at.minX + t.at.maxX) / 2;
      const cy = (t.at.minY + t.at.maxY) / 2;
      const g = this.scene.add.graphics();
      g.setPosition(cx, cy);
      g.setScrollFactor(1, 1);
      g.setDepth(DEPTH.portal);
      // 两根石柱
      g.fillStyle(0x5a5a5a, 1);
      g.lineStyle(2, 0x1b2233, 0.6);
      g.fillRect(-22, -50, 10, 100);
      g.strokeRect(-22, -50, 10, 100);
      g.fillRect(12, -50, 10, 100);
      g.strokeRect(12, -50, 10, 100);
      // 顶部拱
      g.fillStyle(0x5a5a5a, 1);
      g.fillEllipse(0, -50, 44, 20);
      g.strokeEllipse(0, -50, 44, 20);
      // 内部暖光
      g.fillGradientStyle(0xffdc50, 0xff8c00, 0xffdc50, 0xff8c00, 0, 0.4, 0.4, 0.6);
      g.fillRect(-12, -45, 24, 90);
      g.enableFilters();
      g.filters?.internal.addGlow(0xffdc50, 2, 0, 1, false);
      this.portalGfx.push(g);
      this.add(g);
    }
  }
}
