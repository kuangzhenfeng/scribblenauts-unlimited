/**
 * 玩家控制器着地探针与虚拟输入单测。
 *
 * 用最小 stub 实体与 Physics（不导入 GameEntity，避免传递依赖 Phaser 在 node 环境下初始化失败）。
 */

import { describe, it, expect, vi } from 'vitest';
import { PlayerController } from '@/game/PlayerController';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { GameEntity } from '@/game/Entity';
import { TagSet } from '@/core/rules/TagSet';
import { BehaviorSystem } from '@/game/BehaviorSystem';
import type { EffectDeps } from '@/core/rules/effects';

// sfx.play 在 node 环境会触发 AudioContext 初始化失败，mock 掉音效模块
vi.mock('@/audio/SoundEffects', () => ({
  sfx: { play: () => undefined },
}));

function mkPlayer(x: number, y: number): GameEntity {
  let px = x;
  let py = y;
  return {
    id: 'p1',
    typeId: 'human',
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: 'biped',
    layer: 1,
    critical: true,
    lastTouchedAt: 0,
    isPlayer: true,
    tags: {} as never,
    body: { id: 1, position: { get x() { return px; }, get y() { return py; } }, angle: 0, velocity: { x: 0, y: 0 } } as never,
    get bodyPositionX() { return px; },
    get bodyPositionY() { return py; },
    bodyAngle: 0,
    setBodyPosition(nextX: number, nextY: number) { px = nextX; py = nextY; },
    setBodyVelocity(vx: number, vy: number) {
      // 记录到 body.velocity 供断言
      (this as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity = { x: vx, y: vy };
    },
    setBodyAngle(angle: number) {
      (this as unknown as { body: { angle: number } }).body.angle = angle;
    },
    setBodyAngularVelocity(velocity: number) {
      (this as unknown as { body: { angularVelocity?: number } }).body.angularVelocity = velocity;
    },
    applyImpulse() {},
  } as unknown as GameEntity;
}

function mkStubPhysics(bodiesAt: { id: number; x: number; y: number }[]): Physics {
  return {
    pointQuery: (x: number, y: number) => bodiesAt.filter((b) => b.x === x && b.y === y) as never,
    createConstraint: () => ({}) as never,
    removeConstraint: () => undefined,
  } as unknown as Physics;
}

function setTags(entity: GameEntity, flags: string[], behaviors: string[] = []): void {
  entity.tags = TagSet.fromRaw({
    material: new Set(['metal']),
    temperature: 'normal',
    state: new Set(['normal']),
    behavior: new Set(behaviors),
    flags: new Set(flags),
    category: 'object',
  });
}

/** 组装一个"已着地"的玩家 + EntityManager stub，供虚拟输入测试复用 */
function groundedPlayer(): { player: GameEntity; em: EntityManager; phys: Physics } {
  const player = mkPlayer(100, 100);
  const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
  // 脚下 134 处有 body（id 99），probeGrounded 返回 true
  const phys = mkStubPhysics([{ id: 99, x: 92, y: 134 }]);
  return { player, em, phys };
}

describe('PlayerController probeGrounded', () => {
  it('returns true when a body is below feet', () => {
    const player = mkPlayer(100, 100);
    const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
    // feet y = 100+30 = 130, probe y = 130+4 = 134；feet x = 100±8 = 92 或 108
    const phys = mkStubPhysics([{ id: 99, x: 92, y: 134 }]);
    const pc = new PlayerController(em, phys);
    expect(pc.probeGrounded(player)).toBe(true);
  });

  it('returns false when no body below feet', () => {
    const player = mkPlayer(100, 100);
    const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
    const phys = mkStubPhysics([]);
    const pc = new PlayerController(em, phys);
    expect(pc.probeGrounded(player)).toBe(false);
  });

  it('ignores own body id in probe', () => {
    const player = mkPlayer(100, 100);
    const em = { getPlayer: () => player, all: () => [player], get: () => undefined } as unknown as EntityManager;
    // 自身 body 在脚下位置（id 相同），应忽略不算着地
    const phys = mkStubPhysics([{ id: 1, x: 92, y: 134 }]);
    const pc = new PlayerController(em, phys);
    expect(pc.probeGrounded(player)).toBe(false);
  });
});

describe('PlayerController virtual input', () => {
  it('setVirtualMove(1) drives rightward velocity on update', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setVirtualMove(1);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBeGreaterThan(0);
  });

  it('setVirtualMove(-1) drives leftward velocity on update', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setVirtualMove(-1);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBeLessThan(0);
  });

  it('small moveX below deadzone produces no movement', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    // 0.2 低于 0.5 死区
    pc.setVirtualMove(0.2);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBe(0);
  });

  it('setVirtualJump(true) sets upward velocity when grounded', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setVirtualJump(true);
    pc.update();
    const vel = (player as unknown as { body: { velocity: { y: number } } }).body.velocity;
    expect(vel.y).toBeLessThan(0);
  });

  it('mouse left click-to-move drives Maxwell toward a ground target', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.setMouseMoveTarget(180, player.bodyPositionY);
    pc.update(0);
    const vel = (player as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity;
    expect(vel.x).toBeGreaterThan(0);
    expect(vel.y).toBe(0);
  });

  it('mouse left click on a rideable object approaches and mounts it', () => {
    const { player, phys } = groundedPlayer();
    const dragon = mkPlayer(140, 100);
    dragon.id = 'mouse-dragon';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 2 } as never;
    setTags(dragon, ['rideable'], ['flying']);
    const em = {
      getPlayer: () => player,
      all: () => [player, dragon],
      get: (id: string) => id === dragon.id ? dragon : undefined,
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);
    pc.setMouseMoveTarget(dragon.bodyPositionX, dragon.bodyPositionY, dragon);
    pc.update(0);
    expect(player.hidden).toBe(true);
  });

  it('mouse right button jumps without a ranged weapon', () => {
    const { player, em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    pc.handleMouseSecondaryDown(player.bodyPositionX + 40, player.bodyPositionY);
    pc.update(0);
    const vel = (player as unknown as { body: { velocity: { y: number } } }).body.velocity;
    expect(vel.y).toBeLessThan(0);
    pc.handleMouseSecondaryUp();
  });

  it('mouse right button aims and fires a held ranged weapon', () => {
    const { player, phys } = groundedPlayer();
    const gun = mkPlayer(114, 100);
    gun.id = 'mouse-gun';
    gun.typeId = 'gun';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const em = {
      getPlayer: () => player,
      all: () => [player, gun],
      get: (id: string) => id === gun.id ? gun : undefined,
    } as unknown as EntityManager;
    const shots: Array<{ facing: number }> = [];
    const pc = new PlayerController(em, phys, (_weapon, _x, _y, facing) => shots.push({ facing }), () => 1000);
    pc.pickUp(gun);
    pc.handleMouseSecondaryDown(player.bodyPositionX - 40, player.bodyPositionY);
    expect(shots).toEqual([{ facing: -1 }]);
    pc.handleMouseSecondaryUp();
    pc.update(1100);
    expect(shots).toHaveLength(1);
  });

  it('fires a held ranged weapon through the injected projectile spawner', () => {
    const { player, phys } = groundedPlayer();
    const gun = mkPlayer(114, 100);
    gun.id = 'gun1';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const em = {
      getPlayer: () => player,
      all: () => [player, gun],
      get: (id: string) => id === gun.id ? gun : undefined,
    } as unknown as EntityManager;
    const shots: Array<{ weapon: GameEntity; x: number; y: number; facing: number }> = [];
    const pc = new PlayerController(em, phys, (weapon, x, y, facing) => shots.push({ weapon, x, y, facing }), () => 1000);
    pc.pickUp(gun);
    pc.triggerShoot();
    pc.setVirtualFire(true);
    pc.update(1100);
    pc.update(1250);
    expect(shots).toHaveLength(2);
    expect(shots[0]?.weapon).toBe(gun);
    expect(shots[0]?.facing).toBe(1);
  });

  it('equipped wings enable vertical flight while retaining horizontal movement', () => {
    const { player, em, phys } = groundedPlayer();
    const wing = mkPlayer(100, 112);
    wing.id = 'wing1';
    wing.isPlayer = false;
    wing.body = { ...wing.body, id: 2 } as never;
    setTags(wing, ['wing']);
    const pc = new PlayerController(em, phys);
    pc.pickUp(wing);
    pc.setVirtualMove(1);
    pc.setVirtualJump(true);
    pc.update(0);
    const vel = (player as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity;
    expect(vel.x).toBeGreaterThan(0);
    expect(vel.y).toBeLessThan(0);
    expect(player.state.locomotion).toBe('fly');
  });

  it('allows a ranged weapon, wings, and a rideable dragon at the same time', () => {
    const { player, phys } = groundedPlayer();
    const gun = mkPlayer(114, 100);
    gun.id = 'gun1';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const wing = mkPlayer(100, 112);
    wing.id = 'wing1';
    wing.isPlayer = false;
    wing.body = { ...wing.body, id: 3 } as never;
    wing.layer = 4;
    setTags(wing, ['wing']);
    const dragon = mkPlayer(140, 100);
    dragon.id = 'dragon1';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 4 } as never;
    setTags(dragon, ['rideable'], ['flying', 'wander']);
    const em = {
      getPlayer: () => player,
      all: () => [player, gun, wing, dragon],
      get: (id: string) => [player, gun, wing, dragon].find((e) => e.id === id),
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);
    pc.pickUp(gun);
    pc.pickUp(wing);
    pc.mount(dragon);
    expect(player.hidden).toBe(true);
    pc.setVirtualMove(1);
    pc.setVirtualJump(true);
    pc.update(0);
    const vel = (dragon as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity;
    expect(vel.x).toBeGreaterThan(0);
    expect(vel.y).toBeLessThan(0);
  });

  it('routes dragged entities onto the correct equipment slot', () => {
    const { player, phys } = groundedPlayer();
    const gun = mkPlayer(114, 100);
    gun.id = 'drag-gun';
    gun.typeId = 'gun';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const wing = mkPlayer(100, 112);
    wing.id = 'drag-wing';
    wing.typeId = 'wing';
    wing.isPlayer = false;
    wing.body = { ...wing.body, id: 3 } as never;
    setTags(wing, ['wing']);
    const dragon = mkPlayer(140, 100);
    dragon.id = 'drag-dragon';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 4 } as never;
    setTags(dragon, ['rideable'], ['flying']);
    const entities = {
      getPlayer: () => player,
      all: () => [player, gun, wing, dragon],
      get: (id: string) => [player, gun, wing, dragon].find((e) => e.id === id),
    } as unknown as EntityManager;
    const pc = new PlayerController(entities, phys);

    expect(pc.tryAttachDropped(gun, player.bodyPositionX, player.bodyPositionY)).toBe(true);
    expect(pc.tryAttachDropped(wing, player.bodyPositionX, player.bodyPositionY)).toBe(true);
    expect(pc.tryAttachDropped(dragon, player.bodyPositionX, player.bodyPositionY)).toBe(true);
    expect(player.hidden).toBe(true);

    pc.setVirtualJump(true);
    pc.update(0);
    const vel = (dragon as unknown as { body: { velocity: { y: number } } }).body.velocity;
    expect(vel.y).toBeLessThan(0);
  });

  it('does not attach a dragged entity released too far from the player', () => {
    const { player, phys } = groundedPlayer();
    const gun = mkPlayer(400, 100);
    gun.id = 'far-gun';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const entities = {
      getPlayer: () => player,
      all: () => [player, gun],
      get: (id: string) => id === gun.id ? gun : undefined,
    } as unknown as EntityManager;
    const pc = new PlayerController(entities, phys);

    expect(pc.tryAttachDropped(gun, 400, 100)).toBe(false);
  });

  it('lets a flying mount rise without requiring back wings', () => {
    const { player, phys } = groundedPlayer();
    const dragon = mkPlayer(140, 100);
    dragon.id = 'dragon1';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 2 } as never;
    setTags(dragon, ['rideable'], ['flying']);
    const em = {
      getPlayer: () => player,
      all: () => [player, dragon],
      get: (id: string) => id === dragon.id ? dragon : undefined,
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);
    pc.mount(dragon);
    pc.setVirtualJump(true);
    pc.update(0);
    const vel = (dragon as unknown as { body: { velocity: { y: number } } }).body.velocity;
    expect(vel.y).toBeLessThan(0);
    expect(player.state.locomotion).toBe('fly');
  });

  it('keeps a player-controlled dragon out of BehaviorSystem AI steering', () => {
    const { player, phys } = groundedPlayer();
    player.tags = TagSet.fromRaw({
      material: new Set(['flesh']),
      temperature: 'normal',
      state: new Set(['normal']),
      behavior: new Set(),
      flags: new Set(),
      category: 'creature',
    });
    const dragon = mkPlayer(140, 100);
    dragon.id = 'dragon1';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 2, mass: 1 } as never;
    setTags(dragon, ['rideable'], ['flying', 'wander']);
    dragon.behaviors = [{ kind: 'wander' }, { kind: 'fly' }];
    const em = {
      getPlayer: () => player,
      all: () => [player, dragon],
      get: (id: string) => id === player.id ? player : id === dragon.id ? dragon : undefined,
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);
    pc.mount(dragon);
    pc.setVirtualMove(1);
    pc.update(0);
    const before = (dragon as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity;
    const deps: EffectDeps = {
      entities: em,
      tagIndex: { attach() {}, detach() {}, byStateSet: () => new Set(), byFlagSet: () => new Set() } as never,
      spawn: () => undefined,
      destroyEntity: () => undefined,
      applyImpulse: () => undefined,
    };
    new BehaviorSystem(em, () => 1000, deps).update();
    const after = (dragon as unknown as { body: { velocity: { x: number; y: number } } }).body.velocity;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });

  it('detaches all equipment and restores player visibility before a world reset', () => {
    const { player, phys } = groundedPlayer();
    const wing = mkPlayer(100, 112);
    wing.id = 'wing1';
    wing.isPlayer = false;
    wing.body = { ...wing.body, id: 2 } as never;
    setTags(wing, ['wing']);
    const dragon = mkPlayer(140, 100);
    dragon.id = 'dragon1';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 3 } as never;
    setTags(dragon, ['rideable'], ['flying']);
    const em = {
      getPlayer: () => player,
      all: () => [player, wing, dragon],
      get: (id: string) => [player, wing, dragon].find((e) => e.id === id),
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);
    pc.pickUp(wing);
    pc.mount(dragon);
    expect(player.hidden).toBe(true);
    pc.detachAllAttachments();
    expect(player.hidden).toBe(false);
    expect(dragon.aiMem?.has('playerControlledMount')).toBe(false);
  });

  it('triggerInteract with no held item attempts pickup (no throw)', () => {
    const { em, phys } = groundedPlayer();
    const pc = new PlayerController(em, phys);
    // 无持物/未骑乘 → triggerInteract 走 tryPickUpNearby（前方无物体，静默返回，不应抛异常）
    expect(() => pc.triggerInteract()).not.toThrow();
  });

  it('triggerInteract mounts a nearby rideable entity and toggles dismount', () => {
    const { player } = groundedPlayer();
    const rideable = {
      ...mkPlayer(140, 100),
      id: 'car1',
      typeId: 'car',
      isPlayer: false,
      tags: TagSet.fromRaw({
        material: new Set(['metal']),
        temperature: 'normal',
        state: new Set(['normal']),
        behavior: new Set(),
        flags: new Set(['rideable']),
        category: 'vehicle',
      }),
    } as unknown as GameEntity;
    const em = {
      getPlayer: () => player,
      all: () => [player, rideable],
      get: (id: string) => id === rideable.id ? rideable : undefined,
      getByBody: (id: number) => id === 1 ? rideable : undefined,
    } as unknown as EntityManager;
    const phys = mkStubPhysics([{ id: 1, x: 164, y: 100 }]);
    const pc = new PlayerController(em, phys);
    pc.triggerInteract();
    expect(player.hidden).toBe(true);
    pc.setVirtualMove(1);
    pc.update();
    const vel = (rideable as unknown as { body: { velocity: { x: number } } }).body.velocity;
    expect(vel.x).toBeGreaterThan(0);
    pc.triggerInteract();
    expect(player.hidden).toBe(false);
  });

  it('applyDamage marks the player dead and respawn restores a clean state', () => {
    const { player, em, phys } = groundedPlayer();
    player.tags = TagSet.fromRaw({
      material: new Set(['flesh']),
      temperature: 'normal',
      state: new Set(['poisoned']),
      behavior: new Set(),
      flags: new Set(),
      category: 'creature',
    });
    player.health = 100;
    player.maxHealth = 100;
    const pc = new PlayerController(em, phys);
    pc.setRespawnPoint(20, 30);
    pc.applyDamage(120);
    expect(player.dead).toBe(true);
    expect(player.health).toBe(0);
    expect(player.state.locomotion).toBe('dead');
    pc.respawn();
    expect(player.dead).toBe(false);
    expect(player.health).toBe(100);
    expect(player.tags.hasState('poisoned')).toBe(false);
    expect(player.bodyPositionX).toBe(20);
    expect(player.bodyPositionY).toBe(30);
    expect(player.state.locomotion).toBe('idle');
  });

  it('exposes independent equipment slots and safely unequips one relation at a time', () => {
    const { player, phys } = groundedPlayer();
    const gun = mkPlayer(114, 100);
    gun.id = 'panel-gun';
    gun.typeId = 'gun';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const wing = mkPlayer(100, 112);
    wing.id = 'panel-wing';
    wing.typeId = 'wing';
    wing.isPlayer = false;
    wing.body = { ...wing.body, id: 3 } as never;
    wing.layer = 4;
    setTags(wing, ['wing']);
    const dragon = mkPlayer(140, 100);
    dragon.id = 'panel-dragon';
    dragon.typeId = 'dragon';
    dragon.isPlayer = false;
    dragon.body = { ...dragon.body, id: 4 } as never;
    setTags(dragon, ['rideable'], ['flying']);
    const objects = [player, gun, wing, dragon];
    const em = {
      getPlayer: () => player,
      all: () => objects,
      get: (id: string) => objects.find((entity) => entity.id === id),
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);

    player.state.stateLayer.add('state:invisible');
    pc.pickUp(gun);
    pc.pickUp(wing);
    pc.mount(dragon);
    expect(pc.getEquipmentSnapshot()).toMatchObject({ hand: gun, back: wing, mount: dragon });

    expect(pc.unequip('back')).toBe(true);
    expect(pc.getEquipmentSnapshot()).toMatchObject({ hand: gun, mount: dragon });
    expect(pc.getEquipmentSnapshot().back).toBeUndefined();
    expect(wing.layer).toBe(4);
    expect(player.hidden).toBe(true);

    expect(pc.unequip('mount')).toBe(true);
    expect(pc.getEquipmentSnapshot().mount).toBeUndefined();
    expect(player.hidden).toBe(true);
    expect(pc.getEquipmentSnapshot().hand).toBe(gun);

    expect(pc.unequip('hand')).toBe(true);
    expect(pc.getEquipmentSnapshot().hand).toBeUndefined();
  });

  it('binds the gun grip to the hand and mirrors its visual facing', () => {
    const { player, phys: groundedPhys } = groundedPlayer();
    const gun = mkPlayer(114, 100);
    gun.id = 'grip-gun';
    gun.typeId = 'gun';
    gun.isPlayer = false;
    gun.body = { ...gun.body, id: 2 } as never;
    setTags(gun, ['ranged']);
    const constraints: Array<{
      pointA: { x: number; y: number };
      pointB: { x: number; y: number };
    }> = [];
    const phys = {
      pointQuery: groundedPhys.pointQuery.bind(groundedPhys),
      createConstraint: (_a: unknown, _b: unknown, _length: number, _stiffness: number, options: unknown) => {
        const input = options as { pointA: { x: number; y: number }; pointB: { x: number; y: number } };
        const constraint = {
          pointA: { ...input.pointA },
          pointB: { ...input.pointB },
        };
        constraints.push(constraint);
        return constraint;
      },
      removeConstraint: () => undefined,
    } as unknown as Physics;
    const em = {
      getPlayer: () => player,
      all: () => [player, gun],
      get: (id: string) => id === gun.id ? gun : undefined,
    } as unknown as EntityManager;
    const pc = new PlayerController(em, phys);

    pc.pickUp(gun);
    expect(constraints[0]?.pointA).toEqual({ x: 14, y: 12 });
    expect(constraints[0]?.pointB).toEqual({ x: -8, y: 7 });

    pc.handleMouseSecondaryDown(player.bodyPositionX - 40, player.bodyPositionY);
    pc.update(0);
    expect(gun.state.facing).toBe(-1);
    expect(gun.body.angle).toBe(0);
    expect(gun.body.angularVelocity).toBe(0);
    expect(constraints[0]?.pointA).toEqual({ x: -14, y: 12 });
    expect(constraints[0]?.pointB).toEqual({ x: 8, y: 7 });
    pc.handleMouseSecondaryUp();
  });
});
