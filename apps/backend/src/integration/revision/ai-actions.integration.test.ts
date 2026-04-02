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

  it("persists a tool-call loop through conversation history", async () => {
    const scripted = createScriptedOpenAI([
      "Nu kan vi arbeta vidare med revideringen.",
      '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```',
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

    const toolCallReply = await client.sendAIMessage({
      conversationId: conversation.id,
      userMessage: "[[internal_autostart]] Work on the first revision task.",
    });

    expect(toolCallReply.role).toBe("assistant");
    expect(toolCallReply.content).toContain('"toolName":"inspect_resume"');

    const afterToolResultReply = await client.sendAIMessage({
      conversationId: conversation.id,
      userMessage: [
        "Tool execution result:",
        "```json",
        '{"type":"tool_result","toolName":"inspect_resume","ok":true,"output":{"resumeId":"resume-1","inspected":true}}',
        "```",
        "Continue the conversation using this result. Do not ask the user to execute the tool manually.",
      ].join("\n"),
    });

    expect(afterToolResultReply.role).toBe("assistant");
    expect(afterToolResultReply.content).toContain("kan gå vidare med ett konkret förslag");
    expect(scripted.calls.length).toBeGreaterThanOrEqual(3);

    const expectedToolLoopMessages = [
      { role: "system", content: "You are an action assistant." },
      { role: "assistant", content: "Nu kan vi arbeta vidare med revideringen." },
      { role: "user", content: "[[internal_autostart]] Work on the first revision task." },
      { role: "assistant", content: '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```' },
      {
        role: "user",
        content: [
          "Tool execution result:",
          "```json",
          '{"type":"tool_result","toolName":"inspect_resume","ok":true,"output":{"resumeId":"resume-1","inspected":true}}',
          "```",
          "Continue the conversation using this result. Do not ask the user to execute the tool manually.",
        ].join("\n"),
      },
    ];

    expect(
      scripted.calls.some((call) => JSON.stringify(call.messages) === JSON.stringify(expectedToolLoopMessages))
    ).toBe(true);

    const persistedConversation = await client.getAIConversation({
      conversationId: conversation.id,
    });

    expect(persistedConversation.messages.map((message) => message.role)).toEqual([
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(persistedConversation.messages[2]?.content).toContain('"toolName":"inspect_resume"');
    expect(persistedConversation.messages[4]?.content).toContain("konkret förslag");
  });
});
