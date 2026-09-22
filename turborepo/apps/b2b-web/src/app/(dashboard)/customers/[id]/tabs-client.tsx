"use client"

import React, { useState, useTransition } from "react"
import { ClipboardList, Package, Wrench, AlertTriangle, FileText, MapPin, Edit, Plus } from "lucide-react"
import { addCustomerAddress } from "../actions"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatDate } from "@/lib/format-date"
import { formatDisplayId } from "@/lib/format-id"
import { formatLeadStatus, formatInstallationStatus, formatIncidentStatus } from "@/lib/format-status"

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
          const result = await addCustomerAddress(customer.id, ulicaMiasto);
          if (!result.success) {
            alert(result.error);
            return;
          }
          alert("Adres dodany pomyślnie.");
        } catch (e) {
          alert("Wystąpił błąd podczas dodawania adresu.");
        }
      });
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-[1800px] w-full mx-auto">
      {/* Tabs navigation */}
      <div className="flex border-b border-border mb-6">
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
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block p-4 border border-border rounded-lg bg-background hover:bg-secondary/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {formatDisplayId(lead.project_number, lead.id)}
                          </span>
                        </div>
                        <p className="font-semibold text-foreground mt-1">Status: {formatLeadStatus(lead.status)}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">Ostatnia zmiana: {formatDate(lead.updated_at, "dd MMM yyyy")}</p>
                        {lead.finalna_wycena_pln && <p className="font-bold text-primary mt-1">{lead.finalna_wycena_pln} PLN</p>}
                      </div>
                    </div>
                  </Link>
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
                      <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {formatDisplayId(adres.address_number, adres.id)}</p>
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {formatDisplayId(inst.installation_number, inst.id)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">• Montaż: {formatDate(inst.created_at, "dd MMM yyyy")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Status: {formatInstallationStatus(inst.status)}</p>
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
                  <div key={ust.id} className="p-4 border border-border rounded-lg bg-card flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {formatDisplayId(ust.incident_number, ust.id)}
                        </span>
                        <p className="font-semibold text-foreground">{ust.opis_usterki || "Brak opisu"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Zgłoszono: {formatDate(ust.created_at, "dd MMM yyyy")}</p>
                    </div>
                    <span className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded">
                      {formatIncidentStatus(ust.status)}
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
