// tests/sanity.test.ts
// 脚手架冒烟测试：验证 vitest node 环境与 @ 别名可用
import { describe, it, expect } from 'vitest';
import { getLogLevel } from '@/util/log';

describe('sanity', () => {
  it('vitest runs in node env', () => {
    expect(1 + 1).toBe(2);
  });

  it('@ alias resolves and log level defaults to info', () => {
    expect(getLogLevel()).toBe('info');
  });
});
