/**
 * 生成器 —— 解析候选 → 应用形容词 → 生成实体（含属性标签与生命值）。
 *
 * 职责边界：装配"词条定义"为"运行时实体"，登记物理/实体/索引，不含规则匹配逻辑。
 * 渲染器经 RenderRegistry 选（Phase 3 用占位 Graphics 矩形，Phase 4 接矢量渲染器）。
 */

import type { DictEntry } from '@/core/types/dictionary';
import { getEntry, getCustomDef } from '@/core/data/dictionary/Dictionary';
import type { ParseCandidate, ParsedAdjective } from '@/core/lex/InputParser';
import type { EntityManager } from './EntityManager';
import { GameEntity } from './Entity';
import type { Physics } from '@/engine/physics/Physics';
import { TagSet } from '@/core/rules/TagSet';
import type { TagIndex } from '@/core/rules/TagIndex';
import { applyAdjectives } from './AdjectiveSystem';
import { log } from '@/util/log';
import type Phaser from 'phaser';


export interface SpawnResult {
  entity?: GameEntity;
  reason?: string;
}

/** 生物默认生命值（按 category 区分） */
function defaultHealth(category: string): number {
  switch (category) {
    case 'creature':
      return 100;
    case 'weapon':
    case 'tool':
      return 40;
    case 'food':
      return 20;
    default:
      return 60;
  }
}

export class Spawner {
  private static readonly MAX_OBJECTS = 60;
  private idCounter = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entities: EntityManager,
    private readonly physics: Physics,
    private readonly tagIndex: TagIndex,
    /** 渲染器工厂：(scene, entity) → GameObject（Phase 3 注入占位） */
    private readonly createGameObject: (scene: Phaser.Scene, e: GameEntity) => Phaser.GameObjects.GameObject | undefined,
    private readonly now: () => number = () => 0,
  ) {}

  spawnCandidate(candidate: ParseCandidate, x: number, y: number): SpawnResult {
    let entry = getEntry(candidate.noun.entryId);
    // 自定义物体：custom: 前缀 id 从自定义定义取形容词构造 candidate
    let adj = candidate.adjectives;
    if (!entry && candidate.noun.entryId.startsWith('custom:')) {
      const def = getCustomDef(candidate.noun.entryId);
      if (def) {
        entry = getEntry(def.id);
        if (entry) {
          adj = def.adjectives.map((adjId) => ({ adjId, text: adjId } satisfies ParsedAdjective));
        }
      }
    }
    if (!entry) return { reason: `未知词条：${candidate.noun.entryId}` };
    const newCandidate: ParseCandidate = { noun: candidate.noun, adjectives: adj, score: candidate.score, raw: candidate.raw };
    return this.spawnEntry(entry, newCandidate, x, y);
  }

  /** 超过 60 上限则拒绝生成；critical（NPC/玩家）不计入上限 */
  canSpawn(): boolean {
    let n = 0;
    for (const e of this.entities.all()) {
      if (!e.critical) n++;
    }
    return n < Spawner.MAX_OBJECTS;
  }

  spawnEntry(entry: DictEntry, candidate?: ParseCandidate, x = 0, y = 0): SpawnResult {
    if (!this.canSpawn()) {
      log.warn('spawn rejected: object limit reached');
      return { reason: '物体已达上限' };
    }
    const body = this.physics.createBody(entry.physics, entry.size, x, y);
    const tags = TagSet.fromRaw({
      material: entry.tags.material,
      temperature: entry.tags.temperature,
      state: entry.tags.state,
      behavior: entry.tags.behavior,
      flags: entry.tags.flags,
      category: entry.category,
    });
    const hp = defaultHealth(entry.category);
    const id = this.nextId();
    const entity = new GameEntity({
      id,
      typeId: entry.id,
      body,
      tags,
      rendererId: entry.appearance.renderer,
      layer: 1,
      critical: false,
      lastTouchedAt: this.now(),
      health: hp,
      maxHealth: hp,
    });
    if (candidate) applyAdjectives(entity, candidate, entry);

    // 创建 GameObject（占位或矢量渲染器）并挂 body
    const go = this.createGameObject(this.scene, entity);
    if (go) {
      entity.gameObject = go;
      this.physics.attachBody(go, body);
    } else {
      this.physics.addBody(body);
    }
    this.physics.bindEntity(body, entity);
    this.tagIndex.attach(entity, tags);
    this.entities.add(entity, body.id);
    log.info('spawned', {
      typeId: entry.id,
      adj: candidate?.adjectives.map((a) => a.adjId) ?? [],
      x,
      y,
    });
    return { entity };
  }

  /**
   * 生成玩家（Maxwell）。
   * 复用 human 词条但覆盖 rendererId='maxwell'，红衫区分 NPC 蓝衫；
   * critical=true 令其不受 60 上限驱逐，isPlayer=true 标记玩家身份。
   */
  spawnPlayer(x: number, y: number): GameEntity {
    const entry = getEntry('human');
    if (!entry) throw new Error('human entry missing');
    const r = this.spawnEntry(entry, undefined, x, y);
    const e = r.entity!;
    e.isPlayer = true;
    e.critical = true;
    e.rendererId = 'maxwell';
    e.drawParams = { shirtColor: '#E74C3C', pantsColor: '#3A3A3A', skinColor: '#F2C9A0' };
    this.entities.setPlayer(e.id);
    log.info('player spawned', { id: e.id, x, y });
    return e;
  }

  private nextId(): string {
    return `e${++this.idCounter}`;
  }
}
