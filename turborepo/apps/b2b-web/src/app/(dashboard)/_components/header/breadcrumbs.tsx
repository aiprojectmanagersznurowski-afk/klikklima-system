"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const ROUTE_NAME_MAP: Record<string, string> = {
  dashboard: "Pulpit",
  leads: "Leady",
  customers: "Klienci",
  installations: "Instalacje",
  services: "Serwisy",
  incidents: "Usterki",
  auditors: "Audytorzy",
  crews: "Zespoły",
  logistics: "Logistyka",
  analytics: "Analityka",
  funnel: "Lejek sprzedaży",
  chat: "Asystent AI",
  notifications: "Powiadomienia",
  settings: "Ustawienia",
  calendar: "Kalendarz i wizyty",
  "exit-intent": "Exit Intent",
  me: "Mój profil",
  schedule: "Grafik",
  dokumentacja: "Dokumentacja",
};

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return (
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-foreground text-xs">Pulpit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Pulpit
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          if (segment === "dashboard") return null;
          const isLast = index === segments.length - 1;
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isUuid = segment.length > 20 || /^[0-9a-fA-F-]+$/.test(segment);
          const label = isUuid
            ? "Szczegóły"
            : ROUTE_NAME_MAP[segment] || segment;

          return (
            <span key={href} className="inline-flex items-center gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-medium text-foreground">
                    {label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href} className="text-muted-foreground hover:text-foreground">
                      {label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
