import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// 测试配置：纯逻辑核心在 node 环境下测试，不依赖 DOM/渲染
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
