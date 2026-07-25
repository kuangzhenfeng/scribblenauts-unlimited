/**
 * 形容词可修饰性判定 —— 中立纯函数模块。
 *
 * 旧项目把同一份 isModifiable 逻辑重复写在 Dictionary.ts 与 AdjectiveSystem.ts 两处
 * （为避免循环依赖）。新项目抽到本中立模块，双方 import 同一实现，消除重复（DRY）。
 */

import type { DictEntry, ModifiableFields } from '@/core/types/dictionary';
import type { AdjectiveCategory } from '@/core/types/adjective';

/**
 * 判断某类别的形容词是否可修饰某基础词条。
 * modifiable 缺省（undefined）= 全部允许；nature 默认 false（其余默认 true）。
 */
export function isModifiable(base: DictEntry, category: AdjectiveCategory): boolean {
  const m: ModifiableFields = base.modifiable ?? {};
  switch (category) {
    case 'size':
      return m.size ?? true;
    case 'color':
      return m.color ?? true;
    case 'behavior':
      return m.behavior ?? true;
    case 'state':
      return m.state ?? true;
    case 'material':
      return m.material ?? true;
    case 'nature':
      return m.nature ?? false;
    default:
      return true;
  }
}
