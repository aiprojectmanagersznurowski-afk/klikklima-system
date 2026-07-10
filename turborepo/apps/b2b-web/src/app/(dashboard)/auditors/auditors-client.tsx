"use client";

import React, { useState, useTransition } from "react";
import { TopBar } from "./components/TopBar";
import { AuditorsTable } from "./components/AuditorsTable";
import { AddAuditorModal } from "./components/AddAuditorModal";
import { addAuditor, updateAuditor, deleteAuditor } from "./actions";

export function AuditorsClient({ initialAuditors }: { initialAuditors: any[] }) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddClick = () => {
    setEditingAuditor(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (auditor: any) => {
    setEditingAuditor(auditor);
    setIsModalOpen(true);
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

  const handleSave = async (formData: FormData) => {
    if (editingAuditor) {
      const result = await updateAuditor(editingAuditor.id, formData);
      if (!result.success) {
        alert(result.error);
        return false; // tell modal it failed
      }
    } else {
      const result = await addAuditor(formData);
      if (!result.success) {
        alert(result.error);
        return false;
      }
    }
    return true; // tell modal it succeeded
  };

  const filteredAuditors = initialAuditors.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.imie_i_nazwisko || "").toLowerCase().includes(q) ||
      (a.nazwa_firmy || "").toLowerCase().includes(q) ||
      (a.adres || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-300 space-y-6">
      <TopBar 
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

      <AddAuditorModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        onSave={handleSave} 
        initialData={editingAuditor}
      />
    </div>
  );
}
