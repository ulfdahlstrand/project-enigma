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

  it("executes backend inspect tool loop and returns final response in one sendAIMessage call", async () => {
    // Backend orchestration: sendAIMessage handles the entire loop internally.
    //   - scripted[0]: kickoff reply (createAIConversation)
    //   - scripted[1]: tool call for inspect_resume (backend executes it, branch not found → error result)
    //   - scripted[2]: final assistant response after seeing tool result
    const scripted = createScriptedOpenAI([
      "Nu kan vi arbeta vidare med revideringen.",
      '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```',
      "Jag har nu granskat resultatet och kan gå vidare med ett konkret förslag.",
    ]);
    setOpenAIClientForTests(scripted.client);

    const client = createIntegrationOrpcClient(baseUrl, authHeader);
    // The branch ID does not exist in the DB — the backend will execute the tool
    // and receive an error result, which it persists and forwards to the model.
    const entityId = "30000000-0000-4000-8000-000000000002";

    const conversation = await client.createAIConversation({
      entityType: "resume-revision-actions",
      entityId,
      systemPrompt: "You are an action assistant.",
      kickoffMessage: "Help me execute this revision.",
    });

    // Single sendAIMessage call — backend runs the full tool-call loop internally
    const finalReply = await client.sendAIMessage({
      conversationId: conversation.id,
      userMessage: "[[internal_autostart]] Work on the first revision task.",
    });

    expect(finalReply.role).toBe("assistant");
    expect(finalReply.content).toContain("kan gå vidare med ett konkret förslag");

    // Three OpenAI calls: kickoff + tool-call response + final response after tool result
    expect(scripted.calls.length).toBe(3);

    // Verify the backend sent the tool result (error: branch not found) into the conversation
    const toolResultCall = scripted.calls[2];
    const toolResultMessage = toolResultCall?.messages.find(
      (m) => m.role === "user" && m.content.includes('"type":"tool_result"'),
    );
    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage?.content).toContain('"toolName":"inspect_resume"');

    // Verify persisted message history
    const persistedConversation = await client.getAIConversation({
      conversationId: conversation.id,
    });

    expect(persistedConversation.messages.map((m) => m.role)).toEqual([
      "assistant", // kickoff
      "user",      // autostart message
      "assistant", // tool call
      "user",      // tool result (auto-persisted by backend)
      "assistant", // final response
    ]);
    expect(persistedConversation.messages[2]?.content).toContain('"toolName":"inspect_resume"');
    expect(persistedConversation.messages[3]?.content).toContain('"type":"tool_result"');
    expect(persistedConversation.messages[4]?.content).toContain("konkret förslag");
  });

  it("returns tool call content unchanged for write tools that require frontend execution", async () => {
    const writeToolContent =
      '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{"items":[]}}\n```';

    const scripted = createScriptedOpenAI([
      "Ready to work.",
      writeToolContent,
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

    // Write tools are not executed by backend — response is returned as-is for frontend to handle
    expect(reply.role).toBe("assistant");
    expect(reply.content).toContain('"toolName":"set_revision_work_items"');

    // Only 2 OpenAI calls: kickoff + write tool response (loop stops immediately)
    expect(scripted.calls.length).toBe(2);
  });
});
