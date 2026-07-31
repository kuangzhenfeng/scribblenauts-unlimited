/**
 * Filter 配置 —— Camera 级纸片氛围 + 关键 GameObject 的发光。
 *
 * 涂鸦纸片质感：轻微色彩分级（降饱和/提亮中调/轻对比）+ 纸纹颗粒层；
 * 删除 Vignette（纸面平整，暗角是照片语言与手绘纸片冲突）。
 * 关键发光体（火/Starite/门户）挂 Glow filter。
 */

import Phaser from 'phaser';
import type { GameEntity } from '@/game/Entity';

export class FxFilters {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private scene: Phaser.Scene;
  private paperGrainObj: Phaser.GameObjects.TileSprite | undefined;
  private readonly glowFilters = new WeakMap<Phaser.GameObjects.GameObject, Phaser.Filters.Glow>();

  /** 纸纹只在初始化时生成小纹理，避免每帧执行全屏 Noise fragment shader。 */
  private static readonly PAPER_GRAIN_TEXTURE_KEY = '__paper-grain';
  private static readonly PAPER_GRAIN_SIZE = 64;

  constructor(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.cam = cam;
  }

  /** Camera 级色彩分级：轻微提亮 + 降饱和 + 轻对比（纸感非照片感） */
  applyAmbience(): void {
    // Phaser 4 的 Camera2 颜色矩阵在 WebGL 合成路径下会把 WorldScene 的
    // 纹理层压成近黑，只保留 DOM HUD。场景素材本身已按统一纸片风格制作，
    // 因此不再对整台相机做全屏颜色变换，避免破坏实际游玩画面。
    void this.cam;
  }

  /** 纸纹颗粒全屏层：静态小纹理 TileSprite + Multiply，缓慢漂移 */
  applyPaperGrain(): void {
    this.ensurePaperGrainTexture();
    const grain = this.scene.add.tileSprite(
      0,
      0,
      this.cam.width,
      this.cam.height,
      FxFilters.PAPER_GRAIN_TEXTURE_KEY,
    );
    grain.setOrigin(0, 0);
    grain.setScrollFactor(0, 0);
    grain.setDepth(-35);
    grain.setBlendMode(Phaser.BlendModes.MULTIPLY);
    grain.setAlpha(0.08);
    this.paperGrainObj = grain;
  }

  /** 每帧漂移纸纹 offset（纸纹微动活气） */
  update(delta: number): void {
    if (!this.paperGrainObj) return;
    this.paperGrainObj.tilePositionX += delta * 0.01;
    this.paperGrainObj.tilePositionY += delta * 0.007;
  }

  /** 相机视口尺寸变化时重建纸纹层（按新 cam.width/height 重铺，QuizScene 分屏用） */
  resize(): void {
    if (!this.paperGrainObj) return;
    this.paperGrainObj.destroy();
    this.paperGrainObj = undefined;
    this.applyPaperGrain();
  }

  /** 生成一次低分辨率纸纹，运行期只做普通纹理采样。 */
  private ensurePaperGrainTexture(): void {
    if (this.scene.textures.exists(FxFilters.PAPER_GRAIN_TEXTURE_KEY)) return;

    const size = FxFilters.PAPER_GRAIN_SIZE;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // 确定性灰度分布，避免初始化依赖随机数，也避免纹理重复得过于明显。
        const value = (x * 17 + y * 31 + x * y * 7) % 29;
        const color = value < 4 ? 0xc4c9bd : value < 12 ? 0xe0e3da : 0xffffff;
        g.fillStyle(color, 1);
        g.fillRect(x, y, 1, 1);
      }
    }
    g.generateTexture(FxFilters.PAPER_GRAIN_TEXTURE_KEY, size, size);
    g.destroy();
  }

  /** 给发光体挂 Glow filter（火/Starite/门户等） */
  attachGlow(e: GameEntity, color = 0xff8c00, strength = 3): void {
    const go = e.gameObject as Phaser.GameObjects.Graphics | undefined;
    if (!go) return;
    if (this.glowFilters.has(go)) return;
    go.enableFilters();
    const glow = go.filters?.internal.addGlow(color, strength, 0, 1, false);
    if (glow) this.glowFilters.set(go, glow);
  }

  /** 移除燃烧状态结束后的实体 Glow，避免保留无效的后处理通道。 */
  detachGlow(e: GameEntity): void {
    const go = e.gameObject as Phaser.GameObjects.Graphics | undefined;
    if (!go) return;
    const glow = this.glowFilters.get(go);
    if (!glow) return;
    go.filters?.internal.remove(glow);
    this.glowFilters.delete(go);
  }
}
