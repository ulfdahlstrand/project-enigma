import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beginRequestLogging } from "./request-logging.js";
import { logger } from "./logger.js";

function buildRequest() {
  return {
    method: "POST",
    url: "/rpc/sendAIMessage?debug=true&trace=1",
    headers: {
      "user-agent": "vitest",
      "content-length": "42",
      "x-request-id": "req-123",
    },
    socket: {
      remoteAddress: "127.0.0.1",
    },
  } as unknown as IncomingMessage;
}

function buildResponse() {
  const emitter = new EventEmitter();
  const headers = new Map<string, string>();
  const originalOnce = emitter.once.bind(emitter);

  return Object.assign(emitter, {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    once(event: string, listener: (...args: any[]) => void) {
      originalOnce(event, listener);
      return this;
    },
  }) as unknown as ServerResponse & EventEmitter & {
    getHeader: (name: string) => string | undefined;
  };
}

describe("beginRequestLogging", () => {
  it("logs request start and completion with stable request metadata", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const req = buildRequest();
    const res = buildResponse();

    const requestLogging = beginRequestLogging(req, res);
    requestLogging.setUserId("user-1");
    requestLogging.setOperationName("sendAIMessage");

    res.emit("finish");

    expect(res.getHeader("x-request-id")).toBe("req-123");
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenNthCalledWith(1, "HTTP request received", expect.objectContaining({
      requestId: "req-123",
      method: "POST",
      path: "/rpc/sendAIMessage",
      queryKeys: ["debug", "trace"],
      ip: "127.0.0.1",
      userAgent: "vitest",
      contentLength: 42,
    }));
    expect(infoSpy).toHaveBeenNthCalledWith(2, "HTTP request completed", expect.objectContaining({
      requestId: "req-123",
      method: "POST",
      path: "/rpc/sendAIMessage",
      operationName: "sendAIMessage",
      userId: "user-1",
      statusCode: 200,
      completedBy: "finish",
    }));
  });

  it("does not log completion twice if both finish and close fire", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const req = buildRequest();
    const res = buildResponse();

    beginRequestLogging(req, res);

    res.emit("finish");
    res.emit("close");

    expect(infoSpy).toHaveBeenCalledTimes(2);
  });
});
