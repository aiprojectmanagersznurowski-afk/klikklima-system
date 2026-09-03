import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  FileText,
  PlusCircle,
  User,
  Wrench,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import { EMPTY_VALUE } from "@/lib/empty-value";
import { getInstallationDetail } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Wyprowadzone bezpośrednio z rzeczywistego zwracanego typu `getInstallationDetail()`
 * (installations/[id]/actions.ts), tak jak leads-client.tsx robi to dla `getLeads()`.
 * Zmiana kształtu tam propaguje się tu automatycznie, zamiast wymagać ręcznej
 * aktualizacji drugiej, osobnej kopii tego samego typu.
 */
type InstallationDetail = NonNullable<Awaited<ReturnType<typeof getInstallationDetail>>>;

type HistoryEvent = {
  id: string;
  date: Date;
  icon: React.ReactNode;
  title: string;
  description?: string | null;
};

const STATUS_LABELS: Record<InstallationDetail["status"], string> = {
  PLANNED: "Zaplanowana",
  IN_PROGRESS: "W trakcie montażu",
  COMPLETED: "Zakończona",
  CANCELLED: "Anulowana",
};

const STATUS_BADGE_CLASSES: Record<InstallationDetail["status"], string> = {
  PLANNED: "bg-accent/10 text-accent border-accent/20",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/20",
  COMPLETED: "bg-secondary text-foreground border-border",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

function buildHistory(detail: InstallationDetail): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  events.push({
    id: "created",
    date: new Date(detail.created_at),
    icon: <PlusCircle size={16} className="text-primary" />,
    title: "Instalacja utworzona",
  });

  if (detail.data_planowana) {
    events.push({
      id: "planned",
      date: new Date(detail.data_planowana),
      icon: <CalendarClock size={16} className="text-accent" />,
      title: "Termin montażu zaplanowany",
    });
  }

  for (const serwis of detail.serwisy) {
    events.push({
      id: `serwis-${serwis.id}`,
      date: new Date(serwis.data_realizacji ?? serwis.data_zgloszenia),
      icon: <Wrench size={16} className="text-primary" />,
      title: serwis.data_realizacji ? "Serwis zrealizowany" : "Serwis zgłoszony",
      description: serwis.opis_usterki,
    });
  }

  for (const usterka of detail.usterki_incidents) {
    events.push({
      id: `usterka-${usterka.id}`,
      date: new Date(usterka.created_at),
      icon: <AlertTriangle size={16} className="text-destructive" />,
      title: usterka.numer_zgloszenia ? `Usterka zgłoszona (${usterka.numer_zgloszenia})` : "Usterka zgłoszona",
      description: usterka.opis_usterki,
    });
  }

  if (detail.data_zakonczenia) {
    events.push({
      id: "completed",
      date: new Date(detail.data_zakonczenia),
      icon: <CheckCircle2 size={16} className="text-primary" />,
      title: "Instalacja zakończona",
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default async function InstallationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getInstallationDetail(id);

  if (!detail) {
    notFound();
    return;
  }

  const clientName = detail.lead?.klient?.imie_i_nazwisko || EMPTY_VALUE;
  const address = detail.lead?.adres?.ulica_miasto || EMPTY_VALUE;
  const auditorName = detail.lead?.audytor?.imie_i_nazwisko || "Nie przypisano";
  const crewName = detail.zespol?.nazwa || "Nie przypisano";

  const hasHistoryEntries = detail.serwisy.length > 0 || detail.usterki_incidents.length > 0;
  const history = buildHistory(detail);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <Link href="/installations">
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground -ml-4 gap-2">
          <ArrowLeft size={16} /> Powrót do harmonogramu
        </Button>
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-4">
            {clientName}
            <Badge
              variant="outline"
              className={`text-sm rounded-full px-4 py-1 ${STATUS_BADGE_CLASSES[detail.status]}`}
            >
              {STATUS_LABELS[detail.status]}
            </Badge>
          </h1>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin size={14} />
          {address}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Terminy i dokumentacja</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar size={14} /> Data planowana
                </p>
                <p className="font-medium text-lg">
                  {formatDate(detail.data_planowana, "dd MMMM yyyy, HH:mm")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Data zakończenia
                </p>
                <p className="font-medium text-lg">
                  {detail.data_zakonczenia
                    ? formatDate(detail.data_zakonczenia, "dd MMMM yyyy, HH:mm")
                    : "Instalacja jeszcze nie zakończona"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                  <FileText size={14} /> Protokół odbioru
                </p>
                {detail.protokol_url ? (
                  <a
                    href={detail.protokol_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
                  >
                    Otwórz protokół
                  </a>
                ) : (
                  <p className="font-medium text-lg text-muted-foreground">Brak wgranego protokołu</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Przypisanie</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                  <User size={14} /> Audytor
                </p>
                <p className="font-medium text-lg">{auditorName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                  <Wrench size={14} /> Ekipa montażowa
                </p>
                <p className="font-medium text-lg">{crewName}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Historia instalacji</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 relative">
              {history.length > 0 && (
                <div className="absolute left-[27px] top-6 bottom-6 w-px bg-border" aria-hidden="true" />
              )}
              <ol className="space-y-6 relative">
                {history.map((event) => (
                  <li key={event.id} className="flex gap-4">
                    <div className="size-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0 relative z-10">
                      {event.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(event.date, "dd MMMM yyyy, HH:mm")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {!hasHistoryEntries && (
                <p className="text-sm text-muted-foreground mt-6 pt-6 border-t border-border">
                  Brak zgłoszonych serwisów i usterek.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
