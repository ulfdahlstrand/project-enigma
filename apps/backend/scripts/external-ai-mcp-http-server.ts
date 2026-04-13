import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  ExternalAIMcpClient,
  buildExternalAIMcpServer,
} from "../src/mcp/external-ai-mcp.js";

function resolveBaseUrl() {
  return process.env["EXTERNAL_AI_MCP_BASE_URL"] ?? "http://localhost:3001";
}

async function main() {
  const port = Number(process.env["EXTERNAL_AI_MCP_PORT"] ?? 8787);
  const host = process.env["EXTERNAL_AI_MCP_HOST"] ?? "127.0.0.1";
  const app = createMcpExpressApp({ host });

  app.post("/mcp", async (req, res) => {
    const client = new ExternalAIMcpClient({
      baseUrl: resolveBaseUrl(),
      accessToken: process.env["EXTERNAL_AI_MCP_ACCESS_TOKEN"] ?? null,
      refreshToken: process.env["EXTERNAL_AI_MCP_REFRESH_TOKEN"] ?? null,
      challengeId: process.env["EXTERNAL_AI_MCP_CHALLENGE_ID"] ?? null,
      challengeCode: process.env["EXTERNAL_AI_MCP_CHALLENGE_CODE"] ?? null,
    });

    const server = await buildExternalAIMcpServer(client);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling remote MCP request", error);

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }

    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  });

  for (const method of ["get", "delete"] as const) {
    app[method]("/mcp", async (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      });
    });
  }

  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Project Enigma remote MCP server listening on http://${host}:${port}/mcp`);
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
