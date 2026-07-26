/**
 * Sprite 渲染器定义 —— 以 Phaser Texture Atlas 驱动实体渲染。
 *
 * 渲染单路由：所有对象走 sprite atlas，registry 只支持 sprite kind。
 * 美术资产约定：`public/assets/sprites/{atlasKey}.png` +
 *              `public/assets/sprites/{atlasKey}.json`（Phaser atlas JSON 格式）。
 *
 * 使用方式：
 *   registerSpriteRenderer('maxwell', {
 *     atlasKey: 'characters',
 *     frames: { idle: 'maxwell_idle_0', walk: ['maxwell_walk_0', 'maxwell_walk_1', ...] },
 *     defaultFrame: 'maxwell_idle_0',
 *   });
 */

import type Phaser from 'phaser';

/** 帧定义：单帧名（静止）或帧名序列（循环动画）。 */
export type FrameDef = string | string[];

/** Sprite 渲染器定义。 */
export interface SpriteRendererDef {
  /** Phaser texture atlas key，由 PreloadScene 预加载。 */
  atlasKey: string;
  /** 各 locomotion 状态的帧/帧序列，key 与 DrawState.locomotion 对应。 */
  frames: Partial<Record<string, FrameDef>>;
  /** 无匹配 locomotion 时的默认帧名。 */
  defaultFrame: string;
  /** 帧序列播放速率（fps），默认 8。 */
  frameRate?: number;
}

// ── Atlas 预加载清单 ──────────────────────────────────────────────────────────

interface AtlasManifest {
  atlasKey: string;
  textureUrl: string;
  atlasUrl: string;
}

const _atlasManifests: AtlasManifest[] = [];

/** 所有待加载的 atlas 清单，由 PreloadScene 读取。 */
export const SPRITE_ATLASES: readonly AtlasManifest[] = _atlasManifests;

/**
 * 注册 atlas 到预加载清单（幂等）。
 * 路径约定：`public/assets/sprites/{atlasKey}.png` + `.json`。
 */
export function registerAtlas(atlasKey: string): void {
  if (_atlasManifests.find((m) => m.atlasKey === atlasKey)) return;
  _atlasManifests.push({
    atlasKey,
    textureUrl: `assets/sprites/${atlasKey}.png`,
    atlasUrl: `assets/sprites/${atlasKey}.json`,
  });
}

// ── 动画辅助 ────────────────────────────────────────────────────────────────

const _registeredAnimKeys = new Set<string>();

/** 为 def 中的帧序列在 Phaser AnimationManager 注册动画（幂等）。 */
export function ensureSpriteAnims(scene: Phaser.Scene, def: SpriteRendererDef): void {
  for (const [locomotion, frameDef] of Object.entries(def.frames)) {
    if (!Array.isArray(frameDef) || frameDef.length < 2) continue;
    const key = `${def.atlasKey}_${locomotion}`;
    if (_registeredAnimKeys.has(key) || scene.anims.exists(key)) {
      _registeredAnimKeys.add(key);
      continue;
    }
    scene.anims.create({
      key,
      frames: frameDef.map((f) => ({ key: def.atlasKey, frame: f })),
      frameRate: def.frameRate ?? 8,
      repeat: -1,
    });
    _registeredAnimKeys.add(key);
  }
}

/** 按 locomotion 取首帧名（用于静帧初始化或无动画回退）。 */
export function frameForState(def: SpriteRendererDef, locomotion: string): string {
  const fd = def.frames[locomotion] ?? def.frames['idle'];
  if (!fd) return def.defaultFrame;
  return Array.isArray(fd) ? fd[0] : fd;
}

/** 按 locomotion 取动画 key；单帧（无动画）返回 undefined。 */
export function animKeyForState(def: SpriteRendererDef, locomotion: string): string | undefined {
  const fd = def.frames[locomotion];
  if (!fd || !Array.isArray(fd) || fd.length < 2) return undefined;
  return `${def.atlasKey}_${locomotion}`;
}
