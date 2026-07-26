/**
 * 种子随机数生成器 —— mulberry32。
 *
 * 用于题库随机抽题：同一 seed 产生同一序列，保证"每次进入关卡不同但可复现调试"。
 * 项目禁用 Math.random（CLAUDE.md），所有随机场景统一走种子 RNG。
 */

/** 字符串 hash（FNV-1a 变体），输出 32 位无符号整数 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
  h = Math.imul(h, 0x01000193);
  }
  // 强制无符号 32 位
  return h >>> 0;
}

/** mulberry32：seed → 返回 [0,1) 的 RNG 函数 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates 原地洗牌，返回原数组（用 rng） */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * 生成题目随机种子：crypto.getRandomValues 取 4 字节 → base36 串（约 6-7 字符）。
 * 项目禁用 Math.random（CLAUDE.md），改用浏览器原生 CSPRNG；
 * 测试环境无 crypto.getRandomValues 时回退到 hashString(Date.now()) 取低 32 位。
 */
export function generateSeed(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint8Array(4);
    // 绑定 this 到 crypto（node 实现要求 thisArg 为 Crypto）
    cryptoObj.getRandomValues(buf);
    // 4 字节无符号整数 → base36
    const view = new DataView(buf.buffer);
    const n = view.getUint32(0);
    return n.toString(36);
  }
  // 回退：仅无 crypto 的环境触及，浏览器恒有 getRandomValues
  return (hashString(String(Date.now())) >>> 0).toString(36);
}
