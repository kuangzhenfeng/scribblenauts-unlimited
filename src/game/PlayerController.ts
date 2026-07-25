/**
 * 玩家控制器 —— 键盘输入 → 玩家实体的运动学（移动/跳跃/朝向）。
 *
 * 职责边界：只驱动玩家实体的运动学与 locomotion/facing 状态，
 * 不含规则/渲染逻辑。输入在输入框聚焦时让位（IME/笔记本优先）。
 *
 * 移动用 setBodyVelocity 直接控制；地面接触用 Physics.pointQuery 双脚探针。
 * 拾取/投掷/骑乘统一用 Composite.attach/detach 刚性约束。
 */

import type Phaser from 'phaser';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { GameEntity } from '@/game/Entity';
import { attach, detach, type Attachment } from '@/engine/physics/Composite';
import { log } from '@/util/log';

/** 水平移动速度（世界像素/帧，@60fps≈192px/s） */
const MOVE_SPEED = 3.2;
/** 跳跃初速度（向上 y 分量） */
const JUMP_VELOCITY = -8.5;
/** 着地探针：脚下距刚体中心的偏移（biped 半高 + 裕量） */
const FEET_OFFSET = 30;
/** 着地探针：脚下 4px 处做点查询 */
const GROUND_PROBE = 4;
/** 着地探针在 x 方向的左右两脚 */
const FEET_SPREAD = 8;

export class PlayerController {
  private readonly keys = new Set<string>();
  private facing = 1;
  private lastGroundedPos = { x: 0, y: 0 };
  /** 拾取的约束（item 附着在玩家手部） */
  private heldAttachment: Attachment | undefined;
  /** 骑乘的约束（玩家附在载具座位） */
  private riding: Attachment | undefined;
  /** 骑乘的载具实体 */
  private ridingEntity: GameEntity | undefined;

  constructor(
    private readonly entities: EntityManager,
    private readonly physics: Physics,
  ) {}

  /** 绑定 Phaser 键盘输入；输入框聚焦时让位 */
  attach(scene: Phaser.Scene): void {
    const kd = scene.input.keyboard;
    if (!kd) return;
    kd.on('keydown', (e: KeyboardEvent) => {
      const ae = document.activeElement;
      if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
    });
    kd.on('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase());
    });
    scene.sys.game.events.on('blur', () => this.keys.clear());
  }

  /** 每帧驱动玩家运动学 */
  update(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || p.dead) return;
    // 骑乘时移动作用于载具 body，否则作用于玩家 body
    const target = this.ridingEntity ?? p;
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    let vx = 0;
    if (left) vx -= MOVE_SPEED;
    if (right) vx += MOVE_SPEED;
    if (vx !== 0) this.facing = vx < 0 ? -1 : 1;
    const grounded = this.probeGrounded(p);
    const jump = this.keys.has(' ') || this.keys.has('w') || this.keys.has('arrowup');
    const bodyVel = (target.body as { velocity: { x: number; y: number } }).velocity;
    const vy = grounded && jump ? JUMP_VELOCITY : bodyVel.y;
    target.setBodyVelocity(vx, vy);
    if (grounded) {
      this.lastGroundedPos = { x: p.bodyPositionX, y: p.bodyPositionY };
    }
    p.state.facing = this.facing;
    p.state.locomotion = !grounded ? 'jump' : (vx !== 0 ? 'walk' : 'idle');

    if (this.keys.has('f') && !this.heldAttachment && !this.riding) {
      this.tryPickUpNearby();
    }
    if (this.keys.has('g')) {
      if (this.riding) this.dismount();
      else if (this.heldAttachment) this.releaseThrow();
    }
  }

  /** 双脚探针着地判定 */
  probeGrounded(p: GameEntity): boolean {
    const cy = p.bodyPositionY + FEET_OFFSET;
    for (const dx of [-FEET_SPREAD, FEET_SPREAD]) {
      const hits = this.physics.pointQuery(p.bodyPositionX + dx, cy + GROUND_PROBE);
      for (const b of hits) {
        if (b.id !== p.body.id) return true;
      }
    }
    return false;
  }

  /** 拾取面前实体：在玩家朝向 40px 范围内找最近可拾取实体 */
  private tryPickUpNearby(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p) return;
    const fx = p.bodyPositionX + this.facing * 40;
    const fy = p.bodyPositionY;
    const hits = this.physics.pointQuery(fx, fy);
    for (const b of hits) {
      const e = this.entities.getByBody(b.id) as GameEntity | undefined;
      if (e && !e.isPlayer && e.typeId !== 'human') {
        this.pickUp(e);
        return;
      }
    }
  }

  pickUp(target: GameEntity): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !target || this.heldAttachment) return;
    this.heldAttachment = attach(this.physics, p, target, [this.facing * 14, -8]);
    log.info('player picked up', { target: target.id });
  }

  releaseThrow(power = 0): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !this.heldAttachment) return;
    const item = this.entities.get(this.heldAttachment.childId) as GameEntity | undefined;
    detach(this.physics, this.heldAttachment);
    this.heldAttachment = undefined;
    if (item) {
      item.setBodyVelocity(this.facing * (4 + power), -2);
      log.info('player threw', { target: item.id });
    }
  }

  mount(target: GameEntity): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || this.riding) return;
    if (!target.tags.flags.has('rideable')) return;
    this.riding = attach(this.physics, target, p, [0, -10]);
    this.ridingEntity = target;
    p.hidden = true;
    log.info('player mounted', { target: target.id });
  }

  dismount(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !this.riding) return;
    detach(this.physics, this.riding);
    p.hidden = false;
    this.riding = undefined;
    this.ridingEntity = undefined;
  }

  get respawnPoint(): { x: number; y: number } {
    return this.lastGroundedPos;
  }
}
