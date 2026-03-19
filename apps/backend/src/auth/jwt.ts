import { SignJWT, jwtVerify, type JWTPayload } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

function getExpiresIn(): string {
  return process.env["JWT_EXPIRES_IN"] ?? "15m";
}

export interface AccessTokenPayload extends JWTPayload {
  sub: string;       // user.id (narrowed to string, not string | undefined)
  email: string;
  name: string;
  role: string;
}

export interface AccessTokenInput {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export async function signAccessToken(payload: AccessTokenInput): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(getExpiresIn())
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify<AccessTokenPayload>(token, getSecret());
  return payload;
}
