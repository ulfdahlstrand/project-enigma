/**
 * Pure builders for the copy-to-clipboard instruction blobs shown when an
 * external-AI authorization challenge is created. Kept text-only so the
 * React component can stay thin.
 */
interface ChallengeLike {
  challengeId: string;
  challengeCode: string;
}

export function buildApiChallengeInstructions(
  challenge: ChallengeLike,
  resolvedApiUrl: string,
): string {
  return [
    "Connect to the external AI API for this project.",
    "",
    "Base URL:",
    resolvedApiUrl,
    "",
    "Use this one-time login challenge:",
    `challengeId: ${challenge.challengeId}`,
    `challengeCode: ${challenge.challengeCode}`,
    "",
    "First exchange the challenge with:",
    "POST /auth/external-ai/token",
    "",
    "Then use the returned bearer token to:",
    "1. call GET /external-ai/context",
    "2. inspect the returned scopes and allowedRoutes",
    "3. use only the allowed resume revision routes exposed by that token",
    "",
    "Typical allowed route families include:",
    "- GET /resumes/{resumeId}",
    "- GET /resumes/{resumeId}/branches",
    "- POST /resume-commits/{fromCommitId}/branches",
    "- GET /resume-branches/{branchId}/commits",
    "- GET /resume-commits/{commitId}",
    "- POST /resume-commits/compare",
    "- POST /resume-branches/{branchId}/commits",
    "- GET/POST/PATCH/DELETE assignment routes when those scopes are present",
    "- GET/POST/PATCH/DELETE education routes when those scopes are present",
    "- PATCH /resume-branches/{branchId}/skills when that scope is present",
    "",
    "Do not use any internal-only routes. Start by fetching /external-ai/context and summarize the available workflow and scopes before making any edits.",
  ].join("\n");
}

export function buildMcpChallengeInstructions(
  challenge: ChallengeLike,
  resolvedApiUrl: string,
  resolvedMcpUrl: string,
): string {
  return [
    "Connect this project as a remote MCP server.",
    "",
    "MCP URL:",
    resolvedMcpUrl,
    "",
    "API Base URL:",
    resolvedApiUrl,
    "",
    "Use this one-time login challenge:",
    `challengeId: ${challenge.challengeId}`,
    `challengeCode: ${challenge.challengeCode}`,
    "",
    "The MCP adapter should exchange the challenge with:",
    "POST /auth/external-ai/token",
    "",
    "Then it should:",
    "1. call GET /external-ai/context at session start",
    "2. inspect the returned scopes and allowedRoutes",
    "3. register only the routes exposed by allowedRoutes",
    "4. refresh access with POST /auth/external-ai/token/refresh when needed",
    "",
    "Use the MCP URL above for the MCP client connection and the API Base URL for backend requests.",
  ].join("\n");
}

const rawApiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

export function resolveApiUrls(): { resolvedApiUrl: string; resolvedMcpUrl: string } {
  const resolvedApiUrl =
    typeof window !== "undefined" && rawApiUrl.startsWith("/")
      ? new URL(rawApiUrl, window.location.origin).toString()
      : rawApiUrl;
  const resolvedMcpUrl = resolvedApiUrl
    ? new URL("/mcp", resolvedApiUrl).toString()
    : "";
  return { resolvedApiUrl, resolvedMcpUrl };
}
