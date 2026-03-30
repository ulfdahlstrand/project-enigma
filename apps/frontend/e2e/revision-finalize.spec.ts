import { expect, test, type Page } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";

test.use({ storageState: E2E_AUTH_FILE });

const backendBaseUrl = process.env["PLAYWRIGHT_API_URL"]
  ?? `http://127.0.0.1:${process.env["PLAYWRIGHT_BACKEND_PORT"] ?? 3101}`;

type RevisionFixture = {
  resumeId: string;
  assignmentId: string;
};

type RevisionState = {
  branches: Array<{ id: string; name: string; is_main: boolean; head_commit_id: string | null }>;
  commits: Array<{ id: string; branch_id: string | null; message: string }>;
  mainBranchId: string | null;
  mainHeadCommitId: string | null;
  mainAssignments: Array<{ assignmentId: string; description: string }>;
};

async function bootstrapSingleAssignmentScenario(page: Page): Promise<RevisionFixture> {
  const bootstrapResponse = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle: "Playwright Finalize Resume",
      assignmentClientName: "Payer",
      assignmentRole: "Fullstack developer",
      assignmentDescription: "Detta uppdrag innehåller felstavningen fakutrerings relaterade APIers.",
    },
  });

  await expect(bootstrapResponse).toBeOK();
  const fixture = await bootstrapResponse.json() as RevisionFixture;

  const scriptedAIResponse = await page.request.post(`${backendBaseUrl}/test/e2e/scripted-ai`, {
    data: {
      scenario: "single-assignment-revision",
      assignmentId: fixture.assignmentId,
    },
  });

  await expect(scriptedAIResponse).toBeOK();
  return fixture;
}

async function driveRevisionToFinalize(page: Page, resumeId: string) {
  await page.goto(`/resumes/${resumeId}`);
  await page.getByRole("button", { name: "Open edit options" }).click();
  await page.getByRole("menuitem", { name: "Revise with AI" }).click();

  await page.getByPlaceholder("Ask the AI for help…").fill("Fix spelling in my assignment");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Review Payer assignment")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Go to actions" }).click();

  await expect(page.getByRole("button", { name: "Review" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Review" }).click();

  await expect(page.getByRole("heading", { name: /Review suggested change/i })).toBeVisible();
  await page.getByRole("button", { name: "Approve suggestion" }).click();

  await expect(page.getByText(/faktureringsrelaterade API:ers\./u).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Finish action step" })).toBeEnabled();
  await page.getByRole("button", { name: "Finish action step" }).click();

  await expect(page.getByText("Action step summarized")).toBeVisible({ timeout: 10_000 });
}

async function getRevisionState(page: Page, resumeId: string): Promise<RevisionState> {
  const response = await page.request.get(`${backendBaseUrl}/test/e2e/revision-state?resumeId=${resumeId}`);
  await expect(response).toBeOK();
  return await response.json() as RevisionState;
}

test("keeps the revision branch after approving and finalizing a suggestion", async ({ page }) => {
  const fixture = await bootstrapSingleAssignmentScenario(page);

  await driveRevisionToFinalize(page, fixture.resumeId);
  await page.getByRole("button", { name: "Keep as new branch" }).click();

  await expect(page).toHaveURL(/branchId=/u);

  const state = await getRevisionState(page, fixture.resumeId);
  expect(state.branches).toHaveLength(2);
  expect(state.commits.some((commit) => commit.message === "Apply AI suggestion: Fix spelling in Payer assignment")).toBe(true);
  expect(state.mainAssignments[0]?.description).toContain("fakutrerings relaterade APIers");
});

test("merges the revision branch back into main after approving and finalizing a suggestion", async ({ page }) => {
  const fixture = await bootstrapSingleAssignmentScenario(page);

  await driveRevisionToFinalize(page, fixture.resumeId);
  await page.getByRole("button", { name: "Merge into base branch" }).click();

  await expect(page).not.toHaveURL(/branchId=/u);

  const state = await getRevisionState(page, fixture.resumeId);
  expect(state.commits.some((commit) => commit.message === "Merge inline AI revision")).toBe(true);
  expect(state.mainAssignments[0]?.description).toContain("faktureringsrelaterade API:ers.");
});
