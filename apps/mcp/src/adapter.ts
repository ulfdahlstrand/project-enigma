import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  exchangeExternalAILoginChallengeOutputSchema,
  getExternalAIContextOutputSchema,
  refreshExternalAIAccessTokenOutputSchema,
  type ExternalAIAllowedRoute,
  type GetExternalAIContextOutput,
} from "@cv-tool/contracts";
import { z } from "zod";

const educationTypeSchema = z.enum(["degree", "certification", "language"]);

const externalAIMcpToolNameSchema = z.enum([
  "get_resume",
  "list_resume_branches",
  "get_resume_branch",
  "list_resume_branch_assignments",
  "fork_resume_branch",
  "list_resume_commits",
  "get_resume_commit",
  "compare_resume_commits",
  "update_resume_branch_content",
  "save_resume_version",
  "add_resume_branch_assignment",
  "update_resume_branch_assignment",
  "remove_resume_branch_assignment",
  "update_resume_branch_skills",
  "list_education",
  "create_education",
  "update_education",
  "delete_education",
]);

export type ExternalAIMcpToolName = z.infer<typeof externalAIMcpToolNameSchema>;

export interface ExternalAIMcpToolDefinition<TInput extends z.ZodRawShape = z.ZodRawShape> {
  name: ExternalAIMcpToolName;
  title: string;
  description: string;
  route: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
  };
  inputSchema: TInput;
}

export const externalAIMcpToolDefinitions: ExternalAIMcpToolDefinition[] = [
  {
    name: "get_resume",
    title: "Get Resume",
    description: "Read a resume and its current snapshot-backed content.",
    route: { method: "GET", path: "/resumes/{id}" },
    inputSchema: { id: z.string().uuid().describe("Resume ID") },
  },
  {
    name: "list_resume_branches",
    title: "List Resume Branches",
    description: "List available branches for a resume.",
    route: { method: "GET", path: "/resumes/{resumeId}/branches" },
    inputSchema: { resumeId: z.string().uuid().describe("Resume ID") },
  },
  {
    name: "get_resume_branch",
    title: "Get Resume Branch",
    description: "Read the current state of a specific branch directly.",
    route: { method: "GET", path: "/resumes/{resumeId}/branches/{branchId}" },
    inputSchema: {
      resumeId: z.string().uuid().describe("Resume ID"),
      branchId: z.string().uuid().describe("Branch ID"),
    },
  },
  {
    name: "list_resume_branch_assignments",
    title: "List Resume Branch Assignments",
    description: "List the full assignment entries currently present on a branch.",
    route: { method: "GET", path: "/resume-branches/{branchId}/assignments" },
    inputSchema: {
      branchId: z.string().uuid().describe("Branch ID"),
    },
  },
  {
    name: "fork_resume_branch",
    title: "Fork Resume Branch",
    description: "Create a new branch from an existing commit.",
    route: { method: "POST", path: "/resume-commits/{fromCommitId}/branches" },
    inputSchema: {
      fromCommitId: z.string().uuid().describe("Source commit ID"),
      name: z.string().min(1).describe("New branch name"),
    },
  },
  {
    name: "list_resume_commits",
    title: "List Resume Commits",
    description: "List commits on a branch.",
    route: { method: "GET", path: "/resume-branches/{branchId}/commits" },
    inputSchema: { branchId: z.string().uuid().describe("Branch ID") },
  },
  {
    name: "get_resume_commit",
    title: "Get Resume Commit",
    description: "Read a specific commit snapshot.",
    route: { method: "GET", path: "/resume-commits/{commitId}" },
    inputSchema: { commitId: z.string().uuid().describe("Commit ID") },
  },
  {
    name: "compare_resume_commits",
    title: "Compare Resume Commits",
    description: "Compare two resume commits.",
    route: { method: "POST", path: "/resume-commits/compare" },
    inputSchema: {
      fromCommitId: z.string().uuid().describe("Base commit ID"),
      toCommitId: z.string().uuid().describe("Target commit ID"),
    },
  },
  {
    name: "update_resume_branch_content",
    title: "Update Resume Branch Content",
    description: "Update branch-scoped title, presentation, summary, highlighted items, or education.",
    route: { method: "PATCH", path: "/resume-branches/{branchId}/content" },
    inputSchema: {
      branchId: z.string().uuid().describe("Branch ID"),
      title: z.string().optional(),
      consultantTitle: z.string().nullable().optional(),
      presentation: z.array(z.string()).optional(),
      summary: z.string().nullable().optional(),
      highlightedItems: z.array(z.string()).optional(),
      education: z.array(z.object({
        type: educationTypeSchema,
        value: z.string(),
        sortOrder: z.number(),
      })).optional(),
    },
  },
  {
    name: "save_resume_version",
    title: "Save Resume Version",
    description: "Create a commit on a branch.",
    route: { method: "POST", path: "/resume-branches/{branchId}/commits" },
    inputSchema: {
      branchId: z.string().uuid().describe("Branch ID"),
      title: z.string().optional(),
      description: z.string().optional(),
      consultantTitle: z.string().nullable().optional(),
      presentation: z.array(z.string()).optional(),
      summary: z.string().nullable().optional(),
      highlightedItems: z.array(z.string()).optional(),
      skillGroups: z.array(z.object({ name: z.string(), sortOrder: z.number() })).optional(),
      skills: z.array(z.object({
        name: z.string(),
        category: z.string().nullable(),
        sortOrder: z.number(),
      })).optional(),
      assignments: z.array(z.object({
        assignmentId: z.string().uuid(),
        clientName: z.string(),
        role: z.string(),
        description: z.string(),
        startDate: z.string(),
        endDate: z.string().nullable(),
        technologies: z.array(z.string()),
        isCurrent: z.boolean(),
        keywords: z.string().nullable(),
        type: z.string().nullable(),
        highlight: z.boolean(),
        sortOrder: z.number().nullable(),
      })).optional(),
    },
  },
  {
    name: "add_resume_branch_assignment",
    title: "Add Resume Branch Assignment",
    description: "Add a branch-scoped assignment under the resume/branch hierarchy.",
    route: { method: "POST", path: "/resumes/{resumeId}/branches/{branchId}/assignments" },
    inputSchema: {
      resumeId: z.string().uuid().describe("Resume ID"),
      branchId: z.string().uuid().describe("Branch ID"),
      assignmentId: z.string().uuid().optional().describe("Optional existing assignment ID"),
      clientName: z.string(),
      role: z.string(),
      description: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable().optional(),
      technologies: z.array(z.string()).optional(),
      isCurrent: z.boolean().optional(),
      highlight: z.boolean().optional(),
      sortOrder: z.number().nullable().optional(),
      type: z.string().nullable().optional(),
      keywords: z.string().nullable().optional(),
    },
  },
  {
    name: "update_resume_branch_assignment",
    title: "Update Resume Branch Assignment",
    description: "Update an existing branch-scoped assignment under the resume/branch hierarchy.",
    route: { method: "PATCH", path: "/resumes/{resumeId}/branches/{branchId}/assignments/{id}" },
    inputSchema: {
      resumeId: z.string().uuid().describe("Resume ID"),
      branchId: z.string().uuid().describe("Branch ID"),
      id: z.string().uuid().describe("Branch assignment row ID"),
      clientName: z.string().optional(),
      role: z.string().optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().nullable().optional(),
      technologies: z.array(z.string()).optional(),
      isCurrent: z.boolean().optional(),
      highlight: z.boolean().optional(),
      sortOrder: z.number().nullable().optional(),
      type: z.string().nullable().optional(),
      keywords: z.string().nullable().optional(),
    },
  },
  {
    name: "remove_resume_branch_assignment",
    title: "Remove Resume Branch Assignment",
    description: "Remove an existing branch-scoped assignment under the resume/branch hierarchy.",
    route: { method: "DELETE", path: "/resumes/{resumeId}/branches/{branchId}/assignments/{id}" },
    inputSchema: {
      resumeId: z.string().uuid().describe("Resume ID"),
      branchId: z.string().uuid().describe("Branch ID"),
      id: z.string().uuid().describe("Branch assignment row ID"),
    },
  },
  {
    name: "update_resume_branch_skills",
    title: "Update Resume Branch Skills",
    description: "Replace the branch-scoped skills and skill groups snapshot.",
    route: { method: "PATCH", path: "/resume-branches/{branchId}/skills" },
    inputSchema: {
      branchId: z.string().uuid().describe("Branch ID"),
      skillGroups: z.array(z.object({ name: z.string(), sortOrder: z.number() })),
      skills: z.array(z.object({
        name: z.string(),
        category: z.string().nullable(),
        sortOrder: z.number(),
      })),
    },
  },
  {
    name: "list_education",
    title: "List Education",
    description: "List education entries for an employee.",
    route: { method: "GET", path: "/employees/{employeeId}/education" },
    inputSchema: {
      employeeId: z.string().uuid().describe("Employee ID"),
    },
  },
  {
    name: "create_education",
    title: "Create Education",
    description: "Create an education entry for an employee.",
    route: { method: "POST", path: "/employees/{employeeId}/education" },
    inputSchema: {
      employeeId: z.string().uuid().describe("Employee ID"),
      type: educationTypeSchema,
      value: z.string(),
      sortOrder: z.number().optional(),
    },
  },
  {
    name: "update_education",
    title: "Update Education",
    description: "Update an education entry for an employee.",
    route: { method: "PATCH", path: "/employees/{employeeId}/education/{id}" },
    inputSchema: {
      employeeId: z.string().uuid().describe("Employee ID"),
      id: z.string().uuid().describe("Education ID"),
      type: educationTypeSchema.optional(),
      value: z.string().optional(),
      sortOrder: z.number().optional(),
    },
  },
  {
    name: "delete_education",
    title: "Delete Education",
    description: "Delete an education entry for an employee.",
    route: { method: "DELETE", path: "/employees/{employeeId}/education/{id}" },
    inputSchema: {
      employeeId: z.string().uuid().describe("Employee ID"),
      id: z.string().uuid().describe("Education ID"),
    },
  },
];

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function interpolatePath(pathTemplate: string, input: Record<string, unknown>) {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = input[key];

    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required path parameter: ${key}`);
    }

    return encodeURIComponent(String(value));
  });
}

export function stripPathParams(pathTemplate: string, input: Record<string, unknown>) {
  const pathParamKeys = [...pathTemplate.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);

  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => !pathParamKeys.includes(key) && value !== undefined),
  );
}

export function selectAllowedToolDefinitions(allowedRoutes: ExternalAIAllowedRoute[]) {
  const allowedRouteSet = new Set(allowedRoutes.map((route) => `${route.method} ${route.path}`));

  return externalAIMcpToolDefinitions.filter((definition) =>
    allowedRouteSet.has(`${definition.route.method} ${definition.route.path}`),
  );
}

export function formatExternalAIContextMarkdown(context: GetExternalAIContextOutput) {
  const sections: string[] = [];

  sections.push(`# External AI Revision Context`);
  sections.push(`Guidance version: ${context.guidanceVersion}`);
  sections.push(`Generated at: ${context.generatedAt}`);

  if (context.client) {
    sections.push(`Client: ${context.client.title}`);
  }

  sections.push("");
  sections.push("## Workflow");
  context.workflow.steps.forEach((step, index) => {
    sections.push(`${index + 1}. ${step}`);
  });

  sections.push("");
  sections.push("## Allowed Routes");
  context.allowedRoutes.forEach((route) => {
    sections.push(`- ${route.method} ${route.path} — ${route.purpose}`);
  });

  sections.push("");
  sections.push("## Shared Guidance");
  context.sharedGuidance.forEach((entry) => {
    sections.push(`### ${entry.title}`);
    sections.push(entry.content);
  });

  sections.push("");
  sections.push("## Safety Guidance");
  context.safetyGuidance.forEach((entry) => {
    sections.push(`### ${entry.title}`);
    sections.push(entry.content);
  });

  if (context.promptGuidance.length > 0) {
    sections.push("");
    sections.push("## Prompt Guidance");
    context.promptGuidance.forEach((entry) => {
      sections.push(`### ${entry.title}`);
      sections.push(entry.purpose);
      entry.fragments.forEach((fragment) => {
        sections.push(`- ${fragment.label}: ${fragment.content}`);
      });
    });
  }

  sections.push("");
  sections.push("## Prompt Model");
  sections.push("### Base");
  sections.push(JSON.stringify(context.promptModel.base, null, 2));
  sections.push("### Agents");
  sections.push(JSON.stringify(context.promptModel.agents, null, 2));
  sections.push("### Consultant");
  sections.push(JSON.stringify(context.promptModel.consultant, null, 2));

  sections.push("");
  sections.push("## Supported Resume Sections");
  context.supportedResumeSections.forEach((section) => {
    sections.push(`- ${section}`);
  });

  sections.push("");
  sections.push("## Token Lifecycle");
  sections.push("- The MCP adapter exchanges a one-time challenge or reuses configured tokens.");
  sections.push("- Access token refresh is handled automatically via POST /auth/external-ai/token/refresh when a refresh token is available.");

  return sections.join("\n");
}

export class ExternalAIMcpClient {
  private readonly baseUrl: string;
  private accessToken: string | null;
  private refreshToken: string | null;
  private readonly challengeId: string | null;
  private readonly challengeCode: string | null;

  constructor(input: {
    baseUrl: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    challengeId?: string | null;
    challengeCode?: string | null;
  }) {
    this.baseUrl = normalizeBaseUrl(input.baseUrl);
    this.accessToken = input.accessToken ?? null;
    this.refreshToken = input.refreshToken ?? null;
    this.challengeId = input.challengeId ?? null;
    this.challengeCode = input.challengeCode ?? null;
  }

  async initialize() {
    if (!this.accessToken) {
      await this.exchangeChallenge();
    }

    return this.getContext();
  }

  async getContext() {
    const response = await this.requestJson({
      method: "GET",
      path: "/external-ai/context",
      auth: true,
    });

    return getExternalAIContextOutputSchema.parse(response);
  }

  async callRoute(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    pathTemplate: string,
    input: Record<string, unknown>,
  ) {
    const path = interpolatePath(pathTemplate, input);
    const body = stripPathParams(pathTemplate, input);
    const hasBody = method !== "GET" && method !== "DELETE";

    return this.requestJson({
      method,
      path,
      body: hasBody ? body : undefined,
      auth: true,
    });
  }

  private async exchangeChallenge() {
    if (!this.challengeId || !this.challengeCode) {
      throw new Error(
        "External AI MCP adapter requires either an access token or a challenge ID + challenge code.",
      );
    }

    const response = await this.requestJson({
      method: "POST",
      path: "/auth/external-ai/token",
      body: {
        challengeId: this.challengeId,
        challengeCode: this.challengeCode,
      },
      auth: false,
      retryOnUnauthorized: false,
    });

    const parsed = exchangeExternalAILoginChallengeOutputSchema.parse(response);
    this.accessToken = parsed.accessToken;
    this.refreshToken = parsed.refreshToken;
  }

  private async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error("No refresh token is available for the external AI MCP adapter.");
    }

    const response = await this.requestJson({
      method: "POST",
      path: "/auth/external-ai/token/refresh",
      body: { refreshToken: this.refreshToken },
      auth: false,
      retryOnUnauthorized: false,
    });

    const parsed = refreshExternalAIAccessTokenOutputSchema.parse(response);
    this.accessToken = parsed.accessToken;
  }

  private async requestJson(input: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
    auth: boolean;
    retryOnUnauthorized?: boolean;
  }): Promise<unknown> {
    const retryOnUnauthorized = input.retryOnUnauthorized ?? true;
    const requestInit: RequestInit = {
      method: input.method,
      headers: {
        ...(input.auth && this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
        ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
    };

    if (input.body !== undefined) {
      requestInit.body = JSON.stringify(input.body);
    }

    const response = await fetch(`${this.baseUrl}${input.path}`, requestInit);

    if (response.status === 401 && input.auth && retryOnUnauthorized && this.refreshToken) {
      await this.refreshAccessToken();

      return this.requestJson({
        ...input,
        retryOnUnauthorized: false,
      });
    }

    const text = await response.text();
    const payload = text.length > 0 ? safeParseJson(text) : null;

    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : text || `Request failed with status ${response.status}`;

      throw new Error(`${input.method} ${input.path} failed: ${errorMessage}`);
    }

    return payload;
  }
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function buildExternalAIMcpServer(client: ExternalAIMcpClient) {
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

  return server;
}
