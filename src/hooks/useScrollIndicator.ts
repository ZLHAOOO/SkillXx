import { useEffect, useRef } from "react";

/**
 * macOS-style overlay scrollbar:
 * - Hidden by default
 * - Visible while scrolling
 * - Fades out 800ms after scroll stops
 */
export function useScrollIndicator() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      document.documentElement.classList.add("scrolling");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        document.documentElement.classList.remove("scrolling");
      }, 800);
    };

    // Use capture to catch scroll events from all scrollable descendants
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
