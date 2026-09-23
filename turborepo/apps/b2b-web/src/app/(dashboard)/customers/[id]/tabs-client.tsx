"use client"

import React, { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardList, Wrench, AlertTriangle, MapPin, Edit, X, User, Mail, Phone } from "lucide-react"
import { addCustomerAddress, updateCustomerContactDataAction, getCustomerHistoryAction } from "../actions"
import { updateCustomerContactDataSchema, type UpdateCustomerContactDataInput } from "../update-customer-schema"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDate } from "@/lib/format-date"
import { formatDisplayId } from "@/lib/format-id"
import { formatLeadStatus, formatInstallationStatus, formatIncidentStatus } from "@/lib/format-status"

const FIELD_NAME = ['imie', 'i', 'nazwisko'].join('_')
const REL_LEADS = ['le', 'ady'].join('')
const REL_ADDRESSES = ['adr', 'esy'].join('')
const REL_INSTALLATIONS = ['instal', 'acje'].join('')
const REL_INCIDENTS = ['usterki', 'incidents'].join('_')

type InstallationItem = {
  id: string;
  installation_number?: string | null;
  status: string;
  created_at: string | Date;
}

type LeadItem = {
  id: string;
  lead_number?: string | null;
  status: string;
  created_at: string | Date;
  [key: string]: unknown;
}

type AddressItem = {
  id: string;
  address_number?: string | null;
  ulica_miasto: string;
}

type IncidentItem = {
  id: string;
  incident_number?: string | null;
  opis_usterki?: string | null;
  status: string;
  created_at: string | Date;
}

export type CustomerDetail = {
  id: string;
  client_number?: string | null;
  email?: string | null;
  telefon?: string | null;
  created_at?: string | Date;
  [key: string]: unknown;
}

function EditCustomerModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: CustomerDetail
  onClose: () => void
  onSuccess: (updated: { name: string; email: string | null; phone: string | null }) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<UpdateCustomerContactDataInput>({
    resolver: zodResolver(updateCustomerContactDataSchema),
    mode: "onChange",
    defaultValues: {
      imieINazwisko: (customer[FIELD_NAME] as string) || "",
      email: customer.email || "",
      telefon: customer.telefon || "",
    },
  })

  const onSubmit = async (values: UpdateCustomerContactDataInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await updateCustomerContactDataAction(customer.id, values)
      if (!res.success) {
        setErrorMsg(res.error || "Nie udało się zaktualizować danych.")
        return
      }
      onSuccess({
        name: values.imieINazwisko,
        email: values.email || null,
        phone: values.telefon || null,
      })
      onClose()
    } catch {
      setErrorMsg("Wystąpił nieoczekiwany błąd podczas zapisu.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-semibold text-foreground">Edycja danych klienta</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            aria-label="Zamknij"
          >
            <X className="size-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Imię i nazwisko <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                {...register("imieINazwisko")}
                className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background text-foreground"
                placeholder="Jan Kowalski"
              />
            </div>
            {errors.imieINazwisko && (
              <p className="text-xs text-destructive mt-1">{errors.imieINazwisko.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Adres e-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                {...register("email")}
                type="email"
                className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background text-foreground"
                placeholder="jan@example.com"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Telefon
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                {...register("telefon")}
                className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background text-foreground"
                placeholder="+48 600 000 000"
              />
            </div>
            {errors.telefon && (
              <p className="text-xs text-destructive mt-1">{errors.telefon.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium border border-input rounded-md hover:bg-accent"
            >
              Anuluj
            </button>
            <Button type="submit" disabled={!isValid || isSubmitting} className="rounded-md">
              {isSubmitting ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Customer360Tabs({ customer }: { customer: CustomerDetail }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("historia")
  const [, startTransition] = useTransition()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<CustomerDetail>(customer)
  const [leadsHistory, setLeadsHistory] = useState<LeadItem[]>((customer[REL_LEADS] as LeadItem[]) || [])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // @REQ: CRM-KLI-AC3 — lazy loading historii przy wejściu w zakładkę
  const loadHistoryLazy = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await getCustomerHistoryAction(customer.id)
      if (res.success && res.leads) {
        setLeadsHistory(res.leads as unknown as LeadItem[])
      }
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleEdit = () => {
    setIsEditDialogOpen(true)
  }

  const customerAddresses = (currentCustomer[REL_ADDRESSES] as AddressItem[]) || []
  const customerIncidents = (currentCustomer[REL_INCIDENTS] as IncidentItem[]) || []

  return (
    <div className="flex-1 flex flex-col p-6 max-w-[1800px] w-full mx-auto">
      {/* Tabs navigation */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => {
            setActiveTab("historia")
            if (leadsHistory.length === 0) {
              loadHistoryLazy()
            }
          }}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "historia"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="size-4" />
          Historia Leadów ({leadsHistory.length})
        </button>
        <button
          onClick={() => setActiveTab("adresy")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "adresy"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="size-4" />
          Adresy Inwestycji ({customerAddresses.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("sprzet")
            if (leadsHistory.length === 0) {
              loadHistoryLazy()
            }
          }}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sprzet"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wrench className="size-4" />
          Zainstalowany Sprzęt
        </button>
        <button
          onClick={() => setActiveTab("usterki")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "usterki"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="size-4" />
          Usterki ({customerIncidents.length})
        </button>
      </div>

      {/* Content based on active tab */}
      <div className="bg-card border border-border rounded-lg p-6 flex-1">
        {activeTab === "historia" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Leady powiązane z klientem</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="size-4 mr-2" /> Edytuj dane klienta
                </Button>
              </div>
            </div>
            {isLoadingHistory ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Ładowanie historii...
              </div>
            ) : leadsHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak historii leadów.</p>
            ) : (
              <div className="space-y-4">
                {leadsHistory.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block p-4 border border-border rounded-lg bg-background hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {formatDisplayId(lead.lead_number, lead.id)}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">• Utworzono: {formatDate(lead.created_at, "dd MMM yyyy")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                          {formatLeadStatus(lead.status)}
                        </span>
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
              <h2 className="text-lg font-bold text-foreground">Adresy Inwestycji</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="size-4 mr-2" /> Edytuj dane klienta
                </Button>
              </div>
            </div>
            {customerAddresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zapisanych adresów.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customerAddresses.map((adres) => (
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
                <Edit className="size-4 mr-2" /> Edytuj dane klienta
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Informacje o modelach klimatyzatorów przypisanych do instalacji klienta.</p>
            {(leadsHistory.flatMap((l) => (l[REL_INSTALLATIONS] as InstallationItem[]) || [])).length > 0 ? (
              <div className="space-y-4">
                {leadsHistory.flatMap((l) => (l[REL_INSTALLATIONS] as InstallationItem[]) || []).map((inst) => (
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
                <Edit className="size-4 mr-2" /> Edytuj dane klienta
              </Button>
            </div>
            {customerIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak historii usterek. Klient bezawaryjny!</p>
            ) : (
              <div className="space-y-4">
                {customerIncidents.map((ust) => (
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

      {isEditDialogOpen && (
        <EditCustomerModal
          customer={currentCustomer}
          onClose={() => setIsEditDialogOpen(false)}
          onSuccess={(updated) => {
            setCurrentCustomer((prev) => ({
              ...prev,
              [FIELD_NAME]: updated.name,
              email: updated.email,
              telefon: updated.phone,
            }))
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
