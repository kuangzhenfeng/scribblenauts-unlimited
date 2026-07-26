/**
 * GPT Sprite atlas 渲染器注册。
 *
 * 渲染单路由：所有对象走 sprite 路由（每对象一套美术 + setTint 染色，对齐行业做法：
 * 5th Cell Objectnaut 每对象一套美术 + tint 染色）。creature renderer===id，每物种独立图。
 *
 * 多帧动画对象（maxwell/bird/fish/tentacled/car/fire/water/steam/starite）
 * 各帧序列不同，显式逐个注册；其余单帧静态物件统一从 SPRITE_SPECS 派生，
 * 注册=声明意图（该对象应是 sprite），磁盘是否真有图由 PreloadScene 加载 +
 * EntityGraphics 运行期按纹理存在性分派兜底，二者职责分离。
 */

import { registerSpriteRenderer } from './registry';
import { SPRITE_SPECS } from '../../../scripts/sprite-specs.js';

function cycle(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}_${index}`);
}

/** 注册已生成的多帧动画 Sprite；函数保持幂等，可由多个场景入口调用。 */
export function registerSpriteRenderers(): void {
  // 主角（8 帧：idle + walk×4 + jump + fall + dead）
  registerSpriteRenderer('maxwell', {
    atlasKey: 'maxwell',
    frames: {
      idle: 'maxwell_idle',
      walk: cycle('maxwell_walk', 4),
      jump: 'maxwell_jump',
      fall: 'maxwell_fall',
      dead: 'maxwell_dead',
    },
    defaultFrame: 'maxwell_idle',
    frameRate: 10,
  });

  registerSpriteRenderer('bird', {
    atlasKey: 'bird',
    frames: { idle: 'bird_idle', fly: cycle('bird_fly', 4) },
    defaultFrame: 'bird_idle',
  });

  registerSpriteRenderer('fish', {
    atlasKey: 'fish',
    frames: { idle: 'fish_idle', swim: cycle('fish_swim', 4) },
    defaultFrame: 'fish_idle',
  });

  const tentacledMove = cycle('tentacled_move', 4);
  registerSpriteRenderer('tentacled', {
    atlasKey: 'tentacled',
    frames: { idle: 'tentacled_idle', walk: tentacledMove, swim: tentacledMove },
    defaultFrame: 'tentacled_idle',
  });

  registerSpriteRenderer('car', {
    atlasKey: 'car',
    frames: { idle: 'car_idle', walk: cycle('car_move', 4) },
    defaultFrame: 'car_idle',
  });

  // 特效（循环帧）
  for (const atlasKey of ['fire', 'water', 'steam', 'starite']) {
    registerSpriteRenderer(atlasKey, {
      atlasKey,
      frames: { idle: cycle(atlasKey, atlasKey === 'steam' ? 3 : 4) },
      defaultFrame: `${atlasKey}_0`,
    });
  }

  // 单帧静态物件：从 SPRITE_SPECS 派生（spec 是 sprite 资产配置的唯一数据源，
  // 新增条目自动注册，消除"spec 新增 → 忘改此清单"的漂移）。
  // 多帧对象已显式注册，跳过；biped/quadruped 走 vector，不在 SPRITE_SPECS
  // 单帧派生范围（其 spec 为多帧预留，此处 length!==1 自动跳过）。
  for (const [atlasKey, spec] of Object.entries(SPRITE_SPECS)) {
    if (MULTI_FRAME.has(atlasKey)) continue;
    if (spec.frames.length !== 1) continue;
    registerSpriteRenderer(atlasKey, {
      atlasKey,
      frames: { idle: spec.frames[0] },
      defaultFrame: spec.frames[0],
    });
  }
}

/** 多帧对象：已显式注册帧序列，不从 SPRITE_SPECS 派生。 */
const MULTI_FRAME = new Set([
  'maxwell', 'biped', 'quadruped',
  'bird', 'fish', 'tentacled', 'car',
  'fire', 'water', 'steam', 'starite',
]);
