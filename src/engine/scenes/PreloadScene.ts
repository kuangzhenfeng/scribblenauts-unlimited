/**
 * PreloadScene —— 游戏启动时的资产预加载场景。
 *
 * 在 TitleScene 之前运行，加载所有通过 registerSpriteRenderer 注册的 Sprite Atlas，
 * 以及远景背景板（生图双板：远板天空盒 + 近板视差中景）。
 * 当 SPRITE_ATLASES 为空时无任何加载，直接跳转 TitleScene。
 */

import Phaser from 'phaser';
import { SPRITE_ATLASES } from '../render/SpriteSheet';
import { registerAllRenderers } from '../render/renderers';

/** 远景背景板：远板（固定屏天空盒）+ 近板（视差中景条带），按主题分套 */
const BACKGROUND_PLATES = [
  'bg-far-jungle',  'bg-near-jungle',
  'bg-far-cave',    'bg-near-cave',
  'bg-far-snow',    'bg-near-snow',
  'bg-far-desert',  'bg-near-desert',
  'bg-far-volcano', 'bg-near-volcano',
] as const;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.load.image('title-key-art', 'assets/title/title-key-art.png');
    // 预先注册所有渲染器（vector paper-doll + sprite atlas），以便 SPRITE_ATLASES 清单完整
    registerAllRenderers();
    // Phaser 4 的预加载场景不会可靠地回填超过并行上限的待加载文件；确保所有 atlas 子文件首轮入队。
    this.load.maxParallelDownloads = Math.max(this.load.maxParallelDownloads, SPRITE_ATLASES.length * 2);
    // 加载所有已注册的 sprite atlas（文件不存在时 Phaser 静默跳过）
    for (const { atlasKey, textureUrl, atlasUrl } of SPRITE_ATLASES) {
      if (!this.textures.exists(atlasKey)) {
        this.load.atlas(atlasKey, textureUrl, atlasUrl);
      }
    }
    // 远景背景板（单帧整图，非 atlas；文件不存在时静默跳过，Environment 自动回退程序化绘制）
    for (const key of BACKGROUND_PLATES) {
      if (!this.textures.exists(key)) {
        this.load.image(key, `assets/backgrounds/${key}.png`);
      }
    }
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
