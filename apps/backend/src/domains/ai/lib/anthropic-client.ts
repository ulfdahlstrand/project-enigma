import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Anthropic API client
//
// A single Anthropic instance is exported for use by all AI procedure
// handlers. The client is initialised lazily — ANTHROPIC_API_KEY is only
// read the first time the client is requested.
// This keeps unit tests that inject their own mock client free of API-key
// requirements (mirrors the getDb() pattern in db/client.ts).
//
// Procedure handlers that accept `client` as a parameter (dependency
// injection) import `getAnthropicClient()` as the production default.
// ---------------------------------------------------------------------------

function createAnthropicClient(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[backend] ANTHROPIC_API_KEY environment variable is not set. " +
        "Cannot connect to Anthropic API."
    );
  }
  return new Anthropic({ apiKey });
}

let _client: Anthropic | undefined;

/**
 * Returns the shared Anthropic client instance, creating it on first access.
 * Throws if ANTHROPIC_API_KEY is not set.
 */
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = createAnthropicClient();
  }
  return _client;
}
