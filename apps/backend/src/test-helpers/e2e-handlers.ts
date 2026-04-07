import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { getDb } from "../db/client.js";
import { createResume } from "../domains/resume/resume/create.js";
import { saveResumeVersion } from "../domains/resume/commit/save.js";
import { createScriptedOpenAI } from "./scripted-openai.js";
import { resetOpenAIClientForTests, setOpenAIClientForTests } from "../domains/ai/lib/openai-client.js";
import {
  ensureEnabled,
  parseJsonBody,
  DEFAULT_TEST_USER_ID,
} from "./e2e-test-utils.js";
import {
  buildSingleAssignmentRevisionScenario,
  buildSinglePresentationRevisionScenario,
  buildSingleSectionRevisionScenario,
  buildWholeCvRevisionScenario,
  type SupportedSingleSection,
} from "./e2e-revision-scenarios.js";
import {
  buildSkillsPrioritizationRevisionScenario,
  buildUlfProjectManagementSkillsScenario,
} from "./e2e-skills-scenarios.js";

export async function e2eScriptedAIHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const body = await parseJsonBody<{
    responses?: string[];
    scenario?: "single-assignment-revision";
    presentationScenario?: "single-presentation-revision";
    sectionScenario?: SupportedSingleSection;
    wholeCvScenario?: "whole-cv-spelling-revision";
    skillsScenario?: "skills-prioritization-revision";
    ulfSkillsScenario?: "project-management-skills-only";
    assignmentId?: string;
    assignmentIds?: string[];
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

  if (body.sectionScenario) {
    if (body.sectionScenario === "assignment" && !body.assignmentId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "assignmentId is required for assignment section scenario" }));
      return;
    }

    setOpenAIClientForTests(buildSingleSectionRevisionScenario(body.sectionScenario, body.assignmentId).client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.sectionScenario }));
    return;
  }

  if (body.wholeCvScenario === "whole-cv-spelling-revision") {
    setOpenAIClientForTests(buildWholeCvRevisionScenario(body.assignmentIds ?? []).client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.wholeCvScenario }));
    return;
  }

  if (body.skillsScenario === "skills-prioritization-revision") {
    setOpenAIClientForTests(buildSkillsPrioritizationRevisionScenario().client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.skillsScenario }));
    return;
  }

  if (body.ulfSkillsScenario === "project-management-skills-only") {
    setOpenAIClientForTests(buildUlfProjectManagementSkillsScenario().client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.ulfSkillsScenario }));
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

export async function e2eResetHandler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const db = getDb();

  const fixtureEmployees = await db
    .selectFrom("employees")
    .select(["id"])
    .where("email", "like", "playwright-%@example.com")
    .execute();

  const fixtureEmployeeIds = fixtureEmployees.map((employee) => employee.id);

  if (fixtureEmployeeIds.length > 0) {
    await db
      .deleteFrom("employees")
      .where("id", "in", fixtureEmployeeIds)
      .execute();
  }

  await db
    .deleteFrom("user_sessions")
    .where("user_id", "=", DEFAULT_TEST_USER_ID)
    .execute();

  await db
    .deleteFrom("users")
    .where("id", "=", DEFAULT_TEST_USER_ID)
    .execute();

  resetOpenAIClientForTests();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    ok: true,
    deletedEmployees: fixtureEmployeeIds.length,
    deletedTestUser: true,
  }));
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
    summary?: string | null;
    assignmentClientName?: string;
    assignmentRole?: string;
    assignmentDescription?: string;
    assignments?: Array<{
      clientName?: string;
      role?: string;
      description?: string;
    }>;
    skills?: Array<{
      name?: string;
      category?: string | null;
      level?: string | null;
      sortOrder?: number;
    }>;
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
    .values({ id: employeeId, name: employeeName, email: employeeEmail })
    .execute();

  const resume = await createResume(db, user, {
    employeeId,
    title: body.resumeTitle ?? "Playwright Revision Resume",
    language: body.language ?? "sv",
    summary: body.summary ?? null,
  });

  const skillsToCreate = body.skills ?? [];
  const skillGroups = new Map<string, string>();
  for (const [index, skill] of skillsToCreate.entries()) {
    const groupName = skill.category?.trim() || "Other";
    let groupId = skillGroups.get(groupName);
    if (!groupId) {
      groupId = randomUUID();
      skillGroups.set(groupName, groupId);
      await db
        .insertInto("resume_skill_groups")
        .values({
          id: groupId,
          resume_id: resume.id,
          name: groupName,
          sort_order: skill.sortOrder ?? index,
        })
        .execute();
    }
    await db
      .insertInto("resume_skills")
      .values({
        id: randomUUID(),
        resume_id: resume.id,
        group_id: groupId,
        name: skill.name ?? `Skill ${index + 1}`,
        sort_order: skill.sortOrder ?? index,
      })
      .execute();
  }

  let assignmentId: string | null = null;
  const assignmentIds: string[] = [];

  const assignmentsToCreate = body.skipAssignment
    ? []
    : body.assignments && body.assignments.length > 0
      ? body.assignments
      : [{
          clientName: body.assignmentClientName ?? "Payer",
          role: body.assignmentRole ?? "Fullstack developer",
          description: body.assignmentDescription ?? "Detta uppdrag innehåller felstavningen fakutrerings relaterade APIers.",
        }];

  for (const [index, assignmentInput] of assignmentsToCreate.entries()) {
    const createdAssignmentId = randomUUID();
    assignmentIds.push(createdAssignmentId);
    assignmentId ??= createdAssignmentId;

    await db
      .insertInto("assignments")
      .values({ id: createdAssignmentId, employee_id: employeeId })
      .execute();

    await db
      .insertInto("branch_assignments")
      .values({
        branch_id: resume.mainBranchId!,
        assignment_id: createdAssignmentId,
        client_name: assignmentInput.clientName ?? `Assignment ${index + 1}`,
        role: assignmentInput.role ?? "Consultant",
        description: assignmentInput.description ?? `Assignment ${index + 1} description.`,
        start_date: new Date(`2025-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
        end_date: null,
        technologies: ["TypeScript"],
        is_current: index === 0,
        keywords: null,
        type: null,
        highlight: true,
        sort_order: index,
      })
      .execute();
  }

  const savedCommit = await saveResumeVersion(db, user, {
    branchId: resume.mainBranchId!,
    message: "bootstrap revision fixture",
    consultantTitle: body.consultantTitle ?? "Tech Lead / Senior Engineer",
    presentation: body.presentationParagraphs ?? [],
    summary: body.summary ?? null,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    employeeId,
    resumeId: resume.id,
    mainBranchId: resume.mainBranchId,
    headCommitId: savedCommit.id,
    assignmentId,
    assignmentIds,
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
    .select(["id", "branch_id", "message", "title", "description"])
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
    mainConsultantTitle: mainCommit?.content.consultantTitle ?? null,
    mainPresentation: mainCommit?.content.presentation ?? [],
    mainSummary: mainCommit?.content.summary ?? null,
    mainSkills: mainCommit?.content.skills ?? [],
    mainAssignments: mainCommit?.content.assignments ?? [],
  }));
}
