/**
 * 环境背景系统 —— 分层视差 + 可见地面 + 平台 + 传送门门户 + 主题调色。
 *
 * 与 Camera/EntityGraphics 同层（engine/render），不内联进 WorldScene（深模块：
 * WorldScene.create 已是装配+布线胖方法，再塞 6 层视差会耦合场景装配与背景渲染）。
 * 物理地面/平台仍由 LevelManager.buildTerrain 创建不可见静态矩形，本类只画可见视觉。
 *
 * 远景层优先用 GPT 生图双板（PreloadScene 加载的 bg-far/bg-near-{theme}）：
 *  - 远板：固定屏整图天空盒（scrollFactor 0,0），含天空/远山/云/丛林远景元素
 *  - 近板：水平无缝条带 TileSprite（scrollFactor 0.5），中景低丘，底部衔接地面
 * 缺图时自动回退程序化分层（gradient 天空 + 折线远山 + 椭圆云 + 低丘 TileSprite）。
 * 地面/平台/顶棚/装饰/传送门始终程序化（功能层，须精确匹配世界宽度与物理边界）。
 *
 * 视差用 Phaser 原生 setScrollFactor（零自写 scroll 数学），不加 zoom/deadzone
 *（zoom 会破坏 Notebook 以屏幕中心生成的 screenToWorld 逻辑）。
 * 远/中/地面层静态 → generateTexture 烘焙 → TileSprite，零 per-frame 重绘。
 */

import Phaser from 'phaser';
import type { AABB, Decoration, LevelData } from '@/core/types/level';
import { getRendererEntry } from './registry';
import { registerAllRenderers } from './renderers';
import { frameForState } from './SpriteSheet';
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
    skyTop: 0x47b5e6,
    skyBottom: 0x87ceeb,
    mountain: 0x6898b8,
    cloud: 0xffffff,
    grass: 0x5cb85c,
    grassDark: 0x3a8c3a,
    dirt: 0x7a4a2e,
    cloudDensity: 0.85,
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
  jungle: {
    skyTop: 0x47bfe9,
    skyBottom: 0xa6e79b,
    mountain: 0x4a9b67,
    cloud: 0xf8f2df,
    grass: 0x5fc85c,
    grassDark: 0x2f8d46,
    dirt: 0x8b5a35,
    cloudDensity: 0.72,
  },
  snow: {
    skyTop: 0xb0d4e8,
    skyBottom: 0xe8f0f5,
    mountain: 0x8aa8b8,
    cloud: 0xffffff,
    grass: 0xe8edf0,
    grassDark: 0xc8d0d8,
    dirt: 0x5a6f7c,
    cloudDensity: 0.7,
  },
  desert: {
    skyTop: 0xf0c060,
    skyBottom: 0xffe8a0,
    mountain: 0xc8a050,
    cloud: 0xfff5d0,
    grass: 0xe6c36b,
    grassDark: 0xc8a050,
    dirt: 0x8b6b3a,
    cloudDensity: 0.15,
  },
  volcano: {
    skyTop: 0x3a0a0a,
    skyBottom: 0x6b1a0a,
    mountain: 0x2a1010,
    cloud: 0x4a2020,
    grass: 0x3a2a20,
    grassDark: 0x2a1a10,
    dirt: 0x5a3020,
    cloudDensity: 0.3,
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
  private themeId = 'meadow';
  private bounds: AABB = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private gameObjects: Phaser.GameObjects.GameObject[] = [];
  /** 依赖窗口尺寸的固定屏层（远板/天空/山/云/中景），resize 时销毁重建 */
  private resizableGos: Phaser.GameObjects.GameObject[] = [];
  private cloudTiles: Phaser.GameObjects.TileSprite | undefined;
  private cloudOffset = 0;
  private portalGfx: Phaser.GameObjects.Graphics[] = [];
  private swayObjects: { go: Phaser.GameObjects.GameObject & { rotation: number }; baseRotation: number; phase: number }[] = [];
  /** 处理背景贴图晚于环境层创建完成的有限次刷新。 */
  private assetRefreshTimer: Phaser.Time.TimerEvent | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 关卡加载后重建所有层（由 WorldScene.create 与关卡切换调用） */
  build(level: LevelData): void {
    this.dispose();
    this.theme = THEMES[level.theme] ?? THEMES.meadow;
    this.themeId = level.theme ?? 'meadow';
    this.bounds = level.bounds;
    const { width, height } = this.scene.scale;

    // 远景层：若主题对应生图板已加载则用之，否则回退程序化分层绘制
    const farKey = `bg-far-${this.themeId}`;
    const nearKey = `bg-near-${this.themeId}`;
    const hasFar = this.scene.textures.exists(farKey);
    const hasNear = this.scene.textures.exists(nearKey);

    if (hasFar) {
      this.buildFarPlate(farKey, width, height);
    } else {
      this.buildSky(width, height);
      this.buildMountain(width, height);
      this.buildClouds(width, height);
    }

    // 近景层（地面之前）：生图近板为水平无缝视差条带，回退则用程序化低丘
    if (hasNear) {
      this.buildNearPlate(nearKey);
    } else {
      this.buildMidground(width, height);
    }
    if (this.themeId === 'snow') this.buildSnowPlayableShade(width, height);

    // 以下为功能层，始终保持程序化：地面/平台/顶棚/装饰/传送门
    this.buildGround();
    this.buildPlatforms(level.terrain);
    if (this.themeId === 'cave') this.buildCaveCeiling();
    if (this.themeId === 'volcano') this.buildVolcanoCeiling();
    this.buildDecorations(level.decorations);
    this.buildPortals(level.transitions);
    // jungle 专属远景层（光晕/哥特建筑/侧树）已烧入生图远板，仅程序化回退时绘制
    if (level.theme === 'jungle' && !hasFar) this.buildJungleExtra(width, height);

    this.scheduleAssetRefresh(width, height, hasFar, hasNear);
    log.info('environment built', { theme: level.theme, layers: this.gameObjects.length + this.resizableGos.length, far: hasFar, near: hasNear });
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
    for (const item of this.swayObjects) {
      item.go.rotation = item.baseRotation + Math.sin(this.scene.time.now * 0.0018 + item.phase) * 0.016;
    }
  }

  /**
   * 窗口尺寸变化时重铺固定屏层（由 WorldScene.resize 调用）。
   * 仅重建依赖窗口尺寸的层（远板/天空/山/云/中景），地面/平台/装饰/传送门不动。
   */
  resize(width: number, height: number): void {
    // 先销毁旧的固定屏层，避免叠加泄漏
    for (const go of this.resizableGos) go.destroy();
    this.resizableGos = [];
    this.cloudTiles = undefined;
    this._rebuildResizable(width, height);
  }

  /** 按当前主题与窗口尺寸重建固定屏层（远板或程序化天空/山/云/中景） */
  private _rebuildResizable(width: number, height: number): void {
    const farKey = `bg-far-${this.themeId}`;
    const nearKey = `bg-near-${this.themeId}`;
    const hasFar = this.scene.textures.exists(farKey);
    const hasNear = this.scene.textures.exists(nearKey);
    if (hasFar) {
      this.buildFarPlate(farKey, width, height);
    } else {
      this.buildSky(width, height);
      this.buildMountain(width, height);
      this.buildClouds(width, height);
    }
    // 近板为水平无缝 TileSprite（scrollFactor 0.5），宽度按世界坐标，不受窗口尺寸影响，无需重建
    if (!hasNear) {
      this.buildMidground(width, height);
    }
    // 丛林专属远景层（程序化回退路径，依赖窗口尺寸）
    if (this.themeId === 'jungle' && !hasFar) {
      this.buildJungleExtra(width, height);
    }
  }

  /**
   * 预加载资源量较大时，个别背景可能在 WorldScene 已开始装配后才进入纹理表。
   * 仅在首次缺图时短暂轮询；一旦纹理到达就重铺固定屏层，避免永久停留在回退背景。
   */
  private scheduleAssetRefresh(width: number, height: number, hadFar: boolean, hadNear: boolean, attempt = 0): void {
    if ((hadFar && hadNear) || attempt >= 8) return;
    this.assetRefreshTimer?.remove(false);
    this.assetRefreshTimer = this.scene.time.delayedCall(250, () => {
      this.assetRefreshTimer = undefined;
      if (!this.scene.scene.isActive()) return;
      const hasFar = this.scene.textures.exists(`bg-far-${this.themeId}`);
      const hasNear = this.scene.textures.exists(`bg-near-${this.themeId}`);
      if (hasFar !== hadFar || hasNear !== hadNear) {
        this.resize(width, height);
        return;
      }
      this.scheduleAssetRefresh(width, height, hadFar, hadNear, attempt + 1);
    });
  }

  private dispose(): void {
    this.assetRefreshTimer?.remove(false);
    this.assetRefreshTimer = undefined;
    for (const go of this.gameObjects) go.destroy();
    for (const go of this.resizableGos) go.destroy();
    this.gameObjects = [];
    this.resizableGos = [];
    this.cloudTiles = undefined;
    this.portalGfx = [];
    this.swayObjects = [];
  }

  /** 加入全量生命周期管理（地面/平台/装饰/传送门等，不随 resize 重建） */
  private add<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.gameObjects.push(go);
    return go;
  }

  /** 加入固定屏层管理（resize 时销毁重建） */
  private addResizable<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.resizableGos.push(go);
    return go;
  }

  /**
   * 远板：固定屏整幅生图（天空盒），含天空/远山/云/丛林远景元素。
   * scrollFactor(0,0) 固定不动，按覆盖缩放铺满屏幕（与 TitleScene._fitKeyArt 同策略）。
   */
  private buildFarPlate(texKey: string, width: number, height: number): void {
    const img = this.scene.add.image(0, 0, texKey);
    img.setOrigin(0, 0).setScrollFactor(0, 0).setDepth(DEPTH.sky);
    const src = this.scene.textures.get(texKey).getSourceImage();
    const scale = Math.max(width / src.width, height / src.height);
    img.setScale(scale);
    img.setPosition((width - src.width * scale) / 2, (height - src.height * scale) / 2);
    this.addResizable(img);
  }

  /**
   * 近板：水平无缝条带生图，scrollFactor 0.5 视差移动。
   * 宽度取世界宽（纹理水平平铺），底部衔接地面顶部（groundTopY = bounds.maxY - 30）。
   */
  private buildNearPlate(texKey: string): void {
    const src = this.scene.textures.get(texKey).getSourceImage();
    const nearH = src.height;
    const groundTopY = this.bounds.maxY - 30;
    const worldW = this.bounds.maxX - this.bounds.minX;
    // 视差移动会让有限宽度条带露边，向两侧各扩一段世界宽度，保证镜头边缘始终有连续中景。
    const tile = this.scene.add.tileSprite(this.bounds.minX - worldW, groundTopY - nearH, worldW * 3, nearH, texKey);
    tile.setOrigin(0, 0).setScrollFactor(0.5, 0.5).setDepth(DEPTH.midground);
    // 近板只提供层次，不抢交互实体的轮廓；降低对比度保留原版明亮手绘感。
    tile.setAlpha(
      this.themeId === 'jungle' ? 0.62 :
        this.themeId === 'snow' ? 0.24 :
          this.themeId === 'desert' ? 0.06 : 0.38,
    );
    this.add(tile);
  }

  /** 雪地可玩带轻微冷色压暗，保证浅色角色、冰块与雪花拥有稳定轮廓。 */
  private buildSnowPlayableShade(width: number, height: number): void {
    const g = this.scene.add.graphics();
    g.setScrollFactor(0, 0).setDepth(DEPTH.paper + 0.1);
    // 用透明度渐变衔接可玩带，避免固定矩形在雪面上留下水平硬边。
    g.fillGradientStyle(0x496f91, 0x496f91, 0x496f91, 0x496f91, 0, 0, 0.055, 0.055);
    g.fillRect(0, height * 0.34, width, height * 0.66);
    g.fillGradientStyle(0x496f91, 0x496f91, 0x496f91, 0x496f91, 0, 0, 0.022, 0.022);
    g.fillRect(0, height * 0.68, width, height * 0.32);
    this.addResizable(g);
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
    this.addResizable(sky);
  }

  /** 远山：烘焙山脊折线 → TileSprite，scrollFactor 0.2 */
  private buildMountain(width: number, _height: number): void {
    const texKey = this.mountainTexKey();
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
    this.addResizable(tile);
  }

  /** 云：烘焙错落的手绘云团 → TileSprite，scrollFactor 0.4，每帧 tilePositionX 漂移 */
  private buildClouds(width: number, _height: number): void {
    if (this.theme.cloudDensity <= 0) return;
    const texKey = `env-cloud-${this.themeId}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(this.theme.cloud, 0.88);
      // 透明间隔避免旧版 100px 圆点串造成机械重复感。
      g.fillEllipse(42, 28, 92, 25);
      g.fillCircle(18, 27, 13);
      g.fillCircle(38, 16, 19);
      g.fillCircle(61, 20, 16);
      g.fillCircle(78, 28, 11);
      g.fillStyle(0xffffff, 0.22);
      g.fillEllipse(44, 16, 42, 9);
      g.fillStyle(this.theme.cloud, 0.72);
      g.fillEllipse(224, 27, 110, 24);
      g.fillCircle(192, 26, 12);
      g.fillCircle(215, 15, 17);
      g.fillCircle(238, 19, 14);
      g.fillCircle(260, 27, 11);
      g.generateTexture(texKey, 360, 58);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(0, 54, width, 58, texKey);
    tile.setOrigin(0, 0);
    tile.setScrollFactor(0.4, 0.4);
    tile.setDepth(DEPTH.cloud);
    tile.setAlpha(this.theme.cloudDensity);
    this.cloudTiles = tile;
    this.addResizable(tile);
  }

  /** 中景低丘：烘焙连绵低丘 → TileSprite，scrollFactor 0.6 */
  private buildMidground(width: number, _height: number): void {
    const texKey = `env-mid-${this.theme.grass}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(this.theme.grassDark, this.themeId === 'jungle' ? 0.88 : 0.7);
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
      if (this.themeId === 'jungle') {
        // 叶冠打散低丘直线，恢复原版森林的明亮手绘层次。
        g.fillStyle(0x3f9f50, 0.72);
        for (let i = 0; i < 14; i++) {
          const x = 18 + i * 44;
          const y = 80 + ((i * 17) % 26);
          g.fillCircle(x, y, 22 + (i % 3) * 5);
        }
        g.fillStyle(0x79d66b, 0.42);
        for (let i = 0; i < 10; i++) g.fillCircle(34 + i * 61, 93 + (i % 2) * 8, 11);
      }
      g.generateTexture(texKey, 600, 120);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(0, this.bounds.maxY - 30 - 120, width, 120, texKey);
    tile.setOrigin(0, 0);
    tile.setScrollFactor(0.6, 0.6);
    tile.setDepth(DEPTH.midground);
    this.addResizable(tile);
  }

  /** 地面：cave 用石砖瓦片，其他主题用草地+泥带 */
  private buildGround(): void {
    const groundTopY = this.bounds.maxY - 30;
    const groundH = this.themeId === 'cave' || this.themeId === 'volcano' ? 200 : 240;
    this.buildPlayableBand(groundTopY);

    if (this.themeId === 'cave') {
      const texKey = this.buildStoneBrickTile(600, groundH);
      const tile = this.scene.add.tileSprite(
        this.bounds.minX, groundTopY,
        this.bounds.maxX - this.bounds.minX, groundH, texKey,
      );
      tile.setOrigin(0, 0); tile.setScrollFactor(1, 1); tile.setDepth(DEPTH.ground);
      this.add(tile);
      return;
    }

    // 草地/泥带（meadow / jungle）
    const texKey = `env-ground-${this.theme.grass}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      // 草刃锯齿
      g.fillStyle(this.theme.grassDark, 1);
      g.fillRect(0, 0, 600, 32);
      for (let x = 0; x <= 600; x += 8) {
        const h = 8 + ((x * 7) % 6);
        g.fillStyle(x % 16 < 8 ? this.theme.grass : this.theme.grassDark, 1);
        g.fillTriangle(x, 22, x + 4, 22 - h, x + 8, 22);
      }
      // 草带底
      g.fillStyle(this.theme.grassDark, 1);
      g.fillRect(0, 18, 600, 14);
      // 泥带
      g.fillStyle(this.theme.dirt, 1);
      g.fillRect(0, 32, 600, groundH - 32);
      // 泥纹：小石子
      for (let i = 0; i < 50; i++) {
        const sx = (i * 37) % 600;
        const sy = 40 + ((i * 23) % (groundH - 40));
        const sr = 1.5 + (i % 3);
        g.fillStyle(0x000000, 0.10 + (i % 3) * 0.04);
        g.fillCircle(sx, sy, sr);
      }
      g.generateTexture(texKey, 600, groundH);
      g.destroy();
    }
    const tile = this.scene.add.tileSprite(
      this.bounds.minX, groundTopY,
      this.bounds.maxX - this.bounds.minX, groundH, texKey,
    );
    tile.setOrigin(0, 0); tile.setScrollFactor(1, 1); tile.setDepth(DEPTH.ground);
    this.add(tile);
  }

  /** 可玩带的轻量接触层：把角色、目标与主题远景分开，不增加额外装饰噪声。 */
  private buildPlayableBand(groundTopY: number): void {
    const colors: Record<string, { color: number; top: number; bottom: number }> = {
      jungle: { color: 0x205a36, top: 0.02, bottom: 0.08 },
      cave: { color: 0x111827, top: 0.08, bottom: 0.2 },
      snow: { color: 0x567c99, top: 0.02, bottom: 0.07 },
      desert: { color: 0x7b4a29, top: 0.03, bottom: 0.1 },
      volcano: { color: 0x160c12, top: 0.08, bottom: 0.22 },
    };
    const shade = colors[this.themeId] ?? colors.jungle;
    const g = this.scene.add.graphics();
    g.setScrollFactor(1, 1).setDepth(DEPTH.ground + 0.05);
    g.fillGradientStyle(shade.color, shade.color, shade.color, shade.color, shade.top, shade.top, shade.bottom, shade.bottom);
    g.fillRect(this.bounds.minX, groundTopY - 150, this.bounds.maxX - this.bounds.minX, 150);
    this.add(g);
  }

  /** 远山纹理 key（含主题山色，避免主题切换时复用错误缓存） */
  private mountainTexKey(): string {
    return `env-mountain-${this.theme.mountain}-${this.bounds.maxX}`;
  }

  /**
   * 生成石砖瓦片纹理（确定性，幂等）。
   * 错位砖块 + 砂浆缝 + 顶边高光 + 底边阴影 + 苔藓斑点。
   */
  private buildStoneBrickTile(w: number, h: number): string {
    const texKey = `env-stone-brick-${w}x${h}`;
    if (this.scene.textures.exists(texKey)) return texKey;

    const BRICK_W = 32, BRICK_H = 16, MORTAR = 2;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // 砂浆底色
    g.fillStyle(0x555555, 1);
    g.fillRect(0, 0, w, h);

    // 错位砖块
    let row = 0;
    for (let y = 0; y < h; y += BRICK_H + MORTAR) {
      const offsetX = (row % 2) * Math.floor(BRICK_W / 2);
      for (let xi = -offsetX; xi < w + BRICK_W; xi += BRICK_W + MORTAR) {
        const bx = Math.max(0, xi);
        const bw = Math.min(BRICK_W, w - bx);
        if (bw <= 0) continue;
        const bh = Math.min(BRICK_H, h - y);
        if (bh <= 0) continue;

        // 确定性颜色变化（±15）
        const v = (((bx + y * 3) * 17) % 30) - 15;
        const base = 0x88;
        const r = Math.max(0x60, Math.min(0xaa, base + v));
        const brickColor = (r << 16) | (Math.max(0, r - 8) << 8) | Math.max(0, r - 18);
        g.fillStyle(brickColor, 1);
        g.fillRect(bx, y, bw, bh);

        // 顶边高光
        g.fillStyle(0xffffff, 0.14);
        g.fillRect(bx, y, bw, 2);
        // 底边阴影
        g.fillStyle(0x000000, 0.20);
        g.fillRect(bx, y + bh - 2, bw, 2);
      }
      row++;
    }

    // 苔藓/风化斑（确定性）
    const mossCnt = Math.floor((w * h) / 900);
    for (let i = 0; i < mossCnt; i++) {
      const mx = (i * 67 + 13) % w;
      const my = (i * 43 + 7) % h;
      g.fillStyle(0x2e7d32, 0.28);
      g.fillEllipse(mx, my, 6 + (i % 4), 4 + (i % 3));
    }

    g.generateTexture(texKey, w, h);
    g.destroy();
    return texKey;
  }

  /** cave 主题顶棚：参差不齐的石质边缘，增强洞穴压迫感 */
  private buildCaveCeiling(): void {
    const ceilH = 56;
    const ceilY = this.bounds.minY;
    const totalW = this.bounds.maxX - this.bounds.minX;
    const texKey = `env-cave-ceil-${totalW}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x2a2d3a, 1);
      g.fillRect(0, 0, totalW, ceilH);

      // 参差石齿（确定性）
      g.fillStyle(0x1e2130, 1);
      const TOOTH_W = 40;
      for (let x = 0; x < totalW; x += TOOTH_W) {
        const toothH = 20 + ((x * 7 + 3) % 30);
        g.beginPath();
        g.moveTo(x, ceilH);
        g.lineTo(x + TOOTH_W / 2, ceilH - toothH);
        g.lineTo(x + TOOTH_W, ceilH);
        g.closePath();
        g.fillPath();
      }

      // 石砖表面（浅层）
      g.fillStyle(0x333645, 0.5);
      g.fillRect(0, 0, totalW, 20);

      g.generateTexture(texKey, totalW, ceilH);
      g.destroy();
    }
    const ceil = this.scene.add.tileSprite(this.bounds.minX, ceilY, totalW, ceilH, texKey);
    ceil.setOrigin(0, 0);
    ceil.setScrollFactor(1, 1);
    ceil.setDepth(DEPTH.ground + 0.2);
    this.add(ceil);
  }

  /** volcano 主题顶棚：红黑参差熔岩钟乳，仿 buildCaveCeiling 但用火山色调 */
  private buildVolcanoCeiling(): void {
    const ceilH = 56;
    const ceilY = this.bounds.minY;
    const totalW = this.bounds.maxX - this.bounds.minX;
    const texKey = `env-volcano-ceil-${totalW}`;
    if (!this.scene.textures.exists(texKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x2a1010, 1);
      g.fillRect(0, 0, totalW, ceilH);

      // 参差熔岩齿（黑红底 + 橙红尖端）
      const TOOTH_W = 40;
      for (let x = 0; x < totalW; x += TOOTH_W) {
        const toothH = 20 + ((x * 7 + 3) % 30);
        g.fillStyle(0x1a0808, 1);
        g.beginPath();
        g.moveTo(x, ceilH);
        g.lineTo(x + TOOTH_W / 2, ceilH - toothH);
        g.lineTo(x + TOOTH_W, ceilH);
        g.closePath();
        g.fillPath();
        // 橙红尖端
        g.fillStyle(0xff4400, 0.8);
        g.fillCircle(x + TOOTH_W / 2, ceilH - toothH + 4, 3);
      }

      // 表层暗红渐变（浅层）
      g.fillStyle(0x5a1010, 0.5);
      g.fillRect(0, 0, totalW, 20);

      g.generateTexture(texKey, totalW, ceilH);
      g.destroy();
    }
    const ceil = this.scene.add.tileSprite(this.bounds.minX, ceilY, totalW, ceilH, texKey);
    ceil.setOrigin(0, 0);
    ceil.setScrollFactor(1, 1);
    ceil.setDepth(DEPTH.ground + 0.2);
    this.add(ceil);
  }

  /** terrain 平台：cave 主题用石砖，其他主题用草顶+泥身 */
  private buildPlatforms(terrain?: { x: number; y: number; w: number; h: number }[]): void {
    if (!terrain) return;
    for (const t of terrain) {
      if (this.themeId === 'cave') {
        const texKey = this.buildStoneBrickTile(t.w, t.h);
        const plat = this.scene.add.tileSprite(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, texKey);
        plat.setOrigin(0, 0); plat.setScrollFactor(1, 1); plat.setDepth(DEPTH.ground + 0.1);
        this.add(plat);
      } else {
        const texKey = `env-plat-${this.theme.grass}-${t.w}x${t.h}`;
        if (!this.scene.textures.exists(texKey)) {
          const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
          // 草刃顶
          for (let x = 0; x <= t.w; x += 8) {
            const h = 6 + ((x * 5) % 5);
            g.fillStyle(x % 16 < 8 ? this.theme.grass : this.theme.grassDark, 1);
            g.fillTriangle(x, 14, x + 4, 14 - h, x + 8, 14);
          }
          // 手绘草沿：深色轮廓、浅色断续高光，避免平台像一条生硬的矩形 UI 条。
          g.fillStyle(this.theme.grassDark, 1);
          g.fillRect(0, 11, t.w, 5);
          g.fillStyle(this.theme.grass, 0.9);
          for (let x = 3; x < t.w; x += 18) g.fillRect(x, 11, 8, 2);
          g.fillStyle(this.theme.dirt, 1);
          g.beginPath();
          g.moveTo(0, 16);
          g.lineTo(t.w, 16);
          g.lineTo(t.w - 3, t.h);
          g.lineTo(4, t.h);
          g.closePath();
          g.fillPath();
          g.lineStyle(1.5, 0x3d2b1d, 0.48);
          g.beginPath();
          g.moveTo(0, 16);
          g.lineTo(t.w, 16);
          g.lineTo(t.w - 3, t.h);
          g.lineTo(4, t.h);
          g.closePath();
          g.strokePath();
          // 底缘加入不规则土块与短草，打断直线轮廓并衔接环境地面。
          for (let x = 6; x < t.w - 4; x += 14) {
            const drop = 1 + ((x * 3) % 4);
            g.fillStyle(this.theme.dirt, 1);
            g.fillTriangle(x, t.h - 1, x + 4, t.h - 1 + drop, x + 8, t.h - 1);
            if (x % 28 === 6) {
              g.fillStyle(this.theme.grassDark, 0.85);
              g.fillTriangle(x + 2, 16, x + 4, 12, x + 6, 16);
            }
          }
          for (let i = 0; i < t.w / 20; i++) {
            g.fillStyle(0x000000, 0.10);
            g.fillCircle((i * 20 + 10) % t.w, 24 + (i % 3) * 8, 1.5 + (i % 2));
          }
          g.generateTexture(texKey, t.w, t.h);
          g.destroy();
        }
        const plat = this.scene.add.tileSprite(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, texKey);
        plat.setOrigin(0, 0); plat.setScrollFactor(1, 1); plat.setDepth(DEPTH.ground + 0.1);
        this.add(plat);
      }
    }
  }

  /** 装饰：按 decorations 放置，用 sprite 渲染器绘制 */
  private buildDecorations(decorations?: Decoration[]): void {
    if (!decorations) return;
    registerAllRenderers(); // 确保渲染器已注册（vector + sprite）
    for (const d of decorations) {
      const entry = getRendererEntry(d.kind);
      if (!entry) {
        log.warn('unknown decoration kind', { kind: d.kind });
        continue;
      }
      // 装饰物目前均为 sprite（bush/flower/fence/stalactite/lantern/totem/ruin-pillar/cactus/mushroom/cloud/snowflake）
      if (entry.kind !== 'sprite') {
        log.warn('decoration kind is not sprite', { kind: d.kind });
        continue;
      }
      const sprite = this.scene.add.sprite(
        d.x,
        d.y,
        entry.def.atlasKey,
        frameForState(entry.def, 'idle'),
      );
      sprite.setScale(d.scale ?? 1);
      // 丛林前景只负责提供空间层次，降低灌木/花朵/蘑菇的对比度，给角色与 NPC 留出清晰的可玩带。
      if (this.themeId === 'jungle' && ['bush', 'flower', 'mushroom'].includes(d.kind)) {
        sprite.setAlpha(0.54);
      }
      sprite.setScrollFactor(1, 1);
      sprite.setDepth(DEPTH.decor + (d.y * 0.001));
      if (this.themeId === 'jungle' && ['bush', 'flower', 'mushroom'].includes(d.kind)) {
        this.swayObjects.push({ go: sprite, baseRotation: sprite.rotation, phase: d.x * 0.013 });
      }
      this.add(sprite);
    }
  }

  /** 传送门门户：对每个 transition 画手绘石柱+拱+暖光 */
  private buildPortals(transitions?: { toLevelId: string; at: AABB }[]): void {
    if (!transitions) return;
    for (const t of transitions) {
      const cx = (t.at.minX + t.at.maxX) / 2;
      const cy = (t.at.minY + t.at.maxY) / 2;
      const g = this.scene.add.graphics();
      g.setPosition(cx, cy);
      g.setScrollFactor(1, 1);
      g.setDepth(DEPTH.portal);
      // 传送门优先复用已有手绘废墟 atlas，程序化层只负责暖光与脉动，避免关键物体与实体 sprite 画风断裂。
      const portalEntry = getRendererEntry('ruin-pillar');
      if (portalEntry?.kind === 'sprite' && this.scene.textures.exists(portalEntry.def.atlasKey)) {
        g.setPosition(cx, t.at.maxY - 10);
        g.fillStyle(0xffdc50, 0.18);
        g.fillEllipse(0, -76, 54, 140);
        g.fillStyle(0xffa51f, 0.34);
        g.fillEllipse(0, -76, 22, 112);
        this.portalGfx.push(g);
        this.add(g);

        const portal = this.scene.add.sprite(
          cx,
          t.at.maxY - 10,
          portalEntry.def.atlasKey,
          frameForState(portalEntry.def, 'idle'),
        );
        portal.setOrigin(0.5, 1).setScale(1.05).setDepth(DEPTH.portal + 0.1);
        this.add(portal);
        continue;
      }
      // 两根石柱
      g.fillStyle(0x5a5a5a, 1);
      g.lineStyle(2, 0x1b2233, 0.6);
      g.fillRect(-22, -50, 10, 100);
      g.strokeRect(-22, -50, 10, 100);
      g.fillRect(12, -50, 10, 100);
      g.strokeRect(12, -50, 10, 100);
      // 错位石块、高光与苔藓斑，保持功能层的精确碰撞同时补齐手绘材质。
      for (const x of [-22, 12]) {
        for (let y = -42; y <= 36; y += 20) {
          g.lineStyle(1, 0x2a3040, 0.42);
          g.lineBetween(x, y, x + 10, y + 2);
          g.fillStyle(0xb8c1ae, 0.32);
          g.fillRect(x + 1, y + 2, 2, 7);
        }
      }
      g.fillStyle(0x6fa15e, 0.72);
      g.fillEllipse(-18, -18, 5, 15);
      g.fillEllipse(17, 22, 5, 13);
      // 顶部拱
      g.fillStyle(0x5a5a5a, 1);
      g.fillEllipse(0, -50, 44, 20);
      g.strokeEllipse(0, -50, 44, 20);
      g.lineStyle(2, 0xb8c1ae, 0.42);
      g.arc(0, -50, 18, Math.PI, 0, false);
      // 内部暖光
      g.fillGradientStyle(0xffdc50, 0xff8c00, 0xffdc50, 0xff8c00, 0, 0.4, 0.4, 0.6);
      g.fillRect(-12, -45, 24, 90);
      this.portalGfx.push(g);
      this.add(g);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 丛林主题专属层（在 buildPortals 之后由 build() 调用）
  // ─────────────────────────────────────────────────────────────

  /** 丛林专属：大气光晕 + 哥特建筑 + 屏幕侧树 */
  private buildJungleExtra(width: number, height: number): void {
    this.buildJungleGlow(width, height);
    this.buildGothicBuilding();
    this.buildJungleSideTrees(width, height);
  }

  /** 丛林大气光晕 —— 单片阳光与斜向光束，避免同心圆覆盖世界 */
  private buildJungleGlow(width: number, _height: number): void {
    const g = this.scene.add.graphics();
    g.setScrollFactor(0, 0).setDepth(DEPTH.mountain + 0.5);
    g.fillStyle(0xeaffbd, 0.055);
    g.fillEllipse(width * 0.78, 92, Math.min(width * 0.24, 240), 100);
    this.addResizable(g);
  }

  /** 哥特式建筑剪影 —— 背景中央，scrollFactor 0.22 */
  private buildGothicBuilding(): void {
    const cx = (this.bounds.minX + this.bounds.maxX) / 2;
    const groundY = this.bounds.maxY - 30;
    const by = groundY;

    const g = this.scene.add.graphics();
    g.setScrollFactor(0.22, 0.22);
    g.setDepth(DEPTH.mountain + 2);
    g.fillStyle(0x5e8b6c, 0.45);

    // 主楼体
    g.fillRect(cx - 52, by - 160, 104, 160);
    // 左侧翼
    g.fillRect(cx - 84, by - 110, 34, 110);
    // 右侧翼
    g.fillRect(cx + 50, by - 110, 34, 110);
    // 主塔身
    g.fillRect(cx - 22, by - 220, 44, 68);
    // 主塔尖
    g.fillTriangle(cx - 24, by - 220, cx, by - 265, cx + 24, by - 220);
    // 左侧塔尖
    g.fillTriangle(cx - 84, by - 110, cx - 67, by - 148, cx - 50, by - 110);
    // 右侧塔尖
    g.fillTriangle(cx + 50, by - 110, cx + 67, by - 148, cx + 84, by - 110);
    // 女儿墙锯齿（顶部）
    for (let i = -4; i <= 4; i++) {
      g.fillRect(cx + i * 12 - 4, by - 165, 8, 10);
    }

    // 拱形窗（比楼色深）
    g.fillStyle(0x3f6954, 0.62);
    for (const wx of [cx - 30, cx, cx + 30]) {
      g.fillEllipse(wx, by - 110, 18, 30);
    }
    // 侧翼窗
    g.fillEllipse(cx - 67, by - 75, 12, 20);
    g.fillEllipse(cx + 67, by - 75, 12, 20);

    // 轮廓线（微亮灰，显结构）
    g.lineStyle(1.5, 0xb0d49c, 0.28);
    g.strokeRect(cx - 52, by - 160, 104, 160);
    g.strokeRect(cx - 84, by - 110, 34, 110);
    g.strokeRect(cx + 50, by - 110, 34, 110);

    this.add(g);
  }

  /**
   * 丛林侧树 —— 左右两侧巨型树木剪影，固定在屏幕边缘（scrollFactor 0.08）。
   * 深绿色、多层树冠，形成天然"相框"效果。
   */
  private buildJungleSideTrees(width: number, height: number): void {
    const groundY = this.bounds.maxY - 30;

    for (const side of ['left', 'right'] as const) {
      const g = this.scene.add.graphics();
      g.setScrollFactor(0.08, 0.08);
      g.setDepth(DEPTH.midground + 3);
      g.setAlpha(0.78);

      const sx = side === 'left' ? -48 : width + 48;
      const flip = side === 'left' ? 1 : -1;

      // 树干（厚实）
      g.fillStyle(0x49714a, 0.5);
      g.fillRect(sx - flip * 10, groundY - 560, flip * 62, 560);

      // 巨型树冠（多层叠加）
      const crowns = [
        { ox: 44, oy: -380, r: 125 },
        { ox: 78, oy: -292, r: 100 },
        { ox: 20, oy: -246, r: 92 },
        { ox: 64, oy: -192, r: 84  },
        { ox: 38, oy: -142, r: 72  },
        { ox: 92, oy: -112, r: 64 },
      ];
      for (const c of crowns) {
        const alpha = 0.14 + (c.r % 3) * 0.02;
        g.fillStyle(0x2d754a, alpha);
        g.fillEllipse(sx + flip * c.ox, groundY + c.oy, c.r * 1.35, c.r * 0.72);
      }

      // 次色高光叶冠，形成明亮的森林边缘而非黑色相框。
      g.fillStyle(0x7dcf68, 0.22);
      g.fillCircle(sx + flip * 55, groundY - 360, 80);
      g.fillCircle(sx + flip * 80, groundY - 240, 55);

      void height;
      this.addResizable(g);
    }
  }
}
