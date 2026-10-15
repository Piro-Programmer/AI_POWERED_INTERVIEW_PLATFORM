import { E2E_ADMIN } from "../server/fixtures.js";
import { expect, signUp, test } from "./helpers.js";

test("normal users don't see the admin page", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByText("This page is for admins only.")).toBeVisible();
});

test("an admin sees site stats, finds a user, deletes them, and the audit log records it", async ({ page, browser }) => {
  // someone to manage, signed up in their own browser
  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": "10.248.2.2" } });
  const target = await signUp(await other.newPage());
  await other.close();

  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "The whole site at a glance." })).toBeVisible();
  await expect(page.getByText("Tokens today")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search users" }).fill(target.email);
  const row = page.getByRole("row").filter({ hasText: target.email });
  await expect(row).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status")).toHaveText(`Deleted ${target.username} and all their data.`);
  await expect(page.getByText("No users match that.")).toBeVisible();
  await expect(page.getByRole("list").filter({ hasText: target.email })).toContainText("e2e-admin deleted");
});
