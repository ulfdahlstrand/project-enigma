import pino from "pino";

const level = process.env["BACKEND_LOG_LEVEL"] ?? process.env["LOG_LEVEL"] ?? "info";

export const baseLogger = pino({
  level,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
});
