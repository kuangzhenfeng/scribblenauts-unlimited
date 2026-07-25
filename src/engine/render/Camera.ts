/**
 * 相机适配 —— 世界坐标 ↔ 屏幕坐标变换，跟随目标实体。
 *
 * 用 Phaser Camera 的 setLerp + setBounds 实现 lerp 跟随与边界钳制，
 * screenToWorld 用 getWorldPoint（dpr 无关），供鼠标拾取/拖拽/生成复用。
 */

import type Phaser from 'phaser';
import type { AABB } from '@/core/types/level';

export class Camera {
  /** Phaser 相机引用 */
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  /** 关卡边界钳制（由 LevelManager 设置） */
  clampTo?: AABB;
  /** 跟随平滑系数 */
  lerp = 0.12;

  constructor(cam: Phaser.Cameras.Scene2D.Camera) {
    this.cam = cam;
  }

  /** 跟随目标实体（lerp + bounds 钳制由 Phaser 内置完成） */
  follow(target: { bodyPositionX: number; bodyPositionY: number }, lerp = this.lerp): void {
    this.cam.setLerp(lerp, lerp);
    if (this.clampTo) {
      this.cam.setBounds(this.clampTo.minX, this.clampTo.minY, this.clampTo.maxX - this.clampTo.minX, this.clampTo.maxY - this.clampTo.minY);
    }
    // startFollow 需 GameObject；用直接 setScroll + 每帧手动 lerp 更可控
    this.cam.setScroll(target.bodyPositionX - this.cam.width / 2, target.bodyPositionY - this.cam.height / 2);
  }

  /** 每帧手动 lerp 跟随（先按 clampTo 钳制目标再 lerp，避免插值后越界） */
  followUpdate(targetX: number, targetY: number): void {
    if (this.clampTo) {
      const halfW = this.cam.width / 2;
      const halfH = this.cam.height / 2;
      targetX = Math.max(this.clampTo.minX + halfW, Math.min(this.clampTo.maxX - halfW, targetX));
      targetY = Math.max(this.clampTo.minY + halfH, Math.min(this.clampTo.maxY - halfH, targetY));
    }
    const sx = this.cam.scrollX;
    const sy = this.cam.scrollY;
    this.cam.setScroll(sx + (targetX - sx - this.cam.width / 2) * this.lerp, sy + (targetY - sy - this.cam.height / 2) * this.lerp);
  }

  /** 屏幕 CSS 像素 → 世界坐标（供鼠标拾取/拖拽/生成复用） */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return this.cam.getWorldPoint(sx, sy);
  }
}
