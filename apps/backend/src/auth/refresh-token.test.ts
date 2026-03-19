import { describe, it, expect } from "vitest";
import {
  generateRefreshToken,
  hashRefreshToken,
  buildRefreshCookie,
  clearRefreshCookie,
  parseRefreshToken,
} from "./refresh-token.js";

describe("refresh-token utilities", () => {
  describe("generateRefreshToken", () => {
    it("returns a URL-safe base64 string", () => {
      const token = generateRefreshToken();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("generates unique tokens", () => {
      expect(generateRefreshToken()).not.toBe(generateRefreshToken());
    });
  });

  describe("hashRefreshToken", () => {
    it("returns a 64-char hex string (SHA-256)", () => {
      const hash = hashRefreshToken("some-token");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic", () => {
      expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
    });

    it("produces different hashes for different inputs", () => {
      expect(hashRefreshToken("token-a")).not.toBe(hashRefreshToken("token-b"));
    });
  });

  describe("buildRefreshCookie", () => {
    it("includes HttpOnly directive", () => {
      const cookie = buildRefreshCookie("my-token", false);
      expect(cookie).toContain("HttpOnly");
    });

    it("includes Secure directive in production", () => {
      const cookie = buildRefreshCookie("my-token", true);
      expect(cookie).toContain("Secure");
    });

    it("does NOT include Secure directive in development", () => {
      const cookie = buildRefreshCookie("my-token", false);
      expect(cookie).not.toContain("Secure");
    });
  });

  describe("clearRefreshCookie", () => {
    it("sets MaxAge=0", () => {
      const cookie = clearRefreshCookie(false);
      expect(cookie).toContain("MaxAge=0");
    });
  });

  describe("parseRefreshToken", () => {
    it("extracts the refresh token from a cookie header", () => {
      const header = "cv_refresh_token=my-token; other_cookie=ignored";
      expect(parseRefreshToken(header)).toBe("my-token");
    });

    it("returns null when the cookie is absent", () => {
      expect(parseRefreshToken("other=value")).toBeNull();
    });

    it("returns null for undefined header", () => {
      expect(parseRefreshToken(undefined)).toBeNull();
    });
  });
});
