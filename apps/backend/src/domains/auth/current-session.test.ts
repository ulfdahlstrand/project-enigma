import { describe, expect, it } from "vitest";
import { ORPCError, call } from "@orpc/server";
import type { User } from "../../db/types.js";
import { getCurrentSession, getCurrentSessionHandler } from "./current-session.js";

const MOCK_USER: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  azure_oid: "azure-oid-123",
  email: "alice@example.com",
  name: "Alice Example",
  role: "consultant",
  created_at: new Date("2026-01-01T00:00:00Z"),
};

describe("getCurrentSession", () => {
  it("returns the authenticated user bootstrap payload", () => {
    expect(getCurrentSession({ user: MOCK_USER })).toEqual({
      user: {
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        name: MOCK_USER.name,
        role: MOCK_USER.role,
      },
    });
  });
});

describe("getCurrentSessionHandler", () => {
  it("returns the current session for authenticated requests", async () => {
    await expect(
      call(getCurrentSessionHandler, {}, { context: { user: MOCK_USER } })
    ).resolves.toEqual({
      user: {
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        name: MOCK_USER.name,
        role: MOCK_USER.role,
      },
    });
  });

  it("throws UNAUTHORIZED when no user is present in context", async () => {
    await expect(
      call(getCurrentSessionHandler, {}, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
