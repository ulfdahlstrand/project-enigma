import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import OpenAI from "openai";
import { improveDescription, createImproveDescriptionHandler } from "./improve.js";

// ---------------------------------------------------------------------------
// Mock OpenAI client factory
// ---------------------------------------------------------------------------

function buildClient(text: string | null): OpenAI {
  const message = text !== null ? { content: text } : { content: null };
  const create = vi.fn().mockResolvedValue({ choices: [{ message }] });
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe("improveDescription pure function", () => {
  it("returns improved description from AI response", async () => {
    const client = buildClient("Improved description text.");
    const result = await improveDescription(client, {
      description: "Built some stuff at a company.",
    });
    expect(result).toEqual({ improvedDescription: "Improved description text." });
  });

  it("throws INTERNAL_SERVER_ERROR when AI returns empty content", async () => {
    const client = buildClient(null);
    await expect(
      improveDescription(client, { description: "Built some stuff." })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });

  it("passes role and clientName as context in the prompt when provided", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Better description." } }],
    });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;

    await improveDescription(client, {
      description: "Built some stuff.",
      role: "Senior Developer",
      clientName: "Acme Corp",
    });

    expect(create).toHaveBeenCalledOnce();
    const callArgs = create.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    const userMsg = callArgs.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Senior Developer");
    expect(userMsg?.content).toContain("Acme Corp");
  });
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe("createImproveDescriptionHandler", () => {
  it("returns improved description for authenticated user", async () => {
    const client = buildClient("AI improved this description.");
    const handler = createImproveDescriptionHandler(client);

    const result = await call(
      handler,
      { description: "Original description." },
      { context: { user: { role: "admin", email: "a@example.com" } } }
    );

    expect(result).toEqual({ improvedDescription: "AI improved this description." });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const client = buildClient("Should not be reached.");
    const handler = createImproveDescriptionHandler(client);

    await expect(
      call(handler, { description: "Some description." }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });

  it("throws INTERNAL_SERVER_ERROR when AI returns empty content", async () => {
    const client = buildClient(null);
    const handler = createImproveDescriptionHandler(client);

    await expect(
      call(
        handler,
        { description: "Some description." },
        { context: { user: { role: "admin", email: "a@example.com" } } }
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });

  it("passes role and clientName as context in the prompt when provided", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Better description." } }],
    });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const handler = createImproveDescriptionHandler(client);

    await call(
      handler,
      {
        description: "Built some stuff.",
        role: "Tech Lead",
        clientName: "BigBank AB",
      },
      { context: { user: { role: "admin", email: "a@example.com" } } }
    );

    const callArgs = create.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    const userMsg = callArgs.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Tech Lead");
    expect(userMsg?.content).toContain("BigBank AB");
  });
});
