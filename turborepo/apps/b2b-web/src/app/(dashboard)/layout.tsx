import { cookies } from "next/headers";
import { Suspense } from "react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Box,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
} from "lucide-react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, BookOpen } from "lucide-react";
import type { Role } from "@klikklima/contracts";
import { isScheduleNavItemVisible } from "../../lib/schedule/nav-visibility";
import { isDocsNavItemVisible } from "../../lib/docs/nav-visibility";
import { AppSidebar } from "./_components/sidebar/app-sidebar";
import { DashboardBreadcrumbs } from "./_components/header/breadcrumbs";
import { GlobalSearch } from "@/components/global-search/global-search";
import { SearchDialog } from "./_components/header/search-dialog";
import { ThemeSwitcher } from "./_components/header/theme-switcher";
import { NotificationsButton } from "./_components/header/notifications-button";

export type NavItem = {
  id: string;
  label: string;
  icon: any;
  href?: string;
  comingSoon?: boolean;
  subItems?: { id: string; label: string; href: string; comingSoon?: boolean }[];
};

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Pulpit', icon: LayoutDashboard, href: '/dashboard' },
  {
    id: 'leads',
    label: 'Leady',
    icon: Users,
    // Pozycje odpowiadają 1:1 tablicy `LEAD_STAGES` z `leads/leads-client.tsx`
    // (ta sama liczba etapów, ten sam tekst i ta sama kolejność). Zgodność
    // pilnuje `apps/b2b-web/tests/leads-nav-submenu.test.ts`, który parsuje oba
    // pliki źródłowo i porówna listy.
    subItems: [
      { id: 'ALL', label: 'Wszystkie', href: '/leads?status=ALL' },
      { id: 'NEW_LEAD', label: '1. Nowy lead', href: '/leads?status=NEW_LEAD' },
      { id: 'AWAITING_AUDIT', label: '2. Oczekiwanie na audyt', href: '/leads?status=AWAITING_AUDIT' },
      { id: 'AUDIT_COMPLETED', label: '3. Wykonany audyt', href: '/leads?status=AUDIT_COMPLETED' },
      { id: 'AWAITING_CREW_ASSIGNMENT', label: '4. Oczekuje na ekipę', href: '/leads?status=AWAITING_CREW_ASSIGNMENT' },
      { id: 'HARDWARE_IN_WAREHOUSE', label: '5. Wysyłka (Hurtownia)', href: '/leads?status=HARDWARE_IN_WAREHOUSE' },
      { id: 'HARDWARE_IN_TRANSIT', label: '6. Wysyłka w drodze', href: '/leads?status=HARDWARE_IN_TRANSIT' },
      { id: 'AWAITING_INSTALLATION', label: '7. Oczekuje instalacji', href: '/leads?status=AWAITING_INSTALLATION' },
      { id: 'INSTALLATION_COMPLETED', label: '8. Instalacja zakończona', href: '/leads?status=INSTALLATION_COMPLETED' },
      { id: 'QUOTE_REJECTED', label: '🧊 Zimne leady', href: '/leads?status=QUOTE_REJECTED' },
      { id: 'ROLLBACK_RESCHEDULING', label: '🔄 Rollback', href: '/leads?status=ROLLBACK_RESCHEDULING' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: FolderKanban,
    subItems: [
      { id: 'clients', label: 'Klienci', href: '/customers' },
      { id: 'installations', label: 'Instalacje', href: '/installations' },
      { id: 'services', label: 'Serwisy', href: '/services' },
      { id: 'faults', label: 'Usterki', href: '/incidents' },
      { id: 'auditors', label: 'Audytorzy', href: '/auditors' },
      { id: 'crews', label: 'Zespoły', href: '/crews' },
      { id: 'cold_leads', label: 'Zimne leady', href: '/leads?bucket=cold' },
      { id: 'rejected_auto', label: 'Odrzucone (Brak akceptacji > 14 dni)', href: '/leads?bucket=rejected_auto' },
    ],
  },
  { id: 'logistics', label: 'Logistyka', icon: Box, href: '/logistics' },
  {
    id: 'analytics',
    label: 'Analityka',
    icon: BarChart3,
    subItems: [
      { id: 'funnel', label: 'Lejek sprzedaży', href: '/analytics/funnel' },
      { id: 'crews_analytics', label: 'Montaże & Ekipy', href: '/analytics/crews' },
      { id: 'auditors_analytics', label: 'Audyty & Audytorzy', href: '/analytics/auditors' },
    ],
  },
  { id: 'chat', label: 'Asystent AI', icon: Sparkles, href: '/chat' },
  { id: 'notifications', label: 'Centrum Powiadomień', icon: Bell, href: '/notifications', comingSoon: true },
  {
    id: 'settings',
    label: 'Ustawienia',
    icon: Settings,
    subItems: [
      { id: 'exit_intent', label: 'Exit Intent', href: '/settings/exit-intent' },
      { id: 'rbac', label: 'Użytkownicy i Uprawnienia', href: '/settings' },
      { id: 'calendar_settings', label: 'Kalendarz i wizyty', href: '/settings/calendar' },
      { id: 'notifications_settings', label: 'Parametry powiadomień', href: '/settings/notifications', comingSoon: true },
    ],
  },
];

export function buildNavItems(actorRole: Role | null): NavItem[] {
  const showScheduleNavItem = isScheduleNavItemVisible(actorRole);
  const scheduleNavItem: NavItem | null = showScheduleNavItem
    ? { id: 'my-schedule', label: 'Mój grafik', icon: CalendarDays, href: '/me/schedule' }
    : null;

  const itemsWithSchedule: NavItem[] = scheduleNavItem
    ? [navItems[0], scheduleNavItem, ...navItems.slice(1)]
    : navItems;

  const showDocsNavItem = isDocsNavItemVisible(actorRole);
  const docsNavItem: NavItem | null = showDocsNavItem
    ? { id: 'docs', label: 'Dokumentacja', icon: BookOpen, href: '/dokumentacja' }
    : null;

  return docsNavItem ? [...itemsWithSchedule, docsNavItem] : itemsWithSchedule;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Suspense fallback={<div className="w-16 h-screen bg-sidebar border-r border-sidebar-border shrink-0" />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="overflow-hidden flex flex-col h-screen">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="mr-2 h-4 hidden sm:block" />
            <DashboardBreadcrumbs />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-48 sm:w-72 md:w-80">
              <GlobalSearch />
            </div>
            <SearchDialog />
            <Separator orientation="vertical" className="h-4" />
            <ThemeSwitcher />
            <NotificationsButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
