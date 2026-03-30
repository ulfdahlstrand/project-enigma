import { expect, test, type Page } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";
import { backendBaseUrl, resetE2EData } from "./support/backend";

test.use({ storageState: E2E_AUTH_FILE });

type BootstrapFixture = {
  resumeId: string;
  assignmentId: string | null;
  assignmentIds: string[];
};

type RevisionState = {
  mainConsultantTitle: string | null;
  mainPresentation: string[];
  mainSummary: string | null;
  mainAssignments: Array<{ assignmentId: string; description: string }>;
};

async function bootstrapBaseResume(page: Page, overrides?: {
  consultantTitle?: string;
  presentationParagraphs?: string[];
  summary?: string | null;
  assignments?: Array<{ clientName: string; role: string; description: string }>;
  skipAssignment?: boolean;
  resumeTitle?: string;
}) {
  await resetE2EData(page.request);

  const response = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle: overrides?.resumeTitle ?? `Playwright Section Revision ${Date.now()}`,
      consultantTitle: overrides?.consultantTitle ?? "Tech Leaad / Senior Engineer",
      presentationParagraphs: overrides?.presentationParagraphs ?? ["Default presentation text."],
      summary: overrides?.summary ?? "Default summary text.",
      assignments: overrides?.assignments,
      skipAssignment: overrides?.skipAssignment,
    },
  });

  await expect(response).toBeOK();
  return await response.json() as BootstrapFixture;
}

async function openInlineRevision(page: Page, resumeId: string, message: string) {
  await page.goto(`/resumes/${resumeId}`);
  await page.getByRole("button", { name: "Open edit options" }).click();
  await page.getByRole("menuitem", { name: "Revise with AI" }).click();
  await page.getByPlaceholder("Ask the AI for help…").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

async function configureSectionScenario(page: Page, sectionScenario: "consultantTitle" | "summary", assignmentId?: string) {
  const response = await page.request.post(`${backendBaseUrl}/test/e2e/scripted-ai`, {
    data: {
      sectionScenario,
      assignmentId,
    },
  });

  await expect(response).toBeOK();
}

async function reviewAndApproveFirstSuggestion(page: Page) {
  const firstReviewButton = page.getByRole("button", { name: "Review" }).first();
  await expect(firstReviewButton).toBeVisible({ timeout: 10_000 });
  await firstReviewButton.click();
  await expect(page.getByRole("heading", { name: /Review suggested change/i })).toBeVisible();
  await page.getByRole("button", { name: "Approve suggestion" }).click();
}

async function reviewAndApproveSuggestion(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  const reviewButton = page.locator("button.MuiButton-contained").filter({ hasText: "Review" });
  await expect(reviewButton).toBeVisible({ timeout: 10_000 });
  await reviewButton.click();
  await expect(page.getByRole("heading", { name: /Review suggested change/i })).toBeVisible();
  await page.getByRole("button", { name: "Approve suggestion" }).click();
}

async function getRevisionState(page: Page, resumeId: string): Promise<RevisionState> {
  const response = await page.request.get(`${backendBaseUrl}/test/e2e/revision-state?resumeId=${resumeId}`);
  await expect(response).toBeOK();
  return await response.json() as RevisionState;
}

test("can fix consultant title spelling through the revision flow", async ({ page }) => {
  const fixture = await bootstrapBaseResume(page, {
    consultantTitle: "Tech Leaad / Senior Engineer",
    presentationParagraphs: ["Presentation text without spelling issues."],
    summary: "Summary text without spelling issues.",
    skipAssignment: true,
  });

  await configureSectionScenario(page, "consultantTitle");
  await openInlineRevision(page, fixture.resumeId, "Fix spelling in the consultant title");

  await expect(page.getByText("Review consultant title")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Go to actions" }).click();
  await reviewAndApproveFirstSuggestion(page);

  await expect(page.getByText("Tech Lead / Senior Engineer").first()).toBeVisible({ timeout: 10_000 });
});

test("can fix summary spelling through the revision flow", async ({ page }) => {
  const fixture = await bootstrapBaseResume(page, {
    consultantTitle: "Tech Lead / Senior Engineer",
    presentationParagraphs: ["Presentation text without spelling issues."],
    summary: "Senior engineer with korekt summary text.",
    skipAssignment: true,
  });

  await configureSectionScenario(page, "summary");
  await openInlineRevision(page, fixture.resumeId, "Fix spelling in the summary");

  await expect(page.getByText("Review summary")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Go to actions" }).click();
  await reviewAndApproveFirstSuggestion(page);

  await expect(page.getByText("Senior engineer with korrekt summary text.").first()).toBeVisible({ timeout: 10_000 });
});

test("can fix spelling across the whole CV and merge the result", async ({ page }) => {
  const fixture = await bootstrapBaseResume(page, {
    consultantTitle: "Tech Leaad / Senior Engineer",
    presentationParagraphs: ["Ulf är en teknisk ledare med felstavningen tekisk."],
    summary: "Senior engineer with korekt summary text.",
    assignments: [
      {
        clientName: "Payer",
        role: "Fullstack developer",
        description: "Detta uppdrag innehåller felstavningen fakutrerings relaterade APIers.",
      },
    ],
  });

  const scriptedResponse = await page.request.post(`${backendBaseUrl}/test/e2e/scripted-ai`, {
    data: {
      wholeCvScenario: "whole-cv-spelling-revision",
      assignmentIds: fixture.assignmentIds,
    },
  });
  await expect(scriptedResponse).toBeOK();

  await openInlineRevision(page, fixture.resumeId, "Fix all spelling errors in the whole CV");

  await expect(page.getByText("Review consultant title")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Review presentation")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Review summary")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Review assignment 1")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Go to actions" }).click();

  await expect(page.getByText("Fix spelling in consultant title")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Fix spelling in presentation")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Fix spelling in summary")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Fix spelling in assignment")).toBeVisible({ timeout: 10_000 });

  await reviewAndApproveSuggestion(page, "Fix spelling in consultant title");
  await reviewAndApproveSuggestion(page, "Fix spelling in presentation");
  await reviewAndApproveSuggestion(page, "Fix spelling in summary");
  await reviewAndApproveSuggestion(page, "Fix spelling in assignment");

  await expect(page.getByRole("button", { name: "Finish action step" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Finish action step" }).click();
  await expect(page.getByText("Action step summarized")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Merge into base branch" }).click();

  const state = await getRevisionState(page, fixture.resumeId);
  expect(state.mainConsultantTitle).toBe("Tech Lead / Senior Engineer");
  expect(state.mainPresentation[0]).toContain("teknisk");
  expect(state.mainSummary).toBe("Senior engineer with korrekt summary text.");
  expect(state.mainAssignments[0]?.description).toContain("faktureringsrelaterade API:ers.");
});
