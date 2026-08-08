/**
 * 玩家控制器 —— 鼠标/键盘输入 → 玩家实体的运动学（移动/跳跃/朝向）。
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
import type { WearableEffect, WearableSpec, WearSlot } from '@/core/types/dictionary';
import type { StateTag } from '@/core/types/rules';
import { attach, detach, type Attachment } from '@/engine/physics/Composite';
import { log } from '@/util/log';
import { sfx } from '@/audio/SoundEffects';

/** 水平移动速度（世界像素/帧，@60fps≈192px/s） */
const MOVE_SPEED = 3.2;
/** 跳跃初速度（向上 y 分量） */
const JUMP_VELOCITY = -8.5;
/** 弹簧鞋跳跃初速度；能力由穿戴物声明，数值仍归玩家运动学。 */
const SPRING_SHOE_JUMP_VELOCITY = -12.5;
/** 着地探针：脚下距刚体中心的偏移（biped 半高 + 裕量） */
const FEET_OFFSET = 30;
/** 着地探针：脚下 4px 处做点查询 */
const GROUND_PROBE = 4;
/** 着地探针在 x 方向的左右两脚 */
const FEET_SPREAD = 8;
/** 拾取/装备/骑乘探针距离；覆盖笔记本生成点与小型装备的边缘。 */
const INTERACT_DISTANCE = 64;

/** 翅膀飞行速度（世界像素/帧） */
const FLY_SPEED = 3.2;
/** 远程武器连续射击冷却（毫秒） */
const SHOOT_COOLDOWN = 250;
/** 手持装备攻击动画的可视持续时间（毫秒），与 attack 三帧一次性 clip 对齐。 */
const EQUIPMENT_ATTACK_DURATION = 260;
/** 鼠标拖拽释放到玩家附近时，视为装备/骑乘的容差距离。 */
const DROP_ATTACH_DISTANCE = 72;
/** 点击移动的到达容差；小于此距离时停止，避免目标点附近抖动。 */
const MOUSE_MOVE_TOLERANCE = 8;

/** Maxwell 右手/左手相对身体中心的本地锚点（y 轴向下）。 */
const HAND_ANCHOR = { x: 14, y: 12 };
/** gun 精灵中握把相对帧中心的偏移；枪口默认朝右，翻面后偏移随朝向反转。 */
const GUN_GRIP_ANCHOR = { x: 8, y: 7 };

/** 各穿戴位相对 Maxwell 身体中心的视觉/物理锚点。 */
const WEARABLE_ANCHORS: Record<PlayerWearSlot, [number, number]> = {
  face: [0, -18],
  head: [0, -30],
  body: [0, 7],
  hands: [14, 12],
  legs: [0, 20],
  feet: [0, 29],
  back: [0, 12],
  'full-body': [0, 4],
};

/** 穿戴物相对玩家的渲染层偏移；背部在 Maxwell 身后，其余衣物在身体前。 */
const WEARABLE_LAYER_OFFSETS: Record<PlayerWearSlot, number> = {
  face: 4,
  head: 3,
  body: 2,
  hands: 3,
  legs: 2,
  feet: 2,
  back: -1,
  'full-body': 1,
};

/** 摇杆死区阈值：|moveX| 超过此值才视为方向输入（玩家移动是开关语义） */
const VIRTUAL_MOVE_DEADZONE = 0.5;

export type SpawnProjectile = (weapon: GameEntity, x: number, y: number, facing: number) => void;

/** Maxwell 面板可操作的装备关系槽位。 */
export type PlayerEquipmentSlot = 'hand' | 'back' | 'mount';

/** Maxwell 原版服装穿戴部位。 */
export type PlayerWearSlot = WearSlot;

/** 面板与控制器共用的稳定穿戴位顺序。 */
export const PLAYER_WEAR_SLOTS: readonly PlayerWearSlot[] = [
  'face', 'head', 'body', 'hands', 'legs', 'feet', 'back', 'full-body',
];

/** 玩家当前装备关系的只读快照；关系所有权仍归 PlayerController。 */
export interface PlayerEquipmentSnapshot {
  hand?: GameEntity;
  back?: GameEntity;
  mount?: GameEntity;
  /** 穿戴物按身体部位索引；back 同时保留在上面的兼容字段中。 */
  wearables?: Partial<Record<PlayerWearSlot, GameEntity>>;
}

interface NpcWearableRelation {
  attachment: Attachment;
  spec: WearableSpec;
}

/** BehaviorSystem 与 PlayerController 共享的玩家接管坐骑标记。 */
export const PLAYER_CONTROLLED_MOUNT = 'playerControlledMount';
/** BehaviorSystem 与 PlayerController 共享的玩家接管装备标记。 */
export const PLAYER_CONTROLLED_EQUIPMENT = 'playerControlledEquipment';

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
  /** 服装附着到玩家各身体部位，独立于手持物和骑乘约束。 */
  private readonly wearableAttachments = new Map<PlayerWearSlot, Attachment>();
  /** 附着时保存穿戴能力，避免轻量 EntityManager stub 或清场后能力丢失。 */
  private readonly wearableSpecs = new Map<PlayerWearSlot, WearableSpec>();
  /** 穿戴前的深度层，解除后恢复为普通世界物体。 */
  private readonly wearableLayersBeforeEquip = new Map<string, number>();
  /** 附着前物品自身的朝向；附着期间与宿主朝向合成为最终渲染朝向。 */
  private readonly wearableFacingsBeforeEquip = new Map<string, number>();
  /** 穿戴前的碰撞过滤，解除后恢复为普通世界物体。 */
  private readonly wearableCollisionFiltersBeforeEquip = new Map<string, MatterJS.ICollisionFilter>();
  /** NPC 各自持有的穿戴关系；NPC 本体仍由 BehaviorSystem 继续驱动。 */
  private readonly npcWearableAttachments = new Map<string, Map<PlayerWearSlot, NpcWearableRelation>>();
  /** 手持物装备前的碰撞过滤，避免手持实体与 Maxwell 的刚体互相推挤。 */
  private heldCollisionFilterBeforeEquip: MatterJS.ICollisionFilter | undefined;
  /** 手持物附着前的自身朝向，用于和 Maxwell 朝向合成最终朝向。 */
  private heldFacingBeforeEquip: number | undefined;

  /** F/G 是一次性交互键，只在按下沿执行，避免长按重复下坐骑后继续投掷。 */
  private wasInteractPressed = false;
  private wasReleasePressed = false;

  private readonly spawnProjectile: SpawnProjectile | undefined;
  private readonly now: () => number;
  /** 最近一次发射时间；负无穷保证首次 triggerShoot 立即生效 */
  private lastShotAt = Number.NEGATIVE_INFINITY;

  /** 虚拟摇杆 X 轴 -1..1（电平，触屏控制写入） */
  private virtualMoveX = 0;
  /** 虚拟跳跃按钮按住态（电平，触屏控制写入） */
  private virtualJump = false;
  /** 虚拟开火按钮按住态（电平，触屏控制写入） */
  private virtualFire = false;
  /** 鼠标左键点击产生的移动目标；实体目标会在靠近后自动使用。 */
  private mouseMoveTarget: { x: number; y: number } | undefined;
  /** 鼠标左键点击的实体目标 id，跟随实体位置直到进入交互范围。 */
  private mouseInteractionTargetId: string | undefined;
  /** 鼠标右键瞄准点；远程武器开火时用来更新朝向。 */
  private mouseAimTarget: { x: number; y: number } | undefined;
  /** 鼠标右键远程武器开火电平。 */
  private mouseFire = false;
  /** 鼠标右键无远程武器时产生的一次跳跃/上升请求。 */
  private mouseJump = false;

  constructor(
    private readonly entities: EntityManager,
    private readonly physics: Physics,
    spawnProjectile?: SpawnProjectile,
    now: () => number = () => Date.now(),
  ) {
    this.spawnProjectile = spawnProjectile;
    this.now = now;
  }

  /** 绑定 Phaser 键盘输入；输入框聚焦时让位 */
  attach(scene: Phaser.Scene): void {
    const clearInput = (): void => {
      this.keys.clear();
      this.virtualMoveX = 0;
      this.virtualJump = false;
      this.virtualFire = false;
      this.mouseMoveTarget = undefined;
      this.mouseInteractionTargetId = undefined;
      this.mouseAimTarget = undefined;
      this.mouseFire = false;
      this.mouseJump = false;
      this.wasInteractPressed = false;
      this.wasReleasePressed = false;
    };
    scene.sys.game.events.on('blur', clearInput);
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
  }

  /** 每帧驱动玩家运动学；传入 now 便于固定时间单测。 */
  update(now = this.now()): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || p.dead) return;
    // 骑乘时移动作用于载具 body，否则作用于玩家 body
    const target = this.ridingEntity ?? p;
    // 键盘 + 虚拟摇杆合并：摇杆 |moveX| 超过死区视为方向输入
    const left = this.keys.has('a') || this.keys.has('arrowleft') || this.virtualMoveX < -VIRTUAL_MOVE_DEADZONE;
    const right = this.keys.has('d') || this.keys.has('arrowright') || this.virtualMoveX > VIRTUAL_MOVE_DEADZONE;
    const keyboardOrVirtualMove = left || right;
    let vx = 0;
    if (left) vx -= MOVE_SPEED;
    if (right) vx += MOVE_SPEED;
    if (vx !== 0) this.facing = vx < 0 ? -1 : 1;
    const grounded = this.probeGrounded(p);
    const winged = this.hasWearableEffect('fly');
    const flyingMount = this.ridingEntity?.tags.behavior.has('flying') === true;
    const flying = winged || flyingMount;
    this.updateMouseInteractionTarget(p);
    const mouseDestination = this.mouseMoveTarget;
    if (!keyboardOrVirtualMove && mouseDestination) {
      const dx = mouseDestination.x - target.bodyPositionX;
      if (Math.abs(dx) > MOUSE_MOVE_TOLERANCE) {
        vx = dx < 0 ? -MOVE_SPEED : MOVE_SPEED;
        this.facing = vx < 0 ? -1 : 1;
      }
      if (!flying || Math.abs(mouseDestination.y - target.bodyPositionY) <= MOUSE_MOVE_TOLERANCE) {
        if (Math.abs(dx) <= MOUSE_MOVE_TOLERANCE && !this.mouseInteractionTargetId) {
          this.mouseMoveTarget = undefined;
        }
      }
    }
    this.updateMouseAim(target);
    this.syncHeldAnchor();
    this.syncHeldAnimation(now);
    this.syncWearableAnchors();
    this.syncNpcWearableAnchors();
    const jump = this.keys.has(' ') || this.keys.has('w') || this.keys.has('arrowup') || this.virtualJump;
    const descend = this.keys.has('s') || this.keys.has('arrowdown');
    const mouseJump = this.mouseJump;
    this.mouseJump = false;
    const bodyVel = (target.body as { velocity: { x: number; y: number } }).velocity;
    const mouseVerticalVelocity = flying && mouseDestination
      ? Math.abs(mouseDestination.y - target.bodyPositionY) > MOUSE_MOVE_TOLERANCE
        ? mouseDestination.y < target.bodyPositionY ? -FLY_SPEED : FLY_SPEED
        : 0
      : 0;
    const vy = flying
      ? mouseVerticalVelocity !== 0
        ? mouseVerticalVelocity
        : jump || mouseJump ? -FLY_SPEED : descend ? FLY_SPEED : 0
      : grounded && (jump || mouseJump) ? this.jumpVelocity() : bodyVel.y;
    // 跳跃起跳音效（仅在着地状态下按下跳跃）
    if (!flying && grounded && jump) sfx.play('jump');
    // 着地音效（上一帧不在地面、本帧着地）
    if (!flying && !this.wasGrounded && grounded) sfx.play('land');
    this.wasGrounded = grounded;
    target.setBodyVelocity(vx, vy);
    if (grounded) {
      this.lastGroundedPos = { x: p.bodyPositionX, y: p.bodyPositionY };
    }
    p.state.facing = this.facing;
    if (flying) {
      p.state.locomotion = 'fly';
      target.state.locomotion = 'fly';
      target.state.facing = this.facing;
    // jump（vy<0 上升）/ fall（vy≥0 下落）按原版区分
    } else if (!grounded) {
      p.state.locomotion = bodyVel.y < 0 ? 'jump' : 'fall';
    } else {
      p.state.locomotion = vx !== 0 ? 'walk' : 'idle';
    }
    this.syncPlayerWearableAnimation(p.state.locomotion);

    const interactPressed = this.keys.has('f');
    if (interactPressed && !this.wasInteractPressed) {
      this.triggerInteract();
    }
    this.wasInteractPressed = interactPressed;

    const releasePressed = this.keys.has('g');
    if (releasePressed && !this.wasReleasePressed) {
      if (this.riding) this.dismount();
      else if (this.heldAttachment) this.releaseThrow();
    }
    this.wasReleasePressed = releasePressed;
    if (this.keys.has('x') || this.virtualFire || this.mouseFire) this.shoot(now);
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

  /** 虚拟开火按钮电平（触屏控制写入，按住 true / 松开 false） */
  setVirtualFire(v: boolean): void {
    this.virtualFire = v;
  }

  /** 鼠标左键点击空白处的移动命令；点击实体时同时记录“靠近后使用”目标。 */
  setMouseMoveTarget(x: number, y: number, entity?: GameEntity): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.mouseMoveTarget = { x, y };
    this.mouseInteractionTargetId = entity && !entity.isPlayer ? entity.id : undefined;
  }

  /** 取消当前鼠标移动/交互命令。 */
  clearMouseMoveTarget(): void {
    this.mouseMoveTarget = undefined;
    this.mouseInteractionTargetId = undefined;
  }

  /** 鼠标右键移动时更新瞄准点；远程武器开火会据此转向。 */
  setMouseAim(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.mouseAimTarget = { x, y };
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (p) this.updateMouseAim(this.ridingEntity ?? p);
  }

  /**
   * 鼠标右键按下：空白处对远程武器瞄准开火；点中当前装备/坐骑时执行
   * 对应的释放/下坐骑动作；没有这些目标时对应原版动作按钮的跳跃。
   */
  handleMouseSecondaryDown(x: number, y: number, entity?: GameEntity): void {
    this.setMouseAim(x, y);
    const wearableSlot = entity ? this.wearableSlotForEntity(entity.id) : undefined;
    if (wearableSlot) {
      this.unequipWearable(wearableSlot);
      return;
    } else {
      const npcWearable = entity ? this.npcWearableForEntity(entity.id) : undefined;
      if (npcWearable) {
        this.unequipNpcWearable(npcWearable.hostId, npcWearable.slot);
        return;
      }
    }
    if (entity && entity.id === this.ridingEntity?.id) {
      this.dismount();
    } else if (entity && entity.id === this.heldAttachment?.childId) {
      this.releaseThrow();
    } else if (this.hasRangedWeapon()) {
      this.mouseFire = true;
      this.shoot(this.now());
    } else if (this.riding) {
      this.dismount();
    } else if (this.heldAttachment) {
      this.releaseThrow();
    } else {
      this.mouseJump = true;
    }
  }

  /** 鼠标右键移动瞄准；输入层只传递坐标，不持有武器语义。 */
  handleMouseSecondaryMove(x: number, y: number): void {
    this.setMouseAim(x, y);
  }

  /** 鼠标右键释放，停止连续开火。 */
  handleMouseSecondaryUp(): void {
    this.mouseFire = false;
  }

  /** 统一开火触发；没有远程手持物或未注入生成器时静默返回。 */
  triggerShoot(): void {
    this.shoot(this.now());
  }

  /**
   * 统一交互触发（触屏按钮调用）：
   * 骑乘中→下马，持物中→投掷，否则→拾取面前物体。
   * 与键盘 F/G 语义对齐，由 PlayerController 自身状态决定分支，调用方无需关心语义。
   */
  triggerInteract(): void {
    if (this.riding) this.dismount();
    else if (this.heldAttachment && !this.tryPickUpNearby()) this.releaseThrow();
    else if (!this.heldAttachment) this.tryPickUpNearby();
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

  /** 拾取面前实体：在玩家朝向 64px 范围内找最近可拾取实体 */
  private tryPickUpNearby(): boolean {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p) return false;
    const fx = p.bodyPositionX + this.facing * INTERACT_DISTANCE;
    const fy = p.bodyPositionY;
    const hits = this.physics.pointQuery(fx, fy);
    for (const b of hits) {
      const e = this.entities.getByBody(b.id) as GameEntity | undefined;
      if (e && !e.isPlayer && e.typeId !== 'human') {
        // 骑乘后仍可用 F 装备手持物/服装；另一只可骑乘对象不抢占当前坐骑。
        if (e.tags.hasFlag('rideable')) {
          if (this.riding) continue;
          this.mount(e);
        }
        else this.pickUp(e);
        return this.ridingEntity === e || this.isAttachedAsHeld(e) || this.wearableSlotForEntity(e.id) !== undefined;
      }
    }
    return false;
  }

  pickUp(target: GameEntity): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !target) return;
    const wearable = wearableSpecFor(target);
    if (wearable) {
      this.equipWearable(target, wearable);
      return;
    }
    if (this.heldAttachment) return;
    const itemFacing = normalizedFacing(target.state.facing);
    this.heldFacingBeforeEquip = itemFacing;
    const childAnchor = heldChildAnchor(target, composedFacing(this.facing, itemFacing));
    this.heldCollisionFilterBeforeEquip = { ...target.body.collisionFilter };
    target.body.collisionFilter = { ...target.body.collisionFilter, mask: 0 };
    target.setBodyPosition(
      p.bodyPositionX + this.facing * HAND_ANCHOR.x - childAnchor[0],
      p.bodyPositionY + HAND_ANCHOR.y - childAnchor[1],
    );
    target.setBodyVelocity(0, 0);
    target.setBodyAngle(0);
    target.setBodyAngularVelocity(0);
    this.heldAttachment = attach(
      this.physics,
      p,
      target,
      [this.facing * HAND_ANCHOR.x, HAND_ANCHOR.y],
      childAnchor,
    );
    const aiMem = target.aiMem ?? (target.aiMem = new Map<string, unknown>());
    aiMem.set(PLAYER_CONTROLLED_EQUIPMENT, true);
    target.setBodyVelocity(0, 0);
    this.syncHeldAnchor();
    sfx.play('interact');
    log.info('player picked up', { target: target.id });
  }

  /**
   * 将带穿戴声明的实体附着到 Maxwell 的身体部位。
   *
   * 同部位只保留一个实体；全身套装会清除其他服装，装备普通服装时也会
   * 解除全身套装。这对应原版“服装部位 + 全身套装互斥”的关系，而不会
   * 影响手持物或坐骑关系。
   */
  equipWearable(target: GameEntity, spec = wearableSpecFor(target)): boolean {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !target || !spec || target === p || target.isPlayer || target.dead) return false;

    this.detachWearableFromAnyOwner(target.id);

    if (spec.slot === 'full-body') {
      for (const slot of PLAYER_WEAR_SLOTS) {
        if (slot !== 'full-body') this.unequipWearable(slot);
      }
    } else {
      this.unequipWearable('full-body');
    }
    this.unequipWearable(spec.slot);

    // 穿戴物只承担视觉与能力，不应以独立刚体与 Maxwell/地面碰撞。
    const collisionFilter = target.body.collisionFilter;
    if (collisionFilter) {
      this.wearableCollisionFiltersBeforeEquip.set(target.id, { ...collisionFilter });
      target.body.collisionFilter = { ...collisionFilter, mask: 0 };
    }
    const itemFacing = normalizedFacing(target.state.facing);
    this.wearableFacingsBeforeEquip.set(target.id, itemFacing);
    const anchor = wearableAnchorFor(spec.slot, this.facing);
    target.setBodyPosition(p.bodyPositionX + anchor[0], p.bodyPositionY + anchor[1]);
    target.setBodyVelocity(0, 0);
    target.setBodyAngle(0);
    target.setBodyAngularVelocity(0);
    this.wearableAttachments.set(spec.slot, attach(this.physics, p, target, anchor));
    this.wearableSpecs.set(spec.slot, spec);

    const aiMem = target.aiMem ?? (target.aiMem = new Map<string, unknown>());
    aiMem.set(PLAYER_CONTROLLED_EQUIPMENT, true);
    target.state.facing = composedFacing(this.facing, itemFacing);
    this.wearableLayersBeforeEquip.set(target.id, target.layer);
    target.layer = p.layer + WEARABLE_LAYER_OFFSETS[spec.slot];
    target.setBodyVelocity(0, 0);
    sfx.play('interact');
    log.info(spec.slot === 'back' && target.tags.hasFlag('wing') ? 'player equipped wings' : 'player equipped wearable', {
      target: target.id,
      slot: spec.slot,
    });
    return true;
  }

  /**
   * 鼠标/触控拖拽把实体释放到玩家身上时的统一入口。
   *
   * 输入层只报告“哪个实体被拖到了哪里”，装备槽位与骑乘语义仍由本类
   * 决定：rideable → 坐骑，wearable → 对应穿戴位，其余实体 → 手持物。
   * 返回 true 表示已建立附着；距离不够或对应槽位已占用时保持原状，
   * 由输入层继续按普通拖拽投掷处理。
   */
  tryAttachDropped(target: GameEntity, dropX = target.bodyPositionX, dropY = target.bodyPositionY): boolean {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !target || target === p || target.isPlayer || target.typeId === 'human' || target.dead) return false;

    const wearable = wearableSpecFor(target);
    const npc = wearable ? this.nearestNpcAt(dropX, dropY) : undefined;
    const playerDistance = Math.hypot(dropX - p.bodyPositionX, dropY - p.bodyPositionY);
    if (npc && Math.hypot(dropX - npc.bodyPositionX, dropY - npc.bodyPositionY) < playerDistance) {
      return this.equipWearableOnNpc(npc, target, wearable);
    }
    if (playerDistance > DROP_ATTACH_DISTANCE) return false;

    if (target.tags.hasFlag('rideable')) {
      if (this.riding) return false;
      this.mount(target);
      return this.ridingEntity === target;
    }
    if (wearable) {
      return this.equipWearable(target, wearable);
    }
    if (this.heldAttachment) return false;
    this.pickUp(target);
    return this.isAttachedAsHeld(target);
  }

  releaseThrow(power = 0): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !this.heldAttachment) return;
    const item = this.entities.get(this.heldAttachment.childId) as GameEntity | undefined;
    const itemFacing = this.heldFacingBeforeEquip;
    detach(this.physics, this.heldAttachment);
    this.heldAttachment = undefined;
    if (item && this.heldCollisionFilterBeforeEquip) {
      item.body.collisionFilter = { ...this.heldCollisionFilterBeforeEquip };
    }
    this.heldCollisionFilterBeforeEquip = undefined;
    this.heldFacingBeforeEquip = undefined;
    if (item) {
      if (itemFacing !== undefined) item.state.facing = itemFacing;
      item.aiMem?.delete(PLAYER_CONTROLLED_EQUIPMENT);
      item.setBodyVelocity(this.facing * (4 + power), -2);
      log.info('player threw', { target: item.id });
    }
  }

  /**
   * 返回 Maxwell 当前的手持、服装部位和坐骑关系。
   *
   * UI 只能读取该快照，不能直接持有 Attachment 或修改约束，避免装备语义
   * 在 DOM 浮层中复制一份并与运动控制失去同步。
   */
  getEquipmentSnapshot(): PlayerEquipmentSnapshot {
    const wearables: Partial<Record<PlayerWearSlot, GameEntity>> = {};
    for (const [slot, attachment] of this.wearableAttachments) {
      const entity = this.entities.get(attachment.childId) as GameEntity | undefined;
      if (entity) wearables[slot] = entity;
    }
    return {
      hand: this.heldAttachment
        ? this.entities.get(this.heldAttachment.childId) as GameEntity | undefined
        : undefined,
      back: wearables.back,
      mount: this.ridingEntity,
      wearables,
    };
  }

  /** 返回 NPC 当前穿戴关系，供对象面板或调试工具读取。 */
  getNpcEquipmentSnapshot(npc: GameEntity): PlayerEquipmentSnapshot {
    const wearables: Partial<Record<PlayerWearSlot, GameEntity>> = {};
    for (const [slot, relation] of this.npcWearableAttachments.get(npc.id) ?? []) {
      const entity = this.entities.get(relation.attachment.childId) as GameEntity | undefined;
      if (entity) wearables[slot] = entity;
    }
    return { back: wearables.back, wearables };
  }

  /** 解除一个装备关系；装备实体留在当前位置，不产生投掷速度。 */
  unequip(slot: PlayerEquipmentSlot): boolean {
    if (slot === 'hand') {
      if (!this.heldAttachment) return false;
      const item = this.entities.get(this.heldAttachment.childId) as GameEntity | undefined;
      const itemFacing = this.heldFacingBeforeEquip;
      detach(this.physics, this.heldAttachment);
      this.heldAttachment = undefined;
      if (item && this.heldCollisionFilterBeforeEquip) {
        item.body.collisionFilter = { ...this.heldCollisionFilterBeforeEquip };
      }
      this.heldCollisionFilterBeforeEquip = undefined;
      this.heldFacingBeforeEquip = undefined;
      if (item && itemFacing !== undefined) item.state.facing = itemFacing;
      item?.aiMem?.delete(PLAYER_CONTROLLED_EQUIPMENT);
      item?.setBodyVelocity(0, 0);
      sfx.play('interact');
      if (item) log.info('player unequipped hand item', { target: item.id });
      return true;
    }
    if (slot === 'back') return this.unequipWearable('back');
    if (!this.riding) return false;
    this.dismount();
    return true;
  }

  /** 解除当前所有装备关系；用于 Maxwell 面板的总操作。 */
  unequipAll(): number {
    let count = 0;
    if (this.unequip('hand')) count += 1;
    for (const slot of PLAYER_WEAR_SLOTS) if (this.unequipWearable(slot)) count += 1;
    if (this.unequip('mount')) count += 1;
    return count;
  }

  /** 解除一个身体部位的服装关系；实体留在当前位置，不产生投掷速度。 */
  unequipWearable(slot: PlayerWearSlot): boolean {
    const attachment = this.wearableAttachments.get(slot);
    if (!attachment) return false;
    const item = this.entities.get(attachment.childId) as GameEntity | undefined;
    const itemFacing = item ? this.wearableFacingsBeforeEquip.get(item.id) : undefined;
    detach(this.physics, attachment);
    this.wearableAttachments.delete(slot);
    this.wearableSpecs.delete(slot);
    item?.aiMem?.delete(PLAYER_CONTROLLED_EQUIPMENT);
    if (item) {
      const layer = this.wearableLayersBeforeEquip.get(item.id);
      if (layer !== undefined) item.layer = layer;
      this.wearableLayersBeforeEquip.delete(item.id);
      const collisionFilter = this.wearableCollisionFiltersBeforeEquip.get(item.id);
      if (collisionFilter) item.body.collisionFilter = { ...collisionFilter };
      this.wearableCollisionFiltersBeforeEquip.delete(item.id);
      this.wearableFacingsBeforeEquip.delete(item.id);
      if (itemFacing !== undefined) item.state.facing = itemFacing;
      item.setBodyVelocity(0, 0);
    }
    sfx.play('interact');
    if (item) log.info(slot === 'back' && item.tags.hasFlag('wing') ? 'player unequipped wings' : 'player unequipped wearable', {
      target: item.id,
      slot,
    });
    return true;
  }

  /** 将穿戴物附着到 NPC；NPC 的移动仍由 BehaviorSystem 负责。 */
  equipWearableOnNpc(npc: GameEntity, target: GameEntity, spec = wearableSpecFor(target)): boolean {
    if (!this.isNpc(npc) || !target || !spec || target === npc || target.isPlayer || target.dead) return false;

    this.detachWearableFromAnyOwner(target.id);
    const slots = this.npcWearableAttachments.get(npc.id) ?? new Map<PlayerWearSlot, NpcWearableRelation>();
    if (spec.slot === 'full-body') {
      for (const slot of PLAYER_WEAR_SLOTS) {
        if (slot !== 'full-body') this.unequipNpcWearable(npc.id, slot);
      }
    } else {
      this.unequipNpcWearable(npc.id, 'full-body');
    }
    this.unequipNpcWearable(npc.id, spec.slot);

    const collisionFilter = target.body.collisionFilter;
    if (collisionFilter) {
      this.wearableCollisionFiltersBeforeEquip.set(target.id, { ...collisionFilter });
      target.body.collisionFilter = { ...collisionFilter, mask: 0 };
    }
    const itemFacing = normalizedFacing(target.state.facing);
    this.wearableFacingsBeforeEquip.set(target.id, itemFacing);
    const anchor = wearableAnchorFor(spec.slot, npc.state.facing);
    target.setBodyPosition(npc.bodyPositionX + anchor[0], npc.bodyPositionY + anchor[1]);
    target.setBodyVelocity(0, 0);
    target.setBodyAngle(0);
    target.setBodyAngularVelocity(0);
    slots.set(spec.slot, {
      attachment: attach(this.physics, npc, target, anchor),
      spec,
    });
    this.npcWearableAttachments.set(npc.id, slots);

    const aiMem = target.aiMem ?? (target.aiMem = new Map<string, unknown>());
    aiMem.set(PLAYER_CONTROLLED_EQUIPMENT, true);
    target.state.facing = composedFacing(npc.state.facing, itemFacing);
    this.wearableLayersBeforeEquip.set(target.id, target.layer);
    target.layer = npc.layer + WEARABLE_LAYER_OFFSETS[spec.slot];
    log.info('npc equipped wearable', { npc: npc.id, target: target.id, slot: spec.slot });
    sfx.play('interact');
    return true;
  }

  /** 解除 NPC 一个穿戴部位，装备物留在当前位置。 */
  unequipNpcWearable(npcId: string, slot: PlayerWearSlot): boolean {
    const slots = this.npcWearableAttachments.get(npcId);
    const relation = slots?.get(slot);
    if (!relation) return false;
    const item = this.entities.get(relation.attachment.childId) as GameEntity | undefined;
    const itemFacing = item ? this.wearableFacingsBeforeEquip.get(item.id) : undefined;
    detach(this.physics, relation.attachment);
    slots!.delete(slot);
    if (slots!.size === 0) this.npcWearableAttachments.delete(npcId);
    item?.aiMem?.delete(PLAYER_CONTROLLED_EQUIPMENT);
    if (item) {
      const layer = this.wearableLayersBeforeEquip.get(item.id);
      if (layer !== undefined) item.layer = layer;
      this.wearableLayersBeforeEquip.delete(item.id);
      const collisionFilter = this.wearableCollisionFiltersBeforeEquip.get(item.id);
      if (collisionFilter) item.body.collisionFilter = { ...collisionFilter };
      this.wearableCollisionFiltersBeforeEquip.delete(item.id);
      this.wearableFacingsBeforeEquip.delete(item.id);
      if (itemFacing !== undefined) item.state.facing = itemFacing;
      item.setBodyVelocity(0, 0);
    }
    log.info('npc unequipped wearable', { npc: npcId, target: item?.id ?? relation.attachment.childId, slot });
    sfx.play('interact');
    return true;
  }

  mount(target: GameEntity): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !target || target === p || this.riding) return;
    if (target.dead || target.tags.hasState('frozen') || target.tags.hasState('petrified')) return;
    if (!target.tags.hasFlag('rideable')) return;
    this.riding = attach(this.physics, target, p, [0, -10]);
    this.ridingEntity = target;
    const aiMem = target.aiMem ?? (target.aiMem = new Map<string, unknown>());
    aiMem.set(PLAYER_CONTROLLED_MOUNT, true);
    this.syncPlayerVisibility(p);
    sfx.play('interact');
    log.info('player mounted', { target: target.id });
  }

  dismount(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (!p || !this.riding) return;
    this.ridingEntity?.aiMem?.delete(PLAYER_CONTROLLED_MOUNT);
    detach(this.physics, this.riding);
    this.riding = undefined;
    this.ridingEntity = undefined;
    this.syncPlayerVisibility(p);
    sfx.play('interact');
    log.info('player dismounted');
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
    this.syncPlayerVisibility(p);
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

  /** 关卡切换前解除旧世界的附着约束，避免玩家引用已清场的实体。 */
  detachAllAttachments(): void {
    this.clearAttachments();
    for (const [npcId, slots] of this.npcWearableAttachments) {
      for (const slot of [...slots.keys()]) this.unequipNpcWearable(npcId, slot);
    }
  }

  private clearAttachments(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (this.riding) {
      this.ridingEntity?.aiMem?.delete(PLAYER_CONTROLLED_MOUNT);
      detach(this.physics, this.riding);
      this.riding = undefined;
      this.ridingEntity = undefined;
    }
    if (this.heldAttachment) {
      const item = this.entities.get(this.heldAttachment.childId) as GameEntity | undefined;
      const itemFacing = this.heldFacingBeforeEquip;
      detach(this.physics, this.heldAttachment);
      this.heldAttachment = undefined;
      if (item && this.heldCollisionFilterBeforeEquip) {
        item.body.collisionFilter = { ...this.heldCollisionFilterBeforeEquip };
      }
      this.heldCollisionFilterBeforeEquip = undefined;
      this.heldFacingBeforeEquip = undefined;
      if (item && itemFacing !== undefined) item.state.facing = itemFacing;
      item?.aiMem?.delete(PLAYER_CONTROLLED_EQUIPMENT);
    }
    for (const slot of PLAYER_WEAR_SLOTS) this.unequipWearable(slot);
    this.syncPlayerVisibility(p);
  }

  private isAttachedAsHeld(target: GameEntity): boolean {
    return this.heldAttachment?.childId === target.id;
  }

  private wearableSlotForEntity(entityId: string): PlayerWearSlot | undefined {
    for (const [slot, attachment] of this.wearableAttachments) {
      if (attachment.childId === entityId) return slot;
    }
    return undefined;
  }

  private npcWearableForEntity(entityId: string): { hostId: string; slot: PlayerWearSlot } | undefined {
    for (const [hostId, slots] of this.npcWearableAttachments) {
      for (const [slot, relation] of slots) {
        if (relation.attachment.childId === entityId) return { hostId, slot };
      }
    }
    return undefined;
  }

  private detachWearableFromAnyOwner(entityId: string): void {
    const playerSlot = this.wearableSlotForEntity(entityId);
    if (playerSlot) this.unequipWearable(playerSlot);
    const npcRelation = this.npcWearableForEntity(entityId);
    if (npcRelation) this.unequipNpcWearable(npcRelation.hostId, npcRelation.slot);
  }

  private nearestNpcAt(x: number, y: number): GameEntity | undefined {
    let nearest: GameEntity | undefined;
    let nearestDistance = DROP_ATTACH_DISTANCE;
    for (const entity of this.entities.all()) {
      const npc = entity as GameEntity;
      if (!this.isNpc(npc)) continue;
      const distance = Math.hypot(x - npc.bodyPositionX, y - npc.bodyPositionY);
      if (distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private isNpc(entity: GameEntity): boolean {
    return entity.critical === true && !entity.isPlayer && !entity.dead;
  }

  /** 朝向变化时把手持物的刚性锚点同步到对应的手侧。 */
  private syncHeldAnchor(): void {
    const attachment = this.heldAttachment;
    if (!attachment) return;
    const item = this.entities.get(attachment.childId) as GameEntity | undefined;
    const constraint = attachment.constraint as unknown as {
      pointA?: { x: number; y: number };
      pointB?: { x: number; y: number };
    };
    if (constraint.pointA) {
      constraint.pointA.x = this.facing * HAND_ANCHOR.x;
      constraint.pointA.y = HAND_ANCHOR.y;
    }
    if (constraint.pointB && item) {
      const itemFacing = this.heldFacingBeforeEquip ?? normalizedFacing(item.state.facing);
      const childAnchor = heldChildAnchor(item, composedFacing(this.facing, itemFacing));
      constraint.pointB.x = childAnchor[0];
      constraint.pointB.y = childAnchor[1];
    }
    if (!item) return;
    const itemFacing = this.heldFacingBeforeEquip ?? normalizedFacing(item.state.facing);
    item.state.facing = composedFacing(this.facing, itemFacing);
    // 手持物的朝向由 Maxwell 控制，避免约束或碰撞让手枪在手中旋转。
    item.setBodyAngle?.(0);
    item.setBodyAngularVelocity?.(0);
  }

  /** 朝向变化时同步所有穿戴物的身体部位锚点、视觉朝向和刚体角度。 */
  private syncWearableAnchors(): void {
    for (const [slot, attachment] of this.wearableAttachments) {
      const item = this.entities.get(attachment.childId) as GameEntity | undefined;
      const constraint = attachment.constraint as unknown as {
        pointA?: { x: number; y: number };
      };
      const anchor = wearableAnchorFor(slot, this.facing);
      if (constraint.pointA) {
        constraint.pointA.x = anchor[0];
        constraint.pointA.y = anchor[1];
      }
      if (!item) continue;
      const itemFacing = this.wearableFacingsBeforeEquip.get(item.id) ?? normalizedFacing(item.state.facing);
      item.state.facing = composedFacing(this.facing, itemFacing);
      item.setBodyAngle?.(0);
      item.setBodyAngularVelocity?.(0);
    }
  }

  /** 穿戴翅膀跟随宿主 locomotion，确保飞行帧只由宿主状态切换，不受刚体抖动影响。 */
  private syncPlayerWearableAnimation(locomotion: string): void {
    const attachment = this.wearableAttachments.get('back');
    if (!attachment) return;
    const item = this.entities.get(attachment.childId) as GameEntity | undefined;
    if (!item || !item.tags.hasFlag('wing')) return;
    item.state.locomotion = locomotion === 'fly' ? 'fly' : 'idle';
  }

  /** NPC 朝向变化时同步其穿戴物的身体部位锚点。 */
  private syncNpcWearableAnchors(): void {
    for (const [npcId, slots] of this.npcWearableAttachments) {
      const npc = this.entities.get(npcId) as GameEntity | undefined;
      if (!npc || npc.dead) {
        for (const slot of [...slots.keys()]) this.unequipNpcWearable(npcId, slot);
        continue;
      }
      for (const [slot, relation] of slots) {
        const item = this.entities.get(relation.attachment.childId) as GameEntity | undefined;
        const constraint = relation.attachment.constraint as unknown as { pointA?: { x: number; y: number } };
        const anchor = wearableAnchorFor(slot, npc.state.facing);
        if (constraint.pointA) {
          constraint.pointA.x = anchor[0];
          constraint.pointA.y = anchor[1];
        }
        if (!item) continue;
        const itemFacing = this.wearableFacingsBeforeEquip.get(item.id) ?? normalizedFacing(item.state.facing);
        item.state.facing = composedFacing(npc.state.facing, itemFacing);
        if (item.tags.hasFlag('wing')) {
          item.state.locomotion = npc.state.locomotion === 'fly' ? 'fly' : 'idle';
        }
        item.setBodyAngle?.(0);
        item.setBodyAngularVelocity?.(0);
      }
    }
  }

  /** 骑乘隐藏与 invisible 形容词共同决定可见性，解除骑乘不应取消隐形。 */
  private syncPlayerVisibility(player: GameEntity | undefined): void {
    if (!player) return;
    player.hidden = this.riding !== undefined || player.state.stateLayer.has('state:invisible');
  }

  /** 更新点击实体的跟随位置，并在进入原版交互范围后执行装备/骑乘。 */
  private updateMouseInteractionTarget(p: GameEntity): void {
    if (!this.mouseInteractionTargetId) return;
    const target = this.entities.get(this.mouseInteractionTargetId) as GameEntity | undefined;
    if (!target || target.dead || target === p) {
      this.clearMouseMoveTarget();
      return;
    }
    this.mouseMoveTarget = { x: target.bodyPositionX, y: target.bodyPositionY };
    if (Math.hypot(target.bodyPositionX - p.bodyPositionX, target.bodyPositionY - p.bodyPositionY) > INTERACT_DISTANCE) return;
    // 人形 NPC 的点击只负责靠近，后续对话由 DialogSystem 处理，不将 NPC 当作物品装备。
    if (target.typeId !== 'human' && !target.isPlayer) this.tryAttachDropped(target, target.bodyPositionX, target.bodyPositionY);
    this.clearMouseMoveTarget();
  }

  /** 鼠标右键瞄准时同步玩家/坐骑朝向。 */
  private updateMouseAim(target: GameEntity): void {
    if (!this.mouseAimTarget) return;
    const dx = this.mouseAimTarget.x - target.bodyPositionX;
    if (Math.abs(dx) > 2) this.facing = dx < 0 ? -1 : 1;
  }

  private hasWearableEffect(effect: WearableEffect): boolean {
    for (const spec of this.wearableSpecs.values()) {
      if (spec.effects?.includes(effect)) return true;
    }
    for (const attachment of this.wearableAttachments.values()) {
      const entity = this.entities.get(attachment.childId) as GameEntity | undefined;
      if (entity && wearableSpecFor(entity)?.effects?.includes(effect)) return true;
    }
    return false;
  }

  private jumpVelocity(): number {
    return this.hasWearableEffect('jump') ? SPRING_SHOE_JUMP_VELOCITY : JUMP_VELOCITY;
  }

  private hasRangedWeapon(): boolean {
    const attachment = this.heldAttachment;
    if (!attachment) return false;
    const weapon = this.entities.get(attachment.childId) as GameEntity | undefined;
    return weapon?.tags.hasFlag('ranged') === true;
  }

  /** 清理手持装备的一次性攻击状态，避免 attack 帧在下一次输入前停留。 */
  private syncHeldAnimation(now: number): void {
    const attachment = this.heldAttachment;
    if (!attachment) return;
    const item = this.entities.get(attachment.childId) as GameEntity | undefined;
    if (!item || item.state.locomotion !== 'attack') return;
    const until = item.stateTimers?.get('attack-animation-until');
    if (until === undefined || now < until) return;
    item.state.locomotion = 'idle';
    item.stateTimers?.delete('attack-animation-until');
  }

  private shoot(now: number): void {
    if (!this.spawnProjectile || now - this.lastShotAt < SHOOT_COOLDOWN) return;
    const weapon = this.heldAttachment
      ? this.entities.get(this.heldAttachment.childId) as GameEntity | undefined
      : undefined;
    if (!weapon || !weapon.tags.hasFlag('ranged')) return;
    this.lastShotAt = now;
    weapon.state.locomotion = 'attack';
    const timers = weapon.stateTimers ?? (weapon.stateTimers = new Map());
    timers.set('attack-animation-until', now + EQUIPMENT_ATTACK_DURATION);
    this.spawnProjectile(weapon, weapon.bodyPositionX, weapon.bodyPositionY, this.facing);
    log.info('player fired', { weapon: weapon.id });
  }
}

/** 取实体声明的穿戴关系；旧存档/旧测试中的 wing 标签回退为背部飞行装备。 */
function wearableSpecFor(target: GameEntity): WearableSpec | undefined {
  if (target.wearable) return target.wearable;
  if (target.tags.hasFlag('wing')) return { slot: 'back', effects: ['fly'] };
  return undefined;
}

/**
 * 计算手持物在自身刚体上的绑定点。
 *
 * 大多数物品的可握取位置可近似为质心；手枪则必须把握把绑定到手上，
 * 否则约束会把枪的中心放在手部，导致枪口/握把整体偏移。
 */
function heldChildAnchor(target: GameEntity, facing: number): [number, number] {
  if (target.typeId === 'gun') return [-facing * GUN_GRIP_ANCHOR.x, GUN_GRIP_ANCHOR.y];
  return [0, 0];
}

function normalizedFacing(facing: number): -1 | 1 {
  return facing < 0 ? -1 : 1;
}

function composedFacing(hostFacing: number, itemFacing: number): -1 | 1 {
  return normalizedFacing(hostFacing) === normalizedFacing(itemFacing) ? 1 : -1;
}

function wearableAnchorFor(slot: PlayerWearSlot, facing: number): [number, number] {
  const [x, y] = WEARABLE_ANCHORS[slot];
  return [facing * x, y];
}

const TRANSIENT_PLAYER_STATES: StateTag[] = [
  'burning', 'frozen', 'wet', 'electrified', 'dead',
  'petrified', 'poisoned', 'sleeping', 'charred',
];
