/**
 * 鼠标拾取器 —— 左键点击/拖拽、右键副操作的输入适配层。
 *
 * 职责边界：只做命中、指针手势与拖拽运动学，不决定拾取/骑乘/开火语义
 * （那些在 PlayerController）。左键点击坐标与实体的“靠近后使用”由回调上交，
 * 左键拖拽仍保留原版触屏式物体操控；右键只转发瞄准与动作意图。
 */

import type Phaser from 'phaser';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { Camera } from '@/engine/render/Camera';
import type { GameEntity } from '@/game/Entity';
import { log } from '@/util/log';

export interface MousePickerOptions {
  /** 拖拽释放到玩家附近时尝试建立装备/骑乘附着。 */
  onDropEntity?: (entity: GameEntity, x: number, y: number) => boolean;
  /** 左键点击空白处：原版触屏式“点哪里，Maxwell 走到哪里”。 */
  onTapEmpty?: (x: number, y: number) => void;
  /** 左键点击实体：Maxwell 靠近实体并执行默认使用动作。 */
  onTapEntity?: (entity: GameEntity, x: number, y: number) => void;
  /** 右键按下/移动/释放：由 PlayerController 解释为瞄准、开火或动作。 */
  onSecondaryDown?: (x: number, y: number, entity: GameEntity | undefined) => void;
  onSecondaryMove?: (x: number, y: number) => void;
  onSecondaryUp?: () => void;
}

export class MousePicker {
  /** 当前选中的实体 id（供 Notebook 取目标施加形容词） */
  selectedId: string | undefined;
  /** 选中状态变化时通知 UI 浮层 */
  onSelectionChanged?: (entityId: string | undefined) => void;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  /** 上一帧拖拽位移（估算投掷速度用） */
  private lastDelta = { x: 0, y: 0 };
  private lastT = 0;
  /** 拖拽累计距离；单击只选中，不触发装备/投掷语义。 */
  private dragDistance = 0;
  /** 上一次 pointer 位置（世界坐标），用于累计拖拽距离。 */
  private lastPointerWorld = { x: 0, y: 0 };
  /** 当前左键指针；使用 pointer id 避免右键/第二指干扰拖拽。 */
  private primaryPointerId: number | undefined;
  /** 左键点击空白处的待确认手势。 */
  private pendingEmptyTap = false;
  /** 当前右键指针。 */
  private secondaryPointerId: number | undefined;
  private readonly options: MousePickerOptions;
  private readonly blurHandler = (): void => this.resetPointerState();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entities: EntityManager,
    private readonly physics: Physics,
    private readonly camera: Camera,
    options: MousePickerOptions | ((entity: GameEntity, x: number, y: number) => boolean) = {},
  ) {
    // 保留旧的第五参数函数形态，避免输入层改造时扩大调用方的职责范围。
    this.options = typeof options === 'function' ? { onDropEntity: options } : options;
  }

  attach(): void {
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.scene.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.scene.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.scene.sys.game.events.on('blur', this.blurHandler);
  }

  /** 场景销毁时移除全局失焦监听，避免旧世界继续持有输入层引用。 */
  destroy(): void {
    this.scene.sys.game.events.off('blur', this.blurHandler);
    this.resetPointerState();
  }

  /** 键鼠焦点丢失时清除未完成手势，避免恢复窗口后实体继续被拖拽。 */
  private resetPointerState(): void {
    this.dragging = false;
    this.primaryPointerId = undefined;
    this.secondaryPointerId = undefined;
    this.pendingEmptyTap = false;
    this.dragDistance = 0;
    this.lastDelta = { x: 0, y: 0 };
  }

  /** 按原版 Q/E 旋转当前选中的非玩家实体。 */
  rotateSelected(direction: -1 | 1): boolean {
    if (direction !== -1 && direction !== 1) return false;
    const entity = this.selectedId
      ? this.entities.get(this.selectedId) as GameEntity | undefined
      : undefined;
    if (!entity || entity.isPlayer || entity.dead) return false;
    entity.setBodyAngle(entity.bodyAngle + direction * (Math.PI / 12));
    entity.setBodyAngularVelocity(0);
    log.info('entity rotated', { id: entity.id, direction: direction < 0 ? 'left' : 'right' });
    return true;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const w = this.camera.screenToWorld(p.x, p.y);
    if (p.button === 2) {
      if (this.secondaryPointerId !== undefined) return;
      this.secondaryPointerId = p.id;
      this.options.onSecondaryDown?.(w.x, w.y, this.hitAt(w.x, w.y));
      return;
    }
    if (p.button !== 0 || this.primaryPointerId !== undefined) return;
    this.primaryPointerId = p.id;
    const entity = this.hitAt(w.x, w.y);
    if (!entity) {
      this.selectedId = undefined;
      this.onSelectionChanged?.(undefined);
      this.pendingEmptyTap = true;
      this.dragDistance = 0;
      this.lastPointerWorld = { x: w.x, y: w.y };
      return;
    }
    this.selectedId = entity.id;
    this.onSelectionChanged?.(entity.id);
    this.dragging = true;
    this.dragOffset = { x: entity.bodyPositionX - w.x, y: entity.bodyPositionY - w.y };
    this.lastT = this.scene.time.now;
    this.lastDelta = { x: 0, y: 0 };
    this.dragDistance = 0;
    this.lastPointerWorld = { x: w.x, y: w.y };
    log.info('entity selected', { id: entity.id });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const w = this.camera.screenToWorld(p.x, p.y);
    if (this.secondaryPointerId === p.id) {
      this.options.onSecondaryMove?.(w.x, w.y);
      return;
    }
    if (this.primaryPointerId !== p.id) return;
    if (!this.dragging || !this.selectedId) {
      if (this.pendingEmptyTap) {
        this.dragDistance += Math.hypot(w.x - this.lastPointerWorld.x, w.y - this.lastPointerWorld.y);
        this.lastPointerWorld = { x: w.x, y: w.y };
      }
      return;
    }
    const ent = this.entities.get(this.selectedId) as GameEntity | undefined;
    if (!ent) return;
    this.dragDistance += Math.hypot(w.x - this.lastPointerWorld.x, w.y - this.lastPointerWorld.y);
    this.lastPointerWorld = { x: w.x, y: w.y };
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

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.secondaryPointerId === p.id) {
      this.options.onSecondaryUp?.();
      this.secondaryPointerId = undefined;
      return;
    }
    if (this.primaryPointerId !== p.id) return;
    const w = this.camera.screenToWorld(p.x, p.y);
    if (this.dragging && this.selectedId) {
      const ent = this.entities.get(this.selectedId) as GameEntity | undefined;
      // pointerup 可能没有对应的最后 pointermove，先把实体定位到真实释放点。
      this.onMove(p);
      const dragged = this.dragDistance >= 8;
      if (ent && dragged) {
        const attached = this.options.onDropEntity?.(ent, ent.bodyPositionX, ent.bodyPositionY) === true;
        if (attached) {
          ent.setBodyVelocity(0, 0);
          log.info('entity attached from drag', { id: ent.id });
        } else {
          ent.setBodyVelocity(this.lastDelta.x, this.lastDelta.y);
          log.info('entity released', { id: ent.id });
        }
      } else if (ent && !dragged) {
        this.options.onTapEntity?.(ent, w.x, w.y);
      }
    } else if (this.pendingEmptyTap && this.dragDistance < 8) {
      this.options.onTapEmpty?.(w.x, w.y);
    }
    this.dragging = false;
    this.primaryPointerId = undefined;
    this.pendingEmptyTap = false;
    this.dragDistance = 0;
  }

  private hitAt(x: number, y: number): GameEntity | undefined {
    const hits = this.physics.pointQuery(x, y);
    for (const b of hits) {
      const entity = this.entities.getByBody(b.id) as GameEntity | undefined;
      if (entity) return entity;
    }
    return undefined;
  }
}
