"use client"
import React, { useState } from "react"
import { MapPin, FileText } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function Client360View() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-5">
          <Avatar className="w-20 h-20 text-2xl">
            <AvatarFallback className="bg-blue-100 text-blue-700">JK</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Jan Kowalski</h1>
            <div className="flex gap-2">
              <Badge variant="secondary">B2C</Badge>
              <Badge variant="outline">Stały Klient</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Dodaj notatkę</Button>
          <Button>Edytuj dane</Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: "overview", label: "Informacje Ogólne" },
            { id: "installations", label: "Instalacje i Leady" },
            { id: "documents", label: "Dokumenty i Faktury" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 px-1 text-sm font-medium transition-all border-b-2 relative -bottom-px",
                activeTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-2">
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Dane kontaktowe</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-4">
                  <div className="text-gray-500">E-mail</div>
                  <div className="col-span-2 font-medium text-gray-900">jan.kowalski@example.com</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-4">
                  <div className="text-gray-500">Telefon</div>
                  <div className="col-span-2 font-medium text-gray-900">+48 123 456 789</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-gray-500">Pref. kanał</div>
                  <div className="col-span-2 font-medium text-gray-900">Email</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle>Adresy</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3 items-start">
                  <MapPin className="text-blue-600 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-sm mb-1 text-gray-900">Adres główny (Instalacji)</div>
                    <div className="text-sm text-gray-500 leading-relaxed">ul. Słoneczna 12/4<br/>00-112 Warszawa</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <FileText className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-sm mb-1 text-gray-900">Adres korespondencyjny</div>
                    <div className="text-sm text-gray-500">Taki sam jak główny</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "installations" && (
          <Card>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 font-medium">Data utworzenia</th>
                  <th className="px-6 py-3 font-medium">Typ sprzętu (Model)</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Przypisany Audytor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4">12 Maj 2026</td>
                  <td className="px-6 py-4 font-medium text-gray-900">Daikin Sensira 3.5kW</td>
                  <td className="px-6 py-4"><Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Wycena zaakceptowana</Badge></td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px]">AK</AvatarFallback>
                    </Avatar> 
                    Anna K.
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4">01 Kwi 2024</td>
                  <td className="px-6 py-4 font-medium text-gray-900">Mitsubishi Heavy 2.5kW</td>
                  <td className="px-6 py-4"><Badge className="bg-green-100 text-green-700 border-green-200">Instalacja zakończona</Badge></td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px]">PJ</AvatarFallback>
                    </Avatar>
                    Piotr J.
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === "documents" && (
          <Card>
            <div className="divide-y divide-gray-100">
              {['Wycena_Daikin_Kowalski.pdf', 'Protokol_Odbioru_2024.pdf', 'Faktura_FV_123_2024.pdf'].map((doc) => (
                <div key={doc} className="p-4 px-6 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{doc}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600">Pobierz</Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
