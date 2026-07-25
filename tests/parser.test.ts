/**
 * 输入解析单测 —— 双语分词与多候选的核心正确性。
 */

import { describe, it, expect } from 'vitest';
import { parseInput, parse, parseAdjectivesOnly } from '@/core/lex/InputParser';
import { normalize } from '@/core/lex/normalize';
import { splitByScript } from '@/core/lex/Segmenter';

describe('normalize', () => {
  it('converts fullwidth to halfwidth and trims', () => {
    expect(normalize('　Ｄｏｇ ')).toBe('Dog');
  });
});

describe('splitByScript', () => {
  it('splits cjk and ascii alternation', () => {
    const segs = splitByScript(normalize('飞行的 dog'));
    // 空格属于 ASCII 段（非 CJK），故附在 ascii 段前
    expect(segs.map((s) => s.text)).toEqual(['飞行的', ' dog']);
  });
});

describe('parseInput bilingual nouns', () => {
  it('parses cn 狗', () => {
    const cs = parseInput('狗');
    expect(cs).toHaveLength(1);
    expect(cs[0].noun.entryId).toBe('dog');
    expect(cs[0].adjectives).toHaveLength(0);
  });

  it('parses en dog', () => {
    const cs = parseInput('dog');
    expect(cs[0].noun.entryId).toBe('dog');
  });

  it('parses alias 犬', () => {
    const cs = parseInput('犬');
    expect(cs[0].noun.entryId).toBe('dog');
  });

  it('parses alias puppy (en)', () => {
    const cs = parseInput('puppy');
    expect(cs[0].noun.entryId).toBe('dog');
  });
});

describe('parseInput adjectives', () => {
  it('parses big dog (en)', () => {
    const cs = parseInput('big dog');
    expect(cs[0].noun.entryId).toBe('dog');
    expect(cs[0].adjectives.map((a) => a.adjId)).toContain('big');
  });

  it('parses 大的狗 (cn)', () => {
    const cs = parseInput('大的狗');
    expect(cs[0].noun.entryId).toBe('dog');
    expect(cs[0].adjectives.map((a) => a.adjId)).toContain('big');
  });

  it('parses 飞行的紫色的狗 (cn multi adj)', () => {
    const cs = parseInput('飞行的紫色的狗');
    expect(cs[0].noun.entryId).toBe('dog');
    const ids = cs[0].adjectives.map((a) => a.adjId).sort();
    expect(ids).toEqual(['flying', 'purple'].sort());
  });

  it('parses flying purple octopus (en multi adj)', () => {
    const cs = parseInput('flying purple octopus');
    expect(cs[0].noun.entryId).toBe('octopus');
    const ids = cs[0].adjectives.map((a) => a.adjId).sort();
    expect(ids).toEqual(['flying', 'purple'].sort());
  });
});

describe('parseInput fallback', () => {
  it('returns empty for unknown word', () => {
    expect(parseInput('zzzzqq')).toHaveLength(0);
  });
});

describe('parse unified entry', () => {
  it('parse(raw, spawn) equals parseInput', () => {
    expect(parse('big dog', 'spawn')).toEqual(parseInput('big dog'));
  });

  it('parse(raw, adjectives-only) equals parseAdjectivesOnly', () => {
    expect(parse('燃烧', 'adjectives-only')).toEqual(parseAdjectivesOnly('燃烧'));
  });
});

describe('parseAdjectivesOnly', () => {
  it('returns single adjective for pure adjective input', () => {
    const r = parseAdjectivesOnly('燃烧');
    expect(r).toHaveLength(1);
    expect(r[0].adjId).toBe('burning');
  });

  it('returns multiple adjectives for CJK adjective chain', () => {
    const r = parseAdjectivesOnly('大的');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r.some((a) => a.adjId === 'big')).toBe(true);
  });

  it('returns empty when input contains a noun', () => {
    // 含名词"狗"，不是纯形容词
    expect(parseAdjectivesOnly('燃烧的狗')).toHaveLength(0);
  });

  it('returns empty for unknown text', () => {
    expect(parseAdjectivesOnly('xyz中文未知')).toHaveLength(0);
  });

  it('handles English adjectives', () => {
    const r = parseAdjectivesOnly('big');
    expect(r).toHaveLength(1);
    expect(r[0].adjId).toBe('big');
  });

  it('returns empty for empty input', () => {
    expect(parseAdjectivesOnly('')).toHaveLength(0);
    expect(parseAdjectivesOnly('   ')).toHaveLength(0);
  });
});
