/**
 * Filter 配置 —— Camera 级纸片氛围 + 关键 GameObject 的发光。
 *
 * 涂鸦纸片质感：轻微色彩分级（降饱和/提亮中调/轻对比）+ 纸纹颗粒全屏 Noise 层；
 * 删除 Vignette（纸面平整，暗角是照片语言与手绘纸片冲突）。
 * 关键发光体（火/Starite/门户）挂 Glow filter。
 */

import Phaser from 'phaser';
import type { GameEntity } from '@/game/Entity';

export class FxFilters {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private scene: Phaser.Scene;
  private noiseObj: Phaser.GameObjects.Noise | undefined;

  constructor(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.cam = cam;
  }

  /** Camera 级色彩分级：轻微提亮 + 降饱和 + 轻对比（纸感非照片感） */
  applyAmbience(): void {
    const cm = this.cam.filters.internal.addColorMatrix();
    cm.colorMatrix.brightness(0.04);
    cm.colorMatrix.saturate(-0.1); // 略降饱和
    cm.colorMatrix.contrast(0.05);
    // 去掉强暗角（纸面平，不压角）
  }

  /** 纸纹颗粒全屏层：Noise Multiply blend，缓慢漂移 */
  applyPaperGrain(): void {
    const n = this.scene.add.noise(undefined, 0, 0, this.cam.width, this.cam.height);
    n.setOrigin(0, 0);
    n.setScrollFactor(0, 0);
    n.setDepth(-35);
    n.setBlendMode(Phaser.BlendModes.MULTIPLY);
    n.noiseColorStart = Phaser.Display.Color.ValueToColor(0xffffff);
    n.noiseColorStart.alpha = 0.06;
    n.noiseColorEnd = Phaser.Display.Color.ValueToColor(0xffffff);
    n.noiseColorEnd.alpha = 0.06;
    n.noisePower = 0.9;
    this.noiseObj = n;
  }

  /** 每帧漂移纸纹 offset（纸纹微动活气） */
  update(delta: number): void {
    if (!this.noiseObj) return;
    const off = this.noiseObj.noiseOffset;
    off[0] += delta * 0.0001;
    off[1] += delta * 0.00007;
  }

  /** 相机视口尺寸变化时重建纸纹层（按新 cam.width/height 重铺，QuizScene 分屏用） */
  resize(): void {
    if (!this.noiseObj) return;
    this.noiseObj.destroy();
    this.noiseObj = undefined;
    this.applyPaperGrain();
  }

  /** 给发光体挂 Glow filter（火/Starite/门户等） */
  attachGlow(e: GameEntity, color = 0xff8c00, strength = 3): void {
    const go = e.gameObject as Phaser.GameObjects.Graphics | undefined;
    if (!go) return;
    go.enableFilters();
    go.filters?.internal.addGlow(color, strength, 0, 1, false);
  }
}
