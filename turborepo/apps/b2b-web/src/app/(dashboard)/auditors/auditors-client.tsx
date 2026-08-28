"use client"

import React, { useTransition,  useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ShieldCheck, UserCheck, MoreHorizontal, FileCheck, MapPin , ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AuditorSummary,
  AuditorEditRecord,
  deleteAuditorAction,
  toggleAuditorActiveAction,
  createAuditorAction,
  updateAuditorAction,
  getAuditorForEdit,
} from "./actions"
import { AddAuditorModal, type AddAuditorModalSaveResult } from "./components/AddAuditorModal"
import { can, type Role } from "@klikklima/contracts"
import { createClient } from "@/utils/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { differenceInDays } from "date-fns"

type EditState =
  | { status: "loading" }
  | { status: "ready"; id: string; data: AuditorEditRecord }

export function AuditorsClient({
  initialAuditors,
  actorRole,
}: {
  initialAuditors: AuditorSummary[]
  actorRole: Role | null
}) {
  const router = useRouter()
  const [auditors] = useState<AuditorSummary[]>(initialAuditors)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)

  const filtered = auditors.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.imie_i_nazwisko.toLowerCase().includes(q) || 
             (a.email && a.email.toLowerCase().includes(q));
    }
    return true;
  });

  const [isPending, startTransition] = useTransition();
  const canCreateAuditors = !!actorRole && can(actorRole, "auditors", "create") === "yes";
  const canUpdateAuditors = !!actorRole && can(actorRole, "auditors", "update") === "yes";
  const canDeleteAuditors = !!actorRole && can(actorRole, "auditors", "delete") === "yes";

  const handleDelete = (id: string) => {
    if (!actorRole) {
      alert("Brak uprawnień do usunięcia audytora.");
      return;
    }
    if (confirm(`Uwaga! Czy na pewno chcesz trwale usunąć ten rekord? Ta operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO).`)) {
      startTransition(async () => {
        try {
          const result = await deleteAuditorAction(id);
          if (!result.success) {
            const blocking = result.blockingLeads?.map(l => `${l.id} (${l.clientName ?? "brak nazwy"})`).join(", ");
            alert(result.error + (blocking ? `\nBlokujące leady: ${blocking}` : ""));
            return;
          }
          window.location.reload();
        } catch (e) {
          alert("Wystąpił błąd podczas usuwania rekordu.");
        }
      });
    }
  }

  const handleToggleActive = (id: string, currentlyActive: boolean) => {
    const confirmMessage = currentlyActive
      ? "Zawiesić konto tego audytora? Straci dostęp i zniknie z puli wyboru do nowych leadów."
      : "Odblokować konto tego audytora? Wróci do puli wyboru i odzyska dostęp.";
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        const result = await toggleAuditorActiveAction(id);
        if (!result.success) {
          alert(result.error);
          return;
        }
        window.location.reload();
      } catch (e) {
        alert("Wystąpił błąd podczas zmiany statusu audytora.");
      }
    });
  }

  const handleOpenEdit = (id: string) => {
    setEditState({ status: "loading" });
    startTransition(async () => {
      const data = await getAuditorForEdit(id);
      if (!data) {
        alert("Nie udało się pobrać danych audytora do edycji.");
        setEditState(null);
        return;
      }
      setEditState({ status: "ready", id, data });
    });
  }

  /**
   * D-A2: zdjęcie jest wgrywane do Supabase Storage PO zapisaniu pól
   * tekstowych, niezależnie od trybu (create/update) — dla nowego rekordu
   * unikamy generowania nazwy pliku przed istnieniem `id`, a dla edycji ta
   * sama ścieżka "zapisz pola -> ewentualnie dograj zdjęcie" jest prostsza
   * do utrzymania niż dwie rozbieżne gałęzie kodu.
   */
  const handleSaveAuditor = async (
    formData: FormData,
    photoFile: File | null,
    editingId: string | null
  ): Promise<AddAuditorModalSaveResult> => {
    if (!editingId) {
      const created = await createAuditorAction(formData);
      if (!created.success || !created.id) {
        return { success: false, error: created.error ?? "Nie udało się utworzyć audytora." };
      }
      if (photoFile) {
        const uploadResult = await uploadAuditorPhoto(created.id, photoFile);
        if (uploadResult.success) {
          formData.append('zdjecie_url', uploadResult.path);
          await updateAuditorAction(created.id, formData);
        }
        // Nieudany upload zdjęcia przy tworzeniu nie unieważnia już
        // utworzonego rekordu tekstowego — użytkownik może dograć zdjęcie
        // później z poziomu edycji (AC-A22 dotyczy wprost trybu edycji).
      }
      router.refresh();
      return { success: true };
    }

    if (photoFile) {
      const uploadResult = await uploadAuditorPhoto(editingId, photoFile);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }
      formData.append('zdjecie_url', uploadResult.path);
    }

    const updated = await updateAuditorAction(editingId, formData);
    if (!updated.success) {
      return { success: false, error: updated.error };
    }
    router.refresh();
    return { success: true };
  }

  const uploadAuditorPhoto = async (
    id: string,
    file: File
  ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('audytorzy').upload(fileName, file);
      if (error) throw error;
      return { success: true, path: data.path };
    } catch (e) {
      return { success: false, error: "Błąd podczas wgrywania zdjęcia audytora." };
    }
  }

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audytorzy</h1>
          <p className="text-sm text-muted-foreground mt-1">Baza terenowych audytorów (Wyceny i wizje lokalne).</p>
        </div>
        <div className="flex gap-3">
          {canCreateAuditors && (
            <Button className="rounded-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2" onClick={() => setIsAddModalOpen(true)}>
              <UserCheck className="size-4" />
              Dodaj Audytora
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Szukaj po nazwisku, emailu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Zarejestrowani audytorzy: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card rounded-2xl border border-border">
              Brak audytorów spełniających kryteria.
            </div>
          ) : (
            filtered.map(auditor => {
              let fgazWarning = false;
              let fgazText = "";
              if (auditor.fgaz_valid_until) {
                const daysLeft = differenceInDays(new Date(auditor.fgaz_valid_until), new Date());
                if (daysLeft < 30 && daysLeft >= 0) {
                  fgazWarning = true;
                  fgazText = ` (Wygasa za ${daysLeft} dni)`;
                } else if (daysLeft < 0) {
                  fgazWarning = true;
                  fgazText = ` (Wygasł!)`;
                }
              }

              return (
                <div key={auditor.id} className="flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="size-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <UserCheck className="size-5 text-blue-600 dark:text-blue-500" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                          <MoreHorizontal size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Zarządzanie</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {canUpdateAuditors && (
                            <DropdownMenuItem onClick={() => handleOpenEdit(auditor.id)}>Edytuj Audytora</DropdownMenuItem>
                          )}

                          {canUpdateAuditors && (
                            <>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleToggleActive(auditor.id, auditor.is_active)}
                              >
                                {auditor.is_active ? "Zawieś Konto" : "Odblokuj Konto"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {canDeleteAuditors && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onClick={() => handleDelete(auditor.id)}
                            >
                              <ShieldAlert className="mr-2 size-4" />
                              <span>Usuń (Tylko Admin)</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <h3 className="font-bold text-lg text-foreground line-clamp-1">{auditor.imie_i_nazwisko}</h3>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-col gap-0.5">
                      {auditor.email && <span>{auditor.email}</span>}
                      {auditor.telefon && <span>{auditor.telefon}</span>}
                    </div>

                    <div className="mt-5 space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`size-4 ${auditor.certyfikat_fgaz && !fgazWarning ? 'text-primary' : auditor.certyfikat_fgaz && fgazWarning ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">
                          F-GAZ: {auditor.certyfikat_fgaz ?
                            <span className={fgazWarning ? "text-amber-600 dark:text-amber-500 font-bold" : "text-foreground"}>
                              {auditor.certyfikat_fgaz} {fgazText}
                            </span> :
                            <span className="text-destructive">Brak</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileCheck className={`size-4 ${auditor.uprawnienia_sep ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">SEP 1kV: {auditor.uprawnienia_sep ? <span className="text-primary">Tak</span> : <span className="text-destructive">Brak</span>}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Obszar: <span className="text-foreground font-medium">{auditor.max_promien_dojazdu_km ? `do ${auditor.max_promien_dojazdu_km} km` : "Nie ustalono"}</span></span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/50 border-t border-border px-5 py-3 flex justify-between items-center">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Marki: <span className="text-foreground">{auditor.preferowane_marki.length > 0 ? auditor.preferowane_marki.join(", ") : "Wszystkie"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <AddAuditorModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onSave={(formData, photoFile) => handleSaveAuditor(formData, photoFile, null)}
        />
      )}

      {editState && (
        <AddAuditorModal
          open={!!editState}
          isLoadingInitialData={editState.status === "loading"}
          initialData={editState.status === "ready" ? editState.data : undefined}
          onOpenChange={(next) => {
            if (!next) setEditState(null);
          }}
          onSave={(formData, photoFile) =>
            handleSaveAuditor(formData, photoFile, editState.status === "ready" ? editState.id : null)
          }
        />
      )}
    </div>
  );
}
