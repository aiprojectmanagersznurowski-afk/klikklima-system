"use client"
import React from "react"
import { Search, Filter } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const KANBAN_STAGES = [
  "Nowy lead", "Przypisanie audytora", "Wykonany audyt", "Wycena zaakcept.", 
  "Oczekuje na ekipę", "Wysyłka", "Dostarczony", "Instalacja", "Zakończona"
];

const mockLeads = [
  { id: 1, name: "Jan Kowalski", city: "Warszawa", stage: 0, priority: "Wysoki", assignee: "AK" },
  { id: 2, name: "Anna Nowak", city: "Kraków", stage: 3, priority: "Normalny", assignee: "PJ" },
  { id: 3, name: "Firma X Sp. z o.o.", city: "Poznań", stage: 5, priority: "Pilny", assignee: "ML" },
];

export default function KanbanBoard() {
  return (
    <div className="h-full flex flex-col p-8 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Dyspozytora</h1>
          <p className="text-sm text-gray-500 mt-1">Zarządzaj przepływem leadów i instalacji.</p>
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

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full min-w-max">
          {KANBAN_STAGES.map((stage, index) => (
            <div key={stage} className="w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200/60 overflow-hidden shrink-0">
              <div className="p-4 bg-gray-100/80 border-b border-gray-200/60 flex justify-between items-center">
                <h3 className="font-semibold text-sm text-gray-800">{stage}</h3>
                <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm">
                  {mockLeads.filter(l => l.stage === index).length}
                </span>
              </div>
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {mockLeads.filter(l => l.stage === index).map(lead => (
                  <div key={lead.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200/60 hover:shadow-md hover:border-blue-300 transition-all cursor-grab group">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700 transition-colors">{lead.name}</span>
                      <Badge variant={lead.priority === 'Pilny' ? 'destructive' : lead.priority === 'Wysoki' ? 'secondary' : 'outline'} className="text-[10px] uppercase font-bold tracking-wider">
                        {lead.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mb-4">{lead.city}</div>
                    
                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-50">
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[9px] font-bold text-blue-700">
                          {lead.assignee}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400">#{lead.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
