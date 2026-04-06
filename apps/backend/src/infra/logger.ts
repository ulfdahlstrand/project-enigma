import { baseLogger } from "./logger-core.js";
import { getCurrentRequestLogger } from "./request-context.js";

type LogLevel = "debug" | "info" | "warn" | "error";

function getActiveLogger() {
  return getCurrentRequestLogger() ?? baseLogger;
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const activeLogger = getActiveLogger();
  if (meta && Object.keys(meta).length > 0) {
    activeLogger[level](meta, message);
    return;
  }

  activeLogger[level](message);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => writeLog("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog("error", message, meta),
};
