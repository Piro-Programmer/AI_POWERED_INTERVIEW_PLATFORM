import { expect, signUp, test } from "./helpers.js";

const JOB = "Role: Platform Engineer\nKubernetes, Terraform and Go. On-call experience is a plus.";

test("share a report read-only, open it signed out, then revoke the link", async ({ page, browser }) => {
  await signUp(page);
  await page.goto("/interview");
  await page.getByLabel("The job description (required)").fill(JOB);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.getByRole("link", { name: /Practise these questions/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await page.goto(page.url().replace(/\/practice$/, ""));

  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create share link" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  expect(link).toMatch(/\/shared\/[A-Za-z0-9_-]{32}$/);
  await expect(page.getByRole("button", { name: "Shared · manage link" })).toBeVisible();

  // someone else, not signed in
  const visitor = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": "10.249.1.1" } });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(link);
  await expect(visitorPage.getByText("Read-only", { exact: true })).toBeVisible();
  await expect(visitorPage.getByRole("heading", { name: /Platform Engineer/ })).toBeVisible();
  await expect(visitorPage.getByText("How would you design feature 1 of an Express API?")).toBeVisible();
  // no owner-only actions
  await expect(visitorPage.getByRole("link", { name: /Practise these questions/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();

  await visitorPage.reload();
  await expect(visitorPage.getByText("This link doesn’t work any more.", { exact: false })).toBeVisible();
  await visitor.close();
});
