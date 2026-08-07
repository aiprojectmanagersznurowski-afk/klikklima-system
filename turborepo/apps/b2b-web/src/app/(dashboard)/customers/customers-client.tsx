"use client"

import React, { useState, useTransition } from "react"
import { Search, MoreHorizontal, User, Mail, Phone, Calendar, ArrowRight, ShieldAlert, FileText, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerSummary, deleteCustomerAction } from "./actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

export function CustomersClient({ initialCustomers }: { initialCustomers: CustomerSummary[] }) {
  const [customers, setCustomers] = useState<CustomerSummary[]>(initialCustomers)
  const [searchQuery, setSearchQuery] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Uwaga! Czy na pewno chcesz trwale usunąć klienta ${name}? Ta operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO).`)) {
      startTransition(async () => {
        try {
          await deleteCustomerAction(id);
          setCustomers(prev => prev.filter(c => c.id !== id));
          alert(`Klient ${name} został usunięty.`);
        } catch (e) {
          alert(`Błąd podczas usuwania klienta. Możliwe, że blokują go klucze obce.`);
        }
      });
    }
  }

  const filtered = customers.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || 
             (c.email && c.email.toLowerCase().includes(q)) || 
             (c.phone && c.phone.includes(q)) ||
             c.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Baza Klientów (CRM)</h1>
          <p className="text-sm text-muted-foreground mt-1">Single Source of Truth dla danych klientów, leadów i instalacji.</p>
        </div>
        <div className="flex gap-3">
          <Button className="rounded-md font-semibold shadow-sm flex items-center gap-2">
            <User className="size-4" />
            Dodaj Klienta Ręcznie
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Szukaj po nazwisku, e-mail, telefonie, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Liczba klientów: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col relative">
          <div className="overflow-x-auto flex-1">
            {isPending && (
              <div className="absolute inset-0 bg-background/50 z-20 flex items-center justify-center">
                <span className="text-sm font-semibold text-muted-foreground">Przetwarzanie...</span>
              </div>
            )}
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                  <th className="p-3.5 px-6">Klient</th>
                  <th className="p-3.5 px-6">Kontakt</th>
                  <th className="p-3.5 px-6">Data dodania</th>
                  <th className="p-3.5 px-6 text-center">Leady</th>
                  <th className="p-3.5 px-6 text-center">Instalacje</th>
                  <th className="p-3.5 px-6 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      Brak klientów w bazie.
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => (
                    <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{item.name}</span>
                          <span className="text-[11px] font-mono text-muted-foreground mt-0.5">{item.id.substring(0,8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-foreground flex items-center gap-1.5">
                            <Mail className="size-3.5 text-muted-foreground" />
                            {item.email || "Brak e-mail"}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="size-3.5 text-muted-foreground" />
                            {item.phone || "Brak telefonu"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(item.createdAt), "dd MMM yyyy", { locale: pl })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center bg-secondary text-secondary-foreground rounded-full size-7 text-xs font-medium border border-border">
                          {item.leadsCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full size-7 text-xs font-semibold border border-primary/20">
                          {item.installationsCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            href={`/customers/${item.id}`} 
                            className={`h-8 text-xs font-medium inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground px-3`}
                          >
                            Karta 360 <ArrowRight className="ml-1.5 size-3.5" />
                          </Link>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" disabled={isPending}>
                              <MoreHorizontal size={16} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Opcje Klienta</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Link href={`/customers/${item.id}`} className="flex items-center w-full">
                                  <User className="mr-2 size-4" />
                                  <span>Otwórz Kartę 360</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <FileText className="mr-2 size-4" />
                                <span>Wygeneruj raport</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Wrench className="mr-2 size-4" />
                                <span>Zgłoś usterkę z palca</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(item.id, item.name)}
                              >
                                <ShieldAlert className="mr-2 size-4" />
                                <span>Usuń (Tylko Admin)</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
