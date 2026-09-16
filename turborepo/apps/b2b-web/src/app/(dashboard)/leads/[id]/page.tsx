import React from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AssignAuditor } from "./assign-auditor";
import { EditLeadModal } from "./edit-lead-modal";
import { DeleteLeadButton } from "./delete-lead-button";
import { CreateBookingDialog } from "./create-booking-dialog";
import { LeadBookingsList, type LeadBookingRow } from "./lead-bookings-list";
import { getAuditors } from "../actions";
import { getLeadDetail } from "./actions";
import { getCurrentActorRole } from "../../../../utils/supabase/server";
import { LEAD_STATUS_TONE } from "../leads-client";
import { signStoragePaths } from "@/lib/storage/signed-urls";
import type { TriageAnswers } from "@/lib/triage-answers";
import { formatDate } from "@/lib/format-date";
import { formatLeadStatus } from "@/lib/format-status";
import { EMPTY_VALUE } from "@/lib/empty-value";
import type { LeadStatus } from "@repo/database";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function LeadDetailsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ edit?: string }> 
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const isEditMode = edit === 'true';

  const detailResult = await getLeadDetail(id);

  if (!detailResult.success) {
    notFound();
    return;
  }

  const { lead } = detailResult;

  // Osobne zapytanie od getLeadDetail() (celowo — getLeadDetail() już gate'uje
  // leads.read wariantem 'own'). actorRole tu służy wyłącznie warstwie UI, żeby
  // ukryć kontrolki edycji (leads.update) dla ról, którym serwer i tak odrzuci zapis.
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch {
    actorRole = null;
  }

  const triage: TriageAnswers = (lead.odpowiedzi_triage as TriageAnswers | null) || {};

  const name = lead.klient?.imie_i_nazwisko || EMPTY_VALUE;
  const phone = lead.klient?.telefon || EMPTY_VALUE;
  const email = lead.klient?.email || EMPTY_VALUE;
  const address = lead.adres?.ulica_miasto || EMPTY_VALUE;

  const location = triage.location || EMPTY_VALUE;
  const buildingState = triage.buildingState || EMPTY_VALUE;
  const roomCount = triage.roomCount || EMPTY_VALUE;
  const hasBalcony = triage.hasBalcony !== undefined ? (triage.hasBalcony ? "Tak" : "Nie") : EMPTY_VALUE;
  const floorNumber = triage.floor;
  const floorDisplay = floorNumber === 0 ? "Parter" : floorNumber !== null && floorNumber !== undefined ? `Piętro ${floorNumber}` : EMPTY_VALUE;

  const roomSizes = triage.roomSizes
    ? Object.entries(triage.roomSizes).map(([key, value]) => `Pokój ${key}: ${value}`).join(", ")
    : EMPTY_VALUE;

  const estimatedQuote = lead.estymowana_wycena || EMPTY_VALUE;

  // Device configuration info
  const extUnit = triage.selectedExternalUnit;
  const intUnits = triage.selectedInternalUnits || [];

  // BLOCKER 3 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): ta pula wyboru audytora MUSI
  // wykluczać zablokowane konta (is_active: false), tak samo jak pula w
  // assignCrewToLead/leads/actions.ts. Wołamy tę samą funkcję zamiast dublować
  // zapytanie, żeby istniała tylko jedna definicja "puli wyboru".
  const audytorzy = await getAuditors();

  // Bulk generate signed URLs for auditors
  const auditorPaths = audytorzy
    .map(a => a.zdjecie_url)
    .filter((url): url is string => Boolean(url));

  const signedUrlsMap = await signStoragePaths("audytorzy", auditorPaths, 60 * 60);

  const auditorsWithAvatars = audytorzy.map((auditor) => ({
    id: auditor.id,
    imie_i_nazwisko: auditor.imie_i_nazwisko,
    avatarUrl: auditor.zdjecie_url ? signedUrlsMap[auditor.zdjecie_url as string] : null,
  }));

  // FLD-QUOTE-BASKET-SELECT (WO, "Kształt zmiany"): KOMPLET koszyków (aktywne i wycofane) —
  // filtrowanie po puli/aktywności jest zadaniem `selectableBaskets` (lib/schedule/basket-select),
  // nie tego Server Component. Wzorzec identyczny z `settings/calendar/page.tsx`. Zapytanie
  // opakowane w try/catch tak jak `actorRole` powyżej — to dodatek do karty leada (dialog
  // rezerwacji), nie krytyczna ścieżka odczytu; awaria tego zapytania nie ma wywalać całej
  // strony szczegółu leada.
  let baskets: Awaited<ReturnType<typeof prisma.visitDurationBasket.findMany>> = [];
  try {
    baskets = await prisma.visitDurationBasket.findMany();
  } catch {
    baskets = [];
  }

  // FLD-QUOTE-BASKET-SELECT (dziura 2, contract-steward): rezerwacje TEGO leada, zmapowane na
  // kontrakt {id, scheduledStart, basketId} — etykieta koszyka jest znajdowana przez
  // `<LeadBookingsList>` (findBasketById), nigdy wyliczana tutaj.
  let bookings: LeadBookingRow[] = [];
  try {
    const bookingRows = await prisma.booking.findMany({ where: { leadId: lead.id } });
    bookings = bookingRows.map((booking) => ({
      id: booking.id,
      scheduledStart: booking.scheduledStart,
      basketId: booking.visitBasketId,
    }));
  } catch {
    bookings = [];
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-300">
      <div className="mb-6">
        <Link href="/leads">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground -ml-4 gap-2">
            <ArrowLeft size={16} /> Powrót do tablicy
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Główna zawartość - 2 kolumny */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card p-8 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-4">
                {name}
                <StatusPill
                  className="text-sm px-4 py-1"
                  label={formatLeadStatus(lead.status)}
                  tone={lead.status ? LEAD_STATUS_TONE[lead.status as LeadStatus] : "neutral"}
                />
              </h1>
              <div className="flex items-center gap-2">
                <EditLeadModal
                  leadId={lead.id}
                  defaultOpen={isEditMode}
                  initialData={{
                    name,
                    phone,
                    email,
                    address,
                    estimatedQuote,
                  }}
                  actorRole={actorRole}
                />
                <DeleteLeadButton leadId={lead.id} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
              ID: {lead.id} • Utworzono: {formatDate(lead.created_at, "dd.MM.yyyy HH:mm")}
            </p>

            <div className="space-y-12">
              {/* Sekcja: Wybrane urządzenia i wycena (TERAZ NA GÓRZE) */}
              <section>
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-border">Preferencje urządzeń i Wycena</h3>
                <div className="bg-secondary rounded-xl p-6 border border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Preferowany termin audytu</p>
                      <p className="font-medium text-lg">
                        {lead.data_rezerwacji
                          ? formatDate(lead.data_rezerwacji, "dd.MM.yyyy HH:mm")
                          : EMPTY_VALUE}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-card rounded-lg border border-primary/10">
                    <p className="text-sm text-muted-foreground mb-3 font-semibold">Wybrany zestaw (Triage):</p>
                    {extUnit || intUnits.length > 0 ? (
                      <div className="space-y-4">
                        {extUnit && (
                          <div>
                            <span className="text-xs font-bold uppercase text-muted-foreground/60">Jednostka zewnętrzna:</span>
                            <div className="font-medium text-foreground mt-1">
                              {extUnit.brand} {extUnit.model_code} <span className="text-muted-foreground font-normal">({extUnit.cooling_capacity_kw} kW)</span>
                            </div>
                          </div>
                        )}
                        {intUnits.length > 0 && (
                          <div>
                            <span className="text-xs font-bold uppercase text-muted-foreground/60">Jednostki wewnętrzne ({intUnits.length}):</span>
                            <ul className="mt-1 space-y-2">
                              {intUnits.map((iu: any, idx: number) => (
                                <li key={idx} className="font-medium text-foreground flex items-center gap-2 before:content-['•'] before:text-primary">
                                  {iu.brand} {iu.series_name || iu.model_code} <span className="text-muted-foreground font-normal">({iu.cooling_capacity_kw} kW, {iu.color})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="font-medium text-lg">{triage.selectedDeviceLine || "Nie wybrano konkretnej linii (zdano się na audytora)"}</p>
                    )}
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Estymowana wycena z Triage</p>
                    <p className="text-2xl font-bold font-mono text-primary">{estimatedQuote}</p>
                  </div>
                </div>
              </section>

              {/* Sekcja: Dane kontaktowe */}
              <section>
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-border">Dane kontaktowe i Adres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Imię i nazwisko</p>
                    <p className="font-medium text-lg">{name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Telefon</p>
                    <p className="font-medium text-lg">{phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="font-medium text-lg">{email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Adres montażu</p>
                    <p className="font-medium text-lg">{address}</p>
                  </div>
                </div>
              </section>

              {/* Sekcja: Informacje o obiekcie */}
              <section>
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-border">Informacje o obiekcie (Triage)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Rodzaj obiektu</p>
                    <p className="font-medium text-lg">{location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Stan wykończenia</p>
                    <p className="font-medium text-lg">{buildingState}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Liczba pomieszczeń</p>
                    <p className="font-medium text-lg">{roomCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Wielkości pokoi</p>
                    <p className="font-medium text-lg">{roomSizes}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Piętro</p>
                    <p className="font-medium text-lg">{floorDisplay}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Możliwy agregat na balkonie</p>
                    <p className="font-medium text-lg">{hasBalcony}</p>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>

        {/* Sidebar - Prawa kolumna */}
        <div className="lg:col-span-1 space-y-6">
          <AssignAuditor
            leadId={lead.id}
            currentAuditorId={lead.audytor_id}
            auditors={auditorsWithAvatars}
            actorRole={actorRole}
          />
          <CreateBookingDialog
            baskets={baskets}
            leadId={lead.id}
            subject={{ kind: "LEAD", leadId: lead.id }}
            actorRole={actorRole}
          />
          <LeadBookingsList bookings={bookings} baskets={baskets} />
        </div>
      </div>
    </div>
  );
}
