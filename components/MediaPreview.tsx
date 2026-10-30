"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/store";
import { cutRangeAt, PLAYHEAD_EPSILON_S } from "@/lib/edits";
import { useCutRanges } from "@/hooks/useCutRanges";
import { useI18n } from "./I18nProvider";

/**
 * Owns the <video>/<audio> element and the cut-skipping playback loop.
 * In video mode this is the visual preview; in audio mode it mounts a hidden
 * <audio> so playback still works when the preview panel is omitted.
 */
export default function MediaPreview() {
  const { t } = useI18n();
  const mediaUrl = useEditorStore((s) => s.mediaUrl);
  const mediaKind = useEditorStore((s) => s.mediaKind);
  const previewStatus = useEditorStore((s) => s.previewStatus);
  const previewProgress = useEditorStore((s) => s.previewProgress);
  const markPreviewUnsupported = useEditorStore((s) => s.markPreviewUnsupported);
  const setVideoEl = useEditorStore((s) => s.setVideoEl);
  const setDuration = useEditorStore((s) => s.setDuration);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const cuts = useCutRanges();

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const isAudio = mediaKind === "audio";
  const cutsRef = useRef(cuts);
  useEffect(() => {
    cutsRef.current = cuts;
  }, [cuts]);

  const refCb = useCallback(
    (el: HTMLMediaElement | null) => {
      mediaRef.current = el;
      setVideoEl(el);
    },
    [setVideoEl]
  );

  // Playback loop: mirror time into the store and skip over cut ranges.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const media = mediaRef.current;
      if (media) {
        let t = media.currentTime;
        if (!media.paused) {
          const cut = cutRangeAt(t, cutsRef.current);
          if (cut) {
            const target = cut.end + PLAYHEAD_EPSILON_S;
            if (target >= media.duration - 0.05) {
              media.pause();
              media.currentTime = cut.start;
              t = cut.start;
            } else {
              media.currentTime = target;
              t = target;
            }
          }
        }
        const prev = useEditorStore.getState().currentTime;
        if (Math.abs(prev - t) > 0.005) setCurrentTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [setCurrentTime]);

  const togglePlay = useCallback(() => {
    useEditorStore.getState().togglePlayback();
  }, []);

  // MEDIA_ERR_SRC_NOT_SUPPORTED (4) and MEDIA_ERR_DECODE (3) both mean the
  // browser can't play this codec; anything else (aborted, network) is not
  // fixed by re-encoding.
  const onMediaError = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const code = e.currentTarget.error?.code;
      if (code === 3 || code === 4) markPreviewUnsupported();
    },
    [markPreviewUnsupported]
  );

  // MediaRecorder WebM (and some fragmented MP4) report duration=Infinity until
  // the browser is forced to scan to the end; seeking far past the end makes
  // Chromium/Firefox compute the real value and fire `durationchange`.
  const probingRef = useRef(false);
  const onLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = e.currentTarget;
      if (Number.isFinite(media.duration)) {
        setDuration(media.duration);
        return;
      }
      probingRef.current = true;
      media.currentTime = 1e101;
    },
    [setDuration]
  );
  const onDurationChange = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = e.currentTarget;
      if (!Number.isFinite(media.duration)) return;
      setDuration(media.duration);
      if (probingRef.current) {
        probingRef.current = false;
        media.currentTime = 0;
      }
    },
    [setDuration]
  );

  if (!mediaUrl) return null;

  const converting = previewStatus === "unsupported" || previewStatus === "converting";

  if (isAudio) {
    return (
      <audio
        ref={refCb}
        src={mediaUrl}
        preload="metadata"
        onError={onMediaError}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="hidden"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50/70 p-3 sm:p-4 dark:bg-zinc-950/70">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <video
          ref={refCb}
          src={mediaUrl}
          playsInline
          onClick={togglePlay}
          onError={onMediaError}
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={onDurationChange}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="max-h-full max-w-full cursor-pointer rounded-sm bg-black shadow-lg shadow-zinc-900/10 dark:shadow-black/40"
        />
        {converting && (
          <div
            data-preview-converting
            className="absolute inset-x-0 bottom-3 mx-auto flex w-max max-w-[90%] items-center gap-2 rounded-full bg-zinc-900/85 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm dark:bg-zinc-100/90 dark:text-zinc-900"
          >
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{t("preview.converting")}</span>
            {previewStatus === "converting" && previewProgress > 0 && (
              <span className="tabular-nums opacity-70">{Math.round(previewProgress * 100)}%</span>
            )}
          </div>
        )}
        {previewStatus === "failed" && (
          <div className="absolute inset-x-0 bottom-3 mx-auto w-max max-w-[90%] rounded-full bg-red-600/90 px-3 py-1.5 text-xs text-white shadow-lg">
            {t("preview.unsupported")}
          </div>
        )}
      </div>
    </div>
  );
}
