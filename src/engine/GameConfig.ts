// engine/GameConfig.ts
// Phaser.Game 配置：全屏 WebGL，Matter 物理，全输入，禁用右键菜单
import Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0b0d12',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.2 },
      enableSleeping: false,
      debug: false,
    },
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    activePointers: 1,
  },
  disableContextMenu: true,
  scene: [WorldScene],
};
