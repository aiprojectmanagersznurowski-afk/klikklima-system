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

export const dynamic = "force-dynamic";

export default async function LeadDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const auditorsWithAvatars = await Promise.all(
    audytorzy.map(async (auditor) => {
      let signedUrl = auditor.zdjecie_url;
      if (signedUrl) {
        const { data } = await supabase.storage
          .from("audytorzy")
          .createSignedUrl(signedUrl, 60 * 60);
        if (data) signedUrl = data.signedUrl;
      }
      return {
        ...auditor,
        avatarUrl: signedUrl,
      };
    })
  );

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <Link href="/kanban">
          <Button variant="ghost" className="gap-2 -ml-4 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={16} /> Powrót do tablicy
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Główna zawartość - 2 kolumny */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
              <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700 border-blue-200 px-4 py-1">
                {(lead.status || "").replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">
              ID: {lead.id} • Utworzono: {format(new Date(lead.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
            </p>

            <div className="space-y-12">
              {/* Sekcja: Wybrane urządzenia i wycena (TERAZ NA GÓRZE) */}
              <section>
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-gray-100">Preferencje urządzeń i Wycena</h3>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 mb-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Preferowany termin audytu</p>
                      <p className="font-medium text-lg">
                        {lead.data_rezerwacji 
                          ? format(new Date(lead.data_rezerwacji), "dd.MM.yyyy HH:mm", { locale: pl }) 
                          : "Brak wybranego terminu"}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100">
                    <p className="text-sm text-gray-500 mb-3 font-semibold">Wybrany zestaw (Triage):</p>
                    {extUnit || intUnits.length > 0 ? (
                      <div className="space-y-4">
                        {extUnit && (
                          <div>
                            <span className="text-xs font-bold uppercase text-gray-400">Jednostka zewnętrzna:</span>
                            <div className="font-medium text-gray-900 mt-1">
                              {extUnit.brand} {extUnit.model_code} <span className="text-gray-500 font-normal">({extUnit.cooling_capacity_kw} kW)</span>
                            </div>
                          </div>
                        )}
                        {intUnits.length > 0 && (
                          <div>
                            <span className="text-xs font-bold uppercase text-gray-400">Jednostki wewnętrzne ({intUnits.length}):</span>
                            <ul className="mt-1 space-y-2">
                              {intUnits.map((iu: any, idx: number) => (
                                <li key={idx} className="font-medium text-gray-900 flex items-center gap-2 before:content-['•'] before:text-blue-500">
                                  {iu.brand} {iu.series_name || iu.model_code} <span className="text-gray-500 font-normal">({iu.cooling_capacity_kw} kW, {iu.color})</span>
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
                  
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Estymowana wycena z Triage</p>
                    <p className="text-2xl font-bold text-blue-700">{estimatedQuote}</p>
                  </div>
                </div>
              </section>

              {/* Sekcja: Dane kontaktowe */}
              <section>
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-gray-100">Dane kontaktowe i Adres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Imię i nazwisko</p>
                    <p className="font-medium text-lg">{name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Telefon</p>
                    <p className="font-medium text-lg">{phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="font-medium text-lg">{email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Adres montażu</p>
                    <p className="font-medium text-lg">{address}</p>
                  </div>
                </div>
              </section>

              {/* Sekcja: Informacje o obiekcie */}
              <section>
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-gray-100">Informacje o obiekcie (Triage)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Rodzaj obiektu</p>
                    <p className="font-medium text-lg">{location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Stan wykończenia</p>
                    <p className="font-medium text-lg">{buildingState}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Liczba pomieszczeń</p>
                    <p className="font-medium text-lg">{roomCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Wielkości pokoi</p>
                    <p className="font-medium text-lg">{roomSizes}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Piętro</p>
                    <p className="font-medium text-lg">{floorDisplay}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Możliwy agregat na balkonie</p>
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
