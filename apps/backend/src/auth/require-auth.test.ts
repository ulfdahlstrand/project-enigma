import { describe, it, expect } from "vitest";
import { requireAuth } from "./require-auth.js";
import type { User } from "../db/types.js";

const MOCK_USER: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  google_sub: "google-sub-123",
  azure_oid: "azure-oid-123",
  email: "alice@example.com",
  name: "Alice",
  role: "consultant",
  created_at: new Date("2026-01-01T00:00:00Z"),
};

describe("requireAuth", () => {
  it("returns the user when context has a valid user", () => {
    const user = requireAuth({ user: MOCK_USER });
    expect(user).toBe(MOCK_USER);
  });

  it("throws UNAUTHORIZED when user is null", () => {
    expect(() => requireAuth({ user: null })).toThrow();
  });

  it("thrown error has code UNAUTHORIZED", () => {
    try {
      requireAuth({ user: null });
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe("UNAUTHORIZED");
    }
  });

  it("thrown error has HTTP status 401", () => {
    try {
      requireAuth({ user: null });
    } catch (err: unknown) {
      expect((err as { status?: number }).status).toBe(401);
    }
  });
});
