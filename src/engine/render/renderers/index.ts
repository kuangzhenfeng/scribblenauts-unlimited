/**
 * 渲染器统一注册 —— PreloadScene preload 时调用一次。
 *
 * 渲染单路由：全部对象走 sprite atlas（每对象一套美术 + setTint 染色，对齐行业做法：
 * 5th Cell Objectnaut 每对象一套美术 + tint 染色）。creature renderer===id，每物种独立图。
 * vector paper-doll 路由已废弃删除。
 */

import { registerSpriteRenderers } from '../spriteRenderers';

export function registerAllRenderers(): void {
  registerSpriteRenderers();
}
