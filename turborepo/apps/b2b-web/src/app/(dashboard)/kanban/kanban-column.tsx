"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { leady as Lead, LeadStatus } from "@repo/database";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  column: { id: LeadStatus; title: string };
  leads: Lead[];
  onCardClick?: (lead: Lead) => void;
}

export function KanbanColumn({ column, leads, onCardClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200/60 overflow-hidden shrink-0 h-full"
    >
      <div className="p-4 bg-gray-100/80 border-b border-gray-200/60 flex justify-between items-center">
        <h3 className="font-semibold text-sm text-gray-800">{column.title}</h3>
        <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[150px]">
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} onClick={() => onCardClick?.(lead)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
