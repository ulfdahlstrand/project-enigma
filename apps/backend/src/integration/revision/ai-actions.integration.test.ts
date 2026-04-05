import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import { createAppServer } from "../../app-server.js";
import { createIntegrationTestDb, truncateAllPublicTables } from "../../test-helpers/integration-db.js";
import { createBearerToken } from "../../test-helpers/integration-auth.js";
import { createIntegrationOrpcClient } from "../../test-helpers/integration-orpc-client.js";
import { createScriptedOpenAI } from "../../test-helpers/scripted-openai.js";
import {
  INTEGRATION_ADMIN_USER,
  seedIntegrationAdmin,
} from "../../test-helpers/seed-versioning.js";
import { resetOpenAIClientForTests, setOpenAIClientForTests } from "../../domains/ai/lib/openai-client.js";

describe("revision action AI integration", () => {
  let db: Kysely<Database>;
  let baseUrl: string;
  let closeServer: (() => Promise<void>) | undefined;
  let authHeader: string;

  beforeAll(async () => {
    db = createIntegrationTestDb();
    authHeader = await createBearerToken({
      userId: INTEGRATION_ADMIN_USER.id,
      email: INTEGRATION_ADMIN_USER.email,
      name: INTEGRATION_ADMIN_USER.name,
      role: INTEGRATION_ADMIN_USER.role,
    });

    const { server } = await createAppServer();

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
  });

  afterAll(async () => {
    resetOpenAIClientForTests();

    if (closeServer) {
      await closeServer();
    }

    if (db) {
      await db.destroy();
    }
  });

  beforeEach(async () => {
    await truncateAllPublicTables(db);
    await seedIntegrationAdmin(db);
    resetOpenAIClientForTests();
  });

  it("stores a kickoff greeting when a revision conversation is created", async () => {
    const scripted = createScriptedOpenAI([
      "Hej! Jag kan hjalpa dig med revisionen. Vad vill du justera forst?",
    ]);
    setOpenAIClientForTests(scripted.client);

    const client = createIntegrationOrpcClient(baseUrl, authHeader);
    const entityId = "30000000-0000-4000-8000-000000000004";

    const conversation = await client.createAIConversation({
      entityType: "resume-revision-actions",
      entityId,
      systemPrompt: "You are an action assistant.",
      kickoffMessage: "Process only this work item now.",
    });

    expect(conversation.entityType).toBe("resume-revision-actions");
    expect(scripted.calls).toHaveLength(1);

    const persistedConversation = await client.getAIConversation({
      conversationId: conversation.id,
    });

    expect(persistedConversation.messages.map((m) => m.role)).toEqual(["assistant"]);
    expect(persistedConversation.messages[0]?.content).toContain("Vad vill du justera");
  });

  it("executes backend inspect tool loop and returns final response in one sendAIMessage call", async () => {
    const scripted = createScriptedOpenAI([
      "Nu kan vi arbeta vidare med revideringen.",
      {
        content: null,
        tool_calls: [{
          id: "call-inspect",
          type: "function",
          function: {
            name: "inspect_resume",
            arguments: "{\"includeAssignments\":true}",
          },
        }],
      },
      "Jag har nu granskat resultatet och kan gå vidare med ett konkret förslag.",
    ]);
    setOpenAIClientForTests(scripted.client);

    const client = createIntegrationOrpcClient(baseUrl, authHeader);
    const entityId = "30000000-0000-4000-8000-000000000002";

    const conversation = await client.createAIConversation({
      entityType: "resume-revision-actions",
      entityId,
      systemPrompt: "You are an action assistant.",
      kickoffMessage: "Help me execute this revision.",
    });

    const finalReply = await client.sendAIMessage({
      conversationId: conversation.id,
      userMessage: "Ratta stavfel i presentationen.",
    });

    expect(finalReply.role).toBe("assistant");
    expect(finalReply.content).toContain("kan gå vidare med ett konkret förslag");

    expect(scripted.calls.length).toBe(3);

    const toolResultCall = scripted.calls[2];
    const toolResultMessage = toolResultCall?.messages.find(
      (m) => m.role === "tool" && typeof m.content === "string" && m.content.includes('"ok":false'),
    );
    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage?.content).toContain("Branch not found");

    const persistedConversation = await client.getAIConversation({
      conversationId: conversation.id,
    });

    expect(persistedConversation.messages.map((m) => m.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
    expect(persistedConversation.messages[2]?.content).toContain("konkret förslag");
  });

  it("returns tool call content unchanged for write tools that require frontend execution", async () => {
    const writeToolContent =
      '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{"summary":"Review","items":[]}}\n```';

    const scripted = createScriptedOpenAI([
      "Ready to work.",
      {
        content: null,
        tool_calls: [{
          id: "call-write",
          type: "function",
          function: {
            name: "set_revision_work_items",
            arguments: "{\"summary\":\"Review\",\"items\":[]}",
          },
        }],
      },
    ]);
    setOpenAIClientForTests(scripted.client);

    const client = createIntegrationOrpcClient(baseUrl, authHeader);
    const entityId = "30000000-0000-4000-8000-000000000003";

    const conversation = await client.createAIConversation({
      entityType: "resume-revision-actions",
      entityId,
      systemPrompt: "You are an action assistant.",
      kickoffMessage: "Start.",
    });

    const reply = await client.sendAIMessage({
      conversationId: conversation.id,
      userMessage: "Execute the write tool.",
    });

    expect(reply.role).toBe("assistant");
    expect(reply.content).toContain('"toolName":"set_revision_work_items"');

    expect(scripted.calls.length).toBe(2);
  });
});
