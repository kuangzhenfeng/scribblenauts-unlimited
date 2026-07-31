// main.ts
// 入口：创建 Phaser.Game 实例并装入 #game-container
import Phaser from 'phaser';
import { gameConfig } from '@/engine/GameConfig';
import { log } from '@/util/log';

const game = new Phaser.Game(gameConfig);

// 开发环境暴露实例，便于真实浏览器验收资源是否完成预加载。
if (import.meta.env.DEV) {
  (window as Window & { __scribblenautsGame?: Phaser.Game }).__scribblenautsGame = game;
}

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
