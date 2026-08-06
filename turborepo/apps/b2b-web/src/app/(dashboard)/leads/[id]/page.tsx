import React from "react";
import { prisma } from "@repo/database";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AssignAuditor } from "./assign-auditor";
import { EditLeadModal } from "./edit-lead-modal";
import { DeleteLeadButton } from "./delete-lead-button";

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

  const lead = await prisma.leady.findUnique({
    where: { id },
    include: {
      klient: true,
      adres: true,
    },
  });

  if (!lead) {
    return notFound();
  }

  const triage = (lead.odpowiedzi_triage as any) || {};

  const name = lead.klient?.imie_i_nazwisko || "Brak danych";
  const phone = lead.klient?.telefon || "Brak danych";
  const email = lead.klient?.email || "Brak danych";
  const address = lead.adres?.ulica_miasto || "Brak danych";
  
  const location = triage.location || "Brak danych";
  const buildingState = triage.buildingState || "Brak danych";
  const roomCount = triage.roomCount || "Brak danych";
  const hasBalcony = triage.hasBalcony !== undefined ? (triage.hasBalcony ? "Tak" : "Nie") : "Brak danych";
  const floorNumber = triage.floor;
  const floorDisplay = floorNumber === 0 ? "Parter" : floorNumber !== null && floorNumber !== undefined ? `Piętro ${floorNumber}` : "Brak danych";

  const roomSizes = triage.roomSizes 
    ? Object.entries(triage.roomSizes).map(([key, value]) => `Pokój ${key}: ${value}`).join(", ")
    : "Brak danych";

  const estimatedQuote = lead.estymowana_wycena || "Brak estymacji";

  // Device configuration info
  const extUnit = triage.selectedExternalUnit;
  const intUnits = triage.selectedInternalUnits || [];

  // Fetch all auditors
  const audytorzy = await prisma.audytorzy.findMany({
    orderBy: { imie_i_nazwisko: "asc" },
  });

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Bulk generate signed URLs for auditors
  const auditorPaths = audytorzy
    .map(a => a.zdjecie_url)
    .filter((url): url is string => Boolean(url));
  
  let signedUrlsMap: Record<string, string> = {};
  if (auditorPaths.length > 0) {
    const { data } = await supabase.storage
      .from("audytorzy")
      .createSignedUrls(auditorPaths, 60 * 60);
    
    if (data) {
      data.forEach(item => {
        if (!item.error && item.signedUrl && item.path) {
          signedUrlsMap[item.path as string] = item.signedUrl;
        }
      });
    }
  }

  const auditorsWithAvatars = audytorzy.map((auditor) => ({
    ...auditor,
    avatarUrl: auditor.zdjecie_url ? signedUrlsMap[auditor.zdjecie_url as string] : null,
  }));

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
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-4">
                {name}
                <Badge variant="outline" className="text-sm bg-primary/10 text-primary border-primary/20 px-4 py-1">
                  {(lead.status || "").replace(/_/g, " ")}
                </Badge>
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
                />
                <DeleteLeadButton leadId={lead.id} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
              ID: {lead.id} • Utworzono: {format(new Date(lead.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
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
                          ? format(new Date(lead.data_rezerwacji), "dd.MM.yyyy HH:mm", { locale: pl }) 
                          : "Brak wybranego terminu"}
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
          <AssignAuditor leadId={lead.id} currentAuditorId={lead.audytor_id} auditors={auditorsWithAvatars as any} />
        </div>
      </div>
    </div>
  );
}
