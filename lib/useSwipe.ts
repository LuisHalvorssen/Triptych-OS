"use client";

import { useCallback, useRef, useState } from "react";

interface Options {
  onCompleteRight?: () => void;
  onCompleteLeft?: () => void;
  /** distance in px before a swipe counts as committed. Default 80. */
  threshold?: number;
  /** abort the gesture if vertical movement exceeds this (px). Default 30. */
  maxVerticalDrift?: number;
  /** disable on non-touch devices. Default true. */
  touchOnly?: boolean;
}

interface State {
  dx: number;
  active: boolean;
  direction: "left" | "right" | null;
}

interface Result {
  state: State;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
  };
}

/**
 * Minimal left/right swipe gesture hook. Touch-only (pointer-less devices).
 * Caller reads `state.dx` to render the visual translate while swiping.
 * Fires `onCompleteRight` / `onCompleteLeft` once the user lifts their finger
 * past the threshold.
 */
export function useSwipe({
  onCompleteRight,
  onCompleteLeft,
  threshold = 80,
  maxVerticalDrift = 30,
  touchOnly = true,
}: Options): Result {
  const [state, setState] = useState<State>({
    dx: 0,
    active: false,
    direction: null,
  });
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const abortedRef = useRef(false);

  const reset = useCallback(() => {
    startRef.current = null;
    abortedRef.current = false;
    setState({ dx: 0, active: false, direction: null });
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (touchOnly && typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
        return;
      }
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
      abortedRef.current = false;
      setState({ dx: 0, active: true, direction: null });
    },
    [touchOnly]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startRef.current || abortedRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;
      if (Math.abs(dy) > maxVerticalDrift) {
        abortedRef.current = true;
        setState({ dx: 0, active: false, direction: null });
        return;
      }
      const direction = dx > 0 ? "right" : dx < 0 ? "left" : null;
      setState({ dx, active: true, direction });
    },
    [maxVerticalDrift]
  );

  const onTouchEnd = useCallback(() => {
    if (!startRef.current || abortedRef.current) {
      reset();
      return;
    }
    const { dx } = state;
    if (dx >= threshold && onCompleteRight) {
      onCompleteRight();
    } else if (dx <= -threshold && onCompleteLeft) {
      onCompleteLeft();
    }
    reset();
  }, [state, threshold, onCompleteRight, onCompleteLeft, reset]);

  return {
    state,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
  };
}
