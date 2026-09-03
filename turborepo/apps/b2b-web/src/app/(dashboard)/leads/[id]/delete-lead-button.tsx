"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteLeadAction } from "../actions";
import { useRouter } from "next/navigation";
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowDialog(true)}
        disabled={isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
        title="Usuń leada"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </Button>

      {showDialog && (
        <DeleteJustificationDialog
          title="Usuń leada"
          description="Czy na pewno chcesz trwale usunąć tego leada? Ta operacja jest nieodwracalna."
          onConfirm={(values) => deleteLeadAction(leadId, values)}
          onClose={() => setShowDialog(false)}
          onSuccess={() => {
            startTransition(() => {
              router.push("/leads");
            });
          }}
        />
      )}
    </>
  );
}
