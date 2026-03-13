import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyGoogleToken, type VerifyFn } from "./verify-google-token.js";

const VALID_PAYLOAD = {
  sub: "google-sub-123",
  email: "alice@example.com",
  name: "Alice Example",
  email_verified: true,
};

const makeVerifyFn = (result: "resolve" | "reject"): VerifyFn => {
  if (result === "resolve") {
    return vi.fn().mockResolvedValue({ getPayload: () => VALID_PAYLOAD });
  }
  return vi.fn().mockRejectedValue(new Error("Invalid token"));
};

describe("verifyGoogleToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user payload when token is valid", async () => {
    const verify = makeVerifyFn("resolve");
    const user = await verifyGoogleToken("valid.token.here", verify);
    expect(user).toEqual({
      sub: VALID_PAYLOAD.sub,
      email: VALID_PAYLOAD.email,
      name: VALID_PAYLOAD.name,
    });
  });

  it("calls the verify function with the provided token", async () => {
    const verify = makeVerifyFn("resolve");
    await verifyGoogleToken("my.token.value", verify);
    expect(verify).toHaveBeenCalledWith("my.token.value");
  });

  it("returns null when token verification fails", async () => {
    const verify = makeVerifyFn("reject");
    const user = await verifyGoogleToken("bad.token", verify);
    expect(user).toBeNull();
  });

  it("returns null when payload is missing", async () => {
    const verify: VerifyFn = vi.fn().mockResolvedValue({ getPayload: () => undefined });
    const user = await verifyGoogleToken("token.no.payload", verify);
    expect(user).toBeNull();
  });

  it("returns null when sub is missing from payload", async () => {
    const verify: VerifyFn = vi.fn().mockResolvedValue({
      getPayload: () => ({ email: "alice@example.com", name: "Alice" }),
    });
    const user = await verifyGoogleToken("token.no.sub", verify);
    expect(user).toBeNull();
  });
});
