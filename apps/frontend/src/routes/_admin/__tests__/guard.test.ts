import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../../_admin";
import { resetAuthSession } from "../../../auth/session-store";

describe("admin route — beforeLoad guard", () => {
  beforeEach(() => {
    resetAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated users to /login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();

    let thrown: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (beforeLoad as any)({});
    } catch (error) {
      thrown = error;
    }

    expect((thrown as { options: { to: string } }).options.to).toBe("/login");
  });

  it("redirects non-admin users to /", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "consultant@example.com",
          name: "Consultant Example",
          role: "consultant",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();

    let thrown: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (beforeLoad as any)({});
    } catch (error) {
      thrown = error;
    }

    expect((thrown as { options: { to: string } }).options.to).toBe("/");
  });

  it("allows admin users through", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "admin@example.com",
          name: "Admin Example",
          role: "admin",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((beforeLoad as any)({})).resolves.toBeUndefined();
  });
});
