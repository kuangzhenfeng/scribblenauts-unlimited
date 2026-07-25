/**
 * 对话系统单测 —— 验证靠近 NPC 触发气泡、远离隐藏。
 *
 * 用最小 stub 实体（不导入 GameEntity，避免传递依赖 Phaser 在 node 环境下初始化失败）。
 * 新架构 DialogSystem 依赖 EntityQuery + LevelRef 抽象，用 stub 注入。
 */

import { describe, it, expect } from 'vitest';
import { DialogSystem } from '@/game/DialogSystem';
import type { EntityManager } from '@/game/EntityManager';
import type { LevelManager } from '@/game/LevelManager';
import type { Camera } from '@/engine/render/Camera';
import type { GameEntity } from '@/game/Entity';

function mkEntity(id: string, x: number, y: number, typeId = 'human'): GameEntity {
  return {
    id,
    typeId,
    state: { animTime: 0, locomotion: 'idle', facing: 1, scale: 1, stateLayer: new Set() },
    drawParams: {},
    rendererId: 'biped',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags: {} as never,
    body: { id: 0, position: { x, y }, angle: 0, velocity: { x: 0, y: 0 } } as never,
    bodyPositionX: x,
    bodyPositionY: y,
    bodyAngle: 0,
    setBodyPosition() {},
    setBodyVelocity() {},
    applyImpulse() {},
  } as unknown as GameEntity;
}

function mkStubBubble() {
  return {
    shown: false,
    hidden: false,
    text: '',
    show(t: string) { this.shown = true; this.hidden = false; this.text = t; },
    hide() { this.hidden = true; this.shown = false; },
    positionAt() {},
  };
}

function mkStubCamera(): Camera {
  return { cam: { getWorldPoint: () => ({ x: 0, y: 0 }) } } as unknown as Camera;
}

describe('DialogSystem', () => {
  it('shows bubble when player is near giverNpc', () => {
    const npc = mkEntity('npc1', 100, 100);
    const player = mkEntity('p1', 110, 100);
    player.isPlayer = true;
    const em = { all: () => [npc, player], get: (id: string) => (id === 'npc1' ? npc : id === 'p1' ? player : undefined), getPlayer: () => player } as unknown as EntityManager;
    const lvl = {
      currentLevel: { challenges: [{ id: 'c1', giverNpcId: 'npc1', dialog: [{ zh: '帮帮我', en: 'help' }] }] },
      isChallengeDone: () => false,
      npcEntityId: (id: string) => (id === 'npc1' ? 'npc1' : undefined),
    } as unknown as LevelManager;
    const bubble = mkStubBubble();
    const ds = new DialogSystem(em, lvl, bubble as never, mkStubCamera());
    ds.update();
    expect(bubble.shown).toBe(true);
    expect(bubble.text).toBe('帮帮我');
  });

  it('hides bubble when player is far from npc', () => {
    const npc = mkEntity('npc2', 0, 0);
    const player = mkEntity('p2', 500, 500);
    player.isPlayer = true;
    const em = { all: () => [npc, player], get: (id: string) => (id === 'npc2' ? npc : id === 'p2' ? player : undefined), getPlayer: () => player } as unknown as EntityManager;
    const lvl = {
      currentLevel: { challenges: [{ id: 'c2', giverNpcId: 'npc2', dialog: [{ zh: '', en: '' }] }] },
      isChallengeDone: () => false,
      npcEntityId: (id: string) => (id === 'npc2' ? 'npc2' : undefined),
    } as unknown as LevelManager;
    const bubble = mkStubBubble();
    const ds = new DialogSystem(em, lvl, bubble as never, mkStubCamera());
    ds.update();
    expect(bubble.hidden).toBe(true);
  });
});
