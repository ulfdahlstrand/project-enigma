import { z } from "zod";

export const authUserRoleSchema = z.enum(["admin", "consultant"]);

export const currentSessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: authUserRoleSchema,
});

export const getCurrentSessionInputSchema = z.object({});

export const getCurrentSessionOutputSchema = z.object({
  user: currentSessionUserSchema,
});

export type AuthUserRole = z.infer<typeof authUserRoleSchema>;
export type CurrentSessionUser = z.infer<typeof currentSessionUserSchema>;
export type GetCurrentSessionInput = z.infer<typeof getCurrentSessionInputSchema>;
export type GetCurrentSessionOutput = z.infer<typeof getCurrentSessionOutputSchema>;
