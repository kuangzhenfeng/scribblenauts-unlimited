/**
 * 鼠标拾取器 —— pointerdown/move/up → 选中/拖拽/投掷。
 *
 * 职责边界：只做命中与拖拽运动学，不决定拾取/骑乘语义（那些在 PlayerController）。
 * 选中实体时暴露 selectedId 供 Notebook 的"对选中实体施加形容词"取目标。
 * 拖拽用 setBodyPosition 对齐鼠标，释放时按帧间位移估算速度投掷（KISS）。
 */

import type Phaser from 'phaser';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { Camera } from '@/engine/render/Camera';
import type { GameEntity } from '@/game/Entity';
import { log } from '@/util/log';

export class MousePicker {
  /** 当前选中的实体 id（供 Notebook 取目标施加形容词） */
  selectedId: string | undefined;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  /** 上一帧拖拽位移（估算投掷速度用） */
  private lastDelta = { x: 0, y: 0 };
  private lastT = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entities: EntityManager,
    private readonly physics: Physics,
    private readonly camera: Camera,
  ) {}

  attach(): void {
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.scene.input.on('pointerup', () => this.onUp());
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const w = this.camera.screenToWorld(p.x, p.y);
    const hits = this.physics.pointQuery(w.x, w.y);
    for (const b of hits) {
      const e = this.entities.getByBody(b.id) as GameEntity | undefined;
      if (e) {
        this.selectedId = e.id;
        this.dragging = true;
        this.dragOffset = { x: e.bodyPositionX - w.x, y: e.bodyPositionY - w.y };
        this.lastT = this.scene.time.now;
        this.lastDelta = { x: 0, y: 0 };
        log.info('entity selected', { id: e.id });
        return;
      }
    }
    this.selectedId = undefined;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.dragging || !this.selectedId) return;
    const ent = this.entities.get(this.selectedId) as GameEntity | undefined;
    if (!ent) return;
    const w = this.camera.screenToWorld(p.x, p.y);
    const tx = w.x + this.dragOffset.x;
    const ty = w.y + this.dragOffset.y;
    const now = this.scene.time.now;
    const idt = Math.max(8, now - this.lastT);
    this.lastDelta = {
      x: ((tx - ent.bodyPositionX) / idt) * 16,
      y: ((ty - ent.bodyPositionY) / idt) * 16,
    };
    ent.setBodyPosition(tx, ty);
    ent.setBodyVelocity(0, 0);
    this.lastT = now;
  }

  private onUp(): void {
    if (!this.dragging || !this.selectedId) return;
    const ent = this.entities.get(this.selectedId) as GameEntity | undefined;
    if (ent) {
      ent.setBodyVelocity(this.lastDelta.x, this.lastDelta.y);
      log.info('entity released', { id: ent.id });
    }
    this.dragging = false;
  }
}
