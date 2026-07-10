"use client";

import React, { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatus, leady as Lead } from "@repo/database";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { updateLeadStatus } from "./actions";

// Map our enums to Polish labels
export const KANBAN_STAGES: { id: LeadStatus; title: string }[] = [
  { id: "NEW_LEAD", title: "Nowy lead - przypisz audytora" },
  { id: "AUDITOR_ASSIGNED", title: "Audytor Przypisany - oczekuje wyceny" },
  { id: "AUDIT_COMPLETED", title: "Wykonany audyt" },
  { id: "QUOTE_ACCEPTED", title: "Wycena zaakcept." },
  { id: "PAID", title: "Opłacono - Przypisz zespół" },
  { id: "AWAITING_INSTALLATION", title: "Oczekuje na ekipę / Przed Instalacją" },
  { id: "HARDWARE_SHIPPED", title: "Wysyłka" },
  { id: "HARDWARE_DELIVERED", title: "Dostarczony" },
  { id: "INSTALLATION_IN_PROGRESS", title: "Instalacja w trakcie" },
  { id: "INSTALLATION_COMPLETED", title: "Zakończona" },
];

export function KanbanClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) return;

    const isActiveALead = active.data.current?.type === "Lead";
    const isOverALead = over.data.current?.type === "Lead";
    const isOverAColumn = over.data.current?.type === "Column";

    if (!isActiveALead) return;

    // Dropping a lead over another lead
    if (isActiveALead && isOverALead) {
      setLeads((items) => {
        const activeIndex = items.findIndex((t) => t.id === activeIdStr);
        const overIndex = items.findIndex((t) => t.id === overIdStr);
        
        if (items[activeIndex].status !== items[overIndex].status) {
          const updatedItems = [...items];
          updatedItems[activeIndex].status = items[overIndex].status;
          return arrayMove(updatedItems, activeIndex, overIndex);
        }
        return arrayMove(items, activeIndex, overIndex);
      });
    }

    // Dropping a lead over an empty column
    if (isActiveALead && isOverAColumn) {
      setLeads((items) => {
        const activeIndex = items.findIndex((t) => t.id === activeIdStr);
        const updatedItems = [...items];
        updatedItems[activeIndex].status = overIdStr as LeadStatus;
        return arrayMove(updatedItems, activeIndex, activeIndex);
      });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeLead = leads.find((l) => l.id === active.id);
    const overIdStr = String(over.id);
    
    let newStatus: LeadStatus | undefined;
    if (over.data.current?.type === "Column") {
      newStatus = overIdStr as LeadStatus;
    } else if (over.data.current?.type === "Lead") {
      newStatus = leads.find((l) => l.id === overIdStr)?.status as LeadStatus;
    }

    if (activeLead && newStatus && activeLead.status !== newStatus) {
      // Optimistically we already updated state in onDragOver, now persist:
      startTransition(() => {
        updateLeadStatus(activeLead.id as string, newStatus).then((res) => {
          if (!res.success) {
            // In a real app we might want to revert on failure
            console.error(res.error);
          }
        });
      });
    }
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="h-full flex flex-col p-8 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lejek Leadów</h1>
          <p className="text-sm text-gray-500 mt-1">Zarządzaj statusem zapytań ofertowych przeciągając je między kolumnami.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Szukaj klienta..." 
              className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent w-64 shadow-sm"
            />
          </div>
          <Button variant="outline" className="gap-2 bg-white"><Filter size={16}/> Filtruj</Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 mt-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-6 h-full min-w-max items-start">
            {KANBAN_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                column={stage}
                leads={leads.filter((l) => l.status === stage.id)}
                onCardClick={(lead) => window.open(`/kanban/${lead.id}`, '_blank')}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? <KanbanCard lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
