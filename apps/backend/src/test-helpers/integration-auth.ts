import { signAccessToken } from "../auth/jwt.js";

export async function createBearerToken(input: {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "consultant";
}) {
  const token = await signAccessToken({
    sub: input.userId,
    email: input.email,
    name: input.name,
    role: input.role,
  });

  return `Bearer ${token}`;
}
