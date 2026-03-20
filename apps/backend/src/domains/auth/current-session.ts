import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { requireAuth, type AuthContext } from "../../auth/require-auth.js";

export function getCurrentSession(context: AuthContext) {
  const user = requireAuth(context);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export const getCurrentSessionHandler = implement(contract.getCurrentSession).handler(
  async ({ context }) => getCurrentSession(context as AuthContext)
);
