"use client"

import React, { useState, useRef } from "react"
import { Search, ShieldCheck, Wrench, MoreHorizontal, FileCheck, MapPin, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CrewSummary, updateCrewAvatar } from "./actions"
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

export type CrewSummaryWithAvatar = CrewSummary & { avatarUrl?: string | null };

export function CrewsClient({ initialCrews }: { initialCrews: CrewSummaryWithAvatar[] }) {
  const [crews] = useState<CrewSummaryWithAvatar[]>(initialCrews)
  const [searchQuery, setSearchQuery] = useState("")
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCrewId, setUploadingCrewId] = useState<string | null>(null)

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
          <Button className="rounded-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2" onClick={() => alert("Dodawanie w Fazie 2")}>
            <Wrench className="size-4" />
            Dodaj Zespół
          </Button>
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
                        <DropdownMenuItem onClick={() => alert("Wkrótce w Fazie 2")}>Edytuj Zespół</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => triggerFileUpload(crew.id)}>
                          <Upload className="size-4 mr-2" /> Wgraj zdjęcie zespołu
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">Zawieś Zespół</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <h3 className="font-bold text-lg text-foreground line-clamp-1">{crew.nazwa}</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{crew.koordynator_imie_nazwisko || "Brak koordynatora"}</span>
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
                      <span className="text-sm text-muted-foreground">Obszar: <span className="text-foreground font-medium">{crew.promien_dzialania_km ? `do ${crew.promien_dzialania_km} km` : "Nie ustalono"}</span></span>
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
    </div>
  );
}
