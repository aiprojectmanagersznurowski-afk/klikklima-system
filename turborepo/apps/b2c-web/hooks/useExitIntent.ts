import { useEffect, useState, useRef } from "react";

interface ExitIntentOptions {
  threshold?: number;
  mobileScrollUpThreshold?: number;
  inactivityDelayMs?: number;
}

export function useExitIntent(onExitIntent: () => void, options: ExitIntentOptions = {}) {
  const {
    threshold = 20,
    mobileScrollUpThreshold = 150,
    inactivityDelayMs = 45000, // 45 seconds of inactivity
  } = options;

  const [hasFired, setHasFired] = useState(false);
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(0);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run on client, and skip if already fired
    if (hasFired || typeof window === "undefined") return;

    const trigger = () => {
      setHasFired(true);
      onExitIntent();
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= threshold && !hasFired) {
        trigger();
      }
    };

    const handleScroll = () => {
      if (hasFired) return;
      
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      
      if (currentScrollY < lastScrollY.current) {
        const distance = lastScrollY.current - currentScrollY;
        const timeDiff = currentTime - lastScrollTime.current;
        const velocity = distance / (timeDiff || 1);
        
        // Fast scroll up
        if (distance > mobileScrollUpThreshold && velocity > 0.8) {
          trigger();
        }
      }

      lastScrollY.current = currentScrollY;
      lastScrollTime.current = currentTime;
      resetInactivityTimer();
    };

    const handleInteraction = () => {
      resetInactivityTimer();
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = setTimeout(() => {
        if (!hasFired) {
          trigger();
        }
      }, inactivityDelayMs);
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("mousemove", handleInteraction, { passive: true });
    document.addEventListener("touchstart", handleInteraction, { passive: true });
    document.addEventListener("keydown", handleInteraction, { passive: true });

    resetInactivityTimer();

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousemove", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [hasFired, onExitIntent, threshold, mobileScrollUpThreshold, inactivityDelayMs]);

  return { hasFired, reset: () => setHasFired(false) };
}
