import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger as PinoLogger } from "pino";

export type RequestContextState = {
  requestId: string;
  path: string;
  logger: PinoLogger;
  userId: string | null;
  operationName: string | null;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export function runWithRequestContext<T>(state: RequestContextState, fn: () => T): T {
  return requestContextStorage.run(state, fn);
}

export function getRequestContext() {
  return requestContextStorage.getStore() ?? null;
}

export function getCurrentRequestLogger() {
  return requestContextStorage.getStore()?.logger ?? null;
}

export function setRequestContextUserId(userId: string | null) {
  const state = requestContextStorage.getStore();
  if (state) {
    state.userId = userId;
  }
}

export function setRequestContextOperationName(operationName: string | null) {
  const state = requestContextStorage.getStore();
  if (state) {
    state.operationName = operationName;
  }
}
