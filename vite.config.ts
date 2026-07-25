import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Vite 构建配置
// 纯静态 SPA，矢量美术全在代码内，无外部位图资源
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
