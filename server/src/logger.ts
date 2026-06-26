// 极简结构化日志
type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()} ${msg}`;
  if (meta && Object.keys(meta).length) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](base, JSON.stringify(meta));
  } else {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](base);
  }
}

export const logger = {
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
};
