/**
 * 实体管理器 —— 统一持有所有运行时实体，提供增删查与快照。
 *
 * 职责边界：
 * - 只管实体的生命周期与索引，不含规则/物理/渲染逻辑；
 * - 物理刚体的增删由调用方经 Physics 完成，EntityManager 只记录引用；
 * - 实现 EntityQuery 接口供规则引擎/effect 使用。
 */

import type { Entity, EntityQuery } from '@/core/entity/Entity';

let nextEntityId = 1;

export class EntityManager implements EntityQuery {
  /** id → 实体 */
  private readonly byId = new Map<string, Entity>();
  /** 物理刚体 id → 实体（碰撞回调反查用） */
  private readonly byBodyId = new Map<number, Entity>();
  /** 玩家实体 id（跨关卡保留） */
  private playerId: string | undefined;

  add(entity: Entity, bodyId: number): void {
    this.byId.set(entity.id, entity);
    this.byBodyId.set(bodyId, entity);
  }

  remove(id: string): Entity | undefined {
    const e = this.byId.get(id);
    if (!e) return undefined;
    this.byId.delete(id);
    // bodyId 反查需遍历（实体抽象不暴露 body.id；调用方持有引用时直接传）
    return e;
  }

  /** 由 matter.js 刚体 id 反查实体（碰撞事件用） */
  get(id: string): Entity | undefined {
    return this.byId.get(id);
  }

  getByBody(bodyId: number): Entity | undefined {
    return this.byBodyId.get(bodyId);
  }

  /** 设置玩家实体（由 Spawner.spawnPlayer 调用） */
  setPlayer(id: string): void {
    this.playerId = id;
  }

  getPlayer(): Entity | undefined {
    return this.playerId ? this.byId.get(this.playerId) : undefined;
  }

  all(): Entity[] {
    return [...this.byId.values()];
  }

  /** 渲染层只读快照 */
  snapshot(): Entity[] {
    return [...this.byId.values()];
  }

  get count(): number {
    return this.byId.size;
  }

  nextId(): string {
    return `e${nextEntityId++}`;
  }

  /**
   * 清空全部实体。
   * 传 except 时保留该实体（用于关卡切换保留玩家）。
   */
  clear(except?: string): void {
    if (except) {
      const keep = this.byId.get(except);
      this.byId.clear();
      this.byBodyId.clear();
      if (keep) {
        this.byId.set(keep.id, keep);
        this.byBodyId.clear();
      }
    } else {
      this.byId.clear();
      this.byBodyId.clear();
      this.playerId = undefined;
    }
  }
}
