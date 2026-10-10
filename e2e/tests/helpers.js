import { test as base, expect } from "@playwright/test";

const octet = () => Math.floor(Math.random() * 250) + 1;

// Each test acts as its own client IP, as Vercel's proxy reports it in
// X-Forwarded-For in production, so the per-IP limits (e.g. 10 sign-ups an
// hour) apply per test rather than to the whole suite.
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ ...extraHTTPHeaders, "X-Forwarded-For": `10.${octet()}.${octet()}.${octet()}` });
  }
});

export { expect };

export const PASSWORD = "e2e-pass-123";

let counter = 0;

/** A unique user for this test, so tests can run in parallel. */
export const newUser = () => {
  counter += 1;
  const id = `${Date.now().toString(36)}${process.pid}${counter}`;
  return { username: `e2e${id}`, email: `e2e${id}@example.test`, password: PASSWORD };
};

/** Create an account through the register page; ends on the dashboard. */
export async function signUp(page, user = newUser()) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return user;
}
