"use client"

import React, { useTransition,  useState } from "react"
import { Search, Wrench, MoreHorizontal, CalendarClock, Phone , ShieldAlert } from "lucide-react"
import { can, type Role } from "@klikklima/contracts"
import { Button } from "@/components/ui/button"
import { StatusPill, type StatusPillTone } from "@/components/ui/status-pill"
import { ServiceSummary , deleteServiceAction } from "./actions"
import { daysUntilService } from "../../../lib/service-schedule"
import { isDeleteMenuItemVisible } from "./menu-visibility"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/format-date"
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog"

export function ServicesClient({
  initialServices,
  actorRole,
}: {
  initialServices: ServiceSummary[]
  actorRole: Role | null
}) {
  const [services] = useState<ServiceSummary[]>(initialServices)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const canDeleteServices = !!actorRole && can(actorRole, "services", "delete") === "yes";

  const filtered = services.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.customer_name.toLowerCase().includes(q) || 
             s.address.toLowerCase().includes(q) ||
             (s.customer_phone && s.customer_phone.includes(q));
    }
    return true;
  });

  const [isPending, startTransition] = useTransition();
  const handleDelete = (id: string) => {
    setDeleteDialogId(id);
  }

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Serwisy Gwarancyjne</h1>
          <p className="text-sm text-muted-foreground mt-1">Lista historycznych instalacji zbliżających się do terminu serwisu rocznego.</p>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Szukaj klienta, adresu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Instalacje oczekujące na serwis: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground uppercase font-semibold text-xs tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-4">Data Serwisu</th>
                  <th className="px-6 py-4">Klient i Kontakt</th>
                  <th className="px-6 py-4">Adres Instalacji</th>
                  <th className="px-6 py-4">Status & Dni do serwisu</th>
                  <th className="px-6 py-4 text-right sticky right-0 z-30 bg-secondary/50">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      Brak nadchodzących serwisów.
                    </td>
                  </tr>
                ) : (
                  filtered.map((service) => {
                    const rowKey = service.service_id ?? `forecast:${service.installation_id}`;
                    const daysLeft = daysUntilService(new Date(service.next_service_date));

                    let statusTone: StatusPillTone = "neutral";
                    let statusText = `${daysLeft} dni`;

                    if (daysLeft < 0) {
                      statusTone = "danger";
                      statusText = `ZALEGŁY (${Math.abs(daysLeft)} dni)`;
                    } else if (daysLeft <= 30) {
                      statusTone = "warning";
                      statusText = `PILNE (${daysLeft} dni)`;
                    } else if (daysLeft <= 60) {
                      statusTone = "info";
                      statusText = `Wkrótce (${daysLeft} dni)`;
                    }

                    return (
                      <tr key={rowKey} className="group hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="size-4 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              {formatDate(service.next_service_date, "dd MMM yyyy")}
                            </span>
                            {service.date_undetermined && (
                              <span className="text-xs text-muted-foreground italic">(termin nieustalony)</span>
                            )}
                          </div>
                          {service.installation_date && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Montaż: {formatDate(service.installation_date, "dd.MM.yyyy")}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{service.customer_name}</div>
                          {service.customer_phone && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <Phone className="size-3" />
                              {service.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-muted-foreground">{service.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusPill label={statusText} tone={statusTone} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right sticky right-0 z-20 bg-card group-hover:bg-secondary/20">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                              <MoreHorizontal size={16} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Zarządzanie Serwisem</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => alert("Wysyłka przypomnienia (Epic 4)")}>Wyślij Przypomnienie (SMS/Email)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => alert("Przydział w Fazie 2")}>Przydziel Brygadę</DropdownMenuItem>
                              <DropdownMenuItem>Oznacz jako Wykonany</DropdownMenuItem>

                              {isDeleteMenuItemVisible(service) && canDeleteServices && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => handleDelete(service.service_id as string)}
                                  >
                                    <ShieldAlert className="mr-2 size-4" />
                                    <span>Usuń (Tylko Admin)</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {deleteDialogId && (
        <DeleteJustificationDialog
          title="Usuń serwis"
          description="Uwaga! Operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO). Rekord zostanie trwale usunięty."
          onConfirm={(values) => deleteServiceAction(deleteDialogId, values)}
          onClose={() => setDeleteDialogId(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
