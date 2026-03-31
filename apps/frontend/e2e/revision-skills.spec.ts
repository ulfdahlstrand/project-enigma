import { expect, test, type Page } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";
import { backendBaseUrl, resetE2EData } from "./support/backend";

test.use({ storageState: E2E_AUTH_FILE });

type SkillsFixture = {
  resumeId: string;
};

type RevisionState = {
  mainSkills: Array<{ name: string; category: string | null; sortOrder: number }>;
};

async function bootstrapSkillsScenario(page: Page): Promise<SkillsFixture> {
  await resetE2EData(page.request);

  const bootstrapResponse = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle: `Playwright Skills Revision ${Date.now()}`,
      consultantTitle: "Engineering Manager / Staff Engineer",
      presentationParagraphs: ["Resume for skills prioritization scenario."],
      summary: "Original summary for skills prioritization scenario.",
      skipAssignment: true,
      skills: [
        { name: "Typescript", category: "Webbutveckling", sortOrder: 0 },
        { name: "React", category: "Webbutveckling", sortOrder: 1 },
        { name: "NodeJS", category: "Webbutveckling", sortOrder: 2 },
        { name: "Tanstack Query", category: "Webbutveckling", sortOrder: 3 },
        { name: "Enhetstest", category: "Test och kvalitet", sortOrder: 1000 },
        { name: "Test-driven development", category: "Test och kvalitet", sortOrder: 1001 },
        { name: "Acceptanstest", category: "Test och kvalitet", sortOrder: 1002 },
        { name: "Systemarkitektur", category: "Ledarskap och arkitektur", sortOrder: 2000 },
        { name: "Systemintegration", category: "Ledarskap och arkitektur", sortOrder: 2001 },
        { name: "Teknisk projektledning", category: "Ledarskap och arkitektur", sortOrder: 2002 },
        { name: "Testledning", category: "Ledarskap och arkitektur", sortOrder: 2003 },
      ],
    },
  });

  await expect(bootstrapResponse).toBeOK();
  const fixture = await bootstrapResponse.json() as SkillsFixture;

  const scriptedAIResponse = await page.request.post(`${backendBaseUrl}/test/e2e/scripted-ai`, {
    data: {
      skillsScenario: "skills-prioritization-revision",
    },
  });

  await expect(scriptedAIResponse).toBeOK();
  return fixture;
}

async function getRevisionState(page: Page, resumeId: string): Promise<RevisionState> {
  const response = await page.request.get(`${backendBaseUrl}/test/e2e/revision-state?resumeId=${resumeId}`);
  await expect(response).toBeOK();
  return await response.json() as RevisionState;
}

async function openInlineRevision(page: Page, resumeId: string, message: string) {
  await page.goto(`/resumes/${resumeId}`);
  await page.getByRole("button", { name: "Open edit options" }).click();
  await page.getByRole("menuitem", { name: "Revise with AI" }).click();
  await page.getByPlaceholder("Ask the AI for help…").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

async function reviewSuggestion(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  await page
    .locator("button.MuiButton-contained")
    .filter({ hasText: "Review" })
    .click();
}

async function reviewColumnHeadings(page: Page, tone: "original" | "suggested") {
  return page.getByTestId(`skills-review-${tone}-heading`).allTextContents();
}

async function reviewColumnItems(page: Page, tone: "original" | "suggested") {
  return page.getByTestId(`skills-review-${tone}-item`).allTextContents();
}

test("can reprioritize skill groups and skill order to foreground management through AI revision", async ({ page }) => {
  const fixture = await bootstrapSkillsScenario(page);

  await openInlineRevision(
    page,
    fixture.resumeId,
    "Reorder the skills so leadership and architecture are highlighted before web and test, and put the strongest coordinating skills first.",
  );

  await expect(page.getByText("Review skill group order")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Review leadership and architecture ordering")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Review web development ordering")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Review test and quality ordering")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Go to actions" }).click();

  await expect(page.getByText("Prioritize skill group order")).toBeVisible({ timeout: 10_000 });
  await reviewSuggestion(page, "Prioritize skill group order");

  await expect(page.getByRole("heading", { name: /Review suggested change/i })).toBeVisible();
  await expect(page.getByText("Only the order of the groups changes in this suggestion.")).toBeVisible();
  await expect(await reviewColumnHeadings(page, "original")).toEqual([
    "Webbutveckling",
    "Test och kvalitet",
    "Ledarskap och arkitektur",
  ]);
  await expect(await reviewColumnHeadings(page, "suggested")).toEqual([
    "Ledarskap och arkitektur",
    "Webbutveckling",
    "Test och kvalitet",
  ]);
  await page.getByRole("button", { name: "Approve suggestion" }).click();

  await expect(page.getByText("LEDARSKAP OCH ARKITEKTUR").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("p").filter({
    hasText: "Systemarkitektur, Systemintegration, Teknisk projektledning, Testledning",
  }).first()).toBeVisible();
  await expect(page.locator("p").filter({
    hasText: "Typescript, React, NodeJS, Tanstack Query",
  }).first()).toBeVisible();
  await expect(page.locator("p").filter({
    hasText: "Enhetstest, Test-driven development, Acceptanstest",
  }).first()).toBeVisible();

  await expect(page.getByText("Reorder leadership and architecture skills")).toBeVisible({ timeout: 10_000 });
  await reviewSuggestion(page, "Reorder leadership and architecture skills");
  await expect(page.getByText("Only Ledarskap och arkitektur changes in this suggestion.")).toBeVisible();
  await expect(await reviewColumnItems(page, "original")).toEqual([
    "Systemarkitektur",
    "Systemintegration",
    "Teknisk projektledning",
    "Testledning",
  ]);
  await expect(await reviewColumnItems(page, "suggested")).toEqual([
    "Teknisk projektledning",
    "Systemarkitektur",
    "Testledning",
    "Systemintegration",
  ]);
  await page.getByRole("button", { name: "Approve suggestion" }).click();

  await expect(page.locator("p").filter({
    hasText: "Teknisk projektledning, Systemarkitektur, Testledning, Systemintegration",
  }).first()).toBeVisible();
  await expect(page.locator("p").filter({
    hasText: "Typescript, React, NodeJS, Tanstack Query",
  }).first()).toBeVisible();
  await expect(page.locator("p").filter({
    hasText: "Enhetstest, Test-driven development, Acceptanstest",
  }).first()).toBeVisible();

  await expect(page.getByText("Reorder web development skills")).toBeVisible({ timeout: 10_000 });
  await reviewSuggestion(page, "Reorder web development skills");
  await expect(page.getByText("Only Webbutveckling changes in this suggestion.")).toBeVisible();
  await expect(await reviewColumnItems(page, "original")).toEqual([
    "Typescript",
    "React",
    "NodeJS",
    "Tanstack Query",
  ]);
  await expect(await reviewColumnItems(page, "suggested")).toEqual([
    "Typescript",
    "NodeJS",
    "React",
    "Tanstack Query",
  ]);
  await page.getByRole("button", { name: "Approve suggestion" }).click();

  await expect(page.locator("p").filter({
    hasText: "Teknisk projektledning, Systemarkitektur, Testledning, Systemintegration",
  }).first()).toBeVisible();
  await expect(page.locator("p").filter({
    hasText: "Typescript, NodeJS, React, Tanstack Query",
  }).first()).toBeVisible();
  await expect(page.locator("p").filter({
    hasText: "Enhetstest, Test-driven development, Acceptanstest",
  }).first()).toBeVisible();

  await expect(page.getByText("Reorder test and quality skills")).toBeVisible({ timeout: 10_000 });
  await reviewSuggestion(page, "Reorder test and quality skills");
  await expect(page.getByText("Only Test och kvalitet changes in this suggestion.")).toBeVisible();
  await expect(await reviewColumnItems(page, "original")).toEqual([
    "Enhetstest",
    "Test-driven development",
    "Acceptanstest",
  ]);
  await expect(await reviewColumnItems(page, "suggested")).toEqual([
    "Test-driven development",
    "Enhetstest",
    "Acceptanstest",
  ]);
  await page.getByRole("button", { name: "Approve suggestion" }).click();

  const managementHeading = page.getByText("LEDARSKAP OCH ARKITEKTUR").first();
  const devHeading = page.getByText("WEBBUTVECKLING").first();
  const testHeading = page.getByText("TEST OCH KVALITET").first();
  const leadershipSkills = page.locator("p").filter({
    hasText: "Teknisk projektledning, Systemarkitektur, Testledning, Systemintegration",
  }).first();
  const webSkills = page.locator("p").filter({
    hasText: "Typescript, NodeJS, React, Tanstack Query",
  }).first();
  const testSkills = page.locator("p").filter({
    hasText: "Test-driven development, Enhetstest, Acceptanstest",
  }).first();

  await expect(managementHeading).toBeVisible({ timeout: 10_000 });
  await expect(devHeading).toBeVisible({ timeout: 10_000 });
  await expect(testHeading).toBeVisible({ timeout: 10_000 });
  await expect(leadershipSkills).toBeVisible();
  await expect(webSkills).toBeVisible();
  await expect(testSkills).toBeVisible();

  await expect(page.getByRole("button", { name: "Finish action step" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Finish action step" }).click();
  await expect(page.getByText("Action step summarized")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Merge into base branch" }).click();
  await expect(page).not.toHaveURL(/branchId=/u);

  const state = await getRevisionState(page, fixture.resumeId);
  expect(state.mainSkills.map((skill) => skill.category)).toEqual([
    "Ledarskap och arkitektur",
    "Ledarskap och arkitektur",
    "Ledarskap och arkitektur",
    "Ledarskap och arkitektur",
    "Webbutveckling",
    "Webbutveckling",
    "Webbutveckling",
    "Webbutveckling",
    "Test och kvalitet",
    "Test och kvalitet",
    "Test och kvalitet",
  ]);
  expect(state.mainSkills.map((skill) => skill.name)).toEqual([
    "Teknisk projektledning",
    "Systemarkitektur",
    "Testledning",
    "Systemintegration",
    "Typescript",
    "NodeJS",
    "React",
    "Tanstack Query",
    "Test-driven development",
    "Enhetstest",
    "Acceptanstest",
  ]);
});
