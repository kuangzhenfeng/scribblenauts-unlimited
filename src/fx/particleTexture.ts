/**
 * 程序化粒子纹理 —— 用 Graphics.generateTexture 烘焙一个柔光圆点纹理供粒子用。
 *
 * 项目坚持"零位图、纯矢量程序美术"取舍，粒子纹理也用 Graphics 现场生成：
 * 一个径向渐变 alpha 的圆，作为火/蒸汽/水/爆炸的粒子图。
 */

import Phaser from 'phaser';

export const PARTICLE_TEXTURE_KEY = 'ptcl-soft';

/** 生成柔光圆点纹理（若已存在则跳过） */
export function ensureParticleTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARTICLE_TEXTURE_KEY)) return;
  const size = 32;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 从中心向外渐淡的圆（多层 alpha 同心圆近似径向渐变）
  for (let r = size / 2; r > 0; r -= 1) {
    const a = 1 - r / (size / 2);
    g.fillStyle(0xffffff, a * 0.12);
    g.fillCircle(size / 2, size / 2, r);
  }
  g.generateTexture(PARTICLE_TEXTURE_KEY, size, size);
  g.destroy();
}
