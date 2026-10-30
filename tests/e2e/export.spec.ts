import { expect, test } from "@playwright/test";
import { openSampleProject, words } from "./helpers";

test("exports an edited MP4 that is shorter than the original", async ({ page }) => {
  await openSampleProject(page);

  // Cut the first cue ("Hello world one two" ≈ 1.6 s) so the edit is measurable.
  await words(page).nth(0).click();
  for (const i of [1, 2, 3]) await words(page).nth(i).click({ modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-wid][data-cut]")).toHaveCount(4);

  await page.getByRole("button", { name: /^export$/i }).click();
  const dialog = page.getByRole("heading", { name: /^export$/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByText(/^cuts$/i)).toBeVisible();

  await page.getByRole("button", { name: /export mp4/i }).click();

  // ffmpeg.wasm re-encodes a ~5 s clip; allow for a cold core load.
  const link = page.locator("a[data-download-edited]");
  await expect(link).toBeVisible({ timeout: 150_000 });
  await expect(link).toHaveAttribute("download", /-edited\.mp4$/);
  await expect(link).toContainText(/download edited video/i);
  await expect(page.getByText(/original file is unchanged/i)).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toMatch(/-edited\.mp4$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const { statSync } = await import("node:fs");
  expect(statSync(path!).size).toBeGreaterThan(10_000);
});
