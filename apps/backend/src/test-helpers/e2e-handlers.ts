import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import type OpenAI from "openai";
import { sql } from "kysely";
import { getDb } from "../db/client.js";
import { createResume } from "../domains/resume/resume/create.js";
import { saveResumeVersion } from "../domains/resume/commit/save.js";
import { createScriptedOpenAI } from "./scripted-openai.js";
import { resetOpenAIClientForTests, setOpenAIClientForTests } from "../domains/ai/lib/openai-client.js";

const TEST_AUTH_ENABLED = process.env["ENABLE_TEST_AUTH"] === "true";
const DEFAULT_TEST_USER_ID = "40000000-0000-4000-8000-000000000001";

function getMessageText(
  content: Parameters<OpenAI["chat"]["completions"]["create"]>[0]["messages"][number]["content"] | undefined,
): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString()) as T;
}

function ensureEnabled(res: ServerResponse) {
  if (TEST_AUTH_ENABLED) {
    return true;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
  return false;
}

function buildSingleAssignmentRevisionScenario(assignmentId: string) {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Assignment revision" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Assignment revision";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att planera revideringen.";
          } else if (
            lastMessage.includes("Fix spelling in my assignment")
            || lastMessage.includes("use the available tools for this stage")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the Payer assignment","actions":[{"id":"action-payer","title":"Review Payer assignment","description":"Check the Payer assignment description for spelling issues.","status":"pending","assignmentId":"${assignmentId}"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now:")
          ) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"inspect_assignment","input":{"assignmentId":"${assignmentId}"}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"inspect_assignment"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_assignment_suggestions","input":{"workItemId":"action-payer","summary":"Suggested spelling fixes for the Payer assignment","suggestions":[{"id":"suggestion-payer","title":"Fix spelling in Payer assignment","description":"Correct the misspelled phrase in the assignment description.","section":"assignment","assignmentId":"${assignmentId}","suggestedText":"Detta uppdrag innehåller felstavningen faktureringsrelaterade API:ers.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_assignment_suggestions"')) {
            content = "Corrections proposed, ready for review.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

function buildSinglePresentationRevisionScenario() {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Presentation revision" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Presentation revision";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att planera revideringen.";
          } else if (
            lastMessage.includes("Fix spelling in the presentation")
            || lastMessage.includes("use the available tools for this stage")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the presentation","actions":[{"id":"action-presentation","title":"Review presentation","description":"Check the presentation text for spelling issues.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now:")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"presentation"}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume_section"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"Suggested spelling fix for the presentation","suggestions":[{"id":"suggestion-presentation","title":"Fix spelling in presentation","description":"Correct the misspelled word in the presentation.","section":"presentation","suggestedText":"Ulf är en teknisk ledare med lång erfarenhet av systemutveckling och avancerade tekniska roller.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_revision_suggestions"')) {
            content = "Corrections proposed, ready for review.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

export async function e2eScriptedAIHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const body = await parseJsonBody<{
    responses?: string[];
    scenario?: "single-assignment-revision";
    presentationScenario?: "single-presentation-revision";
    assignmentId?: string;
  }>(req);

  if (body.scenario === "single-assignment-revision") {
    if (!body.assignmentId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "assignmentId is required for single-assignment-revision" }));
      return;
    }

    setOpenAIClientForTests(buildSingleAssignmentRevisionScenario(body.assignmentId).client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.scenario }));
    return;
  }

  if (body.presentationScenario === "single-presentation-revision") {
    setOpenAIClientForTests(buildSinglePresentationRevisionScenario().client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.presentationScenario }));
    return;
  }

  const responses = body.responses ?? [];
  if (responses.length === 0) {
    resetOpenAIClientForTests();
  } else {
    setOpenAIClientForTests(createScriptedOpenAI(responses).client);
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, responseCount: responses.length }));
}

export async function e2eBootstrapRevisionHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const body = await parseJsonBody<{
    employeeName?: string;
    employeeEmail?: string;
    resumeTitle?: string;
    language?: string;
    presentationParagraphs?: string[];
    consultantTitle?: string | null;
    assignmentClientName?: string;
    assignmentRole?: string;
    assignmentDescription?: string;
    skipAssignment?: boolean;
  }>(req);

  const db = getDb();
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", DEFAULT_TEST_USER_ID)
    .executeTakeFirst();

  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Test user not found. Login first." }));
    return;
  }

  const employeeId = randomUUID();
  const employeeName = body.employeeName ?? "Playwright Employee";
  const employeeEmail = body.employeeEmail ?? `playwright-${employeeId}@example.com`;

  await db
    .insertInto("employees")
    .values({
      id: employeeId,
      name: employeeName,
      email: employeeEmail,
    })
    .execute();

  const resume = await createResume(db, user, {
    employeeId,
    title: body.resumeTitle ?? "Playwright Revision Resume",
    language: body.language ?? "sv",
    summary: null,
  });

  await db
    .updateTable("resumes")
    .set({
      consultant_title: body.consultantTitle ?? "Tech Lead / Senior Engineer",
      presentation: sql`${JSON.stringify(body.presentationParagraphs ?? [])}::jsonb` as unknown as string[],
    })
    .where("id", "=", resume.id)
    .execute();

  let assignmentId: string | null = null;

  if (!body.skipAssignment) {
    assignmentId = randomUUID();
    await db
      .insertInto("assignments")
      .values({
        id: assignmentId,
        employee_id: employeeId,
      })
      .execute();

    await db
      .insertInto("branch_assignments")
      .values({
        branch_id: resume.mainBranchId!,
        assignment_id: assignmentId,
        client_name: body.assignmentClientName ?? "Payer",
        role: body.assignmentRole ?? "Fullstack developer",
        description: body.assignmentDescription ?? "Detta uppdrag innehåller felstavningen fakutrerings relaterade APIers.",
        start_date: new Date("2025-01-01T00:00:00.000Z"),
        end_date: null,
        technologies: ["TypeScript"],
        is_current: true,
        keywords: null,
        type: null,
        highlight: true,
        sort_order: 0,
      })
      .execute();
  }

  const savedCommit = await saveResumeVersion(db, user, {
    branchId: resume.mainBranchId!,
    message: "bootstrap revision fixture",
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    employeeId,
    resumeId: resume.id,
    mainBranchId: resume.mainBranchId,
    headCommitId: savedCommit.id,
    assignmentId,
  }));
}

export async function e2eRevisionStateHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const requestUrl = new URL(req.url ?? "", "http://127.0.0.1");
  const resumeId = requestUrl.searchParams.get("resumeId");

  if (!resumeId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "resumeId is required" }));
    return;
  }

  const db = getDb();
  const branches = await db
    .selectFrom("resume_branches")
    .select(["id", "name", "is_main", "head_commit_id"])
    .where("resume_id", "=", resumeId)
    .orderBy("created_at", "asc")
    .execute();

  const commits = await db
    .selectFrom("resume_commits")
    .select(["id", "branch_id", "message"])
    .where("resume_id", "=", resumeId)
    .orderBy("created_at", "asc")
    .execute();

  const mainBranch = branches.find((branch) => branch.is_main);
  const mainCommit = mainBranch?.head_commit_id
    ? await db
        .selectFrom("resume_commits")
        .select(["id", "content"])
        .where("id", "=", mainBranch.head_commit_id)
        .executeTakeFirst()
    : null;

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    branches,
    commits,
    mainBranchId: mainBranch?.id ?? null,
    mainHeadCommitId: mainBranch?.head_commit_id ?? null,
    mainAssignments: mainCommit?.content.assignments ?? [],
  }));
}
