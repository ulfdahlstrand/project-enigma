import pino from "pino";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const level = process.env["BACKEND_LOG_LEVEL"] ?? process.env["LOG_LEVEL"] ?? "info";
const nodeEnv = process.env["NODE_ENV"] ?? "development";
const requestedFormat = (
  process.env["BACKEND_LOG_FORMAT"] ?? (nodeEnv === "production" ? "json" : "pretty")
).toLowerCase();
const requestedLogFile = process.env["BACKEND_LOG_FILE"]?.trim();
const logFilePath =
  requestedLogFile === ""
    ? undefined
    : (requestedLogFile ?? (nodeEnv === "production" ? undefined : ".logs/backend.log"));

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

const streams: Parameters<typeof pino.multistream>[0] = [
  { stream: transport ?? pino.destination({ dest: 1, sync: false }) },
];

if (logFilePath) {
  const resolvedLogFilePath = resolve(process.cwd(), logFilePath);
  mkdirSync(dirname(resolvedLogFilePath), { recursive: true });
  streams.push({
    stream: pino.destination({
      dest: resolvedLogFilePath,
      sync: false,
    }),
  });
}

export const baseLogger = pino(
  {
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams),
);
