import { describe, expect, it } from "vitest";
import {
  formatExternalAIContextMarkdown,
  interpolatePath,
  selectAllowedToolDefinitions,
  stripPathParams,
} from "./external-ai-mcp.js";

describe("external-ai-mcp helpers", () => {
  it("interpolates path params", () => {
    expect(
      interpolatePath("/resumes/{resumeId}/branches/{branchId}", {
        resumeId: "resume-1",
        branchId: "branch-1",
      }),
    ).toBe("/resumes/resume-1/branches/branch-1");
  });

  it("strips path params from request body", () => {
    expect(
      stripPathParams("/resumes/{resumeId}/branches/{branchId}/assignments/{id}", {
        resumeId: "resume-1",
        branchId: "branch-1",
        id: "assignment-1",
        role: "Developer",
        highlight: true,
      }),
    ).toEqual({
      role: "Developer",
      highlight: true,
    });
  });

  it("selects tools from allowed routes", () => {
    const selected = selectAllowedToolDefinitions([
      {
        method: "GET",
        path: "/resumes/{resumeId}/branches/{branchId}",
        requiredScope: "resume-branch:read",
        purpose: "Read branch",
      },
      {
        method: "GET",
        path: "/resume-branches/{branchId}/assignments",
        requiredScope: "branch-assignment:read",
        purpose: "List assignments",
      },
      {
        method: "POST",
        path: "/resume-branches/{branchId}/commits",
        requiredScope: "resume-commit:write",
        purpose: "Save commit",
      },
    ]);

    expect(selected.map((tool) => tool.name)).toEqual([
      "get_resume_branch",
      "list_resume_branch_assignments",
      "save_resume_version",
    ]);
  });

  it("formats external context as markdown with token lifecycle", () => {
    const markdown = formatExternalAIContextMarkdown({
      guidanceVersion: "external-ai-context-v2",
      generatedAt: "2026-04-12T00:00:00.000Z",
      client: {
        id: "d0ed72c0-6e50-4d72-81b6-24a87c990eb0",
        key: "openai_chatgpt",
        title: "OpenAI ChatGPT",
        description: null,
        isActive: true,
      },
      scopes: ["ai:context:read"],
      workflow: {
        type: "external_api_revision",
        steps: ["Fetch context first."],
      },
      allowedRoutes: [
        {
          method: "GET",
          path: "/external-ai/context",
          requiredScope: "ai:context:read",
          purpose: "Read context",
        },
      ],
      sharedGuidance: [{ key: "tone", title: "Tone", content: "Keep it concise." }],
      safetyGuidance: [{ key: "truth", title: "Truth", content: "Do not invent facts." }],
      promptGuidance: [],
      promptModel: {
        base: {
          prompt: "Base prompt",
          rules: "Base rules",
          validators: null,
          workflow: null,
          contextRequirements: null,
          outputContract: null,
        },
        agents: [],
        consultant: {
          supported: false,
          note: "No preferences set",
          layers: {
            prompt: null,
            rules: null,
            validators: null,
            workflow: null,
            contextRequirements: null,
            outputContract: null,
          },
          updatedAt: null,
        },
      },
      supportedResumeSections: ["presentation"],
    });

    expect(markdown).toContain("External AI Revision Context");
    expect(markdown).toContain("GET /external-ai/context");
    expect(markdown).toContain("Token Lifecycle");
    expect(markdown).toContain("POST /auth/external-ai/token/refresh");
  });
});
