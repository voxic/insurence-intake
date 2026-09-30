"use client";

import { useLayoutEffect, useRef } from "react";

/** Stay pinned unless the reader has moved at least this far off the bottom. */
export const NEAR_BOTTOM_PX = 80;

export function transcriptContentKey(
  turns: readonly { id: string; text: string }[] | undefined,
) {
  if (!turns?.length) return "";
  return turns.map((turn) => `${turn.id}\n${turn.text}`).join("\n");
}

function distanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

/**
 * Pins a scrollport to the newest content.
 *
 * Stickiness comes from scroll events, not from the distance after paint.
 * A new line grows scrollHeight, so a post-render check looks like the
 * reader left the bottom and the view stops following.
 */
export function useFollowLatest(contentKey: string, threshold = NEAR_BOTTOM_PX) {
  const ref = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    let appliedByUs = false;
    const onScroll = () => {
      if (appliedByUs) return;
      stickRef.current = distanceFromBottom(element) <= threshold;
    };

    const follow = () => {
      if (!stickRef.current) return;
      appliedByUs = true;
      element.scrollTo({ top: element.scrollHeight });
      appliedByUs = false;
    };

    element.addEventListener("scroll", onScroll);
    follow();
    // Radix enables overflow on the viewport in an effect after this layout
    // pass. Follow again once that style is on the element.
    const frame = requestAnimationFrame(follow);

    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", onScroll);
    };
  }, [contentKey, threshold]);

  return ref;
}
