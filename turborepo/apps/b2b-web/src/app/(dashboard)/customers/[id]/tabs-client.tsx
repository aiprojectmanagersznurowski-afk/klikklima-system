"use client"

import React, { useState, useTransition } from "react"
import { ClipboardList, Package, Wrench, AlertTriangle, FileText, MapPin, Edit, Plus } from "lucide-react"
import { addCustomerAddress } from "./actions"
import { Button } from "@/components/ui/button"

const LEAD_STATUS_PL: Record<string, string> = {
  "NEW": "Nowy",
  "CONTACTED": "Skomunikowany",
  "AUDIT_SCHEDULED": "Audyt zaplanowany",
  "AUDIT_COMPLETED": "Audyt zakończony",
  "OFFER_SENT": "Oferta wysłana",
  "OFFER_ACCEPTED": "Oferta zaakceptowana",
  "OFFER_REJECTED": "Oferta odrzucona",
  "INSTALLATION_PLANNED": "Instalacja zaplanowana",
  "INSTALLATION_IN_PROGRESS": "Instalacja w trakcie",
  "INSTALLATION_COMPLETED": "Instalacja zakończona",
  "LOST": "Utracony"
};

export function Customer360Tabs({ customer }: { customer: any }) {
  const [activeTab, setActiveTab] = useState("historia")
  const [isPending, startTransition] = useTransition()

  const handleEdit = () => {
    alert("Funkcja edycji pól w tej zakładce zostanie zintegrowana w następnej fazie CRM (Edycja formularzy).");
  }

  const handleAddAddress = () => {
    const ulicaMiasto = window.prompt("Podaj nowy adres (Ulica, Miasto):");
    if (ulicaMiasto && ulicaMiasto.trim() !== "") {
      startTransition(async () => {
        try {
          await addCustomerAddress(customer.id, ulicaMiasto);
          alert("Adres dodany pomyślnie.");
        } catch (e) {
          alert("Wystąpił błąd podczas dodawania adresu.");
        }
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("historia")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "historia" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <ClipboardList className="size-4" />
          Historia Leadów ({customer.leady.length})
        </button>
        <button
          onClick={() => setActiveTab("adresy")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "adresy" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <MapPin className="size-4" />
          Adresy Inwestycji ({customer.adresy.length})
        </button>
        <button
          onClick={() => setActiveTab("sprzet")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sprzet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <Package className="size-4" />
          Sprzęt i Instalacje
        </button>
        <button
          onClick={() => setActiveTab("usterki")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "usterki" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <AlertTriangle className="size-4" />
          Usterki ({customer.usterki_incidents.length})
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 min-h-[400px] relative">
        {isPending && (
          <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-xl">
            <span className="font-semibold text-muted-foreground">Przetwarzanie...</span>
          </div>
        )}
        
        {activeTab === "historia" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Leady powiązane z klientem</h2>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="size-4 mr-2" /> Edytuj
              </Button>
            </div>
            {customer.leady.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak historii leadów.</p>
            ) : (
              <div className="space-y-4">
                {customer.leady.map((lead: any) => (
                  <div key={lead.id} className="p-4 border border-border rounded-lg bg-background flex justify-between items-center">
                    <div>
                      <span className="text-xs font-mono text-muted-foreground">ID: {lead.id}</span>
                      <p className="font-semibold text-foreground mt-1">Status: {LEAD_STATUS_PL[lead.status] || lead.status}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Ostatnia zmiana: {new Date(lead.updated_at).toLocaleDateString()}</p>
                      {lead.finalna_wycena_pln && <p className="font-bold text-primary mt-1">{lead.finalna_wycena_pln} PLN</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "adresy" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Zapisane lokalizacje montażu</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddAddress}>
                  <Plus className="size-4 mr-2" /> Dodaj Adres
                </Button>
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="size-4 mr-2" /> Edytuj
                </Button>
              </div>
            </div>
            {customer.adresy.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zapisanych adresów.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.adresy.map((adres: any) => (
                  <div key={adres.id} className="p-4 border border-border rounded-lg bg-background flex items-start gap-3">
                    <MapPin className="size-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">{adres.ulica_miasto}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {adres.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "sprzet" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Zainstalowany Sprzęt HVAC</h2>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="size-4 mr-2" /> Edytuj
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Tu znajdą się informacje o modelach klimatyzatorów przypisanych do zakończonych instalacji (Wymaga rozwinięcia encji urządzeń u klienta w następnej fazie).</p>
            {customer.leady.flatMap((l: any) => l.instalacje).length > 0 ? (
              <div className="space-y-4">
                {customer.leady.flatMap((l: any) => l.instalacje).map((inst: any) => (
                  <div key={inst.id} className="p-4 border border-border rounded-lg bg-background flex justify-between items-center">
                    <div>
                      <p className="font-medium text-foreground">Montaż: {new Date(inst.created_at).toLocaleDateString()}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">Status: {inst.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Brak zrealizowanych instalacji.</p>
            )}
          </div>
        )}

        {activeTab === "usterki" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Zgłoszenia i Awarie</h2>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="size-4 mr-2" /> Edytuj
              </Button>
            </div>
            {customer.usterki_incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak historii usterek. Klient bezawaryjny!</p>
            ) : (
              <div className="space-y-4">
                {customer.usterki_incidents.map((ust: any) => (
                  <div key={ust.id} className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-destructive">{ust.opis_usterki || "Brak opisu"}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">Zgłoszono: {new Date(ust.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded">
                      {ust.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
