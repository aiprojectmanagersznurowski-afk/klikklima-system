"use client";

import React, { useState, useTransition } from "react";
import { updateLeadAuditor } from "./actions";
import type { getAuditors } from "../actions";
import { Button } from "@/components/ui/button";
import { Check, Loader2, UserPlus } from "lucide-react";
import { can, type Role } from "@klikklima/contracts";

// SEC-ASSIGNMENT-POOL-MINIMIZE (AC6): id/imie_i_nazwisko wyprowadzone z prawdziwego
// zwracanego typu getAuditors() (leads/actions.ts), zamiast ręcznie skopiowane —
// zmiana kształtu tam propaguje się tu automatycznie. `zdjecie_url` jest tu
// zastępowane `avatarUrl`, bo page.tsx zamienia ścieżkę storage na podpisany URL
// zanim przekaże pulę do tego komponentu (patrz `auditorsWithAvatars`).
type AssignableAuditor = Omit<Awaited<ReturnType<typeof getAuditors>>[number], "zdjecie_url"> & {
  avatarUrl: string | null;
};

export function AssignAuditor({
  leadId,
  currentAuditorId,
  auditors,
  actorRole,
}: {
  leadId: string;
  currentAuditorId: string | null;
  auditors: AssignableAuditor[];
  actorRole: Role | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [optimisticAuditor, setOptimisticAuditor] = useState(currentAuditorId);

  const canUpdateLead = !!actorRole && can(actorRole, "leads", "update") === "yes";

  const handleSelect = (auditorId: string | null) => {
    setOptimisticAuditor(auditorId);
    setIsEditing(false);
    startTransition(async () => {
      const result = await updateLeadAuditor(leadId, auditorId);
      if (!result.success) {
        alert(result.error);
        setOptimisticAuditor(currentAuditorId); // revert on error
      }
    });
  };

  const currentAuditorName = auditors.find((a) => a.id === optimisticAuditor)?.imie_i_nazwisko;

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-xs">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Zarządzanie</h3>
      
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">Przypisany audytor</span>
        
        {isEditing ? (
          <div className="flex flex-col gap-2 border border-border rounded-lg p-2 bg-secondary/50">
            {auditors.map((auditor) => (
              <button
                key={auditor.id}
                onClick={() => handleSelect(auditor.id)}
                className="flex items-center justify-between p-2 hover:bg-secondary text-foreground rounded-md text-sm text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 h-6 w-6">
                    {auditor.avatarUrl ? (
                      <img className="h-6 w-6 rounded-full object-cover" src={auditor.avatarUrl} alt={auditor.imie_i_nazwisko} />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center border border-border">
                        <span className="text-primary font-semibold text-xs">
                          {(auditor.imie_i_nazwisko || "").charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span>{auditor.imie_i_nazwisko}</span>
                </div>
                {optimisticAuditor === auditor.id && <Check size={16} className="text-primary" />}
              </button>
            ))}
            {auditors.length === 0 && (
              <div className="text-xs text-muted-foreground p-2 italic text-center">Brak dodanych audytorów w bazie</div>
            )}
            <button
              onClick={() => handleSelect(null)}
              className="text-xs text-destructive p-2 hover:bg-destructive/10 text-left rounded-md mt-1 border-t border-border cursor-pointer"
            >
              Odznacz audytora
            </button>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="mt-2 text-xs">
              Anuluj
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {optimisticAuditor ? (
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-8 w-8">
                  {auditors.find((a) => a.id === optimisticAuditor)?.avatarUrl ? (
                    <img className="h-8 w-8 rounded-full object-cover" src={auditors.find((a) => a.id === optimisticAuditor)?.avatarUrl ?? undefined} alt={currentAuditorName} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-sm border border-border">
                      {currentAuditorName?.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="font-medium text-foreground">{currentAuditorName}</span>
                {canUpdateLead && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    disabled={isPending}
                    className="ml-2 h-8 text-xs"
                  >
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Zmień"}
                  </Button>
                )}
              </div>
            ) : (
              canUpdateLead && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  disabled={isPending}
                  className="gap-2 text-primary border-primary/20 hover:bg-primary/10 bg-primary/5"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus size={16} />}
                  Przypisz audytora
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
