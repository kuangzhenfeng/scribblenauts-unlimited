/**
 * 对话系统 —— 检测玩家靠近未完成挑战的 giverNpc，触发气泡展示需求陈述 + 操作提示。
 *
 * 职责边界：只决定"何时展示哪句"，不评估挑战完成（那是 GoalSystem）。
 * 玩家进入 DIALOG_RADIUS 即自动展示 dialog[0] 需求陈述 + dialog[1] 操作提示，离开则隐藏。
 * 同半径内 QuestMarker 的 "!" 徽章自动隐藏（避免感叹号与气泡重叠）：通过 dialogActiveNpcId 暴露当前对话中的 NPC。
 * 对话期间该 NPC 暂停 AI 移动（气泡稳定可读）：通过 dialogActiveEntityId 暴露当前对话实体 id，
 * 供 BehaviorSystem 跳过其 AI 并归零速度。
 */

import type { EntityManager } from '@/game/EntityManager';
import type { LevelManager } from './LevelManager';
import type { SpeechBubble } from '@/ui/SpeechBubble';
import type { Camera } from '@/engine/render/Camera';
import type { GameEntity } from '@/game/Entity';
import { L } from '@/core/i18n/I18n';

/** 触发对话的半径（世界像素），与 QuestMarker 共享以实现"近=对话、远=感叹号"互斥 */
export const DIALOG_RADIUS = 150;

export class DialogSystem {
  /** 当前正在对话中的 giverNpcId（同半径内 QuestMarker 据此隐藏 "!" 徽章） */
  private activeNpcId: string | undefined;
  /** 当前正在对话中的 NPC 实体 id（BehaviorSystem 据此暂停该实体 AI） */
  private activeEntityId: string | undefined;

  constructor(
    private readonly entities: EntityManager,
    private readonly level: LevelManager,
    private readonly bubble: SpeechBubble,
    private readonly camera: Camera,
  ) {}

  /** 当前对话中的 giverNpcId（无对话时 undefined） */
  get dialogActiveNpcId(): string | undefined {
    return this.activeNpcId;
  }

  /** 当前对话中的 NPC 实体 id（无对话时 undefined） */
  get dialogActiveEntityId(): string | undefined {
    return this.activeEntityId;
  }

  /** 每帧检查玩家与未完成挑战 giverNpc 的距离 */
  update(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    const lvl = this.level.currentLevel;
    if (!p || !lvl?.challenges) {
      this.activeNpcId = undefined;
      this.activeEntityId = undefined;
      this.bubble.hide();
      return;
    }
    let nearest: { npcId: string; eid: string; text: string; hint?: string; x: number; y: number } | undefined;
    for (const ch of lvl.challenges) {
      if (this.level.isChallengeDone(ch.id)) continue;
      const npcEid = this.level.npcEntityId(ch.giverNpcId);
      const npc = npcEid ? (this.entities.get(npcEid) as GameEntity | undefined) : undefined;
      if (!npc) continue;
      const dx = npc.bodyPositionX - p.bodyPositionX;
      const dy = npc.bodyPositionY - p.bodyPositionY;
      if (dx * dx + dy * dy <= DIALOG_RADIUS * DIALOG_RADIUS) {
        nearest = {
          npcId: ch.giverNpcId,
          eid: npcEid!,
          text: L(ch.dialog[0]),
          hint: L(ch.dialog[1]),
          x: npc.bodyPositionX,
          y: npc.bodyPositionY,
        };
        break;
      }
    }
    if (nearest) {
      this.activeNpcId = nearest.npcId;
      this.activeEntityId = nearest.eid;
      this.bubble.show(nearest.text, nearest.hint);
      this.bubble.positionAt(nearest.x, nearest.y, this.camera);
    } else {
      this.activeNpcId = undefined;
      this.activeEntityId = undefined;
      this.bubble.hide();
    }
  }
}
