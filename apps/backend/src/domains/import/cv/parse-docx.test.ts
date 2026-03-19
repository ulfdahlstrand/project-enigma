import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type OpenAI from "openai";
import { parseCvDocx, createParseCvDocxHandler } from "./parse-docx.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CV_JSON = {
  consultant: { name: "Jane Doe", title: "Engineer", presentation: ["Expert"] },
  skills: { Languages: ["TypeScript"] },
  education: { degrees: ["BSc CS"], certifications: [], languages: ["English"] },
  assignments: [
    {
      client: "Acme",
      role: "Developer",
      period: "2022-2023",
      description: "Built things\n\nEverything\n\nSuccess",
      technologies: ["TypeScript"],
      keywords: ["backend"],
    },
  ],
};

function buildOpenAIMock(content: string | null, finishReason = "stop") {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ finish_reason: finishReason, message: { content } }],
        }),
      },
    },
  } as unknown as OpenAI;
}

// A minimal real DOCX in base64 that mammoth can parse (contains "Hello" text).
// We use a vi.mock to avoid needing a real file in tests.
vi.mock("mammoth", () => ({
  default: {
    convertToHtml: vi.fn().mockResolvedValue({ value: "<p>Jane Doe — Senior Engineer</p><p>Acme 2022-2023</p>" }),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseCvDocx", () => {
  it("returns parsed cvJson on valid AI response", async () => {
    const client = buildOpenAIMock(JSON.stringify(VALID_CV_JSON));
    const result = await parseCvDocx(client, { docxBase64: "dGVzdA==", language: "en" });
    expect(result.cvJson.consultant.name).toBe("Jane Doe");
    expect(result.cvJson.assignments).toHaveLength(1);
  });

  it("throws INTERNAL_SERVER_ERROR when AI returns empty content", async () => {
    const client = buildOpenAIMock(null);
    await expect(
      parseCvDocx(client, { docxBase64: "dGVzdA==", language: "en" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });

  it("throws INTERNAL_SERVER_ERROR when AI returns invalid JSON", async () => {
    const client = buildOpenAIMock("not json at all");
    await expect(
      parseCvDocx(client, { docxBase64: "dGVzdA==", language: "en" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });

  it("throws INTERNAL_SERVER_ERROR when AI response is truncated (finish_reason: length)", async () => {
    const client = buildOpenAIMock(JSON.stringify(VALID_CV_JSON), "length");
    await expect(
      parseCvDocx(client, { docxBase64: "dGVzdA==", language: "en" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });

  it("coerces array description field to string", async () => {
    const withArrayDescription = {
      ...VALID_CV_JSON,
      assignments: [
        {
          ...VALID_CV_JSON.assignments[0],
          description: ["paragraph one", "paragraph two"],
        },
      ],
    };
    const client = buildOpenAIMock(JSON.stringify(withArrayDescription));
    const result = await parseCvDocx(client, { docxBase64: "dGVzdA==", language: "en" });
    expect(typeof result.cvJson.assignments[0]!.description).toBe("string");
    expect(result.cvJson.assignments[0]!.description).toContain("paragraph one");
    expect(result.cvJson.assignments[0]!.description).toContain("paragraph two");
  });

  it("throws when AI returns JSON that does not match cvJsonSchema", async () => {
    const client = buildOpenAIMock(JSON.stringify({ wrong: "structure" }));
    await expect(
      parseCvDocx(client, { docxBase64: "dGVzdA==", language: "en" })
    ).rejects.toThrow();
  });
});

describe("createParseCvDocxHandler", () => {
  it("returns result when authenticated", async () => {
    const client = buildOpenAIMock(JSON.stringify(VALID_CV_JSON));
    const handler = createParseCvDocxHandler(client);
    const result = await call(
      handler,
      { docxBase64: "dGVzdA==", language: "en" },
      { context: { user: { role: "admin", email: "a@example.com" } } }
    );
    expect(result.cvJson).toBeDefined();
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const client = buildOpenAIMock(JSON.stringify(VALID_CV_JSON));
    const handler = createParseCvDocxHandler(client);
    await expect(
      call(handler, { docxBase64: "dGVzdA==", language: "en" }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
