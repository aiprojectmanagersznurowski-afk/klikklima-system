import { Inbox, AlertTriangle, ClipboardList, Hammer, Wrench, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MetricCardsProps {
  newLeadsCount: number;
  delayedLeadsCount: number;
  activeInFunnelCount: number;
  upcomingInstallationsCount: number;
  upcomingServicesCount: number;
}

export function MetricCards({
  newLeadsCount,
  delayedLeadsCount,
  activeInFunnelCount,
  upcomingInstallationsCount,
  upcomingServicesCount,
}: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* 1. New leads */}
      <Link href="/leads?status=NEW_LEAD" className="group">
        <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">Nowe Leady</CardDescription>
            <CardAction>
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Inbox className="size-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-foreground">{newLeadsCount}</span>
              <Badge variant="secondary" className="text-[10px] font-normal">Etap 1</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Oczekują na pierwszy kontakt</p>
          </CardContent>
        </Card>
      </Link>

      {/* 2. Delayed leads (>24h) */}
      <Link href="/leads?status=NEW_LEAD" className="group">
        <Card
          className={cn(
            "h-full transition-all duration-200 hover:shadow-md",
            delayedLeadsCount > 0
              ? "border-destructive/40 bg-destructive/5 hover:border-destructive"
              : "hover:border-primary/40"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription
              className={cn(
                "text-xs font-medium",
                delayedLeadsCount > 0 ? "text-destructive font-semibold" : ""
              )}
            >
              Opóźnione Leady (&gt;24h)
            </CardDescription>
            <CardAction>
              <div
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center transition-colors",
                  delayedLeadsCount > 0
                    ? "bg-destructive/20 text-destructive group-hover:bg-destructive group-hover:text-white"
                    : "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                )}
              >
                <AlertTriangle className="size-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span
                className={cn(
                  "text-3xl font-bold tracking-tight",
                  delayedLeadsCount > 0 ? "text-destructive" : "text-foreground"
                )}
              >
                {delayedLeadsCount}
              </span>
              {delayedLeadsCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  SLA Alert
                </Badge>
              )}
            </div>
            <p
              className={cn(
                "text-xs",
                delayedLeadsCount > 0 ? "text-destructive/80 font-medium" : "text-muted-foreground"
              )}
            >
              Brak reakcji ponad dobę
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* 3. Aktywne w lejku */}
      <Link href="/leads?status=ALL" className="group">
        <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">Aktywne w lejku</CardDescription>
            <CardAction>
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ClipboardList className="size-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-foreground">{activeInFunnelCount}</span>
              <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-muted-foreground">Wszystkie aktywne projekty</p>
          </CardContent>
        </Card>
      </Link>

      {/* 4. Upcoming installations */}
      <Link href="/installations" className="group">
        <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">Nadchodzące Instalacje</CardDescription>
            <CardAction>
              <div className="size-8 rounded-lg bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Hammer className="size-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-foreground">{upcomingInstallationsCount}</span>
              <Badge variant="secondary" className="text-[10px] font-normal">Zaplanowane</Badge>
            </div>
            <p className="text-xs text-muted-foreground">W trakcie lub oczekujące</p>
          </CardContent>
        </Card>
      </Link>

      {/* 5. Upcoming services */}
      <Link href="/services" className="group">
        <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-medium">Nadchodzące Serwisy</CardDescription>
            <CardAction>
              <div className="size-8 rounded-lg bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Wrench className="size-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-foreground">{upcomingServicesCount}</span>
              <Badge variant="secondary" className="text-[10px] font-normal">Gwarancyjne</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Roczne przeglądy urządzeń</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
