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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Przeglądy i Serwisy</h1>
        <p className="text-sm text-muted-foreground mt-1">Zarządzanie cyklem posprzedażowym i przypomnieniami.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-xs"><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Serwisy w tym miesiącu</span>
          <span className="text-3xl font-bold font-mono text-foreground">24</span>
        </CardContent></Card>
        <Card className="rounded-2xl border-border bg-card shadow-xs"><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-destructive">Przeterminowane</span>
          <span className="text-3xl font-bold font-mono text-destructive">3</span>
        </CardContent></Card>
        <Card className="rounded-2xl border-border bg-card shadow-xs"><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-amber-600 dark:text-amber-500">Oczekuje na wysyłkę SMS</span>
          <span className="text-3xl font-bold font-mono text-amber-600 dark:text-amber-500">12</span>
        </CardContent></Card>
        <Card className="rounded-2xl border-border bg-card shadow-xs"><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-primary">Umówione</span>
          <span className="text-3xl font-bold font-mono text-primary">9</span>
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-semibold tracking-wider border-b border-border">
            <tr>
              <th className="p-3.5 px-6">Klient</th>
              <th className="p-3.5 px-6">Model sprzętu</th>
              <th className="p-3.5 px-6">Ostatni serwis</th>
              <th className="p-3.5 px-6">Następny serwis</th>
              <th className="p-3.5 px-6">Status komunikacji</th>
              <th className="p-3.5 px-6 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              { client: "Jan Kowalski", model: "Daikin Sensira 3.5kW", last: "10 Kwi 2025", next: "10 Kwi 2026", status: "Przeterminowane", badge: "destructive", badgeClasses: "bg-destructive/10 text-destructive border-destructive/20 font-semibold rounded-full" },
              { client: "Firma XYZ", model: "LG Standard Plus", last: "15 Sie 2025", next: "15 Sie 2026", status: "Oczekuje na SMS", badge: "secondary", badgeClasses: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 font-semibold rounded-full" },
              { client: "Anna Nowak", model: "Mitsubishi Heavy", last: "01 Wrz 2025", next: "01 Wrz 2026", status: "Wysłano przypomnienie", badge: "outline", badgeClasses: "text-foreground border-border font-medium rounded-full bg-secondary/40" },
              { client: "Piotr Wiśniewski", model: "Gree Lomo", last: "20 Wrz 2025", next: "20 Wrz 2026", status: "Termin umówiony", badge: "default", badgeClasses: "bg-primary/10 text-primary border-primary/20 font-semibold rounded-full" },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-secondary/30 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground hover:text-primary transition-colors cursor-pointer">{row.client}</td>
                <td className="px-6 py-4 font-mono font-medium text-foreground/90">{row.model}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{row.last}</td>
                <td className="px-6 py-4 font-mono text-xs font-bold text-foreground">{row.next}</td>
                <td className="px-6 py-4"><Badge variant={row.badge as any} className={row.badgeClasses}>{row.status}</Badge></td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary"><MoreVertical size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
