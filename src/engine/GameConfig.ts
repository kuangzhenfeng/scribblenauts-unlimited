// engine/GameConfig.ts
// Phaser.Game 配置：全屏 WebGL，Matter 物理，全输入，禁用右键菜单
import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { SettingsScene } from './scenes/SettingsScene';
import { WorldScene } from './scenes/WorldScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0a1208',
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
    // 虚拟摇杆与动作按钮用纯 DOM 事件不走 Phaser input pipeline，
    // 但 MousePicker 拖拽走 Phaser input，保留 2 个 pointer 槽防多指冲突
    activePointers: 2,
  },
  disableContextMenu: true,
  scene: [PreloadScene, TitleScene, LevelSelectScene, SettingsScene, WorldScene],
};
