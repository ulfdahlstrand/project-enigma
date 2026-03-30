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

describe("revision planning AI integration", () => {
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

  it("stores kickoff greeting and deterministic tool-call response from scripted OpenAI", async () => {
    const scripted = createScriptedOpenAI([
      "Hej! Jag kan hjälpa dig att planera revideringen.",
      '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```',
    ]);
    setOpenAIClientForTests(scripted.client);

    const client = createIntegrationOrpcClient(baseUrl, authHeader);
    const entityId = "30000000-0000-4000-8000-000000000001";

    const conversation = await client.createAIConversation({
      entityType: "resume-revision-planning",
      entityId,
      systemPrompt: "You are a planning assistant.",
      kickoffMessage: "Help me plan a revision flow.",
    });

    expect(conversation.entityType).toBe("resume-revision-planning");
    expect(scripted.calls).toHaveLength(1);
    expect(scripted.calls[0]?.messages).toEqual([
      { role: "system", content: "You are a planning assistant." },
      { role: "user", content: "Help me plan a revision flow." },
    ]);

    const afterKickoff = await client.getAIConversation({
      conversationId: conversation.id,
    });

    expect(afterKickoff.messages).toHaveLength(1);
    expect(afterKickoff.messages[0]?.role).toBe("assistant");
    expect(afterKickoff.messages[0]?.content).toBe("Hej! Jag kan hjälpa dig att planera revideringen.");

    const assistantReply = await client.sendAIMessage({
      conversationId: conversation.id,
      userMessage: "I want to fix spelling in my assignments.",
    });

    expect(assistantReply.role).toBe("assistant");
    expect(assistantReply.content).toContain('"toolName":"inspect_resume"');
    expect(scripted.calls).toHaveLength(2);
    expect(scripted.calls[1]?.messages).toEqual([
      { role: "system", content: "You are a planning assistant." },
      { role: "assistant", content: "Hej! Jag kan hjälpa dig att planera revideringen." },
      { role: "user", content: "I want to fix spelling in my assignments." },
    ]);

    const persistedConversation = await client.getAIConversation({
      conversationId: conversation.id,
    });

    expect(persistedConversation.messages).toHaveLength(3);
    expect(persistedConversation.messages.map((message) => message.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
    expect(persistedConversation.messages[2]?.content).toContain('"toolName":"inspect_resume"');
  });
});
