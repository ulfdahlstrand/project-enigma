import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ExternalAIMcpClient,
  formatExternalAIContextMarkdown,
  selectAllowedToolDefinitions,
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

  let context = await client.initialize();

  const server = new McpServer({
    name: "project-enigma-external-ai",
    version: "0.1.0",
  });

  server.registerResource(
    "external-ai-context",
    "external-ai://context",
    {
      title: "External AI Context",
      description: "Current external AI context, workflow, and allowed route guidance.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "external-ai://context",
          text: formatExternalAIContextMarkdown(context),
          mimeType: "text/markdown",
        },
      ],
    }),
  );

  server.registerPrompt(
    "external-ai-revision-context",
    {
      title: "External AI Revision Context",
      description: "Load the current external AI revision context as a prompt message.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: formatExternalAIContextMarkdown(context),
          },
        },
      ],
    }),
  );

  server.registerTool(
    "refresh_external_ai_context",
    {
      title: "Refresh External AI Context",
      description: "Reload the external AI context from the API and return the latest guidance.",
      inputSchema: {},
    },
    async () => {
      context = await client.getContext();

      return {
        content: [
          {
            type: "text",
            text: formatExternalAIContextMarkdown(context),
          },
        ],
      };
    },
  );

  for (const definition of selectAllowedToolDefinitions(context.allowedRoutes)) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
      },
      async (args) => {
        const result = await client.callRoute(
          definition.route.method,
          definition.route.path,
          args as Record<string, unknown>,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }

  server.registerTool(
    "get_external_ai_allowed_routes",
    {
      title: "Get External AI Allowed Routes",
      description: "Return the currently allowed external AI routes for the active token.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(context.allowedRoutes, null, 2),
        },
      ],
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
