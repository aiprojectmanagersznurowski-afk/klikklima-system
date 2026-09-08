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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Zarządzanie</h3>
      
      <div className="flex flex-col gap-2">
        <span className="text-sm text-gray-500">Przypisany audytor</span>
        
        {isEditing ? (
          <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
            {auditors.map((auditor) => (
              <button
                key={auditor.id}
                onClick={() => handleSelect(auditor.id)}
                className="flex items-center justify-between p-2 hover:bg-blue-50 hover:text-blue-700 rounded-md text-sm text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 h-6 w-6">
                    {auditor.avatarUrl ? (
                      <img className="h-6 w-6 rounded-full object-cover" src={auditor.avatarUrl} alt={auditor.imie_i_nazwisko} />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-[10px]">
                          {(auditor.imie_i_nazwisko || "").charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span>{auditor.imie_i_nazwisko}</span>
                </div>
                {optimisticAuditor === auditor.id && <Check size={16} className="text-blue-600" />}
              </button>
            ))}
            {auditors.length === 0 && (
              <div className="text-xs text-gray-500 p-2 italic text-center">Brak dodanych audytorów w bazie</div>
            )}
            <button
              onClick={() => handleSelect(null)}
              className="text-xs text-red-600 p-2 hover:bg-red-50 text-left rounded-md mt-1 border-t border-gray-200"
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
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {currentAuditorName?.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="font-medium text-gray-900">{currentAuditorName}</span>
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
                  className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50 bg-blue-50/50"
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
