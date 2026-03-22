type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("debug")) console.debug(formatLog("debug", message, meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("info")) console.info(formatLog("info", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(formatLog("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(formatLog("error", message, meta));
  },
};
