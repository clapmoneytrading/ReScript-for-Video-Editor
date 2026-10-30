import { expect, test } from "@playwright/test";
import { openSampleProject, words } from "./helpers";

test("imports media + SRT and shows a playable, editable transcript", async ({ page }) => {
  await openSampleProject(page);

  // 11 tokens across the three cues in sample.srt.
  await expect(words(page)).toHaveCount(11);
  await expect(words(page).first()).toHaveText(/Hello/);

  // Duration landed from <video> metadata (not 0:00.0).
  const clock = page.locator("footer").getByText(/\/\s*0:0[45]\.\d/);
  await expect(clock).toBeVisible();

  // Nothing is cut yet; export is enabled.
  await expect(page.locator("[data-wid][data-cut]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^export$/i })).toBeEnabled();
});
