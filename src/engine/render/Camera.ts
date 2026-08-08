/**
 * 相机适配 —— 世界坐标 ↔ 屏幕坐标变换，跟随目标实体。
 *
 * 用 Phaser Camera 的 setLerp + setBounds 实现 lerp 跟随与边界钳制，
 * screenToWorld 用 getWorldPoint（dpr 与 zoom 无关），供鼠标拾取/拖拽/生成复用；
 * 相机支持原版 PC 的小键盘平移、C/Numpad5 复位和 +/-/滚轮缩放。
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
  /** 键盘相机平移速度（世界像素/帧，按 60fps 估算）。 */
  private readonly panSpeed = 6;
  /** 相对 Maxwell 的手动观察偏移；跟随玩家时仍保持该偏移。 */
  private panOffset = { x: 0, y: 0 };

  constructor(cam: Phaser.Cameras.Scene2D.Camera) {
    this.cam = cam;
  }

  /** 跟随目标实体（lerp + bounds 钳制由 Phaser 内置完成） */
  follow(
    target: { bodyPositionX: number; bodyPositionY: number },
    lerp = this.lerp,
    focusOffsetY = 0,
  ): void {
    this.cam.setLerp(lerp, lerp);
    if (this.clampTo) {
      this.cam.setBounds(this.clampTo.minX, this.clampTo.minY, this.clampTo.maxX - this.clampTo.minX, this.clampTo.maxY - this.clampTo.minY);
    }
    // startFollow 需 GameObject；用直接 setScroll + 每帧手动 lerp 更可控。
    const scroll = this.targetScroll(target.bodyPositionX, target.bodyPositionY, focusOffsetY);
    this.cam.setScroll(scroll.x, scroll.y);
  }

  /** 每帧手动 lerp 跟随（先按 clampTo 钳制目标再 lerp，避免插值后越界） */
  followUpdate(targetX: number, targetY: number, focusOffsetY = 0): void {
    const desired = this.targetScroll(targetX, targetY, focusOffsetY);
    const sx = this.cam.scrollX;
    const sy = this.cam.scrollY;
    this.cam.setScroll(
      sx + (desired.x - sx) * this.lerp,
      sy + (desired.y - sy) * this.lerp,
    );
  }

  /** 立即跳转到目标位置，绕过 lerp（关卡切换时调用，避免玩家飞出画面） */
  snapTo(x: number, y: number, focusOffsetY = 0): void {
    this.panOffset = { x: 0, y: 0 };
    const scroll = this.targetScroll(x, y, focusOffsetY);
    this.cam.setScroll(scroll.x, scroll.y);
  }

  /** 按原版小键盘相机控制平移观察点。dx/dy 为世界坐标增量。 */
  panBy(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.panOffset.x += dx;
    this.panOffset.y += dy;
  }

  /** 返回一帧相机应到达的目标位置；由 WorldScene 每帧调用。 */
  panDirection(horizontal: number, vertical: number, deltaMs: number): void {
    const frameScale = Math.min(Math.max(deltaMs, 0), 50) / (1000 / 60);
    const magnitude = Math.hypot(horizontal, vertical) || 1;
    this.panBy(
      (horizontal / magnitude) * this.panSpeed * frameScale,
      (vertical / magnitude) * this.panSpeed * frameScale,
    );
  }

  /** 按原版 C / Numpad5 语义清除手动观察偏移并重新居中。 */
  resetView(x: number, y: number, focusOffsetY = 0): void {
    this.snapTo(x, y, focusOffsetY);
  }

  /** 按原版 +/- 与鼠标滚轮调整缩放，同时保持当前视口中心不跳动。 */
  zoomBy(delta: number): void {
    const current = this.cam.zoom || 1;
    const next = Math.max(0.75, Math.min(1.5, current + delta));
    if (next === current) return;
    // 直接按 Phaser 的 scroll 语义读取当前中心，避免 wheel 事件恰好发生在
    // preRender 前时，getWorldPoint 仍使用上一帧矩阵而产生一次跳变。
    const center = {
      x: this.cam.scrollX + this.cam.width / 2,
      y: this.cam.scrollY + this.cam.height / 2,
    };
    this.cam.setZoom(next);
    // Phaser 的 scroll 是相对相机视口中心的世界坐标偏移，不是缩放后
    // worldView 的左上角；缩放只改变同一 scroll 下可见的世界范围。
    this.cam.setScroll(center.x - this.cam.width / 2, center.y - this.cam.height / 2);
  }

  private targetScroll(x: number, y: number, focusOffsetY: number): { x: number; y: number } {
    const zoom = this.cam.zoom || 1;
    const scrollHalfW = this.cam.width / 2;
    const scrollHalfH = this.cam.height / 2;
    const worldHalfW = this.cam.width / (2 * zoom);
    const worldHalfH = this.cam.height / (2 * zoom);
    let targetX = x + this.panOffset.x;
    let targetY = y + focusOffsetY + this.panOffset.y;
    if (this.clampTo) {
      targetX = Math.max(this.clampTo.minX + worldHalfW, Math.min(this.clampTo.maxX - worldHalfW, targetX));
      // 视觉焦点偏移允许相机在地面下方的可见缓冲带内继续下移；Environment
      // 的地面贴图本身保留了这段缓冲，避免角色贴住视口底边。
      const maxFocusY = this.clampTo.maxY - worldHalfH + focusOffsetY;
      targetY = Math.max(this.clampTo.minY + worldHalfH, Math.min(maxFocusY, targetY));
    }
    return { x: targetX - scrollHalfW, y: targetY - scrollHalfH };
  }

  /** 屏幕 CSS 像素 → 世界坐标（供鼠标拾取/拖拽/生成复用） */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return this.cam.getWorldPoint(sx, sy);
  }

  /** 世界坐标 → 屏幕 CSS 像素（供 DOM 浮层和世界特效定位复用） */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.cam.scrollX - this.cam.width / 2) * this.cam.zoom + this.cam.centerX,
      y: (wy - this.cam.scrollY - this.cam.height / 2) * this.cam.zoom + this.cam.centerY,
    };
  }
}
