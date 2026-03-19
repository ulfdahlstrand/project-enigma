/**
 * Route guard tests for the _authenticated layout route.
 *
 * Verifies that the beforeLoad hook redirects unauthenticated users to /login.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Route } from "../../../_authenticated";

const TOKEN_KEY = "cv-tool:has-session";

describe("_authenticated layout route — beforeLoad guard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("throws redirect to /login when no token is in localStorage", () => {
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (beforeLoad as any)({})).toThrow();

    let thrown: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (beforeLoad as any)({});
    } catch (e) {
      thrown = e;
    }
    // TanStack Router redirect() throws a Response with options.to
    expect((thrown as { options: { to: string } }).options.to).toBe("/login");
  });

  it("does not throw when a token is present in localStorage", () => {
    localStorage.setItem(TOKEN_KEY, "mock.id.token");
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (beforeLoad as any)({})).not.toThrow();
  });
});
