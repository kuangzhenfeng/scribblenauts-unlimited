/**
 * Phaser Matter 物理适配层。
 *
 * 职责边界：
 * - 创建 Matter 刚体并挂到 Phaser GameObject 上；
 * - 分发 collisionStart/Active/End 碰撞事件（经 body 反查逻辑实体）；
 * - 提供刚性 Constraint（拾取/骑乘/组合）与点查询（着地探针/拾取/鼠标命中）；
 * - 不懂词条语义，只把 body 反查交给上层。
 *
 * 用 Phaser 内置的 MatterJS 命名空间类型（不单独引入 matter-js 包，避免双份类型来源）。
 */

import Phaser from 'phaser';
import type { PhysicsSpec, SizeSpec } from '@/core/types/dictionary';
import type { Entity } from '@/core/entity/Entity';

type MatterBody = MatterJS.BodyType;
type MatterConstraint = MatterJS.ConstraintType;

/** Phaser.Physics.Matter.Matter 是裸 matter-js 模块的聚合引用 */
const Matter = (Phaser as unknown as {
  Physics: { Matter: { Matter: typeof MatterJS } };
}).Physics.Matter.Matter;

export interface CollisionPair {
  a: Entity;
  b: Entity;
  phase: 'start' | 'active' | 'end';
}

/** 物理 body 与逻辑实体的反查挂载点 */
const ENTITY_KEY = '__scribblenautsEntity';

/**
 * 碰撞类别位掩码（matter.js collisionFilter.category 用，每位一类，须为 2 的幂）。
 * 默认类别为 DEFAULT_CATEGORY（0x0001），未显式设置类别的 body 归属于此（地形/玩家生成物）。
 */
export const COLLISION_CATEGORY = {
  /** 默认类别：地面、平台、玩家生成的物体 */
  DEFAULT: 0x0001,
  /** 玩家（Maxwell）专属类别 */
  PLAYER: 0x0002,
  /** 关卡预生成实体（NPC / 树 / 石头等）类别 */
  LEVEL_SPAWN: 0x0004,
} as const;

/**
 * 碰撞过滤预设：把 body 归入某类别并配置 mask。
 *
 * matter.js 规则：两 body A/B 碰撞当且仅当 (categoryA & maskB) && (categoryB & maskA) 均非零。
 * - player：与除 LEVEL_SPAWN 外的一切碰撞（地面/平台/生成物），但不阻挡于预生成实体；
 * - levelSpawn：与除 PLAYER 外的一切碰撞（地面/生成物/彼此），但不与玩家碰撞。
 * 这样玩家在预生成 NPC/树/石头间穿行无阻，规则引擎的火→树、武器→NPC 等碰撞回调因
 * 对端是 DEFAULT 类别而照常触发。
 */
export type CollisionRole = 'player' | 'levelSpawn';

const ROLE_FILTER: Record<CollisionRole, MatterJS.ICollisionFilter> = {
  player: {
    category: COLLISION_CATEGORY.PLAYER,
    mask: 0xffffffff & ~COLLISION_CATEGORY.LEVEL_SPAWN,
    group: 0,
  },
  levelSpawn: {
    category: COLLISION_CATEGORY.LEVEL_SPAWN,
    mask: 0xffffffff & ~COLLISION_CATEGORY.PLAYER,
    group: 0,
  },
};

export type MatterBodyEntity = MatterBody & { [ENTITY_KEY]?: Entity };

export class Physics {
  constructor(private readonly scene: Phaser.Scene) {}

  /** 由词条物理配置创建裸 Matter 刚体（不挂 GameObject） */
  createBody(spec: PhysicsSpec, size: SizeSpec, x: number, y: number, role?: CollisionRole): MatterBody {
    const matter = this.scene.matter;
    const options: MatterJS.IBodyDefinition = {
      density: spec.density,
      friction: spec.friction,
      restitution: spec.restitution,
      isStatic: spec.isStatic,
      frictionAir: spec.frictionAir ?? 0,
    };
    if (role) {
      options.collisionFilter = { ...ROLE_FILTER[role] };
    }
    let body: MatterBody;
    if (spec.shape === 'circle') {
      body = matter.bodies.circle(x, y, size.width / 2, options);
    } else if (spec.shape === 'box' || spec.shape === 'capsule') {
      body = matter.bodies.rectangle(x, y, size.width, size.height, options);
    } else if (spec.shape === 'compound' && spec.parts) {
      const comps = spec.parts.map((p) =>
        p.shape === 'circle'
          ? matter.bodies.circle(x + p.offset[0], y + p.offset[1], p.size[0] / 2)
          : matter.bodies.rectangle(x + p.offset[0], y + p.offset[1], p.size[0], p.size[1]),
      );
      body = matter.body.create({ parts: comps, ...options });
    } else {
      body = matter.bodies.rectangle(x, y, size.width, size.height, options);
    }
    // inertia=Infinity 禁止刚体绕质心旋转，防止双足/四足生物碰撞后倒地
    if (spec.fixedRotation) Matter.Body.setInertia(body, Infinity);
    return body;
  }

  /** 把裸 body 加入世界 */
  addBody(body: MatterBody): void {
    this.scene.matter.world.add(body as never);
  }

  /** 把 body 挂到 Phaser GameObject 上（注入 Matter 组件并关联自建 body） */
  attachBody(go: Phaser.GameObjects.GameObject, body: MatterBody): void {
    // add.gameObject 注入 Matter 组件；options 可直接传裸 body 关联
    this.scene.matter.add.gameObject(go, body as never);
  }

  removeBody(body: MatterBody): void {
    this.scene.matter.world.remove(body as never);
  }

  /** 在 body 上挂逻辑实体引用（碰撞反查用） */
  bindEntity(body: MatterBody, e: Entity): void {
    (body as MatterBodyEntity)[ENTITY_KEY] = e;
  }

  /** 由 body 反查逻辑实体 */
  entityOf(body: MatterBody | undefined): Entity | undefined {
    return body ? (body as MatterBodyEntity)[ENTITY_KEY] : undefined;
  }

  /** 创建静态矩形地面/墙壁（由关卡数据 bounds/terrain 驱动） */
  createStaticRect(x: number, y: number, w: number, h: number, friction = 0.6): MatterBody {
    const body = this.scene.matter.bodies.rectangle(x, y, w, h, {
      isStatic: true,
      friction,
    });
    this.addBody(body);
    return body;
  }

  /** 创建刚性 Constraint（拾取/骑乘/带轮子的狗） */
  createConstraint(
    a: MatterBody,
    b: MatterBody,
    length = 0,
    stiffness = 1,
    options: MatterJS.IConstraintDefinition = {},
  ): MatterConstraint {
    return this.scene.matter.add.constraint(a, b, length, stiffness, options as never) as unknown as MatterConstraint;
  }

  removeConstraint(c: MatterConstraint): void {
    this.scene.matter.world.removeConstraint(c as never);
  }

  /** 点查询：返回包含该点的所有 body（鼠标命中/拾取范围用） */
  pointQuery(x: number, y: number): MatterBody[] {
    return this.scene.matter.intersectPoint(x, y) as unknown as MatterBody[];
  }

  /** 点查询：某 body 是否包含该点 */
  containsPoint(body: MatterBody, x: number, y: number): boolean {
    return this.scene.matter.containsPoint(body as never, x, y);
  }

  /** 注册碰撞事件分发 */
  onCollision(cb: (pair: CollisionPair) => void): () => void {
    const world = this.scene.matter.world;
    const mk = (phase: 'start' | 'active' | 'end') =>
      (_event: unknown, bodyA: MatterBody, bodyB: MatterBody) => {
        const ea = this.entityOf(bodyA);
        const eb = this.entityOf(bodyB);
        if (!ea || !eb) return;
        cb({ a: ea, b: eb, phase });
      };
    const onStart = mk('start');
    const onActive = mk('active');
    const onEnd = mk('end');
    world.on('collisionstart', onStart as never);
    world.on('collisionactive', onActive as never);
    world.on('collisionend', onEnd as never);
    return () => {
      world.off('collisionstart', onStart as never);
      world.off('collisionactive', onActive as never);
      world.off('collisionend', onEnd as never);
    };
  }

  /** 取世界全部 body（用于清场） */
  private allBodies(): MatterBody[] {
    const world = this.scene.matter.world;
    const localWorld = (world as unknown as { localWorld: MatterJS.CompositeType }).localWorld;
    return Matter.Composite.allBodies(localWorld);
  }

  /** 清空全部动态刚体与静态地形（关卡切换时调用），可保留指定 body */
  clearDynamic(keepBodies?: Set<number>): void {
    const world = this.scene.matter.world;
    for (const b of this.allBodies()) {
      if (keepBodies?.has(b.id)) continue;
      world.remove(b as never);
    }
  }
}
