"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function BackButton({ label = "Wstecz", fallbackHref = "/" }: { label?: string, fallbackHref?: string }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(true);

  useEffect(() => {
    // Proste sprawdzenie: jeśli user otworzył to w nowej karcie (history.length <= 1), 
    // to bezpieczniej przekierować go na stronę główną.
    if (window.history.length <= 2) {
      setCanGoBack(false);
    }
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-primary hover:underline font-medium mb-8 transition-all"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
