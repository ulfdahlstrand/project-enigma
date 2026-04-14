import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OAuthAuthorizePage } from "../../../features/oauth/OAuthAuthorizePage";

const oauthAuthorizeSearchSchema = z.object({
  response_type: z.string().default("code"),
  client_id: z.string(),
  redirect_uri: z.string(),
  scope: z.string().default(""),
  state: z.string().default(""),
  code_challenge: z.string().default(""),
  code_challenge_method: z.string().default("S256"),
});

export const Route = createFileRoute("/_authenticated/oauth/authorize")({
  validateSearch: oauthAuthorizeSearchSchema,
  component: OAuthAuthorizeRoute,
});

function OAuthAuthorizeRoute() {
  const search = Route.useSearch();

  return (
    <OAuthAuthorizePage
      params={{
        responseType: search.response_type,
        clientId: search.client_id,
        redirectUri: search.redirect_uri,
        scope: search.scope,
        state: search.state,
        codeChallenge: search.code_challenge,
        codeChallengeMethod: search.code_challenge_method,
      }}
    />
  );
}
