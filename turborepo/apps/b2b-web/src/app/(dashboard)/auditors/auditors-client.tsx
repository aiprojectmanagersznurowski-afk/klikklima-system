"use client";

import React, { useState, useTransition } from "react";
import { TopBar } from "./components/TopBar";
import { AuditorsTable } from "./components/AuditorsTable";
import { AddAuditorModal } from "./components/AddAuditorModal";
import { CrewsTable } from "./components/CrewsTable";
import { AddCrewModal } from "./components/AddCrewModal";
import { addAuditor, updateAuditor, deleteAuditor, addCrew, updateCrew, deleteCrew } from "./actions";

export function AuditorsClient({ initialAuditors, initialCrews }: { initialAuditors: any[], initialCrews: any[] }) {
  const [search, setSearch] = useState("");
  const [crewSearch, setCrewSearch] = useState("");
  const [isAuditorModalOpen, setIsAuditorModalOpen] = useState(false);
  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState<any | null>(null);
  const [editingCrew, setEditingCrew] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddClick = () => {
    setEditingAuditor(null);
    setIsAuditorModalOpen(true);
  };

  const handleEditClick = (auditor: any) => {
    setEditingAuditor(auditor);
    setIsAuditorModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (confirm("Czy na pewno chcesz usunąć tego audytora?")) {
      startTransition(async () => {
        const result = await deleteAuditor(id);
        if (!result.success) {
          alert(result.error);
        }
      });
    }
  };

  const handleAddCrewClick = () => {
    setEditingCrew(null);
    setIsCrewModalOpen(true);
  };

  const handleEditCrewClick = (crew: any) => {
    setEditingCrew(crew);
    setIsCrewModalOpen(true);
  };

  const handleDeleteCrewClick = (id: string) => {
    if (confirm("Czy na pewno chcesz usunąć tę ekipę?")) {
      startTransition(async () => {
        const result = await deleteCrew(id);
        if (!result.success) {
          alert(result.error);
        }
      });
    }
  };

  const handleSaveAuditor = async (formData: FormData) => {
    if (editingAuditor) {
      const result = await updateAuditor(editingAuditor.id, formData);
      if (!result.success) {
        alert(result.error);
        return false;
      }
    } else {
      const result = await addAuditor(formData);
      if (!result.success) {
        alert(result.error);
        return false;
      }
    }
    return true;
  };

  const handleSaveCrew = async (formData: FormData) => {
    if (editingCrew) {
      const result = await updateCrew(editingCrew.id, formData);
      if (!result.success) {
        alert(result.error);
        return false;
      }
    } else {
      const result = await addCrew(formData);
      if (!result.success) {
        alert(result.error);
        return false;
      }
    }
    return true;
  };

  const filteredAuditors = initialAuditors.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.imie_i_nazwisko || "").toLowerCase().includes(q) ||
      (a.nazwa_firmy || "").toLowerCase().includes(q) ||
      (a.adres || "").toLowerCase().includes(q)
    );
  });

  const filteredCrews = initialCrews.filter((c) => {
    const q = crewSearch.toLowerCase();
    return (
      (c.nazwa || "").toLowerCase().includes(q) ||
      (c.koordynator_imie_nazwisko || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-300 space-y-12">
      <div className="space-y-6">
        <TopBar 
          title="Audytorzy"
          subtitle="Zarządzaj zespołem audytorów terenowych"
          buttonText="Dodaj Audytora"
          searchValue={search} 
          onSearchChange={setSearch} 
          onAddClick={handleAddClick} 
        />
        
        <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : ""}>
          <AuditorsTable 
            auditors={filteredAuditors} 
            onEdit={handleEditClick} 
            onDelete={handleDeleteClick} 
          />
        </div>
      </div>

      <div className="space-y-6">
        <TopBar 
          title="Ekipy Monterskie"
          subtitle="Zarządzaj zespołami montażowymi"
          buttonText="Dodaj Ekipę"
          searchValue={crewSearch} 
          onSearchChange={setCrewSearch} 
          onAddClick={handleAddCrewClick} 
        />
        
        <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : ""}>
          <CrewsTable 
            crews={filteredCrews} 
            onEdit={handleEditCrewClick} 
            onDelete={handleDeleteCrewClick} 
          />
        </div>
      </div>

      <AddAuditorModal 
        open={isAuditorModalOpen} 
        onOpenChange={setIsAuditorModalOpen} 
        onSave={handleSaveAuditor} 
        initialData={editingAuditor}
      />

      <AddCrewModal 
        open={isCrewModalOpen} 
        onOpenChange={setIsCrewModalOpen} 
        onSave={handleSaveCrew} 
        initialData={editingCrew}
      />
    </div>
  );
}
