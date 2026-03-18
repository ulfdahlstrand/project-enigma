import OpenAI from "openai";

// ---------------------------------------------------------------------------
// OpenAI API client
//
// A single OpenAI instance is shared by all AI procedure handlers. Lazily
// initialised — OPENAI_API_KEY is only read the first time the client is
// requested. Mirrors the getDb() pattern in db/client.ts.
//
// Procedure handlers accept `client` as a parameter (dependency injection)
// and import `getOpenAIClient()` as the production default.
// ---------------------------------------------------------------------------

function createOpenAIClient(): OpenAI {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[backend] OPENAI_API_KEY environment variable is not set. " +
        "Cannot connect to OpenAI API."
    );
  }
  return new OpenAI({ apiKey });
}

let _client: OpenAI | undefined;

/**
 * Returns the shared OpenAI client instance, creating it on first access.
 * Throws if OPENAI_API_KEY is not set.
 */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = createOpenAIClient();
  }
  return _client;
}
