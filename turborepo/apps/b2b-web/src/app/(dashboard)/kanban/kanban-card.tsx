"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { leady as Lead } from "@repo/database";
import { Badge } from "@/components/ui/badge";

export function KanbanCard({ lead }: { lead: Lead }) {
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

  // Parse triage data or other fields if available
  // Fallbacks:
  const triage = lead.odpowiedzi_triage as any;
  const name = triage && triage.name ? triage.name : "Brak danych";
  const city = triage && triage.address ? triage.address : "Brak miasta";
    
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200/60 hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="flex justify-between items-start mb-3">
        <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700 transition-colors">
          {name}
        </span>
        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
          Normalny
        </Badge>
      </div>
      <div className="text-xs text-gray-500 mb-4">{city}</div>

      <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-50">
        <div className="flex -space-x-1">
          <div className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[9px] font-bold text-blue-700">
            {lead.audytor_id ? "A" : "?"}
          </div>
        </div>
        <span className="text-[10px] font-medium text-gray-400">
          #{lead.id.substring(0, 6)}
        </span>
      </div>
    </div>
  );
}
