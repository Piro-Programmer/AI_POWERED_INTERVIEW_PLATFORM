import { readFileSync } from "node:fs";
import { OUTBOX } from "../server/fixtures.js";
import { expect, signUp, test } from "./helpers.js";

// the newest email sent to `to`, from the fake mail service's outbox
const lastEmailTo = (to) => {
  let lines = [];
  try {
    lines = readFileSync(OUTBOX, "utf8").trim().split("\n");
  } catch {
    return null;
  }
  return lines.map((line) => JSON.parse(line)).filter((m) => m.to === to).at(-1) ?? null;
};

test("forgot password: email link, set a new password, sign in with it", async ({ page }) => {
  const user = await signUp(page);
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that email");

  await expect.poll(() => lastEmailTo(user.email)).not.toBeNull();
  const email = lastEmailTo(user.email);
  expect(email.subject).toBe("Reset your Interview Lab password");
  const link = email.text.match(/https?:\/\/\S+\/reset-password\?token=[\w-]+/)[0];

  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password$/); // the token is taken out of the address bar
  await page.getByLabel("New password", { exact: true }).fill("reset-pass-77");
  await page.getByLabel("Repeat new password").fill("reset-pass-77");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("status")).toContainText("Your password has been changed");

  // the link works only once
  await page.goto(link);
  await page.getByLabel("New password", { exact: true }).fill("other-pass-77");
  await page.getByLabel("Repeat new password").fill("other-pass-77");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid or has expired");

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("reset-pass-77");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
