import { FAKE_VERDICT } from "../server/fake-ai.mjs";
import { expect, signUp, test } from "./helpers.js";

const JOB = "Role: Backend Developer\nWe build Node.js and Express APIs on MongoDB. GraphQL and Docker are a plus.";

test("generate a report, practise a question, then delete the report", async ({ page }) => {
  await signUp(page);

  // generate
  await page.goto("/interview");
  await page.getByLabel("The job description (required)").fill(JOB);
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByRole("heading", { name: /Backend Developer/ })).toBeVisible();
  await expect(page.getByText("How would you design feature 1 of an Express API?")).toBeVisible();

  // practise one question
  await page.getByRole("link", { name: /Practise these questions/ }).click();
  await expect(page).toHaveURL(/\/reports\/[a-f0-9]{24}\/practice$/);
  await page
    .getByLabel("Your answer")
    .fill("I would model the data first, then add routes with validation, and measure latency before and after.");
  await page.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByText(FAKE_VERDICT)).toBeVisible();

  // it's listed with the user's reports
  await page.goto("/reports");
  const row = page.getByRole("link", { name: /Backend Developer/ });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(/\/reports\/[a-f0-9]{24}$/);

  // delete (accept the confirm dialog)
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete report" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByText("Nothing here yet.", { exact: false })).toBeVisible();
});

test("a report can't be opened from another account", async ({ page, browser }) => {
  await signUp(page);
  await page.goto("/interview");
  await page.getByLabel("The job description (required)").fill(JOB);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.getByRole("link", { name: /Practise these questions/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
  const reportUrl = page.url().replace(/\/practice$/, "");

  // a separate browser context = a different signed-in user
  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": "10.250.250.250" } });
  const otherPage = await other.newPage();
  await signUp(otherPage);
  await otherPage.goto(reportUrl);
  await expect(otherPage.getByText("belongs to another account", { exact: false })).toBeVisible();
  await other.close();
});
