import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Box,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
  CalendarDays,
  BookOpen,
} from 'lucide-react';
import type { Role } from '@klikklima/contracts';
import { isScheduleNavItemVisible } from '../lib/schedule/nav-visibility';
import { isDocsNavItemVisible } from '../lib/docs/nav-visibility';
import { isPricingNavItemVisible } from '../lib/pricing/nav-visibility';

export interface NavSubItem {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  comingSoon?: boolean;
  subItems?: NavSubItem[];
}

export const baseNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Pulpit', icon: LayoutDashboard, href: '/dashboard' },
  {
    id: 'leads',
    label: 'Leady',
    icon: Users,
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
      { id: 'QUOTE_REJECTED', label: '🧊 Zimne Leady', href: '/leads?status=QUOTE_REJECTED' },
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
      { id: 'cold_leads', label: 'Zimne Leady', href: '/leads?bucket=cold' },
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

export function getNavItemsForRole(actorRole: Role | null): NavItem[] {
  const showSchedule = isScheduleNavItemVisible(actorRole);
  const scheduleNavItem: NavItem | null = showSchedule
    ? { id: 'my-schedule', label: 'Mój grafik', icon: CalendarDays, href: '/me/schedule' }
    : null;

  const itemsWithSchedule = scheduleNavItem
    ? [baseNavItems[0], scheduleNavItem, ...baseNavItems.slice(1)]
    : baseNavItems;

  const showDocs = isDocsNavItemVisible(actorRole);
  const itemsWithDocs = showDocs
    ? [...itemsWithSchedule, { id: 'docs', label: 'Dokumentacja', icon: BookOpen, href: '/dokumentacja' } as NavItem]
    : itemsWithSchedule;

  const showPricing = isPricingNavItemVisible(actorRole);
  return itemsWithDocs.map((item) => {
    if (item.id === 'settings' && item.subItems) {
      const filtered = item.subItems.filter((s) => s.href !== '/settings/pricing');
      if (showPricing) {
        const calIndex = filtered.findIndex((s) => s.href === '/settings/calendar');
        const pricingItem: NavSubItem = { id: 'pricing_settings', label: 'Cennik wyceny', href: '/settings/pricing' };
        const updated = [...filtered];
        if (calIndex !== -1) {
          updated.splice(calIndex + 1, 0, pricingItem);
        } else {
          updated.push(pricingItem);
        }
        return { ...item, subItems: updated };
      }
      return { ...item, subItems: filtered };
    }
    return item;
  });
}
