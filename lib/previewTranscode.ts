"use client";

import { useEditorStore } from "./store";
import { transcodeForPreview } from "./ffmpeg";
import { reportError } from "./sentry";

/**
 * Re-encode the loaded media for the preview element once it has reported the
 * original as undecodable. Idempotent: only acts while `previewStatus` is
 * "unsupported", and bails if the file changed underneath it.
 */
export async function ensurePlayablePreview(): Promise<void> {
  const s = useEditorStore.getState();
  const file = s.videoFile;
  const kind = s.mediaKind;
  if (s.previewStatus !== "unsupported" || !file || !kind) return;
  s.setPreviewConverting(0);
  try {
    const blob = await transcodeForPreview(file, kind, (ratio) => {
      const cur = useEditorStore.getState();
      if (cur.videoFile === file && cur.previewStatus === "converting") {
        cur.setPreviewConverting(ratio);
      }
    });
    const cur = useEditorStore.getState();
    if (cur.videoFile !== file) return;
    cur.setPreviewUrl(URL.createObjectURL(blob));
  } catch (err) {
    console.error("Preview transcode failed:", err);
    reportError(err, "preview-transcode");
    const cur = useEditorStore.getState();
    if (cur.videoFile === file) cur.setPreviewFailed();
  }
}
