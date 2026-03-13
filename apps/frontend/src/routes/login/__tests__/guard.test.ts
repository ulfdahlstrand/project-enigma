/**
 * Route guard tests for the /login route.
 *
 * Verifies that the beforeLoad hook redirects already-authenticated users to /employee.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Route } from "..";

const TOKEN_KEY = "cv-tool:id-token";

describe("login route — beforeLoad guard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does not throw when no token is in localStorage (unauthenticated user)", () => {
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (beforeLoad as any)({})).not.toThrow();
  });

  it("throws redirect to /employee when a token is present in localStorage", () => {
    localStorage.setItem(TOKEN_KEY, "mock.id.token");
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();

    let thrown: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (beforeLoad as any)({});
    } catch (e) {
      thrown = e;
    }
    // TanStack Router redirect() throws a Response with options.to
    expect((thrown as { options: { to: string } }).options.to).toBe("/employee");
  });
});
