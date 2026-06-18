"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({ label = "Wstecz" }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-primary hover:underline font-medium mb-8 transition-all"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
