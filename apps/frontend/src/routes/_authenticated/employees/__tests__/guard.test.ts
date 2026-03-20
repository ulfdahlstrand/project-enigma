/**
 * Route guard tests for the _authenticated layout route.
 *
 * Verifies that the beforeLoad hook redirects unauthenticated users to /login.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Route } from "../../../_authenticated";
import { resetAuthSession } from "../../../../auth/session-store";

describe("_authenticated layout route — beforeLoad guard", () => {
  beforeEach(() => {
    resetAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws redirect to /login when the backend reports no session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();

    let thrown: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (beforeLoad as any)({});
    } catch (e) {
      thrown = e;
    }
    expect((thrown as { options: { to: string } }).options.to).toBe("/login");
  });

  it("does not throw when the backend reports an authenticated session", async () => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((beforeLoad as any)({})).resolves.toBeUndefined();
  });
});
