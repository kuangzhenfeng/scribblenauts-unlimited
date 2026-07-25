// util/log.ts
// 日志封装：输出到控制台（英文），遵循 CLAUDE.md 日志规范精神（无 Node 后端）
// 级别 debug < info < warn < error，默认 info，可用环境变量 LOG_LEVEL 调整

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): LogLevel {
  const raw = (typeof process !== 'undefined' && process.env?.LOG_LEVEL) || 'info';
  if (raw in LEVEL_ORDER) return raw as LogLevel;
  return 'info';
}

let currentLevel: LogLevel = resolveLevel();

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

interface LogPayload {
  msg: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, payload: LogPayload): void {
  if (!shouldLog(level)) return;
  const prefix = `[${level.toUpperCase()}]`;
  const kv = Object.keys(payload)
    .filter((k) => k !== 'msg')
    .map((k) => `${k}=${safeStr(payload[k])}`)
    .join(' ');
  const line = kv ? `${prefix} ${payload.msg} ${kv}` : `${prefix} ${payload.msg}`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line);
}

function safeStr(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const log = {
  debug(msg: string, extra: Record<string, unknown> = {}): void {
    emit('debug', { msg, ...extra });
  },
  info(msg: string, extra: Record<string, unknown> = {}): void {
    emit('info', { msg, ...extra });
  },
  warn(msg: string, extra: Record<string, unknown> = {}): void {
    emit('warn', { msg, ...extra });
  },
  error(msg: string, extra: Record<string, unknown> = {}): void {
    emit('error', { msg, ...extra });
  },
};
