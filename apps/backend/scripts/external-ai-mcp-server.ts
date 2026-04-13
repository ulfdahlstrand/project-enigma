import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ExternalAIMcpClient,
  buildExternalAIMcpServer,
} from "../src/mcp/external-ai-mcp.js";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const client = new ExternalAIMcpClient({
    baseUrl: getRequiredEnv("EXTERNAL_AI_MCP_BASE_URL"),
    accessToken: process.env["EXTERNAL_AI_MCP_ACCESS_TOKEN"] ?? null,
    refreshToken: process.env["EXTERNAL_AI_MCP_REFRESH_TOKEN"] ?? null,
    challengeId: process.env["EXTERNAL_AI_MCP_CHALLENGE_ID"] ?? null,
    challengeCode: process.env["EXTERNAL_AI_MCP_CHALLENGE_CODE"] ?? null,
  });

  const server = await buildExternalAIMcpServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
