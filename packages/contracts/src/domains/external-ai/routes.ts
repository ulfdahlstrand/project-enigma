import { oc } from "@orpc/contract";
import {
  listExternalAIAuthorizationsInputSchema,
  listExternalAIAuthorizationsOutputSchema,
  createExternalAIAuthorizationInputSchema,
  createExternalAIAuthorizationOutputSchema,
  exchangeExternalAILoginChallengeInputSchema,
  exchangeExternalAILoginChallengeOutputSchema,
  getExternalAIContextInputSchema,
  getExternalAIContextOutputSchema,
  listExternalAIClientsInputSchema,
  listExternalAIClientsOutputSchema,
  revokeExternalAIAuthorizationInputSchema,
  revokeExternalAIAuthorizationOutputSchema,
  deleteExternalAIAuthorizationInputSchema,
  deleteExternalAIAuthorizationOutputSchema,
  refreshExternalAIAccessTokenInputSchema,
  refreshExternalAIAccessTokenOutputSchema,
} from "../../external-ai.js";

export const externalAIRoutes = {
  listExternalAIClients: oc
    .route({ method: "GET", path: "/auth/external-ai/clients" })
    .input(listExternalAIClientsInputSchema)
    .output(listExternalAIClientsOutputSchema),
  listExternalAIAuthorizations: oc
    .route({ method: "GET", path: "/auth/external-ai/authorizations" })
    .input(listExternalAIAuthorizationsInputSchema)
    .output(listExternalAIAuthorizationsOutputSchema),
  createExternalAIAuthorization: oc
    .route({ method: "POST", path: "/auth/external-ai/authorizations" })
    .input(createExternalAIAuthorizationInputSchema)
    .output(createExternalAIAuthorizationOutputSchema),
  exchangeExternalAILoginChallenge: oc
    .route({ method: "POST", path: "/auth/external-ai/token" })
    .input(exchangeExternalAILoginChallengeInputSchema)
    .output(exchangeExternalAILoginChallengeOutputSchema),
  revokeExternalAIAuthorization: oc
    .route({ method: "POST", path: "/auth/external-ai/authorizations/{authorizationId}/revoke" })
    .input(revokeExternalAIAuthorizationInputSchema)
    .output(revokeExternalAIAuthorizationOutputSchema),
  getExternalAIContext: oc
    .route({ method: "GET", path: "/external-ai/context" })
    .input(getExternalAIContextInputSchema)
    .output(getExternalAIContextOutputSchema),
  refreshExternalAIAccessToken: oc
    .route({ method: "POST", path: "/auth/external-ai/token/refresh" })
    .input(refreshExternalAIAccessTokenInputSchema)
    .output(refreshExternalAIAccessTokenOutputSchema),
  deleteExternalAIAuthorization: oc
    .route({ method: "DELETE", path: "/auth/external-ai/authorizations/{authorizationId}" })
    .input(deleteExternalAIAuthorizationInputSchema)
    .output(deleteExternalAIAuthorizationOutputSchema),
};
