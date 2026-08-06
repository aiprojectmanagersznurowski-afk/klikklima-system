"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  FileText,
  Phone,
  Mail,
  Calendar,
  Wrench,
  AlertTriangle,
  Send,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  FolderOpen,
  MessageSquare,
  UserCheck,
  Building2,
  RefreshCw
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { addClientNote } from "../actions";

interface ClientDetailsProps {
  client: {
    id: string;
    imie_i_nazwisko: string;
    email: string;
    telefon: string;
    createdAt: Date;
    addresses: Array<{ id: string; ulica_miasto: string | null; created_at: Date }>;
    leads: Array<{
      id: string;
      status: string | null;
      estymowana_wycena: string | null;
      finalna_wycena_pln: any;
      created_at: Date;
      audytor?: { imie_i_nazwisko: string; telefon: string | null } | null;
    }>;
    installations: Array<{
      id: string;
      status: string;
      data_planowana: Date | null;
      data_zakonczenia: Date | null;
      protokol_url: string | null;
      leadStatus?: string | null;
      wycena?: string;
      zespol?: { nazwa: string; telefon_kontaktowy: string | null } | null;
    }>;
    services: Array<{
      id: string;
      opis_usterki: string | null;
      status: string;
      data_zgloszenia: Date;
      data_realizacji: Date | null;
      zespol?: { nazwa: string } | null;
    }>;
    notes: Array<{ id: string; date: Date; content: string; author: string }>;
    contactLogs: Array<{
      id: string;
      date: Date;
      type: "EMAIL" | "SMS";
      template: string;
      title: string;
      recipient: string;
      status: string;
    }>;
  };
}

export function ClientDetailsClient({ client }: ClientDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [newNoteText, setNewNoteText] = useState("");
  const [selectedLeadForNote, setSelectedLeadForNote] = useState(client.leads[0]?.id || "");
  const [isSavingNote, setIsSavingNote] = useState(false);

  function getInitials(name: string) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || "K").toUpperCase();
  }

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !selectedLeadForNote) return;
    setIsSavingNote(true);
    const res = await addClientNote(selectedLeadForNote, newNoteText.trim());
    setIsSavingNote(false);
    if (res.success) {
      setNewNoteText("");
      window.location.reload();
    } else {
      alert("Nie udało się zapisać notatki.");
    }
  };

  const badgeColorForStatus = (status: string | null) => {
    if (!status) return "secondary";
    if (status.includes("COMPLETED") || status.includes("PAID") || status.includes("Znak") || status === "Zrealizowane") {
      return "bg-primary/10 text-primary border-primary/20";
    }
    if (status.includes("IN_PROGRESS") || status.includes("AUDIT_COMPLETED") || status.includes("QUOTE_ACCEPTED")) {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
    if (status.includes("CANCELLED") || status.includes("REJECTED") || status.includes("Utracony")) {
      return "bg-red-100 text-red-700 border-red-200";
    }
    return "bg-orange-100 text-orange-700 border-orange-200";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Link href="/clients" className="text-sm font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Powrót do Listy Klientów
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 border-b border-gray-200 pb-8">
        <div className="flex items-center gap-5">
          <Avatar className="w-20 h-20 text-2xl border-2 border-blue-100 shadow-sm">
            <AvatarFallback className="bg-blue-600 text-white font-bold">
              {getInitials(client.imie_i_nazwisko)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              {client.imie_i_nazwisko}
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border border-blue-200">
                ID: {client.id.slice(0, 8)}...
              </Badge>
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-gray-400" />
                {client.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-gray-400" />
                {client.telefon}
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="h-4 w-4 text-gray-400" />
                Rejestracja: {new Date(client.createdAt).toLocaleDateString("pl-PL")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setActiveTab("notes")}
            className="border-gray-300 shadow-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Plus className="h-4 w-4 text-blue-600" />
            Dodaj Notatkę
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Odśwież Dane
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-100/80 p-1 rounded-lg h-auto flex flex-wrap gap-1 w-full justify-start border border-gray-200">
          <TabsTrigger value="overview" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Szczegóły Klienta
          </TabsTrigger>
          <TabsTrigger value="leads" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Powiązane Leady ({client.leads.length})
          </TabsTrigger>
          <TabsTrigger value="installations" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Instalacje ({client.installations.length})
          </TabsTrigger>
          <TabsTrigger value="services" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Serwisy i Usterki ({client.services.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Dokumenty i Faktury
          </TabsTrigger>
          <TabsTrigger value="notes" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Notatki ({client.notes.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="px-4 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Send className="h-4 w-4" />
            Ostatnie Kontakty ({client.contactLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  Główne Dane Kontaktowe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-3">
                  <span className="text-gray-500 font-medium">Imię i Nazwisko / Firma</span>
                  <span className="col-span-2 font-semibold text-gray-900">{client.imie_i_nazwisko}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-3">
                  <span className="text-gray-500 font-medium">Adres E-mail</span>
                  <span className="col-span-2 text-blue-600 font-medium">{client.email}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-3">
                  <span className="text-gray-500 font-medium">Numer Telefonu</span>
                  <span className="col-span-2 font-medium text-gray-900">{client.telefon}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <span className="text-gray-500 font-medium">Preferowany Kanał</span>
                  <span className="col-span-2 flex items-center gap-2 font-medium text-gray-700">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs rounded-full font-semibold">
                      {client.email !== "Brak email" ? "Email + SMS (Automatyczny)" : "Wyłącznie SMS"}
                    </Badge>
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  Powiązane Adresy ({client.addresses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {client.addresses.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">
                    Brak zdefiniowanych adresów dla tego klienta w tabeli `adresy`.
                  </div>
                ) : (
                  client.addresses.map((addr, idx) => (
                    <div key={addr.id} className="flex gap-3.5 items-start p-3.5 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition-colors">
                      <MapPin className="text-blue-600 mt-1 h-5 w-5 shrink-0" />
                      <div>
                        <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                          <span>Adres #{idx + 1} (Główny montażu)</span>
                          <Badge variant="outline" className="text-[10px] bg-white text-gray-600">Aktywny</Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1 leading-relaxed">
                          {addr.ulica_miasto || "Nieoznaczona lokalizacja"}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Dodano: {new Date(addr.created_at).toLocaleDateString("pl-PL")}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: LEADS */}
        <TabsContent value="leads">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-900">
                Historia Lejka i Zgłoszonych Leadów
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="w-full">
                <TableHeader className="bg-gray-50/30">
                  <TableRow className="border-b border-gray-100">
                    <TableHead className="py-3 px-6 font-medium text-gray-600">ID Leada</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Data Zgłoszenia</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Status Leada</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Wycena</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Przypisany Audytor</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600 text-right">Link do Leada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {client.leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-gray-500">
                        Brak powiązanych leadów dla tego klienta.
                      </TableCell>
                    </TableRow>
                  ) : (
                    client.leads.map(lead => (
                      <TableRow key={lead.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-3.5 px-6 font-mono font-semibold text-xs text-gray-700">
                          #{lead.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-sm text-gray-600">
                          {new Date(lead.created_at).toLocaleDateString("pl-PL")}
                        </TableCell>
                        <TableCell className="py-3.5 px-6">
                          <Badge className={badgeColorForStatus(lead.status)}>
                            {lead.status || "NOWY"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3.5 px-6 font-medium text-gray-900">
                          {lead.finalna_wycena_pln ? `${lead.finalna_wycena_pln} PLN` : lead.estymowana_wycena || "W trakcie wyceny"}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-sm">
                          {lead.audytor ? (
                            <span className="font-medium text-gray-900 flex items-center gap-2">
                              <UserCheck className="h-3.5 w-3.5 text-primary" />
                              {lead.audytor.imie_i_nazwisko}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Nie przypisano</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-right">
                          <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                              Otwórz Leada <ExternalLink className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: INSTALLATIONS */}
        <TabsContent value="installations">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-900">
                Zlecona i Zrealizowana Montaże (HVAC)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="w-full">
                <TableHeader className="bg-gray-50/30">
                  <TableRow className="border-b border-gray-100">
                    <TableHead className="py-3 px-6 font-medium text-gray-600">ID Instalacji</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Ekipa Monterska</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Planowana Data</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Status Montażu</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Protokół Odbioru</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {client.installations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-gray-500">
                        Brak zarejestrowanych instalacji dla tego klienta.
                      </TableCell>
                    </TableRow>
                  ) : (
                    client.installations.map(inst => (
                      <TableRow key={inst.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-3.5 px-6 font-mono text-xs font-medium text-gray-700">
                          #{inst.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="py-3.5 px-6 font-medium text-gray-900">
                          {inst.zespol ? (
                            <span className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-600" />
                              {inst.zespol.nazwa}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Oczekuje na przydział</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-sm text-gray-600">
                          {inst.data_planowana ? new Date(inst.data_planowana).toLocaleDateString("pl-PL") : "Do ustalenia z klientem"}
                        </TableCell>
                        <TableCell className="py-3.5 px-6">
                          <Badge className={badgeColorForStatus(inst.status)}>
                            {inst.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3.5 px-6">
                          {inst.protokol_url ? (
                            <a href={inst.protokol_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1.5 font-medium text-sm">
                              <FileText className="h-4 w-4 text-blue-600" /> Pobierz protokół PDF
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Brak dokumentu w bazie</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: SERVICES & USTERKI */}
        <TabsContent value="services">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
                Zgłoszone Usterki, Reklamacje oraz Serwisy Okresowe
              </CardTitle>
              <Button size="sm" variant="outline" className="text-orange-700 border-orange-200 bg-orange-50 hover:bg-orange-100">
                + Zarejestruj Nowy Serwis / Usterkę
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="w-full">
                <TableHeader className="bg-gray-50/30">
                  <TableRow className="border-b border-gray-100">
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Data Zgłoszenia</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Opis Usterki / Serwis</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Przypisana Ekipa</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Data Realizacji</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {client.services.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-gray-500">
                        Brak zgłoszonych serwisów ani usterek w historii klienta. Urządzenia pracują bezawaryjnie!
                      </TableCell>
                    </TableRow>
                  ) : (
                    client.services.map(srv => (
                      <TableRow key={srv.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-3.5 px-6 text-sm text-gray-600">
                          {new Date(srv.data_zgloszenia).toLocaleDateString("pl-PL")}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 font-medium text-gray-900">
                          {srv.opis_usterki || "Przegląd roczny gwarancyjny"}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-sm text-gray-600">
                          {srv.zespol ? srv.zespol.nazwa : "Oczekuje na przydzielenie ekipy"}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-sm text-gray-600">
                          {srv.data_realizacji ? new Date(srv.data_realizacji).toLocaleDateString("pl-PL") : "W trakcie planowania"}
                        </TableCell>
                        <TableCell className="py-3.5 px-6 text-right">
                          <Badge className={badgeColorForStatus(srv.status)}>
                            {srv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: DOCUMENTS */}
        <TabsContent value="documents">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-900">
                Archiwum Dokumentów, Protokołów i Faktur
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {[
                  { name: `Oferta_Wyceny_KlikKlima_${client.imie_i_nazwisko.replace(/\s+/g, "_")}.pdf`, type: "Wycena Leada", size: "1.2 MB", date: "Systemowo" },
                  { name: `Protokol_Montazu_HVAC_2026.pdf`, type: "Protokół Odbioru", size: "840 KB", date: "Od Montera" },
                  { name: `Faktura_Vat_2026_08_41.pdf`, type: "Faktura Płatności", size: "450 KB", date: "Integracja P24/Stripe" }
                ].map((doc, idx) => (
                  <div key={idx} className="p-4 px-6 flex justify-between items-center hover:bg-gray-50/80 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg flex items-center justify-center shadow-2xs">
                        <FileText size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-900 block">{doc.name}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>Typ: {doc.type}</span> • <span>Rozmiar: {doc.size}</span> • <span className="text-muted-foreground font-mono">{doc.date}</span>
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 font-medium">
                      Pobierz PDF
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: NOTES */}
        <TabsContent value="notes">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  Historia Notatek Wewnętrznych (Leady & Audyt)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {client.notes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-lg">
                    Brak notatek do tego klienta. Dopisane uwagi z leadów lub z formularza obok pojawią się w tym miejscu.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {client.notes.map((note, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-200/60 pb-2">
                          <span className="font-semibold text-gray-800">Autor: {note.author}</span>
                          <span className="text-gray-400">Powiązano z Lead ID: #{note.id.slice(0, 8)}</span>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {note.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200 h-fit">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Dodaj Szybką Notatkę
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {client.leads.length === 0 ? (
                  <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
                    Aby dodać notatkę wewnętrzną, klient musi posiadać przynajmniej 1 zarejestrowany lead w systemie.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 block">
                        Powiąż notatkę z leadem:
                      </label>
                      <select
                        value={selectedLeadForNote}
                        onChange={(e) => setSelectedLeadForNote(e.target.value)}
                        className="w-full text-sm rounded-md border border-gray-200 p-2 focus:outline-blue-600 bg-white"
                      >
                        {client.leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            Lead #{l.id.slice(0, 8)} - Status: {l.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 block">
                        Treść uwagi dyspozytora:
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Wpisz ważne informacje o preferencjach klienta, ustaleniach z audytu lub dojeździe..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        className="w-full text-sm rounded-md border border-gray-200 p-2.5 focus:outline-blue-600 bg-white resize-none"
                      />
                    </div>

                    <Button
                      onClick={handleAddNote}
                      disabled={isSavingNote || !newNoteText.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                    >
                      {isSavingNote ? "Zapisywanie..." : "Zapisz Notatkę w Bazie"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 7: CONTACT LOGS & NOTIFICATIONS */}
        <TabsContent value="contacts">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center justify-between">
                <span>Historia Wysyłek z Kolejkownika Powiadomień (SMS / E-mail)</span>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  Słownik: notification_definitions.md
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="w-full">
                <TableHeader className="bg-gray-50/30">
                  <TableRow className="border-b border-gray-100">
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Data Wysyłki</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Kanał & Szablon</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Tytuł / Treść Komunikatu</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600">Odbiorca</TableHead>
                    <TableHead className="py-3 px-6 font-medium text-gray-600 text-right">Status Kolejkownika</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {client.contactLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-3.5 px-6 text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {new Date(log.date).toLocaleString("pl-PL")}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 px-6">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={log.type === "EMAIL" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-teal-50 text-teal-700 border-teal-200"}>
                            {log.type}
                          </Badge>
                          <span className="font-mono text-xs text-gray-500 font-semibold">{log.template}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 px-6 font-medium text-gray-900 text-sm">
                        {log.title}
                      </TableCell>
                      <TableCell className="py-3.5 px-6 text-sm text-gray-600 font-mono text-xs">
                        {log.recipient}
                      </TableCell>
                      <TableCell className="py-3.5 px-6 text-right">
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-semibold rounded-full">
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
