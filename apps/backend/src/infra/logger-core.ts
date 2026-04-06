import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pino from "pino";

const level = process.env["BACKEND_LOG_LEVEL"] ?? process.env["LOG_LEVEL"] ?? "info";
const nodeEnv = process.env["NODE_ENV"] ?? "development";
const requestedFormat = (
  process.env["BACKEND_LOG_FORMAT"] ?? (nodeEnv === "production" ? "json" : "pretty")
).toLowerCase();
const configuredLogFile = process.env["BACKEND_LOG_FILE"];
const defaultDevLogFile = nodeEnv !== "production" && nodeEnv !== "test"
  ? ".logs/backend.log"
  : null;
const selectedLogFile = configuredLogFile === ""
  ? null
  : (configuredLogFile ?? defaultDevLogFile);
const logFile = selectedLogFile ? resolve(selectedLogFile) : null;

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

const streams: pino.StreamEntry[] = [];

if (transport) {
  streams.push({ stream: transport });
}

if (logFile) {
  mkdirSync(dirname(logFile), { recursive: true });
  streams.push({
    stream: pino.destination({
      dest: logFile,
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
  streams.length > 0 ? pino.multistream(streams) : undefined,
);
