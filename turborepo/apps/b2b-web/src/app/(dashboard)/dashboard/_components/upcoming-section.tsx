import Link from "next/link";
import { ArrowUpRight, Hammer, Wrench, Calendar, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";

interface InstallationItem {
  id: string;
  clientName: string;
  plannedDate?: Date | string | null;
  status: string;
}

interface ServiceItem {
  service_id?: string | null;
  installation_id?: string | null;
  customer_name: string;
  next_service_date: Date;
  date_undetermined?: boolean;
}

interface UpcomingSectionProps {
  installations: InstallationItem[];
  services: ServiceItem[];
}

export function UpcomingSection({ installations, services }: UpcomingSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upcoming installations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Najbliższe Instalacje</CardTitle>
            <CardDescription className="text-xs">Harmonogram prac montażowych</CardDescription>
          </div>
          <CardAction>
            <Button variant="ghost" size="sm" asChild className="text-xs gap-1 text-primary">
              <Link href="/installations">
                Wszystkie <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {installations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Hammer className="size-8 opacity-20 mb-2" />
              <p className="text-sm font-medium">Brak zaplanowanych instalacji</p>
              <p className="text-xs text-muted-foreground">Nowe zlecenia montażu pojawią się po wyznaczeniu terminu.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {installations.map((inst) => (
                <div key={inst.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-foreground">
                      <Hammer className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{inst.clientName}</p>
                      <p className="text-xs text-muted-foreground">Montaż klimatyzacji</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground font-medium">
                    <Calendar className="size-3.5" />
                    <span>
                      {inst.plannedDate ? formatDate(inst.plannedDate, "dd MMM yyyy") : "Brak daty"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Najbliższe Serwisy</CardTitle>
            <CardDescription className="text-xs">Zbliżające się przeglądy gwarancyjne</CardDescription>
          </div>
          <CardAction>
            <Button variant="ghost" size="sm" asChild className="text-xs gap-1 text-primary">
              <Link href="/services">
                Wszystkie <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Wrench className="size-8 opacity-20 mb-2" />
              <p className="text-sm font-medium">Brak nadchodzących serwisów</p>
              <p className="text-xs text-muted-foreground">Przeglądy roczne pojawią się automatycznie.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {services.map((svc) => (
                <div
                  key={svc.service_id ?? svc.installation_id ?? svc.next_service_date.toISOString()}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-foreground">
                      <Wrench className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{svc.customer_name}</p>
                      <p className="text-xs text-muted-foreground">Serwis gwarancyjny</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground font-medium">
                    <Calendar className="size-3.5" />
                    <span>
                      {svc.date_undetermined
                        ? "Termin niewyznaczony"
                        : formatDate(svc.next_service_date, "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
