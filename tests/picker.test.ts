/**
 * 拾取器单测 —— 验证 parseAdjectivesOnly 的纯形容词模式分流（统一入口 parse(raw,'adjectives-only')）。
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@/core/lex/InputParser';

describe('picker adjectives-only mode', () => {
  it('parse(raw, adjectives-only) returns single adjective for pure input', () => {
    const r = parse('燃烧', 'adjectives-only');
    expect(r).toHaveLength(1);
    expect((r as { adjId: string }[])[0].adjId).toBe('burning');
  });

  it('parse(raw, adjectives-only) returns empty when input contains a noun', () => {
    expect(parse('燃烧的狗', 'adjectives-only')).toHaveLength(0);
  });

  it('parse(raw, adjectives-only) returns empty for unknown text', () => {
    expect(parse('xyz中文未知', 'adjectives-only')).toHaveLength(0);
  });
});
