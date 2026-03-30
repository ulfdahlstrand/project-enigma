import { expect, test } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";
import { backendBaseUrl, resetE2EData } from "./support/backend";

test.use({ storageState: E2E_AUTH_FILE });

test("can open inline revision and generate a plan for a seeded resume", async ({ page }) => {
  await resetE2EData(page.request);

  const bootstrapResponse = await page.request.post(`${backendBaseUrl}/test/e2e/bootstrap-revision`, {
    data: {
      resumeTitle: "Playwright Revision Resume",
      assignmentClientName: "Payer",
      assignmentRole: "Fullstack developer",
      assignmentDescription: "Detta uppdrag innehåller felstavningen fakutrerings relaterade APIers.",
    },
  });

  await expect(bootstrapResponse).toBeOK();
  const fixture = await bootstrapResponse.json() as { resumeId: string; assignmentId: string };

  const scriptedAIResponse = await page.request.post(`${backendBaseUrl}/test/e2e/scripted-ai`, {
    data: {
      responses: [
        "Hej! Jag kan hjälpa dig att planera revideringen.",
        '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```',
        `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the Payer assignment","actions":[{"id":"action-payer","title":"Review Payer assignment","description":"Check the Payer assignment description for spelling issues.","status":"pending","assignmentId":"${fixture.assignmentId}"}]}}
\`\`\``,
        "The revision plan is ready for review.",
        "Payer assignment revision plan",
      ],
    },
  });

  await expect(scriptedAIResponse).toBeOK();

  await page.goto(`/resumes/${fixture.resumeId}`);
  await page.getByRole("button", { name: "Open edit options" }).click();
  await page.getByRole("menuitem", { name: "Revise with AI" }).click();

  await expect(page.getByRole("heading", { name: "Revision checklist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI revision chat" })).toBeVisible();

  await page.getByPlaceholder("Ask the AI for help…").fill("Fix spelling in my assignment");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Review Payer assignment")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Go to actions" })).toBeEnabled();
});
