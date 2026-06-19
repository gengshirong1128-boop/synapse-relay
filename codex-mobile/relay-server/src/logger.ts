type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_COLORS: Record<LogLevel, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

let minLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatTime(): string {
  return new Date().toISOString().slice(11, 23);
}

function write(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const color = LEVEL_COLORS[level];
  const prefix = `${color}${formatTime()} [${level.toUpperCase().padEnd(5)}]${RESET} [${module}]`;
  if (data) {
    const compact = JSON.stringify(data);
    process.stdout.write(`${prefix} ${message} ${compact}\n`);
  } else {
    process.stdout.write(`${prefix} ${message}\n`);
  }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => write('debug', module, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => write('info', module, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => write('warn', module, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => write('error', module, msg, data),
  };
}
