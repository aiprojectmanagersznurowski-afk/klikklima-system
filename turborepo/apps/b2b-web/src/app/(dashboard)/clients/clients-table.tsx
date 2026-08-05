"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ExternalLink, User, Phone, Mail, MapPin, Building, Wrench } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface ClientRowData {
  id: string;
  imie_i_nazwisko: string;
  email: string;
  telefon: string;
  mainAddress: string;
  activeLeadsCount: number;
  totalInstallationsCount: number;
  servicesCount: number;
  createdAt: Date;
}

interface ClientsTableProps {
  initialClients: ClientRowData[];
}

export function ClientsTable({ initialClients }: ClientsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return initialClients;
    const lower = searchTerm.toLowerCase();
    return initialClients.filter(client =>
      client.imie_i_nazwisko.toLowerCase().includes(lower) ||
      client.email.toLowerCase().includes(lower) ||
      client.telefon.toLowerCase().includes(lower) ||
      client.mainAddress.toLowerCase().includes(lower)
    );
  }, [initialClients, searchTerm]);

  function getInitials(name: string) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || "K").toUpperCase();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <User className="text-blue-600 h-8 w-8" />
            Klienci w Systemie
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Zarządzaj bazą klientów B2B oraz B2C, przeglądaj historię ich leadów, montaży oraz zleceń serwisowych.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-blue-50/50 border-blue-200 text-blue-700 text-sm px-3 py-1.5 font-medium">
            Razem w bazie: {initialClients.length}
          </Badge>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Lista Zarejestrowanych Klientów
            </CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Szukaj po imieniu, emailu, telefonie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 border-gray-200 focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="w-full">
            <TableHeader className="bg-gray-50/30">
              <TableRow className="border-b border-gray-100">
                <TableHead className="py-3.5 px-6 font-medium text-gray-600">Klient</TableHead>
                <TableHead className="py-3.5 px-6 font-medium text-gray-600">Dane Kontaktowe</TableHead>
                <TableHead className="py-3.5 px-6 font-medium text-gray-600">Adres Główny</TableHead>
                <TableHead className="py-3.5 px-6 font-medium text-gray-600 text-center">Aktywne Leady</TableHead>
                <TableHead className="py-3.5 px-6 font-medium text-gray-600 text-center">Instalacje / Serwisy</TableHead>
                <TableHead className="py-3.5 px-6 font-medium text-gray-600 text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center text-gray-500">
                    Brak klientów spełniających podane kryteria wyszukiwania.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-blue-50/30 transition-colors group">
                    <TableCell className="py-4 px-6 font-medium text-gray-900">
                      <div className="flex items-center gap-3.5">
                        <Avatar className="h-10 w-10 border border-gray-200">
                          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xs">
                            {getInitials(client.imie_i_nazwisko)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {client.imie_i_nazwisko}
                          </div>
                          <div className="text-xs text-gray-400">
                            Dodano: {new Date(client.createdAt).toLocaleDateString("pl-PL")}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-6">
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{client.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{client.telefon}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <span className="max-w-xs truncate" title={client.mainAddress}>
                          {client.mainAddress}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-6 text-center">
                      <Badge variant={client.activeLeadsCount > 0 ? "default" : "secondary"} className="font-semibold">
                        {client.activeLeadsCount} lead(ów)
                      </Badge>
                    </TableCell>

                    <TableCell className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 font-medium text-xs">
                          Montaże: {client.totalInstallationsCount}
                        </Badge>
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 font-medium text-xs flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {client.servicesCount}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-6 text-right">
                      <Link href={`/clients/${client.id}`} target="_blank" rel="noopener noreferrer" passHref>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 gap-1.5 transition-all shadow-sm font-medium"
                        >
                          <span>Karta 360</span>
                          <ExternalLink className="h-3.5 w-3.5" />
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
    </div>
  );
}
