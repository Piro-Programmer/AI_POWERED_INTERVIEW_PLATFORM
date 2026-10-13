import { expect, signUp, test } from "./helpers.js";

const NEW_PASSWORD = "brand-new-pass-9";

const signIn = async (page, email, password) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

test("change password: stays signed in, and only the new password works", async ({ page }) => {
  const user = await signUp(page);
  await page.getByRole("link", { name: "Account" }).click();

  await page.getByLabel("Current password").fill("wrong-pass-1");
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Repeat new password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert")).toHaveText("Current password is incorrect.");

  await page.getByLabel("Current password").fill(user.password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");

  // still signed in on this device
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/reports$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, user.email, user.password);
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
  await signIn(page, user.email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("delete account: removes it and signs out", async ({ page }) => {
  const user = await signUp(page);
  await page.goto("/account");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, user.email, user.password);
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
});
