"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { leady as Lead } from "@repo/database";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export function KanbanCard({ lead, onClick }: { lead: Lead; onClick?: () => void }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "Lead",
      lead,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white/50 p-4 rounded-lg border-2 border-dashed border-blue-400 opacity-50 h-[104px]"
      />
    );
  }

  // Extract all required fields
  const triage = lead.odpowiedzi_triage as any;
  const clientName = (lead as any).klient?.imie_i_nazwisko || triage?.name || "Brak danych";
  const fullAddress = (lead as any).adres?.ulica_miasto || triage?.address || "Brak adresu";
  const dateFormatted = format(new Date(lead.created_at), "d MMM yyyy, HH:mm", { locale: pl });
  const estimatedQuote = lead.estymowana_wycena || "Brak estymacji";
  const auditorName = (lead as any).audytor?.imie_i_nazwisko;
  const installationTeamName = (lead as any).instalacje?.[0]?.zespol?.nazwa;
    
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-200/60 hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group flex flex-col gap-3"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-[13px] text-gray-900 group-hover:text-blue-700 transition-colors">
            {clientName}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 max-w-[160px] truncate" title={fullAddress}>
            {fullAddress}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400 font-medium">#{lead.id.substring(0, 6)}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{dateFormatted}</div>
        </div>
      </div>

      <div className="text-sm font-bold text-blue-700 bg-blue-50/50 py-1.5 px-3 rounded-lg border border-blue-100 self-start">
        {estimatedQuote}
      </div>

      <div className="flex flex-wrap gap-2 mt-1">
        {auditorName ? (
          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
            A: {auditorName}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-400 border-gray-200 border-dashed">
            Brak audytora
          </Badge>
        )}

        {installationTeamName && (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
            E: {installationTeamName}
          </Badge>
        )}
      </div>
    </div>
  );
}
