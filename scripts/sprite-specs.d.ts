/**
 * sprite-specs.js 的类型声明，供 src/ TS 代码 import。
 *
 * Sprite atlas 帧规格，由 gen-atlas.js / prepare-sprite.js / process-sprite.js 共用，
 * 亦作为 spriteRenderers.ts 自动派生 staticSprite 注册清单的唯一数据源
 * （单帧 + 磁盘 png+json 齐全的条目自动注册为 staticSprite）。
 */

export interface SpriteSpec {
  /** 帧宽（px）。 */
  w: number;
  /** 帧高（px）。 */
  h: number;
  /** 帧名序列，与 atlas JSON 的 frame filename 一一对应。 */
  frames: string[];
}

export const SPRITE_SPECS: Record<string, SpriteSpec>;
