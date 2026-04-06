import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";
import { baseLogger } from "./logger-core.js";
import { runWithRequestContext, setRequestContextOperationName, setRequestContextUserId } from "./request-context.js";

function parseRequestUrl(url: string | undefined) {
  const parsed = new URL(url ?? "/", "http://localhost");
  const queryKeys = [...parsed.searchParams.keys()];

  return {
    path: parsed.pathname,
    queryKeys: queryKeys.length > 0 ? [...new Set(queryKeys)].sort() : [],
  };
}

export type RequestLoggingContext = {
  requestId: string;
  path: string;
  run: <T>(fn: () => T) => T;
  setUserId: (userId: string | null) => void;
  setOperationName: (operationName: string | null) => void;
};

const httpLogger = pinoHttp({
  logger: baseLogger,
  quietReqLogger: true,
  autoLogging: false,
  genReqId(req: IncomingMessage, res: ServerResponse) {
    const requestIdHeader = req.headers["x-request-id"];
    const requestId = typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
      ? requestIdHeader
      : randomUUID();
    res.setHeader("x-request-id", requestId);
    return requestId;
  },
});

export function beginRequestLogging(
  req: IncomingMessage,
  res: ServerResponse,
): RequestLoggingContext {
  const isProduction = process.env["NODE_ENV"] === "production";
  const includeUserAgent = isProduction;
  const startedAt = Date.now();
  httpLogger(req, res);

  const requestId = String((req as IncomingMessage & { id?: string }).id ?? randomUUID());
  const method = req.method ?? "UNKNOWN";
  const { path, queryKeys } = parseRequestUrl(req.url);
  const ip = req.socket.remoteAddress ?? null;
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  const contentLength = typeof req.headers["content-length"] === "string"
    ? Number(req.headers["content-length"])
    : null;

  let userId: string | null = null;
  let operationName: string | null = null;
  let loggedCompletion = false;

  logger.info("HTTP request received", {
    requestId,
    method,
    path,
    ...(queryKeys.length > 0 ? { queryKeys } : {}),
    ip,
    ...(includeUserAgent && userAgent ? { userAgent } : {}),
    ...(contentLength !== null && Number.isFinite(contentLength) ? { contentLength } : {}),
  });

  const logCompletion = (event: "finish" | "close") => {
    if (loggedCompletion) {
      return;
    }

    loggedCompletion = true;

    logger.info("HTTP request completed", {
      requestId,
      method,
      path,
      ...(queryKeys.length > 0 ? { queryKeys } : {}),
      ...(operationName ? { operationName } : {}),
      ...(userId ? { userId } : {}),
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      completedBy: event,
    });
  };

  res.once("finish", () => logCompletion("finish"));
  res.once("close", () => logCompletion("close"));

  return {
    requestId,
    path,
    run(fn) {
      return runWithRequestContext({
        requestId,
        path,
        logger: ((req as IncomingMessage & { log?: typeof baseLogger }).log ?? baseLogger).child({
          requestId,
        }),
        userId,
        operationName,
      }, fn);
    },
    setUserId(nextUserId) {
      userId = nextUserId;
      setRequestContextUserId(nextUserId);
    },
    setOperationName(nextOperationName) {
      operationName = nextOperationName;
      setRequestContextOperationName(nextOperationName);
    },
  };
}
