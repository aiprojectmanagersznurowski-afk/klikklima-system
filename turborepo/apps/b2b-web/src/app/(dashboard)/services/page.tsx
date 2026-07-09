"use client"
import React from "react"
import { MoreVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ServiceScreen() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Przeglądy i Serwisy</h1>
        <p className="text-sm text-gray-500 mt-1">Zarządzanie cyklem posprzedażowym i przypomnieniami.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-500">Serwisy w tym miesiącu</span>
          <span className="text-3xl font-bold text-gray-900">24</span>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-red-600">Przeterminowane</span>
          <span className="text-3xl font-bold text-red-700">3</span>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-orange-600">Oczekuje na wysyłkę SMS</span>
          <span className="text-3xl font-bold text-orange-700">12</span>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-green-600">Umówione</span>
          <span className="text-3xl font-bold text-green-700">9</span>
        </CardContent></Card>
      </div>

      <Card>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium">Klient</th>
              <th className="px-6 py-4 font-medium">Model sprzętu</th>
              <th className="px-6 py-4 font-medium text-gray-400">Ostatni serwis</th>
              <th className="px-6 py-4 font-semibold text-gray-900">Następny serwis</th>
              <th className="px-6 py-4 font-medium">Status komunikacji</th>
              <th className="px-6 py-4 text-right font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { client: "Jan Kowalski", model: "Daikin Sensira 3.5kW", last: "10 Kwi 2025", next: "10 Kwi 2026", status: "Przeterminowane", badge: "destructive", badgeClasses: "bg-red-100 text-red-700 border-red-200" },
              { client: "Firma XYZ", model: "LG Standard Plus", last: "15 Sie 2025", next: "15 Sie 2026", status: "Oczekuje na SMS", badge: "secondary", badgeClasses: "bg-orange-100 text-orange-700 border-orange-200" },
              { client: "Anna Nowak", model: "Mitsubishi Heavy", last: "01 Wrz 2025", next: "01 Wrz 2026", status: "Wysłano przypomnienie", badge: "outline", badgeClasses: "text-gray-900 border-gray-200" },
              { client: "Piotr Wiśniewski", model: "Gree Lomo", last: "20 Wrz 2025", next: "20 Wrz 2026", status: "Termin umówiony", badge: "default", badgeClasses: "bg-green-100 text-green-700 border-green-200" },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-blue-600 hover:underline cursor-pointer">{row.client}</td>
                <td className="px-6 py-4 text-gray-600">{row.model}</td>
                <td className="px-6 py-4 text-gray-400">{row.last}</td>
                <td className="px-6 py-4 font-bold text-gray-900">{row.next}</td>
                <td className="px-6 py-4"><Badge variant={row.badge as any} className={row.badgeClasses}>{row.status}</Badge></td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-600"><MoreVertical size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
