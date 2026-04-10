import { z } from "zod";

export const externalAIScopeSchema = z.enum([
  "ai:context:read",
  "resume:read",
  "resume-branch:read",
  "resume-branch:write",
  "resume-commit:read",
  "resume-commit:write",
  "branch-assignment:read",
  "branch-assignment:write",
  "branch-skill:write",
  "education:read",
  "education:write",
]);

export const externalAIClientSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  isActive: z.boolean(),
});

export const listExternalAIClientsInputSchema = z.object({});

export const listExternalAIClientsOutputSchema = z.object({
  clients: z.array(externalAIClientSchema),
});

export const externalAIAuthorizationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  scopes: z.array(externalAIScopeSchema),
  status: z.string().min(1),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  client: externalAIClientSchema,
});

export const listExternalAIAuthorizationsInputSchema = z.object({});

export const listExternalAIAuthorizationsOutputSchema = z.object({
  authorizations: z.array(externalAIAuthorizationSchema),
});

export const createExternalAIAuthorizationInputSchema = z.object({
  clientKey: z.string().min(1),
  title: z.string().trim().min(1).max(255).nullable().optional(),
  scopes: z.array(externalAIScopeSchema).min(1).optional(),
});

export const createExternalAIAuthorizationOutputSchema = z.object({
  authorizationId: z.string().uuid(),
  challengeId: z.string().uuid(),
  challengeCode: z.string().min(1),
  challengeExpiresAt: z.string().datetime(),
  authorizationExpiresAt: z.string().datetime(),
  accessTokenExpiresAt: z.string().datetime(),
  scopes: z.array(externalAIScopeSchema),
  client: externalAIClientSchema,
});

export const exchangeExternalAILoginChallengeInputSchema = z.object({
  challengeId: z.string().uuid(),
  challengeCode: z.string().min(1),
});

export const exchangeExternalAILoginChallengeOutputSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  scopes: z.array(externalAIScopeSchema),
  authorizationId: z.string().uuid(),
  client: externalAIClientSchema,
});

export const revokeExternalAIAuthorizationInputSchema = z.object({
  authorizationId: z.string().uuid(),
});

export const revokeExternalAIAuthorizationOutputSchema = z.object({
  success: z.literal(true),
});

export const externalAIContextEntrySchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const externalAIAllowedRouteSchema = z.object({
  method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
  path: z.string().min(1),
  requiredScope: externalAIScopeSchema,
  purpose: z.string().min(1),
});

export const getExternalAIContextInputSchema = z.object({});

export const getExternalAIContextOutputSchema = z.object({
  guidanceVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  client: externalAIClientSchema.nullable(),
  scopes: z.array(externalAIScopeSchema),
  workflow: z.object({
    type: z.literal("external_api_revision"),
    steps: z.array(z.string().min(1)),
  }),
  allowedRoutes: z.array(externalAIAllowedRouteSchema),
  sharedGuidance: z.array(externalAIContextEntrySchema),
  safetyGuidance: z.array(externalAIContextEntrySchema),
  supportedResumeSections: z.array(z.string().min(1)),
});

export type ExternalAIScope = z.infer<typeof externalAIScopeSchema>;
export type ExternalAIClient = z.infer<typeof externalAIClientSchema>;
export type ExternalAIAuthorization = z.infer<typeof externalAIAuthorizationSchema>;
export type ListExternalAIClientsInput = z.infer<typeof listExternalAIClientsInputSchema>;
export type ListExternalAIClientsOutput = z.infer<typeof listExternalAIClientsOutputSchema>;
export type ListExternalAIAuthorizationsInput = z.infer<typeof listExternalAIAuthorizationsInputSchema>;
export type ListExternalAIAuthorizationsOutput = z.infer<typeof listExternalAIAuthorizationsOutputSchema>;
export type CreateExternalAIAuthorizationInput = z.infer<typeof createExternalAIAuthorizationInputSchema>;
export type CreateExternalAIAuthorizationOutput = z.infer<typeof createExternalAIAuthorizationOutputSchema>;
export type ExchangeExternalAILoginChallengeInput = z.infer<typeof exchangeExternalAILoginChallengeInputSchema>;
export type ExchangeExternalAILoginChallengeOutput = z.infer<typeof exchangeExternalAILoginChallengeOutputSchema>;
export type RevokeExternalAIAuthorizationInput = z.infer<typeof revokeExternalAIAuthorizationInputSchema>;
export type RevokeExternalAIAuthorizationOutput = z.infer<typeof revokeExternalAIAuthorizationOutputSchema>;
export type ExternalAIContextEntry = z.infer<typeof externalAIContextEntrySchema>;
export type ExternalAIAllowedRoute = z.infer<typeof externalAIAllowedRouteSchema>;
export type GetExternalAIContextInput = z.infer<typeof getExternalAIContextInputSchema>;
export type GetExternalAIContextOutput = z.infer<typeof getExternalAIContextOutputSchema>;
