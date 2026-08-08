/**
 * 鼠标输入层单测 —— 验证左键点击/拖拽与右键副操作的手势分流。
 *
 * 使用最小 Phaser input stub，不启动真实渲染器；装备/骑乘语义由 PlayerController
 * 单独测试，这里只确认 MousePicker 把手势转成正确的回调。
 */

import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { MousePicker, type MousePickerOptions } from '@/game/MousePicker';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import type { Camera } from '@/engine/render/Camera';
import type { GameEntity } from '@/game/Entity';

type PointerHandler = (pointer: Phaser.Input.Pointer) => void;

function makePicker(
  entity: GameEntity | undefined,
  options: MousePickerOptions = {},
): {
  picker: MousePicker;
  emit: (name: string, pointer: unknown) => void;
  emitGame: (name: string) => void;
} {
  const handlers = new Map<string, PointerHandler>();
  const gameHandlers = new Map<string, () => void>();
  const scene = {
    time: { now: 100 },
    input: {
      on(name: string, handler: PointerHandler) {
        handlers.set(name, handler);
      },
    },
    sys: { game: { events: { on(name: string, handler: () => void) { gameHandlers.set(name, handler); } } } },
  } as unknown as Phaser.Scene;
  const entities = {
    get: (id: string) => id === entity?.id ? entity : undefined,
    getByBody: (id: number) => id === 1 ? entity : undefined,
  } as unknown as EntityManager;
  const physics = {
    pointQuery: () => entity ? [{ id: 1 }] : [],
  } as unknown as Physics;
  const camera = {
    screenToWorld: (x: number, y: number) => ({ x, y }),
  } as unknown as Camera;
  const picker = new MousePicker(scene, entities, physics, camera, options);
  picker.attach();
  return {
    picker,
    emit: (name, pointer) => handlers.get(name)?.(pointer as Phaser.Input.Pointer),
    emitGame: (name: string) => gameHandlers.get(name)?.(),
  };
}

function makeEntity(): GameEntity {
  let x = 100;
  let y = 100;
  let angle = 0;
  return {
    id: 'entity-1',
    typeId: 'gun',
    body: { id: 1 } as never,
    get bodyPositionX() { return x; },
    get bodyPositionY() { return y; },
    get bodyAngle() { return angle; },
    setBodyPosition(nextX: number, nextY: number) { x = nextX; y = nextY; },
    setBodyVelocity() {},
    setBodyAngle(nextAngle: number) { angle = nextAngle; },
    setBodyAngularVelocity() {},
  } as unknown as GameEntity;
}

function pointer(id: number, button: number, x: number, y: number): unknown {
  return { id, button, x, y };
}

describe('MousePicker mouse gesture routing', () => {
  it('routes a left click on empty space to tap movement', () => {
    const taps: Array<[number, number]> = [];
    const { picker, emit } = makePicker(undefined, {
      onTapEmpty: (x, y) => taps.push([x, y]),
    });
    emit('pointerdown', pointer(0, 0, 240, 180));
    emit('pointerup', pointer(0, 0, 240, 180));
    expect(taps).toEqual([[240, 180]]);
    expect(picker).toBeInstanceOf(MousePicker);
  });

  it('routes a left drag to drop callback and uses the entity center as release point', () => {
    const entity = makeEntity();
    const drops: Array<[string, number, number]> = [];
    const { picker, emit } = makePicker(entity, {
      onDropEntity: (e, x, y) => {
        drops.push([e.id, x, y]);
        return true;
      },
    });
    emit('pointerdown', pointer(0, 0, 100, 100));
    emit('pointermove', pointer(0, 0, 140, 100));
    emit('pointerup', pointer(0, 0, 140, 100));
    expect(drops).toEqual([['entity-1', 140, 100]]);
    expect(entity.bodyPositionX).toBe(140);
    expect(picker.selectedId).toBe('entity-1');
  });

  it('keeps right button gestures out of left drag routing', () => {
    const actions: string[] = [];
    const { emit } = makePicker(undefined, {
      onSecondaryDown: () => actions.push('down'),
      onSecondaryMove: () => actions.push('move'),
      onSecondaryUp: () => actions.push('up'),
      onTapEmpty: () => actions.push('left'),
    });
    emit('pointerdown', pointer(1, 2, 100, 100));
    emit('pointermove', pointer(1, 2, 130, 100));
    emit('pointerup', pointer(1, 2, 130, 100));
    expect(actions).toEqual(['down', 'move', 'up']);
  });

  it('rotates the selected entity with the original Q/E action semantics', () => {
    const entity = makeEntity();
    const { picker, emit } = makePicker(entity);
    emit('pointerdown', pointer(0, 0, 100, 100));
    emit('pointerup', pointer(0, 0, 100, 100));
    expect(picker.rotateSelected(-1)).toBe(true);
    expect(entity.bodyAngle).toBeCloseTo(-Math.PI / 12);
    expect(picker.rotateSelected(1)).toBe(true);
    expect(entity.bodyAngle).toBeCloseTo(0);
  });

  it('clears an unfinished drag when the game loses focus', () => {
    const entity = makeEntity();
    const drops: string[] = [];
    const { emit, emitGame } = makePicker(entity, {
      onDropEntity: () => {
        drops.push('drop');
        return true;
      },
    });
    emit('pointerdown', pointer(0, 0, 100, 100));
    emitGame('blur');
    emit('pointerup', pointer(0, 0, 140, 100));
    expect(drops).toEqual([]);
  });
});
