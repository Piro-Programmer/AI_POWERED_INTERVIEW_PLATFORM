import { expect, test } from "./helpers.js";

test("landing page has link-preview tags, and links to the privacy page", async ({ page, request }) => {
  await page.goto("/");

  const meta = (selector) => page.locator(selector).getAttribute("content");
  expect(await meta('meta[property="og:title"]')).toMatch(/Interview Lab/);
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
  const image = await meta('meta[property="og:image"]');
  expect(image).toMatch(/\/og-image\.png$/);

  // the preview image itself is served (checked on this server, not production)
  const png = await request.get("/og-image.png");
  expect(png.ok()).toBe(true);
  expect(png.headers()["content-type"]).toBe("image/png");
  expect((await request.get("/robots.txt")).ok()).toBe(true);

  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "What we keep, and for how long." })).toBeVisible();
  await expect(page.getByText("Your resume.", { exact: false })).toBeVisible();
});
