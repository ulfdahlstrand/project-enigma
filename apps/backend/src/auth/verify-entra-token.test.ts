import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyEntraToken,
  buildEntraAuthority,
  type VerifyEntraTokenFn,
} from "./verify-entra-token.js";

const VALID_PAYLOAD = {
  oid: "entra-oid-123",
  preferred_username: "alice@example.com",
  name: "Alice Example",
};

const makeVerifyFn = (result: "resolve" | "reject"): VerifyEntraTokenFn => {
  if (result === "resolve") {
    return vi.fn().mockResolvedValue(VALID_PAYLOAD);
  }
  return vi.fn().mockRejectedValue(new Error("Invalid token"));
};

describe("verifyEntraToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user payload when token is valid", async () => {
    const verify = makeVerifyFn("resolve");
    const user = await verifyEntraToken("valid.token.here", verify);
    expect(user).toEqual({
      oid: VALID_PAYLOAD.oid,
      email: VALID_PAYLOAD.preferred_username,
      name: VALID_PAYLOAD.name,
    });
  });

  it("calls the verify function with the provided token", async () => {
    const verify = makeVerifyFn("resolve");
    await verifyEntraToken("my.token.value", verify);
    expect(verify).toHaveBeenCalledWith("my.token.value");
  });

  it("returns null when token verification fails", async () => {
    const verify = makeVerifyFn("reject");
    const user = await verifyEntraToken("bad.token", verify);
    expect(user).toBeNull();
  });

  it("returns null when oid is missing from payload", async () => {
    const verify: VerifyEntraTokenFn = vi.fn().mockResolvedValue({
      preferred_username: "alice@example.com",
      name: "Alice",
    });
    const user = await verifyEntraToken("token.no.oid", verify);
    expect(user).toBeNull();
  });
});

describe("buildEntraAuthority", () => {
  it("builds the tenant-scoped authority url", () => {
    vi.stubEnv("ENTRA_TENANT_ID", "tenant-123");
    expect(buildEntraAuthority()).toBe("https://login.microsoftonline.com/tenant-123/v2.0");
    vi.unstubAllEnvs();
  });
});
