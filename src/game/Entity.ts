/**
 * 实体（Entity）的 Phaser 实现。
 *
 * 持有 Phaser GameObject + Matter body 引用 + TagSet + 状态，是 core 层 Entity 接口的具体实现，
 * 桥接逻辑层（tags/health/规则）与引擎层（GameObject/Matter body）。
 *
 * 设计原则：
 * - 实体是数据载体，行为由各 System 驱动（ECS-lite）；
 * - 运动学量经 getter 代理 Matter body，写操作经 setBody* 转发；
 * - core 层只依赖 Entity 抽象接口，不依赖此类（解耦）。
 *
 * 用 Phaser 内置的 MatterJS 命名空间类型（body.position/angle/frictionAir 等），
 * 不单独引入 matter-js 包，避免双份类型来源。
 */

import Phaser from 'phaser';
import type { Entity as EntityIface, EntityState } from '@/core/entity/Entity';
import { createEntityState } from '@/core/entity/Entity';
import type { TagSet } from '@/core/rules/TagSet';
import type { BehaviorSpec, WearableSpec } from '@/core/types/dictionary';

type MatterBody = MatterJS.BodyType;

/** Phaser.Physics.Matter.Matter 是裸 matter-js 模块的聚合引用 */
const Matter = (Phaser as unknown as {
  Physics: { Matter: { Matter: typeof MatterJS } };
}).Physics.Matter.Matter;

export class GameEntity implements EntityIface {
  id: string;
  typeId: string;
  state: EntityState = createEntityState();
  drawParams: Record<string, unknown> = {};
  rendererId: string;
  layer: number;
  critical: boolean;
  lastTouchedAt: number;
  tags: TagSet;
  health?: number;
  maxHealth?: number;
  stateTimers?: Map<string, number>;
  dead?: boolean;
  isPlayer?: boolean;
  behaviors?: BehaviorSpec[];
  /** 词条声明的角色穿戴关系与能力 */
  wearable?: WearableSpec;
  /** 被施加的形容词 id 集合（Spawner 在 applyAdjectives 后写入），供 GoalSystem 校验形容词题目 */
  appliedAdjectives?: Set<string>;
  hidden?: boolean;
  aiMem?: Map<string, unknown>;
  /** 自定义组合物体的刚性部件关系，由销毁路径统一解除。 */
  compositeAttachments?: import('@/engine/physics/Composite').Attachment[];
  containedTypeIds?: string[];
  /** 简易问答模式：物品剩余存活回合数（初始 3，每切一题 -1，归零销毁） */
  ttl?: number;

  /** Phaser GameObject（可选，纯逻辑实体/隐藏时可能无） */
  gameObject?: Phaser.GameObjects.GameObject;
  /** Matter 刚体 */
  body: MatterBody;

  constructor(opts: {
    id: string;
    typeId: string;
    body: MatterBody;
    tags: TagSet;
    rendererId: string;
    layer?: number;
    critical?: boolean;
    lastTouchedAt?: number;
    health?: number;
    maxHealth?: number;
    drawParams?: Record<string, unknown>;
    wearable?: WearableSpec;
    gameObject?: Phaser.GameObjects.GameObject;
  }) {
    this.id = opts.id;
    this.typeId = opts.typeId;
    this.body = opts.body;
    this.tags = opts.tags;
    this.rendererId = opts.rendererId;
    this.layer = opts.layer ?? 1;
    this.critical = opts.critical ?? false;
    this.lastTouchedAt = opts.lastTouchedAt ?? 0;
    this.health = opts.health;
    this.maxHealth = opts.maxHealth;
    this.drawParams = opts.drawParams ?? {};
    this.wearable = opts.wearable;
    this.gameObject = opts.gameObject;
  }

  get bodyPositionX(): number {
    return this.body.position.x;
  }
  get bodyPositionY(): number {
    return this.body.position.y;
  }
  get bodyAngle(): number {
    return this.body.angle;
  }

  setBodyPosition(x: number, y: number): void {
    Matter.Body.setPosition(this.body, { x, y });
  }
  setBodyVelocity(x: number, y: number): void {
    Matter.Body.setVelocity(this.body, { x, y });
  }
  setBodyAngle(angle: number): void {
    Matter.Body.setAngle(this.body, angle);
  }
  setBodyAngularVelocity(velocity: number): void {
    Matter.Body.setAngularVelocity(this.body, velocity);
  }
  applyImpulse(dir: [number, number], mag: number): void {
    // Matter force 值极小，dir×mag 作为力施加于质心
    Matter.Body.applyForce(this.body, this.body.position, { x: dir[0] * mag, y: dir[1] * mag });
  }
}
