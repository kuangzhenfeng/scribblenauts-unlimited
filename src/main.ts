// main.ts
// 入口：创建 Phaser.Game 实例并装入 #game-container
import Phaser from 'phaser';
import { gameConfig } from '@/engine/GameConfig';
import { log } from '@/util/log';

const game = new Phaser.Game(gameConfig);

// 窗口尺寸变化交由 Phaser Scale.RESIZE 处理；监听一次以便日志跟踪
window.addEventListener('resize', () => {
  log.debug('window.resize', { w: window.innerWidth, h: window.innerHeight });
});

// 热更新（Vite HMR）时销毁旧实例，避免重复 canvas
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

export { game };
