import { describe, expect, it } from "vitest";
import { ORPCError } from "@orpc/server";
import { getExternalAIContext } from "./external-ai-context.js";

const CONTEXT = {
  user: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    azure_oid: "entra-oid-1",
    email: "consultant@example.com",
    name: "Consultant Example",
    role: "consultant" as const,
    created_at: new Date("2026-01-01T00:00:00Z"),
  },
};

describe("getExternalAIContext", () => {
  it("returns external-safe context for regular authenticated users", () => {
    const result = getExternalAIContext(CONTEXT, [
      {
        key: "shared-resume-guidance",
        title: "Shared resume revision guidance",
        purpose: "Shared instructions",
        appliesToSections: ["presentation", "assignments"],
        fragments: [{ key: "base_prompt", label: "Base prompt", content: "Shared prompt" }],
      },
    ]);
    expect(result.guidanceVersion).toBe("external-ai-context-v2");
    expect(result.client).toBeNull();
    expect(result.scopes).toEqual(["ai:context:read"]);
    expect(result.sharedGuidance.map((entry) => entry.key)).toContain("same-language");
    expect(result.promptGuidance[0]?.key).toBe("shared-resume-guidance");
    expect(result.promptModel.base.prompt).toBe("Shared prompt");
    expect(result.promptModel.consultant.supported).toBe(false);
    expect(result.supportedResumeSections).toContain("assignments");
    expect(result.allowedRoutes).toHaveLength(1);
  });

  it("includes the connected client when called through an external ai token", () => {
    const result = getExternalAIContext({
      ...CONTEXT,
      externalAI: {
        tokenId: "token-1",
        authorizationId: "auth-1",
        clientId: "client-1",
        clientKey: "anthropic_claude",
        clientTitle: "Anthropic Claude",
        clientDescription: "Claude client",
        scopes: ["ai:context:read", "resume:read", "resume-commit:read"],
      },
    }, []);

    expect(result.client?.key).toBe("anthropic_claude");
    expect(result.scopes).toEqual(["ai:context:read", "resume:read", "resume-commit:read"]);
    expect(result.allowedRoutes.map((route) => route.path)).toContain("/resumes/{resumeId}");
    expect(result.allowedRoutes.map((route) => route.path)).toContain("/resume-commits/{commitId}");
    expect(result.promptModel.agents).toEqual([]);
  });

  it("throws FORBIDDEN when an external token lacks context scope", () => {
    expect(() =>
      getExternalAIContext({
        ...CONTEXT,
        externalAI: {
          tokenId: "token-1",
          authorizationId: "auth-1",
          clientId: "client-1",
          clientKey: "anthropic_claude",
          clientTitle: "Anthropic Claude",
          clientDescription: "Claude client",
          scopes: [],
        },
      }, []),
    ).toThrowError(ORPCError);
  });
});
