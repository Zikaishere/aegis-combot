type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL || "info") as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
}

export const logger = {
  debug: (context: string, message: string, ...meta: unknown[]) => {
    if (!shouldLog("debug")) return;
    console.debug(formatMessage("debug", context, message), ...meta);
  },

  info: (context: string, message: string, ...meta: unknown[]) => {
    if (!shouldLog("info")) return;
    console.log(formatMessage("info", context, message), ...meta);
  },

  warn: (context: string, message: string, ...meta: unknown[]) => {
    if (!shouldLog("warn")) return;
    console.warn(formatMessage("warn", context, message), ...meta);
  },

  error: (context: string, message: string, ...meta: unknown[]) => {
    if (!shouldLog("error")) return;
    console.error(formatMessage("error", context, message), ...meta);
  },
};
