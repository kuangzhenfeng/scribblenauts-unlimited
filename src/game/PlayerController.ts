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
import type { StateTag } from '@/core/types/rules';
import { attach, detach, type Attachment } from '@/engine/physics/Composite';
import { log } from '@/util/log';
import { sfx } from '@/audio/SoundEffects';

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

/** 摇杆死区阈值：|moveX| 超过此值才视为方向输入（玩家移动是开关语义） */
const VIRTUAL_MOVE_DEADZONE = 0.5;

export class PlayerController {
  private readonly keys = new Set<string>();
  private facing = 1;
  private lastGroundedPos = { x: 0, y: 0 };
  /** 上一帧是否着地，用于检测"刚着地"瞬间播放音效 */
  private wasGrounded = false;
  /** 拾取的约束（item 附着在玩家手部） */
  private heldAttachment: Attachment | undefined;
  /** 骑乘的约束（玩家附在载具座位） */
  private riding: Attachment | undefined;
  /** 骑乘的载具实体 */
  private ridingEntity: GameEntity | undefined;

  /** 虚拟摇杆 X 轴 -1..1（电平，触屏控制写入） */
  private virtualMoveX = 0;
  /** 虚拟跳跃按钮按住态（电平，触屏控制写入） */
  private virtualJump = false;

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
    // 键盘 + 虚拟摇杆合并：摇杆 |moveX| 超过死区视为方向输入
    const left = this.keys.has('a') || this.keys.has('arrowleft') || this.virtualMoveX < -VIRTUAL_MOVE_DEADZONE;
    const right = this.keys.has('d') || this.keys.has('arrowright') || this.virtualMoveX > VIRTUAL_MOVE_DEADZONE;
    let vx = 0;
    if (left) vx -= MOVE_SPEED;
    if (right) vx += MOVE_SPEED;
    if (vx !== 0) this.facing = vx < 0 ? -1 : 1;
    const grounded = this.probeGrounded(p);
    const jump = this.keys.has(' ') || this.keys.has('w') || this.keys.has('arrowup') || this.virtualJump;
    const bodyVel = (target.body as { velocity: { x: number; y: number } }).velocity;
    const vy = grounded && jump ? JUMP_VELOCITY : bodyVel.y;
    // 跳跃起跳音效（仅在着地状态下按下跳跃）
    if (grounded && jump) sfx.play('jump');
    // 着地音效（上一帧不在地面、本帧着地）
    if (!this.wasGrounded && grounded) sfx.play('land');
    this.wasGrounded = grounded;
    target.setBodyVelocity(vx, vy);
    if (grounded) {
      this.lastGroundedPos = { x: p.bodyPositionX, y: p.bodyPositionY };
    }
    p.state.facing = this.facing;
    // jump（vy<0 上升）/ fall（vy≥0 下落）按原版区分
    if (!grounded) {
      p.state.locomotion = bodyVel.y < 0 ? 'jump' : 'fall';
    } else {
      p.state.locomotion = vx !== 0 ? 'walk' : 'idle';
    }

    if (this.keys.has('f') && !this.heldAttachment && !this.riding) {
      this.tryPickUpNearby();
    }
    if (this.keys.has('g')) {
      if (this.riding) this.dismount();
      else if (this.heldAttachment) this.releaseThrow();
    }
  }

  /**
   * 虚拟摇杆 X 轴输入（触屏控制写入）。
   * dx ∈ [-1,1]，由 TouchControls 计算后注入；update 中按死区判定方向。
   */
  setVirtualMove(dx: number): void {
    this.virtualMoveX = Math.max(-1, Math.min(1, dx));
  }

  /** 虚拟跳跃按钮电平（触屏控制写入，按住 true / 松开 false） */
  setVirtualJump(v: boolean): void {
    this.virtualJump = v;
  }

  /**
   * 统一交互触发（触屏按钮调用）：
   * 骑乘中→下马，持物中→投掷，否则→拾取面前物体。
   * 与键盘 F/G 语义对齐，由 PlayerController 自身状态决定分支，调用方无需关心语义。
   */
  triggerInteract(): void {
    if (this.riding) this.dismount();
    else if (this.heldAttachment) this.releaseThrow();
    else this.tryPickUpNearby();
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
        if (e.tags.hasFlag('rideable')) this.mount(e);
        else this.pickUp(e);
        return;
      }
    }
  }

  pickUp(target: GameEntity): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !target || this.heldAttachment) return;
    this.heldAttachment = attach(this.physics, p, target, [this.facing * 14, -8]);
    sfx.play('interact');
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
    if (!p || !target || target === p || this.riding || this.heldAttachment) return;
    if (target.dead || target.tags.hasState('frozen') || target.tags.hasState('petrified')) return;
    if (!target.tags.hasFlag('rideable')) return;
    this.riding = attach(this.physics, target, p, [0, -10]);
    this.ridingEntity = target;
    p.hidden = true;
    sfx.play('interact');
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

  /** 对玩家施加伤害；死亡只改变实体状态，重生由调用方显式触发。 */
  applyDamage(amount: number): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || p.dead || amount <= 0) return;
    if (p.drawParams.invincible === true) return;
    p.health = Math.max(0, (p.health ?? p.maxHealth ?? 100) - amount);
    if (p.health > 0) return;
    this.clearAttachments();
    p.dead = true;
    p.state.locomotion = 'dead';
    p.tags.addState('dead');
    p.state.stateLayer.add('state:dead');
    log.info('player died', { id: p.id });
  }

  /** 将玩家恢复到重生点并清除会阻断控制的临时状态。 */
  respawn(position = this.lastGroundedPos): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p) return;
    this.clearAttachments();
    p.setBodyPosition(position.x, position.y);
    p.setBodyVelocity(0, 0);
    p.health = p.maxHealth ?? 100;
    p.dead = false;
    p.hidden = false;
    for (const state of TRANSIENT_PLAYER_STATES) {
      p.tags.removeState(state);
      p.state.stateLayer.delete(`state:${state}`);
    }
    if (!p.tags.hasState('normal')) p.tags.addState('normal');
    p.tags.setTemperature('normal');
    p.state.locomotion = 'idle';
    p.state.facing = this.facing;
    this.wasGrounded = false;
    this.lastGroundedPos = { ...position };
    log.info('player respawned', { id: p.id, x: position.x, y: position.y });
  }

  get respawnPoint(): { x: number; y: number } {
    return this.lastGroundedPos;
  }

  /** 设置重生点（WorldScene 在 spawnPlayer 后 + 关卡切换后调用，兜底跨关卡失效问题） */
  setRespawnPoint(x: number, y: number): void {
    this.lastGroundedPos = { x, y };
  }

  private clearAttachments(): void {
    if (this.riding) {
      detach(this.physics, this.riding);
      this.riding = undefined;
      this.ridingEntity = undefined;
    }
    if (this.heldAttachment) {
      detach(this.physics, this.heldAttachment);
      this.heldAttachment = undefined;
    }
  }
}

const TRANSIENT_PLAYER_STATES: StateTag[] = [
  'burning', 'frozen', 'wet', 'electrified', 'dead',
  'petrified', 'poisoned', 'sleeping', 'charred',
];
