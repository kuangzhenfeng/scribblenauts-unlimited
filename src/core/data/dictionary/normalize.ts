/**
 * 英文词典键规范化。
 *
 * 词条内部可以保留连字符或多词显示形式，查找时统一为小写空格形式，
 * 这样 sea-turtle、sea turtle 和多余空格可以命中同一个词条。
 */
export function normalizeEnglishKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
