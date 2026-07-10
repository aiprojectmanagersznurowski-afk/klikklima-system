"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { leady as Lead } from "@repo/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailsModal({ lead, isOpen, onClose }: LeadDetailsModalProps) {
  if (!lead) return null;

  const triage = (lead.odpowiedzi_triage as any) || {};

  const name = triage.name || "Brak danych";
  const phone = triage.phone || "Brak danych";
  const email = triage.email || "Brak danych";
  const address = triage.address || "Brak danych";
  const location = triage.location || "Brak danych";
  const buildingState = triage.buildingState || "Brak danych";
  const roomCount = triage.roomCount || "Brak danych";
  const hasBalcony = triage.hasBalcony !== undefined ? (triage.hasBalcony ? "Tak" : "Nie") : "Brak danych";
  const floor = triage.floor || "Brak danych";

  const roomSizes = triage.roomSizes 
    ? Object.entries(triage.roomSizes).map(([key, value]) => `Pokój ${key}: ${value}`).join(", ")
    : "Brak danych";

  // Wycena może być w estymowana_wycena (które teraz jest zapisywane) lub policzona na szybko
  const estimatedQuote = lead.estymowana_wycena || "Brak estymacji";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Szczegóły Leada</DialogTitle>
            <Badge variant="outline" className="mr-6 bg-blue-50 text-blue-700 border-blue-200">
              {lead.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            ID: {lead.id} • Utworzono: {format(new Date(lead.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-8">
          {/* Sekcja: Dane kontaktowe */}
          <section>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Dane kontaktowe i Adres</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-sm text-gray-500">Imię i nazwisko</p>
                <p className="font-medium">{name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telefon</p>
                <p className="font-medium">{phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Adres montażu</p>
                <p className="font-medium">{address}</p>
              </div>
            </div>
          </section>

          {/* Sekcja: Informacje o obiekcie */}
          <section>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Informacje o obiekcie (Triage)</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-sm text-gray-500">Rodzaj obiektu</p>
                <p className="font-medium">{location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Stan wykończenia</p>
                <p className="font-medium">{buildingState}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Liczba pomieszczeń</p>
                <p className="font-medium">{roomCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Wielkości pokoi</p>
                <p className="font-medium">{roomSizes}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Piętro</p>
                <p className="font-medium">{floor}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Możliwy agregat na balkonie</p>
                <p className="font-medium">{hasBalcony}</p>
              </div>
            </div>
          </section>

          {/* Sekcja: Wybrane urządzenia i wycena */}
          <section>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Preferencje urządzeń i Wycena</h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-sm text-gray-500">Preferowana seria klimatyzacji</p>
                  <p className="font-medium">{triage.selectedDeviceLine || "Nie wybrano konkretnej linii (zdano się na audytora)"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Preferowany termin audytu</p>
                  <p className="font-medium">
                    {lead.data_rezerwacji 
                      ? format(new Date(lead.data_rezerwacji), "dd.MM.yyyy HH:mm", { locale: pl }) 
                      : "Brak wybranego terminu"}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">Estymowana wycena z Triage</p>
                <p className="text-xl font-bold text-blue-700">{estimatedQuote}</p>
              </div>
            </div>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
