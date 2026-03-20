/**
 * Route guard tests for the /login route.
 *
 * Verifies that the beforeLoad hook redirects already-authenticated users to /employees.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Route } from "..";
import { resetAuthSession } from "../../../auth/session-store";

describe("login route — beforeLoad guard", () => {
  beforeEach(() => {
    resetAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when the backend reports no authenticated session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((beforeLoad as any)({})).resolves.toBeUndefined();
  });

  it("throws redirect to /employees when the backend reports an active session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "alice@example.com",
          name: "Alice Example",
          role: "consultant",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();

    let thrown: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (beforeLoad as any)({});
    } catch (e) {
      thrown = e;
    }
    expect((thrown as { options: { to: string } }).options.to).toBe("/employees");
  });
});
