import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { TagSet } from '@/core/rules/TagSet';
import { PlayerController } from '@/game/PlayerController';
import type { GameEntity } from '@/game/Entity';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';

vi.mock('@/audio/SoundEffects', () => ({
  sfx: { play: () => undefined },
}));

type MatterApi = {
  Engine: {
    create: (options?: unknown) => MatterJS.Engine;
    update: (engine: MatterJS.Engine, delta: number) => void;
  };
  Bodies: {
    rectangle: (x: number, y: number, width: number, height: number, options?: Record<string, unknown>) => MatterJS.BodyType;
  };
  Body: {
    setAngle: (body: MatterJS.BodyType, angle: number) => void;
    setAngularVelocity: (body: MatterJS.BodyType, velocity: number) => void;
    setPosition: (body: MatterJS.BodyType, position: { x: number; y: number }) => void;
    setVelocity: (body: MatterJS.BodyType, velocity: { x: number; y: number }) => void;
  };
  Constraint: {
    create: (options: Record<string, unknown>) => MatterJS.ConstraintType;
  };
  Composite: {
    add: (composite: MatterJS.CompositeType | MatterJS.World, object: unknown) => void;
    remove: (composite: MatterJS.CompositeType | MatterJS.World, object: unknown) => void;
  };
};

const require = createRequire(import.meta.url);
const Matter = require('../node_modules/phaser/src/physics/matter-js/CustomMain.js') as MatterApi;

function entity(id: string, typeId: string, body: MatterJS.BodyType, flags: string[], isPlayer = false): GameEntity {
  const tags = TagSet.fromRaw({
    material: new Set(['cloth']),
    temperature: 'normal',
    state: new Set(['normal']),
    behavior: new Set(),
    flags: new Set(flags),
    category: 'object',
  });
  return {
    id,
    typeId,
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: typeId,
    layer: 1,
    critical: isPlayer,
    lastTouchedAt: 0,
    isPlayer,
    tags,
    body,
    get bodyPositionX() { return body.position.x; },
    get bodyPositionY() { return body.position.y; },
    get bodyAngle() { return body.angle; },
    setBodyPosition(x: number, y: number) { Matter.Body.setPosition(body, { x, y }); },
    setBodyVelocity(x: number, y: number) { Matter.Body.setVelocity(body, { x, y }); },
    setBodyAngle(angle: number) { Matter.Body.setAngle(body, angle); },
    setBodyAngularVelocity(velocity: number) { Matter.Body.setAngularVelocity(body, velocity); },
    applyImpulse() {},
  } as unknown as GameEntity;
}

describe('PlayerController equipment physics', () => {
  it('keeps Maxwell stable when a dog is held on the ground', () => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    const playerBody = Matter.Bodies.rectangle(100, 100, 36, 68, { density: 0.01 });
    const dogBody = Matter.Bodies.rectangle(114, 112, 48, 32, { density: 0.004 });
    const originalDogFilter = { ...dogBody.collisionFilter };
    const ground = Matter.Bodies.rectangle(100, 160, 400, 20, { isStatic: true });
    Matter.Composite.add(engine.world, [playerBody, dogBody, ground]);

    const player = entity('player', 'human', playerBody, [], true);
    const dog = entity('dog', 'dog', dogBody, []);
    const entities = {
      getPlayer: () => player,
      get: (id: string) => id === dog.id ? dog : id === player.id ? player : undefined,
    } as unknown as EntityManager;
    const physics = {
      createConstraint: (bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType, length: number, stiffness: number, options: unknown) => {
        const constraint = Matter.Constraint.create({ bodyA, bodyB, length, stiffness, ...(options as Record<string, unknown>) });
        Matter.Composite.add(engine.world, constraint);
        return constraint;
      },
      removeConstraint: (constraint: MatterJS.ConstraintType) => Matter.Composite.remove(engine.world, constraint),
    } as unknown as Physics;

    const controller = new PlayerController(entities, physics);
    controller.pickUp(dog);
    expect(dogBody.collisionFilter.mask).toBe(0);

    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 120; i += 1) {
      Matter.Engine.update(engine, 1000 / 60);
      if (i >= 100) positions.push({ x: player.bodyPositionX, y: player.bodyPositionY });
    }

    const xs = positions.map((position) => position.x);
    const ys = positions.map((position) => position.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    expect(controller.unequip('hand')).toBe(true);
    expect(dogBody.collisionFilter).toEqual(originalDogFilter);
  });

  it('keeps Maxwell stable when wings are equipped on the ground', () => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    const playerBody = Matter.Bodies.rectangle(100, 100, 36, 68, { density: 0.01 });
    const wingBody = Matter.Bodies.rectangle(100, 112, 64, 32, { density: 0.001 });
    const originalWingFilter = { ...wingBody.collisionFilter };
    const ground = Matter.Bodies.rectangle(100, 160, 400, 20, { isStatic: true });
    Matter.Composite.add(engine.world, [playerBody, wingBody, ground]);

    const player = entity('player', 'human', playerBody, [], true);
    const wing = entity('wing', 'wing', wingBody, ['wing']);
    const entities = {
      getPlayer: () => player,
      get: (id: string) => id === wing.id ? wing : id === player.id ? player : undefined,
    } as unknown as EntityManager;
    const physics = {
      createConstraint: (bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType, length: number, stiffness: number, options: unknown) => {
        const constraint = Matter.Constraint.create({ bodyA, bodyB, length, stiffness, ...(options as Record<string, unknown>) });
        Matter.Composite.add(engine.world, constraint);
        return constraint;
      },
      removeConstraint: (constraint: MatterJS.ConstraintType) => Matter.Composite.remove(engine.world, constraint),
    } as unknown as Physics;

    const controller = new PlayerController(entities, physics);
    controller.pickUp(wing);
    expect(wingBody.collisionFilter.mask).toBe(0);

    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 120; i += 1) {
      Matter.Engine.update(engine, 1000 / 60);
      if (i >= 100) positions.push({ x: player.bodyPositionX, y: player.bodyPositionY });
    }

    const xs = positions.map((position) => position.x);
    const ys = positions.map((position) => position.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    expect(controller.unequip('back')).toBe(true);
    expect(wingBody.collisionFilter).toEqual(originalWingFilter);
  });
});
