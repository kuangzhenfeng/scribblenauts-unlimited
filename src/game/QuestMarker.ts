/**
 * 任务标记 —— 为持有未完成挑战的 giverNpc 在头顶浮动金色 "!" 徽章。
 *
 * 职责边界：只负责标记的创建/定位/销毁，不评估挑战完成（那是 GoalSystem）。
 * 每帧检查当前关卡的未完成挑战，为对应 NPC 维护一个世界空间标记；
 * 关卡切换时自动清场重建。纯 Graphics 矢量绘制，零位图、零 DOM。
 *
 * 与 DialogSystem 互斥：玩家进入对话半径时，对应 NPC 的 "!" 徽章隐藏，
 * 由 DialogSystem 通过 dialogActiveNpcId 暴露当前对话中的 NPC；远时显示感叹号，靠近时显示对话。
 */

import type Phaser from 'phaser';
import type { EntityManager } from '@/game/EntityManager';
import type { LevelManager } from './LevelManager';
import type { GameEntity } from '@/game/Entity';

/** 标记相对 NPC 质心的垂直偏移（头顶上方） */
const OFFSET_Y = -58;
/** 浮动幅度（像素） */
const BOB_AMP = 4;
/** 浮动角速度（弧度/毫秒） */
const BOB_SPEED = 0.005;
/** 缩放脉动幅度 */
const PULSE_AMP = 0.06;
/** 徽章半径 */
const RADIUS = 14;
/** 高于所有实体的高 depth 值，确保徽章始终可见 */
const DEPTH = 9000;

interface Marker {
  npcId: string;
  g: Phaser.GameObjects.Graphics;
}

export class QuestMarker {
  private readonly markers = new Map<string, Marker>();
  private trackedLevelId: string | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entities: EntityManager,
    private readonly level: LevelManager,
    /** 对话系统：暴露当前对话中的 giverNpcId，用于互斥隐藏对应徽章 */
    private readonly dialog: { readonly dialogActiveNpcId: string | undefined },
  ) {}

  /** 每帧同步：重建（关卡切换）→ 定位+动画 → 摘除已完成 */
  update(time: number): void {
    const lvl = this.level.currentLevel;
    if (!lvl?.challenges) {
      this.clear();
      return;
    }
    if (lvl.id !== this.trackedLevelId) {
      this.clear();
      this.trackedLevelId = lvl.id;
      this.build();
    }
    const bob = Math.sin(time * BOB_SPEED) * BOB_AMP;
    const pulse = 1 + Math.sin(time * BOB_SPEED * 1.3) * PULSE_AMP;
    const activeNpcId = this.dialog.dialogActiveNpcId;
    for ( const [npcId, m] of this.markers) {
      const eid = this.level.npcEntityId(npcId);
      const npc = eid ? (this.entities.get(eid) as GameEntity | undefined) : undefined;
      if (!npc || npc.dead) {
        m.g.setVisible(false);
        continue;
      }
      // 玩家进入对话半径时隐藏该 NPC 徽章（让位给对话气泡）
      m.g.setVisible(npcId !== activeNpcId);
      m.g.setPosition(npc.bodyPositionX, npc.bodyPositionY + OFFSET_Y + bob);
      m.g.setScale(pulse);
    }
    for (const ch of lvl.challenges) {
      if (this.level.isChallengeDone(ch.id)) {
        const m = this.markers.get(ch.giverNpcId);
        if (m) {
          m.g.destroy();
          this.markers.delete(ch.giverNpcId);
        }
      }
    }
  }

  clear(): void {
    for (const m of this.markers.values()) m.g.destroy();
    this.markers.clear();
    this.trackedLevelId = undefined;
  }

  private build(): void {
    const lvl = this.level.currentLevel;
    if (!lvl?.challenges) return;
    for (const ch of lvl.challenges) {
      if (this.level.isChallengeDone(ch.id)) continue;
      if (this.markers.has(ch.giverNpcId)) continue;
      const g = this.scene.add.graphics();
      g.setDepth(DEPTH);
      this.drawBadge(g);
      this.markers.set(ch.giverNpcId, { npcId: ch.giverNpcId, g });
    }
  }

  private drawBadge(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x000000, 0.28);
    g.fillCircle(1.5, 2.5, RADIUS);
    g.fillStyle(0xf5c518, 1);
    g.fillCircle(0, 0, RADIUS);
    g.lineStyle(3, 0x3d2200, 1);
    g.strokeCircle(0, 0, RADIUS);
    g.lineStyle(1.5, 0xffe890, 0.6);
    g.strokeCircle(0, -2, RADIUS - 4);
    g.fillStyle(0x3d2200, 1);
    g.fillRect(-2.2, -8, 4.4, 11);
    g.fillCircle(0, 6.5, 2.3);
  }
}
