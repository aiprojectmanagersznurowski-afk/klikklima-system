import { getLeadStageCounts, getDelayedNewLeadsCount } from "../leads/actions";
import { getInstallations } from "../installations/actions";
import { getUpcomingServices } from "../services/actions";
import { MetricCards } from "./_components/metric-cards";
import { UpcomingSection } from "./_components/upcoming-section";

export const revalidate = 30;

/**
 * KPI-DASHBOARD (audyt UI, 2026-09-03): panel startowy z metrykami w stylu Studio Admin.
 * Dane pochodzą z istniejących funkcji odczytowych (getLeadStageCounts, getDelayedNewLeadsCount,
 * getInstallations, getUpcomingServices).
 */
export default async function DashboardPage() {
  const [stageCounts, delayedLeadsCount, installations, services] = await Promise.all([
    getLeadStageCounts(),
    getDelayedNewLeadsCount(),
    getInstallations(),
    getUpcomingServices(),
  ]);

  const newLeadsCount = stageCounts["NEW_LEAD"] ?? 0;
  const activeInFunnelCount = stageCounts["ALL"] ?? 0;

  const upcomingInstallations = installations
    .filter((i) => i.status === "PLANNED" || i.status === "IN_PROGRESS")
    .slice(0, 5);

  const upcomingServices = services
    .filter((s) => s.status !== "COMPLETED" && s.status !== "CANCELLED")
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pulpit główny</h1>
        <p className="text-sm text-muted-foreground">
          Skrót stanu lejka sprzedaży, nadchodzących montaży i planowanych przeglądów serwisowych.
        </p>
      </div>

      <MetricCards
        newLeadsCount={newLeadsCount}
        delayedLeadsCount={delayedLeadsCount}
        activeInFunnelCount={activeInFunnelCount}
        upcomingInstallationsCount={upcomingInstallations.length}
        upcomingServicesCount={upcomingServices.length}
      />

      <UpcomingSection
        installations={upcomingInstallations}
        services={upcomingServices}
      />
    </div>
  );
}
