import pino from "pino";

const level = process.env["BACKEND_LOG_LEVEL"] ?? process.env["LOG_LEVEL"] ?? "info";
const nodeEnv = process.env["NODE_ENV"] ?? "development";
const requestedFormat = (
  process.env["BACKEND_LOG_FORMAT"] ?? (nodeEnv === "production" ? "json" : "pretty")
).toLowerCase();

const transport =
  nodeEnv !== "test" && requestedFormat === "pretty"
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
          messageFormat: "{msg}",
          singleLine: false,
        },
      })
    : undefined;

export const baseLogger = pino({
  level,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
}, transport);
