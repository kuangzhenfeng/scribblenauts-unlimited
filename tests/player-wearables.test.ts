import { describe, expect, it, vi } from 'vitest';
import { TagSet } from '@/core/rules/TagSet';
import type { WearableSpec } from '@/core/types/dictionary';
import type { EntityManager } from '@/game/EntityManager';
import type { GameEntity } from '@/game/Entity';
import { PlayerController } from '@/game/PlayerController';
import type { Physics } from '@/engine/physics/Physics';

vi.mock('@/audio/SoundEffects', () => ({
  sfx: { play: () => undefined },
}));

function entity(id: string, typeId: string, wearable?: WearableSpec, flags: string[] = [], isPlayer = id === 'player'): GameEntity {
  let px = 100;
  let py = 100;
  const body = {
    id: Number(id.replace(/\D/g, '')) || 1,
    position: { get x() { return px; }, get y() { return py; } },
    angle: 0,
    angularVelocity: 0,
    velocity: { x: 0, y: 0 },
    collisionFilter: { category: 1, mask: 2, group: 0 },
  };
  return {
    id,
    typeId,
    wearable,
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: typeId,
    layer: 5,
    critical: typeId === 'human',
    lastTouchedAt: 0,
    isPlayer,
    tags: TagSet.fromRaw({
      material: new Set(['cloth']),
      temperature: 'normal',
      state: new Set(['normal']),
      behavior: new Set(),
      flags: new Set(flags),
      category: 'object',
    }),
    body,
    get bodyPositionX() { return px; },
    get bodyPositionY() { return py; },
    get bodyAngle() { return body.angle; },
    setBodyPosition(x: number, y: number) { px = x; py = y; },
    setBodyVelocity(x: number, y: number) { body.velocity = { x, y }; },
    setBodyAngle(angle: number) { body.angle = angle; },
    setBodyAngularVelocity(velocity: number) { body.angularVelocity = velocity; },
    applyImpulse() {},
  } as unknown as GameEntity;
}

function harness(extra: GameEntity[] = []): { player: GameEntity; entities: EntityManager; physics: Physics } {
  const player = entity('player', 'human');
  const all = [player, ...extra];
  const entities = {
    getPlayer: () => player,
    all: () => all,
    get: (id: string) => all.find((candidate) => candidate.id === id),
  } as unknown as EntityManager;
  const physics = {
    pointQuery: () => [{ id: 99 }],
    createConstraint: () => ({}) as never,
    removeConstraint: () => undefined,
  } as unknown as Physics;
  return { player, entities, physics };
}

describe('PlayerController wearable slots', () => {
  it.each([
    ['face', [0, -18]],
    ['head', [0, -30]],
    ['body', [0, 7]],
    ['hands', [14, 12]],
    ['legs', [0, 20]],
    ['feet', [0, 29]],
    ['back', [0, 12]],
    ['full-body', [0, 4]],
  ] as const)('mirrors %s wearable direction and anchor when Maxwell turns', (slot, anchor) => {
    const wearable = entity(`${slot}-wearable`, `${slot}-item`, { slot });
    const { player, entities } = harness([wearable]);
    const constraints: Array<{ pointA: { x: number; y: number } }> = [];
    const physics = {
      pointQuery: () => [{ id: 99 }],
      createConstraint: (_a: unknown, _b: unknown, _length: number, _stiffness: number, options: unknown) => {
        const input = options as { pointA: { x: number; y: number } };
        const constraint = { pointA: { ...input.pointA } };
        constraints.push(constraint);
        return constraint;
      },
      removeConstraint: () => undefined,
    } as unknown as Physics;
    const controller = new PlayerController(entities, physics);

    controller.pickUp(wearable);
    expect(constraints[0]?.pointA).toEqual({ x: anchor[0], y: anchor[1] });

    controller.handleMouseSecondaryDown(player.bodyPositionX - 40, player.bodyPositionY);
    controller.update();

    expect(wearable.state.facing).toBe(-1);
    expect(constraints[0]?.pointA).toEqual({ x: -anchor[0], y: anchor[1] });
  });

  it('composes the wearable direction with Maxwell direction instead of overwriting it', () => {
    const hat = entity('left-facing-hat', 'hat-top', { slot: 'head' });
    hat.state.facing = -1;
    const { player, entities, physics } = harness([hat]);
    const controller = new PlayerController(entities, physics);

    controller.pickUp(hat);
    expect(hat.state.facing).toBe(-1);

    controller.handleMouseSecondaryDown(player.bodyPositionX - 40, player.bodyPositionY);
    controller.update();
    expect(hat.state.facing).toBe(1);
    expect(controller.unequipWearable('head')).toBe(true);
    expect(hat.state.facing).toBe(-1);
  });

  it('equips a declared wearable slot and restores the world body on removal', () => {
    const hat = entity('hat', 'hat-top', { slot: 'head' });
    const { entities, physics } = harness([hat]);
    const controller = new PlayerController(entities, physics);

    controller.pickUp(hat);

    expect(controller.getEquipmentSnapshot().wearables?.head).toBe(hat);
    expect(hat.body.collisionFilter.mask).toBe(0);
    expect(controller.unequipWearable('head')).toBe(true);
    expect(controller.getEquipmentSnapshot().wearables?.head).toBeUndefined();
    expect(hat.body.collisionFilter.mask).toBe(2);
  });

  it('equips a wearable dropped onto an NPC and keeps the NPC independent', () => {
    const npc = entity('npc', 'human', undefined, [], false);
    npc.setBodyPosition(180, 100);
    const hat = entity('hat', 'hat-top', { slot: 'head' });
    const { entities, physics } = harness([npc, hat]);
    const controller = new PlayerController(entities, physics);

    expect(controller.tryAttachDropped(hat, npc.bodyPositionX, npc.bodyPositionY)).toBe(true);
    expect(controller.getNpcEquipmentSnapshot(npc).wearables?.head).toBe(hat);
    expect(npc.isPlayer).toBe(false);
    expect(hat.body.collisionFilter.mask).toBe(0);

    npc.state.facing = -1;
    controller.update();
    expect(hat.state.facing).toBe(-1);
    expect(controller.unequipNpcWearable(npc.id, 'head')).toBe(true);
    expect(controller.getNpcEquipmentSnapshot(npc).wearables?.head).toBeUndefined();
    expect(hat.body.collisionFilter.mask).toBe(2);
  });

  it('composes an NPC wearable direction with the NPC direction', () => {
    const npc = entity('npc-direction', 'human', undefined, [], false);
    npc.setBodyPosition(180, 100);
    const hat = entity('npc-left-facing-hat', 'hat-top', { slot: 'head' });
    hat.state.facing = -1;
    const { entities, physics } = harness([npc, hat]);
    const controller = new PlayerController(entities, physics);

    expect(controller.tryAttachDropped(hat, npc.bodyPositionX, npc.bodyPositionY)).toBe(true);
    expect(hat.state.facing).toBe(-1);

    npc.state.facing = -1;
    controller.update();
    expect(hat.state.facing).toBe(1);
    expect(controller.unequipNpcWearable(npc.id, 'head')).toBe(true);
    expect(hat.state.facing).toBe(-1);
  });

  it('replaces the same slot and makes full-body clothing exclusive', () => {
    const firstHat = entity('hat-1', 'cap', { slot: 'head' });
    const secondHat = entity('hat-2', 'helmet', { slot: 'head' });
    const shoes = entity('shoes', 'shoe', { slot: 'feet' });
    const suit = entity('suit', 'dress', { slot: 'full-body' });
    const gun = entity('gun', 'gun');
    const { entities, physics } = harness([firstHat, secondHat, shoes, suit, gun]);
    const controller = new PlayerController(entities, physics);

    controller.pickUp(firstHat);
    controller.pickUp(secondHat);
    controller.pickUp(shoes);
    controller.pickUp(gun);
    expect(controller.getEquipmentSnapshot().wearables?.head).toBe(secondHat);
    expect(controller.getEquipmentSnapshot().hand).toBe(gun);

    controller.pickUp(suit);
    const snapshot = controller.getEquipmentSnapshot();
    expect(snapshot.wearables?.head).toBeUndefined();
    expect(snapshot.wearables?.feet).toBeUndefined();
    expect(snapshot.wearables?.['full-body']).toBe(suit);
    expect(snapshot.hand).toBe(gun);
    expect(firstHat.body.collisionFilter.mask).toBe(2);
    expect(secondHat.body.collisionFilter.mask).toBe(2);
    expect(shoes.body.collisionFilter.mask).toBe(2);
  });

  it('applies jump and flight effects from wearable metadata', () => {
    const springShoes = entity('spring', 'spring-shoes', { slot: 'feet', effects: ['jump'] });
    const { player, entities, physics } = harness([springShoes]);
    const controller = new PlayerController(entities, physics);

    controller.pickUp(springShoes);
    controller.setVirtualJump(true);
    controller.update();
    expect(player.body.velocity.y).toBe(-12.5);

    const jetpack = entity('jetpack', 'jetpack', { slot: 'back', effects: ['fly'] });
    (entities.all as unknown as () => GameEntity[])().push(jetpack);
    controller.pickUp(jetpack);
    controller.update();
    expect(player.state.locomotion).toBe('fly');
  });
});
