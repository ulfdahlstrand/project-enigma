import { expect, test, type Page } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";

test.use({ storageState: E2E_AUTH_FILE });

const backendBaseUrl = process.env["PLAYWRIGHT_API_URL"]
  ?? `http://127.0.0.1:${process.env["PLAYWRIGHT_BACKEND_PORT"] ?? 3101}`;

type PresentationFixture = {
  resumeId: string;
  resumeTitle: string;
};

async function bootstrapPresentationScenario(page: Page): Promise<PresentationFixture> {
  const resumeTitle = `Playwright Presentation Revision ${Date.now()}`;
  const bootstrapResponse = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle,
      consultantTitle: "Tech Lead / Senior Engineer",
      presentationParagraphs: [
        "Ulf är en teknisk ledare med lång erfarenhet av systemutveckling och avancerade tekniska roller med felstavningen tekisk.",
      ],
      skipAssignment: true,
    },
  });

  await expect(bootstrapResponse).toBeOK();
  const fixture = await bootstrapResponse.json() as Omit<PresentationFixture, "resumeTitle">;

  const scriptedAIResponse = await page.request.post(`${backendBaseUrl}/test/e2e/scripted-ai`, {
    data: {
      presentationScenario: "single-presentation-revision",
    },
  });

  await expect(scriptedAIResponse).toBeOK();
  return { ...fixture, resumeTitle };
}

test.fail("can progress from revision planning into presentation spelling actions from the resumes list", async ({ page }) => {
  const fixture = await bootstrapPresentationScenario(page);

  await page.goto("/resumes");
  await expect(page.getByRole("cell", { name: fixture.resumeTitle })).toBeVisible();
  await page.getByRole("cell", { name: fixture.resumeTitle }).click();

  await expect(page).toHaveURL(new RegExp(`/resumes/${fixture.resumeId}$`, "u"));

  await page.getByRole("button", { name: "Open edit options" }).click();
  await page.getByRole("menuitem", { name: "Revise with AI" }).click();

  await page.getByPlaceholder("Ask the AI for help…").fill("Fix spelling in the presentation");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Review presentation")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Go to actions" })).toBeEnabled();
  await page.getByRole("button", { name: "Go to actions" }).click();

  await expect(page.getByText("Fix spelling in presentation")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Review" })).toBeVisible({ timeout: 10_000 });
});
