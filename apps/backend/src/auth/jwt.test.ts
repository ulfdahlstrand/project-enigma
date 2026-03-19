import { describe, it, expect, beforeEach } from "vitest";
import { signAccessToken, verifyAccessToken, type AccessTokenInput } from "./jwt.js";

const PAYLOAD: AccessTokenInput = {
  sub: "user-uuid-1",
  email: "alice@example.com",
  name: "Alice Example",
  role: "consultant",
};

describe("JWT utilities", () => {
  beforeEach(() => {
    process.env["JWT_SECRET"] = "test-secret-value-that-is-long-enough-32b";
    process.env["JWT_EXPIRES_IN"] = "15m";
  });

  describe("signAccessToken", () => {
    it("returns a JWT string with three parts", async () => {
      const token = await signAccessToken(PAYLOAD);
      expect(token.split(".")).toHaveLength(3);
    });

    it("throws when JWT_SECRET is missing", async () => {
      delete process.env["JWT_SECRET"];
      await expect(signAccessToken(PAYLOAD)).rejects.toThrow("JWT_SECRET");
    });
  });

  describe("verifyAccessToken", () => {
    it("round-trips: verify returns the original payload", async () => {
      const token = await signAccessToken(PAYLOAD);
      const decoded = await verifyAccessToken(token);
      expect(decoded.sub).toBe(PAYLOAD.sub);
      expect(decoded.email).toBe(PAYLOAD.email);
      expect(decoded.name).toBe(PAYLOAD.name);
      expect(decoded.role).toBe(PAYLOAD.role);
    });

    it("rejects a tampered token", async () => {
      const token = await signAccessToken(PAYLOAD);
      const [header, , sig] = token.split(".");
      const tampered = `${header}.bm90dmFsaWQ.${sig}`;
      await expect(verifyAccessToken(tampered)).rejects.toThrow();
    });

    it("rejects a token signed with the wrong secret", async () => {
      const token = await signAccessToken(PAYLOAD);
      process.env["JWT_SECRET"] = "different-secret-that-is-also-long-enough";
      await expect(verifyAccessToken(token)).rejects.toThrow();
    });
  });
});
