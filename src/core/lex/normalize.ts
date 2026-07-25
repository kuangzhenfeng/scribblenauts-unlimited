/**
 * 规范化 —— 输入解析前置清洗。
 *
 * 全角→半角 / 去首尾空白。
 * 不做语义级处理，保持纯文本变换，便于单测与回放。
 *
 * 注意：不做英文小写化——小写化推迟到 ASCII token 分类时按词做，中文不需要。
 */

/** 全角→半角（主要处理标点与空格） */
function toHalfWidth(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    // 全角空格
    if (code === 0x3000) {
      out += ' ';
      continue;
    }
    // 全角 ASCII 范围 0xFF01..0xFF5E
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCodePoint(code - 0xfee0);
      continue;
    }
    out += ch;
  }
  return out;
}

/** 规范化输入文本：全角→半角 + trim */
export function normalize(raw: string): string {
  return toHalfWidth(raw).trim();
}

/** 多空白折叠为单空格（英文分词前） */
export function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
