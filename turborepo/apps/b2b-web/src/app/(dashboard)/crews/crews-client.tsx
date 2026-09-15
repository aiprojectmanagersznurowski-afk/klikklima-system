"use client"

import React, { useTransition,  useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, ShieldCheck, Wrench, MoreHorizontal, FileCheck, MapPin, Upload , ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CrewSummary,
  CrewEditRecord,
  updateCrewAvatar,
  deleteCrewAction,
  createCrewAction,
  updateCrewAction,
  getCrewForEdit,
} from "./actions"
import { AddCrewModal, type AddCrewModalSaveResult } from "./components/AddCrewModal"
import { can, type Role } from "@klikklima/contracts"
import { formatInstallationStatus } from "@/lib/format-status"
import { createClient } from "@/utils/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog"
import { EMPTY_VALUE } from "@/lib/empty-value"

export type CrewSummaryWithAvatar = CrewSummary & { avatarUrl?: string | null };

type EditState =
  | { status: "loading" }
  | { status: "ready"; id: string; data: CrewEditRecord }

export function CrewsClient({
  initialCrews,
  actorRole,
}: {
  initialCrews: CrewSummaryWithAvatar[]
  actorRole: Role | null
}) {
  const router = useRouter()
  const [crews] = useState<CrewSummaryWithAvatar[]>(initialCrews)
  const [searchQuery, setSearchQuery] = useState("")
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCrewId, setUploadingCrewId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)

  const canCreateCrews = !!actorRole && can(actorRole, "crews", "create") === "yes";
  const canUpdateCrews = !!actorRole && can(actorRole, "crews", "update") === "yes";
  const canDeleteCrews = !!actorRole && can(actorRole, "crews", "delete") === "yes";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingCrewId) return

    setIsUploading(uploadingCrewId)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${uploadingCrewId}-${Date.now()}.${ext}`
      
      const { data, error } = await supabase.storage
        .from('zespoly')
        .upload(fileName, file)

      if (error) throw error

      await updateCrewAvatar(uploadingCrewId, data.path)
    } catch (err) {
      console.error('Error uploading file:', err)
      alert("Błąd podczas wgrywania zdjęcia")
    } finally {
      setIsUploading(null)
      setUploadingCrewId(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const triggerFileUpload = (crewId: string) => {
    setUploadingCrewId(crewId)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const filtered = crews.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.nazwa.toLowerCase().includes(q) || 
             (c.koordynator_imie_nazwisko && c.koordynator_imie_nazwisko.toLowerCase().includes(q));
    }
    return true;
  });

  const [isPending, startTransition] = useTransition();
  const handleDelete = (id: string) => {
    setDeleteDialogId(id);
  }

  const handleOpenEdit = (id: string) => {
    setEditState({ status: "loading" });
    startTransition(async () => {
      const data = await getCrewForEdit(id);
      if (!data) {
        alert("Nie udało się pobrać danych ekipy do edycji.");
        setEditState(null);
        return;
      }
      setEditState({ status: "ready", id, data });
    });
  }

  const uploadCrewPhoto = async (
    id: string,
    file: File
  ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('zespoly').upload(fileName, file);
      if (error) throw error;
      return { success: true, path: data.path };
    } catch (e) {
      return { success: false, error: "Błąd podczas wgrywania zdjęcia ekipy." };
    }
  }

  /**
   * D-A2: `createCrewAction` nie przyjmuje zdjęcia w ogóle (kolumna
   * zdjecie_url nie jest w jego `data`) — dla nowej ekipy zdjęcie idzie
   * dwuetapowo: utwórz rekord tekstowy -> jeśli wybrano plik, wgraj go i
   * dopisz ścieżkę osobnym wywołaniem `updateCrewAvatar` (już istniejące,
   * jednokolumnowe). Dla edycji ścieżka trafia jako trzeci argument
   * `updateCrewAction`, zgodnie z jego dzisiejszą sygnaturą.
   */
  const handleSaveCrew = async (
    formData: FormData,
    photoFile: File | null,
    editingId: string | null
  ): Promise<AddCrewModalSaveResult> => {
    if (!editingId) {
      const created = await createCrewAction(formData);
      if (!created.success || !created.id) {
        return { success: false, error: created.error ?? "Nie udało się utworzyć ekipy." };
      }
      if (photoFile) {
        const uploadResult = await uploadCrewPhoto(created.id, photoFile);
        if (uploadResult.success) {
          await updateCrewAvatar(created.id, uploadResult.path);
        }
        // Nieudany upload nie unieważnia już utworzonego rekordu — zdjęcie
        // można dograć później z poziomu edycji.
      }
      router.refresh();
      return { success: true };
    }

    let newPhotoPath: string | undefined;
    if (photoFile) {
      const uploadResult = await uploadCrewPhoto(editingId, photoFile);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }
      newPhotoPath = uploadResult.path;
    }

    const updated = await updateCrewAction(editingId, formData, newPhotoPath);
    if (!updated.success) {
      return { success: false, error: updated.error };
    }
    router.refresh();
    return { success: true };
  }

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Zespoły Monterskie</h1>
          <p className="text-sm text-muted-foreground mt-1">Zarządzanie ekipami instalatorów, certyfikatami i obszarami działania.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          {canCreateCrews && (
            <Button className="rounded-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2" onClick={() => setIsAddModalOpen(true)}>
              <Wrench className="size-4" />
              Dodaj Zespół
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
              placeholder="Szukaj po nazwie zespołu, koordynatorze..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Liczba zespołów: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card rounded-2xl border border-border">
              Brak zespołów spełniających kryteria.
            </div>
          ) : (
            filtered.map(crew => (
              <div key={crew.id} className={`flex flex-col bg-card rounded-2xl border ${crew.aktywny ? 'border-border' : 'border-destructive/30 opacity-75'} overflow-hidden shadow-sm hover:shadow-md transition-shadow relative`}>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden relative">
                      {crew.avatarUrl ? (
                        <img src={crew.avatarUrl} alt={crew.nazwa} className="w-full h-full object-cover" />
                      ) : (
                        <Wrench className="size-5 text-primary" />
                      )}
                      {isUploading === crew.id && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <MoreHorizontal size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Zarządzanie</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {canUpdateCrews && (
                          <DropdownMenuItem onClick={() => handleOpenEdit(crew.id)}>Edytuj Zespół</DropdownMenuItem>
                        )}
                        {canUpdateCrews && (
                          <DropdownMenuItem onClick={() => triggerFileUpload(crew.id)}>
                            <Upload className="size-4 mr-2" /> Wgraj zdjęcie zespołu
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive focus:text-destructive">Zawieś Zespół</DropdownMenuItem>

                              {canDeleteCrews && <DropdownMenuSeparator />}
                              {canDeleteCrews && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(crew.id)}
                              >
                                <ShieldAlert className="mr-2 size-4" />
                                <span>Usuń (Tylko Admin)</span>
                              </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <h3 className="font-bold text-lg text-foreground line-clamp-1">{crew.nazwa}</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{crew.koordynator_imie_nazwisko || EMPTY_VALUE}</span>
                    {crew.telefon_kontaktowy && <span>• {crew.telefon_kontaktowy}</span>}
                  </div>

                  <div className="mt-5 space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`size-4 ${crew.certyfikat_fgaz ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">F-GAZ: {crew.certyfikat_fgaz ? <span className="text-foreground">{crew.certyfikat_fgaz}</span> : <span className="text-destructive">Brak</span>}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCheck className={`size-4 ${crew.uprawnienia_sep ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">SEP 1kV: {crew.uprawnienia_sep ? <span className="text-green-600 dark:text-green-500">Tak</span> : <span className="text-destructive">Brak</span>}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Obszar: <span className="text-foreground font-medium">{crew.promien_dzialania_km ? `do ${crew.promien_dzialania_km} km` : EMPTY_VALUE}</span></span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-secondary/50 border-t border-border px-5 py-3 flex justify-between items-center">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Zrealizowane: <span className="text-foreground">{crew.installationsCount}</span>
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Brygady: <span className="text-foreground">{crew.liczba_brygad}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <AddCrewModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onSave={(formData, photoFile) => handleSaveCrew(formData, photoFile, null)}
        />
      )}

      {editState && (
        <AddCrewModal
          open={!!editState}
          isLoadingInitialData={editState.status === "loading"}
          initialData={editState.status === "ready" ? editState.data : undefined}
          onOpenChange={(next) => {
            if (!next) setEditState(null);
          }}
          onSave={(formData, photoFile) =>
            handleSaveCrew(formData, photoFile, editState.status === "ready" ? editState.id : null)
          }
        />
      )}

      {deleteDialogId && (
        <DeleteJustificationDialog
          title="Usuń zespół"
          description="Uwaga! Czy na pewno chcesz trwale usunąć ten rekord? Ta operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO)."
          onConfirm={async (values) => {
            const result = await deleteCrewAction(deleteDialogId, values);
            if (!result.success) {
              const blocking = result.blockingInstallations?.map(i => `${i.id} (${formatInstallationStatus(i.status)})`).join(", ");
              return { success: false, error: result.error + (blocking ? `\nBlokujące instalacje: ${blocking}` : "") };
            }
            return result;
          }}
          onClose={() => setDeleteDialogId(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
