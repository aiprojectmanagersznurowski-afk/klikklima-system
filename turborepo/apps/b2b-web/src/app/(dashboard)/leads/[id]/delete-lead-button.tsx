"use client";

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteLead } from "./actions";
import { useRouter } from "next/navigation";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (confirm("Czy na pewno chcesz trwale usunąć tego leada?")) {
      startTransition(async () => {
        const res = await deleteLead(leadId);
        if (res.success) {
          router.push("/leads");
        } else {
          alert(res.error || "Błąd podczas usuwania");
        }
      });
    }
  };

  return (
    <Button 
      variant="outline" 
      size="icon"
      onClick={handleDelete}
      disabled={isPending}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
      title="Usuń leada"
    >
      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
    </Button>
  );
}
