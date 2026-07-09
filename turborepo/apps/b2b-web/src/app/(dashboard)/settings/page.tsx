"use client"
import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function SettingsScreen() {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Ustawienia platformy</h1>
      
      <div className="flex gap-8 items-start">
        <div className="w-64 shrink-0 space-y-1">
          {["Ogólne", "Zarządzanie Dostępem", "Integracje (Stripe)"].map((item, i) => (
            <button key={item} className={cn(
              "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              i === 1 ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}>
              {item}
            </button>
          ))}
        </div>

        <Card className="flex-1">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Konta Pracowników</h2>
              <p className="text-sm text-gray-500">Zarządzaj dostępem do platformy KlikKlima B2B.</p>
            </div>
            <Button onClick={() => setShowInviteModal(true)} className="gap-2"><Plus size={16}/> Zaproś pracownika</Button>
          </div>
          
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 font-medium">Użytkownik</th>
                <th className="px-6 py-3 font-medium">Rola</th>
                <th className="px-6 py-3 font-medium">Ostatnie logowanie</th>
                <th className="px-6 py-3 font-medium text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-6 py-4 flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">MK</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-gray-900">Michał Kowalski</div>
                    <div className="text-xs text-gray-500">michal@klikklima.pl</div>
                  </div>
                </td>
                <td className="px-6 py-4"><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200" variant="outline">Dyspozytor</Badge></td>
                <td className="px-6 py-4 text-gray-500">Dzisiaj, 08:32</td>
                <td className="px-6 py-4 text-right"><Button variant="ghost" size="sm" className="text-gray-400">Edytuj</Button></td>
              </tr>
              <tr>
                <td className="px-6 py-4 flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">AD</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-gray-900">Admin Główny</div>
                    <div className="text-xs text-gray-500">admin@klikklima.pl</div>
                  </div>
                </td>
                <td className="px-6 py-4"><Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200" variant="outline">Administrator</Badge></td>
                <td className="px-6 py-4 text-gray-500">Wczoraj, 22:15</td>
                <td className="px-6 py-4 text-right"><Button variant="ghost" size="sm" className="text-gray-400">Edytuj</Button></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl scale-in-95 duration-200">
            <CardHeader className="flex flex-row justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <CardTitle className="text-lg">Zaproś pracownika</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Wyślij zaproszenie z odpowiednią rolą do systemu.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Email pracownika</label>
                <input type="email" placeholder="jan@klikklima.pl" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Rola w systemie</label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white">
                  <option>Dyspozytor</option>
                  <option>Audytor</option>
                  <option>Administrator</option>
                  <option>Monter</option>
                </select>
              </div>
            </CardContent>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowInviteModal(false)}>Anuluj</Button>
              <Button>Wyślij zaproszenie</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
