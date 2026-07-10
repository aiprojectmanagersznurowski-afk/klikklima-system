import React from "react";
import { prisma } from "@repo/database";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
  const floor = triage.floor || "Brak danych";

  const roomSizes = triage.roomSizes 
    ? Object.entries(triage.roomSizes).map(([key, value]) => `Pokój ${key}: ${value}`).join(", ")
    : "Brak danych";

  const estimatedQuote = lead.estymowana_wycena || "Brak estymacji";

  return (
    <div className="p-8 max-w-[1200px] mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <Link href="/kanban">
          <Button variant="ghost" className="gap-2 -ml-4 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={16} /> Powrót do tablicy
          </Button>
        </Link>
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Szczegóły Leada</h1>
          <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700 border-blue-200 px-4 py-1">
            {(lead.status || "").replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">
          ID: {lead.id} • Utworzono: {format(new Date(lead.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
        </p>

        <div className="space-y-12">
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
                <p className="font-medium text-lg">{floor}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Możliwy agregat na balkonie</p>
                <p className="font-medium text-lg">{hasBalcony}</p>
              </div>
            </div>
          </section>

          {/* Sekcja: Wybrane urządzenia i wycena */}
          <section>
            <h3 className="text-xl font-semibold border-b pb-3 mb-6 border-gray-100">Preferencje urządzeń i Wycena</h3>
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Preferowana seria klimatyzacji</p>
                  <p className="font-medium text-lg">{triage.selectedDeviceLine || "Nie wybrano konkretnej linii (zdano się na audytora)"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Preferowany termin audytu</p>
                  <p className="font-medium text-lg">
                    {lead.data_rezerwacji 
                      ? format(new Date(lead.data_rezerwacji), "dd.MM.yyyy HH:mm", { locale: pl }) 
                      : "Brak wybranego terminu"}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Estymowana wycena z Triage</p>
                <p className="text-2xl font-bold text-blue-700">{estimatedQuote}</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
