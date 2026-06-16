import { useEffect, useState } from "react";

export function useExitIntent(onExitIntent: () => void, threshold = 20) {
  const [hasFired, setHasFired] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      // If mouse leaves the top of the viewport (meaning they go towards tabs/address bar)
      if (e.clientY <= threshold && !hasFired) {
        setHasFired(true);
        onExitIntent();
      }
    };

    // Add event listener
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [hasFired, onExitIntent, threshold]);

  return { hasFired, reset: () => setHasFired(false) };
}
