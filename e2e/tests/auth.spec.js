import { expect, newUser, signUp, test } from "./helpers.js";

test("register refuses a weak password, then accepts a valid one", async ({ page }) => {
  const user = newUser();
  await page.goto("/register");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);

  await page.getByLabel("Password").fill("password-only");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toHaveText("Password must contain a letter and a number.");
  await expect(page).toHaveURL(/\/register$/);

  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("signed-out users are sent to sign in; sign out and back in", async ({ page }) => {
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login$/);

  const user = await signUp(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // the old session is gone
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Password").fill("wrong-pass-1");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");

  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
