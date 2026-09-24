import { prisma } from "@repo/database"
import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { User, Phone, Mail, MapPin, Building, Calendar, FileText, ClipboardList, PenTool, CheckCircle, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatDate } from "@/lib/format-date"
import { Customer360Tabs } from "./tabs-client"
import { getCurrentActorRole } from "../../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  if (!actorRole || can(actorRole, "clients", "read") !== "yes") {
    notFound();
    return;
  }

  const { id } = await params;
  // MAJOR (audyt bezpieczeństwa 2026-09-24, runda 3): minimalizacja danych — poprzednie
  // `include` bez `select` serializowało do przeglądarki cały wiersz leada (notatki
  // wewnętrzne, finalną wycenę, odpowiedzi triage), współrzędne adresów oraz
  // `logistyka_zamowienia` (zasób z `read: no` dla WSZYSTKICH ról w macierzy RBAC — jego
  // obecność tutaj była sprzeczna z kontraktem niezależnie od odbiorcy). Kształt `leady`
  // poniżej jest CELOWO identyczny z tym, co zwraca `getCustomerHistoryAction`
  // (`customers/actions.ts`) — różne ścieżki (dane startowe SSR vs. lazy-load), ten sam
  // zawężony kontrakt danych.
  const customerRaw = await prisma.klienci.findUnique({
    where: { id },
    select: {
      id: true,
      client_number: true,
      imie_i_nazwisko: true,
      email: true,
      telefon: true,
      created_at: true,
      anonymized_at: true,
      adresy: {
        select: {
          id: true,
          address_number: true,
          ulica_miasto: true,
        },
      },
      leady: {
        select: {
          id: true,
          project_number: true,
          status: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      },
      usterki_incidents: {
        select: {
          id: true,
          incident_number: true,
          opis_usterki: true,
          status: true,
          created_at: true,
        },
      },
    },
  });

  if (!customerRaw) {
    notFound();
    return;
  }

  const customer = {
    ...customerRaw,
    leady: customerRaw.leady.map((lead) => ({
      id: lead.id,
      lead_number: lead.project_number,
      status: lead.status,
      created_at: lead.created_at,
    })),
  };

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      {/* Top Header / Breadcrumbs */}
      <div className="flex flex-col gap-4 bg-card p-6 border-b border-border">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <User className="size-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.imie_i_nazwisko || "Nieznany Klient"}</h1>
                {customer.client_number && (
                  <span className="font-mono text-sm font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                    {customer.client_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground font-medium">
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-4" /> {customer.email}
                  </span>
                )}
                {customer.telefon && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-4" /> {customer.telefon}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" /> W bazie od: {formatDate(customer.created_at, "dd MMM yyyy")}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="font-semibold shadow-sm">
              Wyślij Wiadomość
            </Button>
            <Link href={`/incidents?clientId=${customer.id}`}>
              <Button className="font-semibold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
                Zgłoś Usterkę (Auto-Fill)
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background p-6">
        <Customer360Tabs customer={customer} />
      </div>
    </div>
  );
}
