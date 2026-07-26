/**
 * i18n 运行时 —— 语言状态 + 文案/双语字段查询函数。
 *
 * 语言状态以 SettingsStore.language 为唯一来源（localStorage 持久化），
 * 每次读取都查 settings，切换后即时生效，无需订阅/响应式。
 * UI 文案经 t(key) 查询；双语数据字段（词条/题库/对话）经 L() / entryName() 取当前语言。
 *
 * 设计原则：
 * - 零第三方依赖，自建极简 i18n（KISS/YAGNI）
 * - 缺失 key 回退 key 本身，开发期可见，不静默
 * - 纯函数 + 模块级单例，无类，无状态字段（状态在 SettingsStore）
 */

import { loadSettings, saveSettings, type Lang } from '@/core/data/settings/SettingsStore';
import { STRINGS } from './strings';

export type { Lang } from '@/core/data/settings/SettingsStore';

/** 读取当前界面语言 */
export function getLang(): Lang {
  return loadSettings().language;
}

/** 设置当前界面语言并持久化 */
export function setLang(lang: Lang): void {
  saveSettings({ ...loadSettings(), language: lang });
}

/**
 * UI 文案查询。缺失 key 回退 key 本身（开发期可见，便于发现漏翻）。
 * 支持插值：t('levelSelect.levelN', { n: 3 }) → "第 3 关"。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const lang = getLang();
  let s = STRINGS[lang][key] ?? STRINGS.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

/**
 * 双语字段选择器：返回字段当前语言值。
 * 用于词典/题库/对话等已是 {zh,en} 结构的数据。
 * 空值（undefined/null）回退空串。
 */
export function L(field: { zh: string; en: string } | undefined | null): string {
  if (!field) return '';
  const lang = getLang();
  return field[lang] ?? field.zh;
}

/**
 * 词条名本地化：按当前语言返回 entry.zh.name / entry.en.name。
 * 形容词条目 AdjectiveEntry 与 DictEntry 的 zh/en 都是 LocalizedName，结构同构，直接复用。
 * entry 为空回退空串。
 */
export function entryName(
  entry: { zh: { name: string }; en: { name: string } } | undefined | null,
): string {
  if (!entry) return '';
  const lang = getLang();
  return entry[lang]?.name ?? entry.zh.name;
}
