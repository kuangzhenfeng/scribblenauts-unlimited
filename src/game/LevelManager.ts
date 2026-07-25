/**
 * 关卡管理器 —— 加载关卡数据、生成地形与初始实体/NPC、管理区域衔接。
 *
 * 加载 JSON 关卡 → 清场保留玩家 → 生成地形（bounds 派生地面 + 可选平台）
 * → 生成静态物体与 NPC。
 * transitions 提供区域衔接入口，由 WorldScene.checkTransition 触发。
 *
 * 与旧项目差异：REGISTRY 改 import.meta.glob 动态加载（不硬编码）；实现 LevelRef
 * 供 GoalSystem 依赖。地形式静态 body 不绑 entity（纯地形）。
 */

import type { LevelData, SpawnDef, NpcSpawn } from '@/core/types/level';
import type { Spawner } from '@/game/Spawner';
import type { EntityManager } from '@/game/EntityManager';
import type { Physics } from '@/engine/physics/Physics';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { log } from '@/util/log';
import type { GameEntity } from '@/game/Entity';

/** 动态加载关卡 JSON（import.meta.glob，构建期聚合） */
const levelModules = import.meta.glob<{ default: LevelData }>('@/core/data/levels/*.json', { eager: true });
const REGISTRY: Record<string, LevelData> = {};
for (const mod of Object.values(levelModules)) {
  const data = mod.default;
  REGISTRY[data.id] = data;
}

export class LevelManager {
  private current: LevelData | undefined;
  /** NPC 实体 id 映射：npcSpawnId → entityId */
  private readonly npcEntities = new Map<string, string>();
  private readonly completed = new Set<string>();

  constructor(
    private readonly entities: EntityManager,
    private readonly spawner: Spawner,
    private readonly physics: Physics,
  ) {}

  /**
   * 加载关卡：清场（保留玩家）→ 重建地形 → 生成静态物体/NPC → 重定位玩家。
   * keepPlayerId 由 WorldScene 传入以跨关卡保留玩家。
   */
  load(levelId: string, keepPlayerId?: string): LevelData | undefined {
    const data = REGISTRY[levelId];
    if (!data) {
      log.warn('level not found', { levelId });
      return undefined;
    }
    const player = keepPlayerId ? (this.entities.get(keepPlayerId) as GameEntity | undefined) : undefined;
    const keepBodies = player ? new Set<number>([player.body.id]) : undefined;
    this.entities.clear(keepPlayerId);
    this.physics.clearDynamic(keepBodies);
    this.npcEntities.clear();
    this.current = data;
    this.buildTerrain(data);
    this.build(data);
    if (player) {
      player.setBodyPosition(data.playerStart.x, data.playerStart.y);
      player.setBodyVelocity(0, 0);
    }
    log.info('level loaded', { levelId, theme: data.theme });
    return data;
  }

  get currentLevel(): LevelData | undefined {
    return this.current;
  }

  npcEntityId(npcSpawnId: string): string | undefined {
    return this.npcEntities.get(npcSpawnId);
  }

  /** 检查区域衔接 */
  checkTransition(px: number, py: number): string | undefined {
    if (!this.current?.transitions) return undefined;
    for (const t of this.current.transitions) {
      const b = t.at;
      if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
        return t.toLevelId;
      }
    }
    return undefined;
  }

  markChallengeDone(challengeId: string): void {
    this.completed.add(challengeId);
  }

  isChallengeDone(challengeId: string): boolean {
    return this.completed.has(challengeId);
  }

  completedArray(): string[] {
    return [...this.completed];
  }

  restoreCompleted(arr: string[]): void {
    this.completed.clear();
    for (const id of arr) this.completed.add(id);
  }

  /** 由 bounds 派生地面矩形 + 可选平台 */
  private buildTerrain(data: LevelData): void {
    const groundY = data.bounds.maxY;
    const groundX = (data.bounds.minX + data.bounds.maxX) / 2;
    const groundW = data.bounds.maxX - data.bounds.minX;
    this.physics.createStaticRect(groundX, groundY, groundW, 60);
    for (const t of data.terrain ?? []) {
      this.physics.createStaticRect(t.x, t.y, t.w, t.h);
    }
  }

  private build(data: LevelData): void {
    for (const s of data.spawns) this.spawnStatic(s);
    for (const n of data.npcs) this.spawnNpc(n);
  }

  private spawnStatic(s: SpawnDef): void {
    const entry = getEntry(s.typeId);
    if (!entry) {
      log.warn('level spawn: unknown typeId', { typeId: s.typeId });
      return;
    }
    const r = this.spawner.spawnEntry(entry, undefined, s.x, s.y);
    if (r.entity && s.layer !== undefined) r.entity.layer = s.layer;
  }

  private spawnNpc(n: NpcSpawn): void {
    const entry = getEntry(n.typeId);
    if (!entry) {
      log.warn('level npc: unknown typeId', { typeId: n.typeId });
      return;
    }
    const r = this.spawner.spawnEntry(entry, undefined, n.x, n.y);
    if (r.entity) {
      r.entity.critical = true;
      r.entity.drawParams.gender = n.gender;
      Object.assign(r.entity.drawParams, n.drawParams ?? {});
      this.npcEntities.set(n.id, r.entity.id);
    }
  }
}
