import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthUser = {
  oid: string;
  email: string;
  name: string;
};

export type EntraPayload = {
  oid?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
};

export type VerifyEntraTokenFn = (token: string) => Promise<EntraPayload>;

function normalizeAuthority(authority: string): string {
  return authority.endsWith("/") ? authority : `${authority}/`;
}

function buildEntraAuthority(): string {
  const tenantId = process.env["ENTRA_TENANT_ID"];
  if (!tenantId) {
    throw new Error("ENTRA_TENANT_ID is not set");
  }
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

const defaultVerifyEntraToken: VerifyEntraTokenFn = async (token) => {
  const clientId = process.env["ENTRA_CLIENT_ID"];
  if (!clientId) {
    throw new Error("ENTRA_CLIENT_ID is not set");
  }

  const authority = buildEntraAuthority();
  // JWKS endpoint does not include the /v2.0 base path — it uses a separate path prefix
  const jwksUrl = authority.replace(/\/v2\.0$/, "") + "/discovery/v2.0/keys";
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jwtVerify(token, jwks, {
    audience: clientId,
    issuer: authority,
  });

  return payload as unknown as EntraPayload;
};

export async function verifyEntraToken(
  token: string,
  verify: VerifyEntraTokenFn = defaultVerifyEntraToken,
): Promise<AuthUser | null> {
  try {
    const payload = await verify(token);
    if (!payload.oid) {
      return null;
    }

    const email = payload.preferred_username ?? payload.email ?? "";
    const name = payload.name ?? email;

    return {
      oid: payload.oid,
      email,
      name,
    };
  } catch {
    return null;
  }
}

export { buildEntraAuthority, normalizeAuthority };
