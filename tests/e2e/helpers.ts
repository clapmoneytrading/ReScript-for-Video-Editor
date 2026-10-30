import { expect, type Page } from "@playwright/test";
import { join } from "node:path";

export const FIXTURES = join(__dirname, "fixtures");
export const SAMPLE_MP4 = join(FIXTURES, "sample.mp4");
export const SAMPLE_SRT = join(FIXTURES, "sample.srt");

/** The hidden media <input> on the upload screen. */
function mediaInput(page: Page) {
  return page.locator('input[type="file"][accept*="video"]').first();
}

/** The transcript header's "Replace transcript" <input> (SRT/VTT/JSON). */
function transcriptInput(page: Page) {
  return page.locator('label[title*="Replace transcript"] input[type="file"]');
}

/**
 * Open the editor with the sample video and the sample SRT, bypassing Whisper.
 * Resolves once the transcript words are rendered and the media has a duration.
 */
export async function openSampleProject(page: Page): Promise<void> {
  await page.goto("/");
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);

  await mediaInput(page).setInputFiles(SAMPLE_MP4);

  // Appears once audio extraction hands off to transcription.
  await expect(transcriptInput(page)).toBeAttached({ timeout: 120_000 });
  await transcriptInput(page).setInputFiles(SAMPLE_SRT);

  await expect(page.locator("[data-wid]").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /play \/ pause/i })).toBeEnabled({
    timeout: 60_000,
  });
}

/** Transcript word spans, optionally filtered to kept (not cut) words. */
export function words(page: Page, { kept = false } = {}) {
  return kept ? page.locator("[data-wid]:not([data-cut])") : page.locator("[data-wid]");
}
