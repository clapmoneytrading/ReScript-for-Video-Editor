import { expect, test } from "@playwright/test";
import { openSampleProject, words } from "./helpers";

test("clicking a word and pressing Delete cuts it; undo restores it", async ({ page }) => {
  await openSampleProject(page);

  const target = words(page).nth(2); // "one"
  await expect(target).toHaveText(/one/);
  await target.click();
  await page.keyboard.press("Delete");

  await expect(target).toHaveAttribute("data-cut", "");
  await expect(page.locator("[data-wid][data-cut]")).toHaveCount(1);

  await page.keyboard.press("Control+z");
  await expect(page.locator("[data-wid][data-cut]")).toHaveCount(0);
});

test("search box selects every match and removes them in one action", async ({ page }) => {
  await openSampleProject(page);

  const search = page.getByPlaceholder(/find a word/i);
  await search.fill("okay, two");
  await expect(page.getByText(/3 matches/)).toBeVisible();

  await page.getByRole("button", { name: /^remove$/i }).click();

  const cut = page.locator("[data-wid][data-cut]");
  await expect(cut).toHaveCount(3);
  for (const text of await cut.allTextContents()) {
    expect(text.trim()).toMatch(/^(okay|two)$/i);
  }
  // Nothing left to match once they are cut.
  await expect(page.getByText(/0 matches/)).toBeVisible();
});
