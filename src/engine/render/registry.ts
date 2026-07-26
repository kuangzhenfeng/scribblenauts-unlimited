/**
 * 渲染器注册表 —— rendererId → SpriteRendererDef 的全局映射。
 *
 * 渲染单路由：sprite atlas（Phaser Texture Atlas 帧动画），每对象一套美术 + setTint 染色。
 * vector paper-doll 路由已废弃删除，registry 只支持 sprite kind。
 *
 * 行业做法（5th Cell Objectnaut）：每对象一套美术 + tint 染色。creature renderer===id，
 * 每物种独立 sprite atlas。
 */

import type { SpriteRendererDef } from './SpriteSheet';
import { registerAtlas } from './SpriteSheet';

export type RendererEntry = { kind: 'sprite'; def: SpriteRendererDef };

const _registry = new Map<string, RendererEntry>();

/** 注册 Sprite 渲染器，并自动将 atlasKey 加入预加载清单。 */
export function registerSpriteRenderer(id: string, def: SpriteRendererDef): void {
  registerAtlas(def.atlasKey);
  _registry.set(id, { kind: 'sprite', def });
}

/** 按 id 取渲染器条目。 */
export function getRendererEntry(id: string): RendererEntry | undefined {
  return _registry.get(id);
}
