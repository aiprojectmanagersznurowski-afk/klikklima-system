"use client"
import React from "react"
import { CheckCircle2, ChevronDown, Calendar, Wrench } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function InstallationDetails() {
  const steps = ["Wycena", "Oczekuje na ekipę", "Wysyłka", "Dostarczony", "Instalacja", "Zakończona"];
  const currentStepIndex = 4;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm text-blue-600 font-semibold mb-1">Zlecenie #INST-2026-892</div>
          <h1 className="text-2xl font-bold text-gray-900">Instalacja: Jan Kowalski</h1>
        </div>
        <Button variant="outline">Anuluj zlecenie</Button>
      </div>

      <Card className="p-6">
        <div className="relative flex justify-between items-center w-full">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 transition-all" 
            style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
          ></div>
          
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            
            return (
              <div key={step} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-colors",
                  isCompleted ? "bg-blue-600 border-blue-600 text-white" :
                  isCurrent ? "bg-white border-blue-600 text-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.1)]" :
                  "bg-white border-gray-300 text-gray-400"
                )}>
                  {isCompleted ? <CheckCircle2 size={16} /> : idx + 4}
                </div>
                <span className={cn(
                  "text-xs font-medium absolute -bottom-6 whitespace-nowrap",
                  (isCompleted || isCurrent) ? "text-gray-900" : "text-gray-400"
                )}>{step}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-8 mt-12">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Zestawienie Sprzętu</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded border border-gray-200 flex items-center justify-center">
                    <Wrench className="text-gray-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Daikin Sensira 3.5kW</div>
                    <div className="text-sm text-gray-500">Model: FTXC35C/RXC35C</div>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-full font-semibold px-3 py-1" variant="outline">Na stanie</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Przypisani pracownicy</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-3">Inżynier / Audytor</div>
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                  <Avatar className="bg-purple-100 text-purple-700">
                    <AvatarFallback>AK</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm text-gray-900">Anna Kowalska</div>
                    <div className="text-xs text-gray-500">Wycena zaakceptowana</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-3">Ekipa Monterska</div>
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100 hover:border-blue-300 cursor-pointer transition-colors group">
                  <Avatar className="bg-orange-100 text-orange-700">
                    <AvatarFallback>M1</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">Ekipa "Południe"</div>
                    <div className="text-xs text-gray-500">M. Nowak, T. Kot</div>
                  </div>
                  <ChevronDown size={16} className="text-gray-400 group-hover:text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Data Instalacji</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 p-4 rounded-lg">
                <div className="flex items-center gap-3 text-blue-900">
                  <Calendar size={20} className="text-blue-600" />
                  <span className="font-medium">14 Lipca 2026, godz. 08:00</span>
                </div>
                <Button variant="outline" size="sm" className="bg-white">Zmień termin</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1">
          <Card className="h-full">
            <CardHeader className="border-b border-gray-100 pb-4"><CardTitle>Aktywności i Komunikacja</CardTitle></CardHeader>
            <CardContent className="pt-6 relative">
              <div className="absolute left-8 top-6 bottom-6 w-px bg-gray-200"></div>
              <div className="space-y-6 relative">
                
                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-blue-600 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Zmieniono status na: Instalacja</p>
                    <p className="text-xs text-gray-500 mt-1">Dziś, 09:41 przez System</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-gray-300 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm text-gray-800">Sprzęt odebrany z magazynu</p>
                    <p className="text-xs text-gray-500 mt-1">Dziś, 07:15 przez M. Nowak</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm text-gray-800">Płatność za pośrednictwem Stripe zakończona sukcesem</p>
                    <p className="text-xs text-gray-500 mt-1">Wczoraj, 14:20</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-gray-300 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm text-gray-800">Wysłano SMS z przypomnieniem o płatności</p>
                    <p className="text-xs text-gray-500 mt-1">11 Lipca, 10:00</p>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
