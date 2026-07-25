/**
 * 脚本切分 —— 把规范化后的输入切成 CJK 段与 ASCII 段，保持顺序。
 *
 * CJK 段内部无空格分词，需走闭集约束分词器；
 * ASCII 段按空格切 token。
 *
 * 与旧项目差异：删除 isCjkRun（void 占位的薄封装/死代码）。
 */

export type SegmentKind = 'cjk' | 'ascii';

export interface Segment {
  kind: SegmentKind;
  text: string;
}

const CJK_RANGE = /[㐀-鿿豈-﫿]/u;

/** 判断字符是否 CJK（汉字范围，含扩展 A 与兼容） */
export function isCjkChar(ch: string): boolean {
  return CJK_RANGE.test(ch);
}

/** 把规范化文本切成交替的 CJK/ASCII 段 */
export function splitByScript(s: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  let bufKind: SegmentKind | null = null;
  const flush = () => {
    if (!buf || bufKind === null) return;
    out.push({ kind: bufKind, text: buf });
    buf = '';
    bufKind = null;
  };
  for (const ch of s) {
    const kind: SegmentKind = isCjkChar(ch) ? 'cjk' : 'ascii';
    if (bufKind === null) {
      bufKind = kind;
      buf = ch;
    } else if (kind === bufKind) {
      buf += ch;
    } else {
      flush();
      bufKind = kind;
      buf = ch;
    }
  }
  flush();
  return out;
}
