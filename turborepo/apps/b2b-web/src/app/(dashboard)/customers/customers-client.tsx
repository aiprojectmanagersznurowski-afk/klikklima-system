"use client"

import React, { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Search, MoreHorizontal, User, Mail, Phone, Calendar, ArrowRight, ShieldAlert, FileText, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerSummary, anonymizeClientAction } from "./actions"
import { AUDIT_REQUIREMENTS, type Role } from "@klikklima/contracts"
import { isAnonymizeMenuItemVisible } from "./menu-visibility"
import { anonymizeClientSchema, ANONYMIZED_NAME_PLACEHOLDER, type AnonymizeClientFormValues } from "./anonymize-client-schema"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { formatDate } from "@/lib/format-date"

function AnonymizeClientModal({
  customer,
  onClose,
  setCustomers,
}: {
  customer: CustomerSummary
  onClose: () => void
  setCustomers: React.Dispatch<React.SetStateAction<CustomerSummary[]>>
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AnonymizeClientFormValues>({
    resolver: zodResolver(anonymizeClientSchema),
    mode: "onChange",
    defaultValues: {
      justification: "",
      // Brak domyślnej podstawy prawnej — operator musi ją świadomie wybrać
      // (WO CLIENT-ANONYMIZATION-RODO, recenzja Fazy B, MAJOR #1).
      legalBasis: undefined,
    },
  })

  const onSubmit = async (values: AnonymizeClientFormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await anonymizeClientAction(customer.id, values)
      if (!result.success) {
        setSubmitError(result.error ?? "Nie udało się zanonimizować klienta.")
        setIsSubmitting(false)
        return
      }
      // AC10: wiersz ZOSTAJE na liście (append-only rejestr), NIE .filter(...).
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, name: ANONYMIZED_NAME_PLACEHOLDER, email: null, phone: null } : c))
      onClose()
    } catch (e) {
      setSubmitError("Błąd podczas anonimizacji klienta.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Anonimizuj dane klienta (RODO)</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Operacja jest nieodwracalna. Dane klienta <span className="font-semibold text-foreground">{customer.name}</span> zostaną trwale usunięte i zastąpione wpisem &bdquo;{ANONYMIZED_NAME_PLACEHOLDER}&rdquo;.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="justification" className="text-sm font-medium text-foreground">
              Uzasadnienie <span className="text-destructive">*</span>
            </label>
            <textarea
              id="justification"
              rows={3}
              placeholder="Min. 10 znaków, np. żądanie klienta na podstawie RODO..."
              aria-invalid={!!errors.justification}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("justification")}
            />
            {errors.justification && (
              <p className="text-sm text-destructive font-medium">{errors.justification.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="legalBasis" className="text-sm font-medium text-foreground">
              Podstawa prawna <span className="text-destructive">*</span>
            </label>
            <select
              id="legalBasis"
              defaultValue=""
              aria-invalid={!!errors.legalBasis}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("legalBasis")}
            >
              <option value="" disabled>
                Wybierz podstawę prawną...
              </option>
              {AUDIT_REQUIREMENTS.legalBases.map((basis) => (
                <option key={basis} value={basis}>
                  {basis}
                </option>
              ))}
            </select>
            {errors.legalBasis && (
              <p className="text-sm text-destructive font-medium">{errors.legalBasis.message}</p>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive font-medium" role="alert">{submitError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              Anuluj
            </button>
            <Button type="submit" variant="destructive" disabled={!isValid || isSubmitting} className="rounded-md">
              {isSubmitting ? "Anonimizowanie..." : "Anonimizuj"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CustomersClient({ initialCustomers, actorRole }: { initialCustomers: CustomerSummary[]; actorRole: Role | null }) {
  const [customers, setCustomers] = useState<CustomerSummary[]>(initialCustomers)
  const [searchQuery, setSearchQuery] = useState("")
  const [isPending, startTransition] = useTransition()
  const [anonymizeTarget, setAnonymizeTarget] = useState<CustomerSummary | null>(null)

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
                        {formatDate(item.createdAt, "dd MMM yyyy")}
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
                              {isAnonymizeMenuItemVisible(actorRole) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => setAnonymizeTarget(item)}
                                  >
                                    <ShieldAlert className="mr-2 size-4" />
                                    <span>Anonimizuj (RODO)</span>
                                  </DropdownMenuItem>
                                </>
                              )}
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

      {anonymizeTarget && (
        <AnonymizeClientModal
          customer={anonymizeTarget}
          onClose={() => setAnonymizeTarget(null)}
          setCustomers={setCustomers}
        />
      )}
    </div>
  );
}
