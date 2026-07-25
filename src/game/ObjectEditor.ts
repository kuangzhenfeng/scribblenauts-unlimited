/**
 * 物体编辑器 —— 组合物体+形容词→命名保存为自定义物体。
 *
 * 玩家选择基础词条 + 一组形容词，命名后存入 IndexedDB 并注入词典索引，
 * 之后输入该名即可生成。自定义 id 统一 `custom:` 前缀，保存时校验不冲突。
 */

import type { CustomObjectDef } from '@/core/types/save';
import type { SaveStore } from '@/core/data/save/SaveStore';
import { registerCustomObject, cnExactId, enExactId } from '@/core/data/dictionary/Dictionary';
import { log } from '@/util/log';

export class ObjectEditor {
  private static readonly PREFIX = 'custom:';

  constructor(private readonly store: SaveStore) {}

  /** 保存自定义物体；校验命名不与内置词条/别名冲突 */
  async save(def: Omit<CustomObjectDef, 'id' | 'created'>): Promise<CustomObjectDef | { error: string }> {
    const id = `${ObjectEditor.PREFIX}${def.zh.name}`;
    if (cnExactId(def.zh.name) || enExactId(def.en.name.toLowerCase())) {
      return { error: `名称「${def.zh.name}」已存在` };
    }
    const full: CustomObjectDef = {
      ...def,
      id,
      created: Date.now(),
    };
    // 注入全部词典索引，使输入该名可被 Spawner 查到并生成
    registerCustomObject(full);
    await this.store.addCustomObject(full);
    log.info('custom object saved', { id, base: def.baseTypeId, adj: def.adjectives });
    return full;
  }
}
