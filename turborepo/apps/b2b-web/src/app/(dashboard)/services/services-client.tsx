"use client"

import React, { useTransition,  useState } from "react"
import { Search, Wrench, MoreHorizontal, CalendarClock, Phone , ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServiceSummary , deleteServiceAction } from "./actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { differenceInDays } from "date-fns"
import { formatDate } from "@/lib/format-date"

export function ServicesClient({ initialServices }: { initialServices: ServiceSummary[] }) {
  const [services] = useState<ServiceSummary[]>(initialServices)
  const [searchQuery, setSearchQuery] = useState("")

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
    if (confirm(`Uwaga! Czy na pewno chcesz trwale usunąć ten rekord? Ta operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO).`)) {
      startTransition(async () => {
        try {
          const result = await deleteServiceAction(id);
          if (!result.success) throw new Error(result.error);
          window.location.reload();
        } catch (e) {
          alert("Wystąpił błąd podczas usuwania rekordu.");
        }
      });
    }
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
              <thead className="bg-secondary/50 text-muted-foreground uppercase font-medium text-xs border-b border-border">
                <tr>
                  <th className="px-6 py-4">Data Serwisu</th>
                  <th className="px-6 py-4">Klient i Kontakt</th>
                  <th className="px-6 py-4">Adres Instalacji</th>
                  <th className="px-6 py-4">Status / Dni do serwisu</th>
                  <th className="px-6 py-4 text-right">Akcje</th>
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
                    const daysLeft = differenceInDays(new Date(service.next_service_date), new Date());
                    
                    let statusColor = "text-muted-foreground";
                    let statusBg = "bg-secondary";
                    let statusText = `${daysLeft} dni`;
                    
                    if (daysLeft < 0) {
                      statusColor = "text-destructive-foreground";
                      statusBg = "bg-destructive";
                      statusText = `ZALEGŁY (${Math.abs(daysLeft)} dni)`;
                    } else if (daysLeft <= 30) {
                      statusColor = "text-amber-900 dark:text-amber-100";
                      statusBg = "bg-amber-100 dark:bg-amber-900/30";
                      statusText = `PILNE (${daysLeft} dni)`;
                    } else if (daysLeft <= 60) {
                      statusColor = "text-blue-900 dark:text-blue-100";
                      statusBg = "bg-blue-100 dark:bg-blue-900/30";
                      statusText = `Wkrótce (${daysLeft} dni)`;
                    }

                    return (
                      <tr key={service.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="size-4 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              {formatDate(service.next_service_date, "dd MMM yyyy")}
                            </span>
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
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusBg} ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
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
                            
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(service.id)}
                              >
                                <ShieldAlert className="mr-2 size-4" />
                                <span>Usuń (Tylko Admin)</span>
                              </DropdownMenuItem>
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
    </div>
  );
}
