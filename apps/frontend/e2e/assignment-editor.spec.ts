/**
 * E2E tests for inline assignment editing, creation, deletion and export.
 *
 * Covers inline assignment editing, creation (PR #483), deletion (PR #483),
 * and export dropdown behaviour.
 */
import { expect, test, type Page } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";
import { backendBaseUrl, resetE2EData } from "./support/backend";

test.use({ storageState: E2E_AUTH_FILE });

type BootstrapFixture = {
  resumeId: string;
  mainBranchId: string;
  assignmentId: string | null;
};

async function bootstrapResume(
  page: Page,
  overrides?: { skipAssignment?: boolean },
): Promise<BootstrapFixture> {
  await resetE2EData(page.request);

  const response = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle: `Playwright Assignment Editor ${Date.now()}`,
      consultantTitle: "Senior Consultant",
      presentationParagraphs: ["Experienced consultant."],
      summary: null,
      skipAssignment: overrides?.skipAssignment ?? false,
      assignments: overrides?.skipAssignment
        ? undefined
        : [{ clientName: "Acme Corp", role: "Backend Developer", description: "Built APIs." }],
    },
  });

  await expect(response).toBeOK();
  return response.json() as Promise<BootstrapFixture>;
}

/** Navigate to the resume page and activate edit mode. */
async function openResumeInEditMode(page: Page, resumeId: string) {
  await page.goto(`/resumes/${resumeId}`);
  // The page-level "Edit" button is the first one in the page header
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  // Wait until the save split button appears (exact match avoids matching "Open save actions")
  await expect(page.getByRole("button", { name: "Save", exact: true }).first()).toBeVisible();
}

/** Click the edit icon on the first assignment card. */
async function openFirstAssignmentEditForm(page: Page) {
  // Scroll assignment section into view and click the edit icon.
  // Use force to bypass any FAB overlay that may cover the icon button.
  const editBtn = page.getByRole("button", { name: "Edit" }).first();
  await editBtn.scrollIntoViewIfNeeded();
  await editBtn.click({ force: true });
  await expect(page.getByLabel("Role")).toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Inline assignment editing
// ---------------------------------------------------------------------------

test("can open an existing assignment in edit mode and change the role", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);
  await openFirstAssignmentEditForm(page);

  await page.getByLabel("Role").fill("Tech Lead");
  await page.getByRole("button", { name: "Save", exact: true }).last().click();

  await expect(page.getByRole("heading", { name: /tech lead/i })).toBeVisible({ timeout: 5_000 });
});

test("can edit all text fields of an assignment and save", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);
  await openFirstAssignmentEditForm(page);

  await page.getByLabel("Role").fill("Architect");
  await page.getByLabel("Client name").fill("Initech");
  await page.getByLabel("Description").fill("Designed the platform.");
  await page.getByLabel("Technologies").fill("Go, Kubernetes");

  await page.getByRole("button", { name: "Save", exact: true }).last().click();

  await expect(page.getByRole("heading", { name: /architect/i })).toBeVisible({ timeout: 5_000 });
});

test("cancel button discards edits and returns to read-only view", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);
  await openFirstAssignmentEditForm(page);

  await page.getByLabel("Role").fill("Should Not Save");

  await page.getByRole("button", { name: "Cancel" }).click();

  // Original role should still be visible, changed value discarded
  await expect(page.getByRole("heading", { name: /backend developer/i })).toBeVisible();
  await expect(page.getByText("Should Not Save")).not.toBeVisible();
});

test("isCurrent checkbox disables the end date field", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);
  await openFirstAssignmentEditForm(page);

  await expect(page.getByLabel("End date")).toBeVisible();

  // Check isCurrent — end date should become disabled
  await page.getByLabel("Currently active").check();
  await expect(page.getByLabel("End date")).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Inline assignment creation
// ---------------------------------------------------------------------------

test("clicking + adds a new assignment that opens immediately in edit mode", async ({ page }) => {
  // The + button requires at least one existing assignment to be visible
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);

  // Scroll + button into view (positioned outside the A4 canvas)
  const addBtn = page.getByRole("button", { name: "Add Assignment" });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  // A new edit form should appear — role and client fields visible
  await expect(page.getByLabel("Role")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("Client name")).toBeVisible();
});

test("new assignment can be saved with role, client and keywords filled in", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);

  const addBtn = page.getByRole("button", { name: "Add Assignment" });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  await expect(page.getByLabel("Role")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Role").fill("Frontend Developer");
  await page.getByLabel("Client name").fill("Globex");
  await page.getByLabel("Technologies").fill("React, TypeScript");
  await page.getByLabel("Keywords").fill("agile, ci/cd");

  await page.getByRole("button", { name: "Save", exact: true }).last().click();

  await expect(page.getByRole("heading", { name: /frontend developer/i })).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Delete assignment  (requires PR #483)
// ---------------------------------------------------------------------------

test("can delete an assignment after confirming", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);
  await openFirstAssignmentEditForm(page);

  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("button", { name: "Yes, delete" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete" }).click();

  await expect(page.getByRole("heading", { name: /backend developer/i })).not.toBeVisible({ timeout: 5_000 });
});

test("cancelling delete confirmation keeps the assignment", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await openResumeInEditMode(page, fixture.resumeId);
  await openFirstAssignmentEditForm(page);

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Yes, delete" })).toBeVisible();

  // Two "Cancel" buttons exist (edit form + delete confirmation) — click the last one
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();

  await expect(page.getByRole("button", { name: "Yes, delete" })).not.toBeVisible();
  await expect(page.getByLabel("Role")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Export dropdown
// ---------------------------------------------------------------------------

test("export dropdown shows all three format options", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await page.goto(`/resumes/${fixture.resumeId}`);

  await page.getByRole("button", { name: "Select export format" }).click();

  await expect(page.getByRole("menuitem", { name: "Export PDF" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Export Word" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Export Markdown" })).toBeVisible();
});

test("can trigger a markdown export from the dropdown", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await page.goto(`/resumes/${fixture.resumeId}`);

  const downloadPromise = page.waitForEvent("download");

  await page.getByRole("button", { name: "Select export format" }).click();
  await page.getByRole("menuitem", { name: "Export Markdown" }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/u);
});

test("can trigger a PDF export from the main export button", async ({ page }) => {
  const fixture = await bootstrapResume(page);

  await page.goto(`/resumes/${fixture.resumeId}`);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.pdf$/u);
});
