/**
 * 倒排索引 —— 标签 → 实体集合，供规则匹配按需遍历较小侧集合。
 *
 * 规则匹配分两类：
 * - collision/contact：基于物理碰撞对，直接从碰撞事件取实体，不扫全表；
 * - tick（self）：按 state 倒排集合遍历。
 *
 * 实现策略：实体 TagSet 持 onChange 回调自动同步索引，effect handler 不再手动
 * deindex/indexEntity（消除旧项目"散落 6+ 处手动同步、易漏调"的 bug 温床）。
 * 全量重建：先从所有旧标签集合移除，再按新标签集合加入。
 */

import type { Entity } from '@/core/entity/Entity';
import type { TagSet } from './TagSet';
import type { StateTag, FlagTag } from '@/core/types/rules';

export class TagIndex {
  /** 状态 → 实体集合 */
  private readonly byState = new Map<string, Set<Entity>>();
  /** 标志 → 实体集合 */
  private readonly byFlag = new Map<string, Set<Entity>>();

  /**
   * 注册实体到索引：读取其当前 tags 建立倒排。
   * 同时在 TagSet 上挂 onChange 回调，后续标签变更自动全量重建。
   */
  attach(e: Entity, tags: TagSet): void {
    this.rebuild(e, emptyTags, tags);
    tags.setListener({
      onTagsChanged: (ts) => this.rebuild(e, this.snapshotOld(e, ts) as TagsSnapshot, snapshot(ts)),
    });
  }

  /** 注销实体：从所有倒排集合移除 */
  detach(e: Entity, tags: TagSet): void {
    this.rebuild(e, snapshot(tags), emptyTags);
    tags.setListener(noopListener);
  }

  byStateSet(s: StateTag): Set<Entity> {
    return this.byState.get(s) ?? new Set();
  }

  byFlagSet(f: FlagTag): Set<Entity> {
    return this.byFlag.get(f) ?? new Set();
  }

  // ---- 内部 ----

  private addTo(idx: Map<string, Set<Entity>>, key: string, e: Entity): void {
    let set = idx.get(key);
    if (!set) {
      set = new Set();
      idx.set(key, set);
    }
    set.add(e);
  }

  private removeFrom(idx: Map<string, Set<Entity>>, key: string, e: Entity): void {
    const set = idx.get(key);
    if (!set) return;
    set.delete(e);
    if (set.size === 0) idx.delete(key);
  }

  /** 全量重建：从 oldTags 移除 + 向 newTags 加入 */
  private rebuild(e: Entity, oldTags: TagsSnapshot, newTags: TagsSnapshot): void {
    for (const s of oldTags.state) this.removeFrom(this.byState, s, e);
    for (const f of oldTags.flags) this.removeFrom(this.byFlag, f, e);
    for (const s of newTags.state) this.addTo(this.byState, s, e);
    for (const f of newTags.flags) this.addTo(this.byFlag, f, e);
  }

  /** 取实体当前在索引中登记的旧标签快照（用于全量重建的"移除侧"） */
  private snapshotOld(e: Entity, _ts: TagSet): TagsSnapshot {
    // 反查：从所有集合中收集 e 所在的键（O(集合数)），保证移除正确
    const state = new Set<string>();
    const flags = new Set<string>();
    for (const [k, set] of this.byState) if (set.has(e)) state.add(k);
    for (const [k, set] of this.byFlag) if (set.has(e)) flags.add(k);
    return { state, flags };
  }
}

interface TagsSnapshot {
  state: Set<string>;
  flags: Set<string>;
}

const emptyTags: TagsSnapshot = { state: new Set(), flags: new Set() };

function snapshot(ts: TagSet): TagsSnapshot {
  return { state: new Set(ts.state as Set<string>), flags: new Set(ts.flags as Set<string>) };
}

const noopListener = { onTagsChanged: () => {} };
