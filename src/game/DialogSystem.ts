/**
 * 对话系统 —— 检测玩家靠近未完成挑战的 giverNpc，触发气泡展示需求陈述 + 操作提示。
 *
 * 职责边界：只决定"何时展示哪句"，不评估挑战完成（那是 GoalSystem）。
 * 玩家进入半径即自动展示 dialog[0] 需求陈述 + dialog[1] 操作提示，离开则隐藏。
 */

import type { EntityManager } from '@/game/EntityManager';
import type { LevelManager } from './LevelManager';
import type { SpeechBubble } from '@/ui/SpeechBubble';
import type { Camera } from '@/engine/render/Camera';
import type { GameEntity } from '@/game/Entity';

/** 触发对话的半径（世界像素） */
const DIALOG_RADIUS = 150;

export class DialogSystem {
  constructor(
    private readonly entities: EntityManager,
    private readonly level: LevelManager,
    private readonly bubble: SpeechBubble,
    private readonly camera: Camera,
  ) {}

  /** 每帧检查玩家与未完成挑战 giverNpc 的距离 */
  update(): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    const lvl = this.level.currentLevel;
    if (!p || !lvl) {
      this.bubble.hide();
      return;
    }
    let nearest: { text: string; hint?: string; x: number; y: number } | undefined;
    for (const ch of lvl.challenges) {
      if (this.level.isChallengeDone(ch.id)) continue;
      const npcEid = this.level.npcEntityId(ch.giverNpcId);
      const npc = npcEid ? (this.entities.get(npcEid) as GameEntity | undefined) : undefined;
      if (!npc) continue;
      const dx = npc.bodyPositionX - p.bodyPositionX;
      const dy = npc.bodyPositionY - p.bodyPositionY;
      if (dx * dx + dy * dy <= DIALOG_RADIUS * DIALOG_RADIUS) {
        nearest = {
          text: ch.dialog[0]?.zh ?? '',
          hint: ch.dialog[1]?.zh,
          x: npc.bodyPositionX,
          y: npc.bodyPositionY,
        };
        break;
      }
    }
    if (nearest) {
      this.bubble.show(nearest.text, nearest.hint);
      this.bubble.positionAt(nearest.x, nearest.y, this.camera);
    } else {
      this.bubble.hide();
    }
  }
}
