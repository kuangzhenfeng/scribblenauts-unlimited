/**
 * 物体编辑器领域服务 —— 规范化基础词条、双语名称、形容词与外观配置。
 *
 * UI 只收集文本；本模块负责把中文/英文输入解析成稳定的词条 id，校验命名冲突，
 * 持久化自定义物体并刷新当前运行时词典中的同一自定义 id。
 */

import type { CustomObjectDef } from '@/core/types/save';
import type { SaveStore } from '@/core/data/save/SaveStore';
import {
  cnExactId,
  enExactId,
  getEntry,
  lookupByCn,
  lookupByEn,
  registerCustomObject,
} from '@/core/data/dictionary/Dictionary';
import { getAdjective, lookupAdjByCn, lookupAdjByEn } from '@/core/data/dictionary/adjectives';
import { isModifiable } from '@/core/data/dictionary/modifiable';
import { normalizeEnglishKey } from '@/core/data/dictionary/normalize';
import { parse, type ParsedAdjective } from '@/core/lex/InputParser';
import { log } from '@/util/log';

export interface ObjectEditorNameDraft {
  name: string;
  aliases?: string[] | string;
}

export interface CustomObjectDraft {
  /** 提供 id 时更新同一个自定义物体；不提供时创建新物体。 */
  id?: string;
  zh: ObjectEditorNameDraft;
  en: ObjectEditorNameDraft;
  /** 可以传基础 id，也可以直接传中文/英文基础词条名。 */
  baseTypeId?: string;
  baseText?: string;
  /** 允许传形容词 id，也允许传中英文名称。 */
  adjectives: string[] | string;
  /** 已有渲染器参数覆盖，例如 color/bodyColor/w/h。 */
  appearanceOverrides?: Record<string, unknown>;
  /** 组合部件：可传词条 id/名称，支持 `wheel@0:-18` 指定相对锚点。 */
  attachments?: string[] | string;
}

export type ObjectEditorResult = CustomObjectDef | { error: string };

export class ObjectEditor {
  private static readonly PREFIX = 'custom:';

  constructor(private readonly store: SaveStore) {}

  /** 保存新自定义物体或更新 draft.id 对应的已有物体。 */
  async save(draft: CustomObjectDraft): Promise<ObjectEditorResult> {
    const data = await this.store.load();
    const existing = draft.id ? data.customObjects.find((item) => item.id === draft.id) : undefined;
    if (draft.id && !existing) return { error: `未找到自定义物体：${draft.id}` };

    const normalized = this.normalizeDraft(draft);
    if ('error' in normalized) return normalized;

    const conflict = this.findNameConflict(normalized, data.customObjects, draft.id);
    if (conflict) return { error: conflict };

    const id = draft.id ?? this.createId(normalized.zh.name);
    const full: CustomObjectDef = {
      ...normalized,
      id,
      created: existing?.created ?? Date.now(),
    };

    // 先写存档，成功后再注入运行时索引，避免持久化失败时只留下半个定义。
    await this.store.upsertCustomObject(full);
    registerCustomObject(full);
    log.info('custom object saved', { id, base: full.baseTypeId, adj: full.adjectives });
    return full;
  }

  /** 显式更新入口，便于 BackpackPanel 不需要拼装 id 字段。 */
  async update(id: string, draft: Omit<CustomObjectDraft, 'id'>): Promise<ObjectEditorResult> {
    return this.save({ ...draft, id });
  }

  /** 删除 IndexedDB 中的自定义物体及其背包记录。 */
  async delete(id: string): Promise<{ error: string } | undefined> {
    const existing = await this.store.getCustomObject(id);
    if (!existing) return { error: `未找到自定义物体：${id}` };
    await this.store.removeCustomObject(id);
    log.info('custom object deleted', { id });
    return undefined;
  }

  /** 从已有物体复制一份，默认以中英文“副本/copy”命名。 */
  async duplicate(
    id: string,
    names: { zh?: ObjectEditorNameDraft; en?: ObjectEditorNameDraft } = {},
  ): Promise<ObjectEditorResult> {
    const existing = await this.store.getCustomObject(id);
    if (!existing) return { error: `未找到自定义物体：${id}` };
    return this.save({
      zh: names.zh ?? { name: `${existing.zh.name}副本`, aliases: existing.zh.aliases },
      en: names.en ?? { name: `${existing.en.name} copy`, aliases: existing.en.aliases },
      baseTypeId: existing.baseTypeId,
      adjectives: [...existing.adjectives],
      attachments: existing.attachments?.map(
        (attachment) => `${attachment.childTypeId}@${attachment.anchor[0]}:${attachment.anchor[1]}`,
      ),
      appearanceOverrides: existing.appearanceOverrides ? { ...existing.appearanceOverrides } : undefined,
    });
  }

  /** 把编辑器输入规范化成可写入词典的定义（公开供 UI/单测复用）。 */
  normalizeDraft(draft: CustomObjectDraft): Omit<CustomObjectDef, 'id' | 'created'> | { error: string } {
    const zh = normalizeName(draft.zh, false);
    const en = normalizeName(draft.en, true);
    if (!zh.name || !en.name) return { error: '中文名与英文名都不能为空' };

    const baseText = draft.baseTypeId?.trim() || draft.baseText?.trim() || '';
    const base = getEntry(baseText) ?? lookupByCn(baseText) ?? lookupByEn(baseText);
    if (!base || base.id.startsWith(ObjectEditor.PREFIX)) {
      return { error: `未找到基础词条：${baseText}` };
    }

    const adjectives = resolveAdjectiveIds(draft.adjectives);
    if ('error' in adjectives) return adjectives;
    for (const adjId of adjectives) {
      const adjective = getAdjective(adjId)!;
      if (!isModifiable(base, adjective.category)) {
        return { error: `基础词条「${base.zh.name}」不能使用形容词「${adjective.zh.name}」` };
      }
    }

    const appearanceOverrides = normalizeAppearanceOverrides(draft.appearanceOverrides);
    if (appearanceOverrides === undefined) {
      const attachments = normalizeAttachments(draft.attachments);
      if (attachments && 'error' in attachments) return attachments;
      return { zh, en, baseTypeId: base.id, adjectives, ...(attachments ? { attachments } : {}) };
    }
    if (isEditorError(appearanceOverrides)) return appearanceOverrides;

    const attachments = normalizeAttachments(draft.attachments);
    if (attachments && 'error' in attachments) return attachments;

    return {
      zh,
      en,
      baseTypeId: base.id,
      adjectives,
      ...(attachments ? { attachments } : {}),
      ...(appearanceOverrides ? { appearanceOverrides } : {}),
    };
  }

  private findNameConflict(
    normalized: Omit<CustomObjectDef, 'id' | 'created'>,
    existing: CustomObjectDef[],
    currentId?: string,
  ): string | undefined {
    const names: Array<{ language: 'zh' | 'en'; value: string }> = [
      { language: 'zh', value: normalized.zh.name },
      { language: 'en', value: normalized.en.name },
      ...(normalized.zh.aliases ?? []).map((value) => ({ language: 'zh' as const, value })),
      ...(normalized.en.aliases ?? []).map((value) => ({ language: 'en' as const, value })),
    ];

    for (const { language, value } of names) {
      const normalizedValue = language === 'en' ? normalizeEnglishKey(value) : value;
      const builtinId = language === 'zh' ? cnExactId(value) : enExactId(value);
      if (builtinId && !builtinId.startsWith(ObjectEditor.PREFIX)) {
        return `名称「${value}」已存在`;
      }
      const customConflict = existing.find((def) => {
        if (def.id === currentId) return false;
        const values = [def[language].name, ...(def[language].aliases ?? [])];
        return values.some((candidate) => {
          const key = language === 'en' ? normalizeEnglishKey(candidate) : candidate;
          return key === normalizedValue;
        });
      });
      if (customConflict) return `名称「${value}」已存在`;
    }
    return undefined;
  }

  private createId(zhName: string): string {
    return `${ObjectEditor.PREFIX}${zhName}`;
  }
}

function normalizeName(draft: ObjectEditorNameDraft, english: boolean): { name: string; aliases?: string[] } {
  const name = english ? normalizeEnglishKey(draft.name) : draft.name.trim().replace(/\s+/g, '');
  const rawAliases = Array.isArray(draft.aliases) ? draft.aliases : splitAliases(draft.aliases ?? '');
  const aliases = rawAliases
    .map((alias) => (english ? normalizeEnglishKey(alias) : alias.trim().replace(/\s+/g, '')))
    .filter(Boolean)
    .filter((alias, index, all) => alias !== name && all.indexOf(alias) === index);
  return aliases.length > 0 ? { name, aliases } : { name };
}

function splitAliases(value: string): string[] {
  return value.split(/[,，;；\n]/).map((alias) => alias.trim()).filter(Boolean);
}

function resolveAdjectiveIds(input: string[] | string): string[] | { error: string } {
  const raw = Array.isArray(input) ? input.map((value) => value.trim()).filter(Boolean).join(' ') : input.trim();
  if (!raw) return [];

  const parsed = parse(raw.replace(/[,，;；]/g, ' '), 'adjectives-only') as ParsedAdjective[];
  if (parsed.length > 0) return unique(parsed.map((item) => item.adjId));

  const ids: string[] = [];
  for (const token of raw.replace(/[,，;；]/g, ' ').split(/\s+/).filter(Boolean)) {
    const adjective = getAdjective(token) ?? lookupAdjByCn(token) ?? lookupAdjByEn(token);
    if (!adjective) return { error: `未找到形容词：${token}` };
    ids.push(adjective.id);
  }
  return unique(ids);
}

function normalizeAppearanceOverrides(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | { error: string } | undefined {
  if (!input) return undefined;
  const output = { ...input };
  const color = output.color ?? output.bodyColor;
  if (color !== undefined) {
    if (typeof color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.trim())) {
      return { error: '颜色必须是 #RGB、#RRGGBB 或 #RRGGBBAA 格式' };
    }
    const normalizedColor = color.trim().toUpperCase();
    // 同时写入两种现有渲染参数：矢量兜底使用 color，sprite 生物使用 bodyColor。
    output.color = normalizedColor;
    output.bodyColor = normalizedColor;
  }
  return output;
}

function normalizeAttachments(
  input: string[] | string | undefined,
): CustomObjectDef['attachments'] | { error: string } | undefined {
  const raw = Array.isArray(input)
    ? input
    : (input ?? '').split(/[,，;；\n]/).map((value) => value.trim()).filter(Boolean);
  if (raw.length === 0) return undefined;
  if (raw.length > 8) return { error: '组合部件最多 8 个' };
  const output: NonNullable<CustomObjectDef['attachments']> = [];
  for (const [index, value] of raw.entries()) {
    const token = typeof value === 'string' ? value.trim() : '';
    if (!token) continue;
    const [childText, anchorText] = token.split('@', 2);
    const child = getEntry(childText.trim()) ?? lookupByCn(childText.trim()) ?? lookupByEn(childText.trim());
    if (!child || child.id.startsWith('custom:')) return { error: `未找到组合部件：${childText.trim()}` };
    const anchor = parseAttachmentAnchor(anchorText, index);
    if ('error' in anchor) return anchor;
    output.push({ childTypeId: child.id, anchor });
  }
  return output.length > 0 ? output : undefined;
}

function parseAttachmentAnchor(value: string | undefined, index: number): [number, number] | { error: string } {
  if (!value?.trim()) return [0, -18 - index * 12];
  const parts = value.split(':').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part) || Math.abs(part) > 160)) {
    return { error: '组合部件锚点格式应为 x:y，范围在 -160 到 160 之间' };
  }
  return [parts[0], parts[1]];
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function isEditorError(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}
