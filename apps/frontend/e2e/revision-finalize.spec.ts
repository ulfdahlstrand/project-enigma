import { expect, test, type Page } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";
import { backendBaseUrl, resetE2EData } from "./support/backend";

test.use({ storageState: E2E_AUTH_FILE });

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
  await resetE2EData(page.request);

  const bootstrapResponse = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle: "Playwright Finalize Resume",
      consultantTitle: "Tech Lead / Senior Engineer",
      presentationParagraphs: ["Playwright presentation paragraph with original wording."],
      summary: "Original summary for branch resume.",
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

test("can leave a revision branch session, reload it, and keep editable branch content", async ({ page }) => {
  const fixture = await bootstrapSingleAssignmentScenario(page);

  await page.goto(`/resumes/${fixture.resumeId}`);
  await page.getByRole("button", { name: "Open edit options" }).click();
  await page.getByRole("menuitem", { name: "Revise with AI" }).click();

  await page.getByPlaceholder("Ask the AI for help…").fill("Fix spelling in my assignment");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Review Payer assignment")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Go to actions" }).click();

  await expect(page.getByText("Fix spelling in Payer assignment")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/branchId=/u);

  const currentUrl = new URL(page.url());
  const branchId = currentUrl.searchParams.get("branchId");
  expect(branchId).toBeTruthy();

  const consultantTitleInput = page.locator("main input:visible").first();
  const coverTextareas = page.locator("main textarea:visible");

  await consultantTitleInput.fill("Principal Engineer");
  await coverTextareas
    .nth(0)
    .fill("Updated presentation paragraph for branch resume.");
  await coverTextareas
    .nth(1)
    .fill("Updated summary for branch resume.");
  await page
    .getByLabel("Highlighted experience")
    .fill("First highlighted branch item\nSecond highlighted branch item");

  await page.getByRole("button", { name: "Edit" }).click();
  await page
    .getByLabel("Description")
    .fill("Updated assignment description that should remain on the branch.");
  await page.getByRole("button", { name: "Save" }).nth(2).click();
  await page.getByRole("group").getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Updated assignment description that should remain on the branch.")).toBeVisible({
    timeout: 10_000,
  });

  await page.goto("/employees");
  await page.goto(`/resumes/${fixture.resumeId}?branchId=${branchId}`);

  await expect(page.getByRole("heading", { name: "Revision checklist" })).toBeVisible();
  await expect(page.locator("main input:visible").first()).toHaveValue("Principal Engineer");
  await expect(page.locator("main textarea:visible").nth(0)).toHaveValue("Updated presentation paragraph for branch resume.");
  await expect(page.locator("main textarea:visible").nth(1)).toHaveValue("Updated summary for branch resume.");
  await expect(page.getByLabel("Highlighted experience")).toHaveValue(
    "First highlighted branch item\nSecond highlighted branch item",
  );
  await expect(page.getByText("Updated assignment description that should remain on the branch.")).toBeVisible();
  await expect(page.getByText("First highlighted branch item")).toBeVisible();
  await expect(page.getByText("Second highlighted branch item")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Description")).toBeVisible();
});
