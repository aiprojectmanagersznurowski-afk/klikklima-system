"use client"
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, UserCheck, Wrench, Bell, Search, LogOut,
  ChevronLeft, ChevronRight, Thermometer, X, FolderKanban, Box, Settings,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

type NavItem = {
  id: string;
  label: string;
  icon: any;
  href?: string;
  comingSoon?: boolean;
  subItems?: { id: string; label: string; href: string; comingSoon?: boolean }[];
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Pulpit', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'leads', label: 'Leady', icon: Users, href: '/leads' },
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
    ]
  },
  { id: 'logistics', label: 'Logistyka', icon: Box, href: '/logistics' },
  { id: 'notifications', label: 'Centrum Powiadomień', icon: Bell, href: '/notifications', comingSoon: true },
  {
    id: 'settings',
    label: 'Ustawienia',
    icon: Settings,
    subItems: [
      { id: 'exit_intent', label: 'Exit Intent', href: '/settings/exit-intent' },
      { id: 'rbac', label: 'Użytkownicy i Uprawnienia', href: '/settings/rbac', comingSoon: true },
      { id: 'notifications_settings', label: 'Parametry powiadomień', href: '/settings/notifications', comingSoon: true },
    ]
  }
];

function SidebarNavigation({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isActive = (href: string) => {
    // Check if href is exactly matching pathname + searchParams
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    return currentUrl === href || (href !== '/' && href !== '/leads' && currentUrl.startsWith(href));
  };

  const isExactActive = (href: string) => {
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    return currentUrl === href;
  };

  const toggleGroup = (id: string) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroups(prev => ({ ...prev, [id]: true }));
    } else {
      setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
    }
  };

  // Automatically open groups if a child is active
  useEffect(() => {
    if (collapsed) return;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    
    const newOpenGroups = { ...openGroups };
    let changed = false;
    
    navItems.forEach(item => {
      if (item.subItems) {
        const hasActiveChild = item.subItems.some(sub => currentUrl.startsWith(sub.href));
        if (hasActiveChild && !newOpenGroups[item.id]) {
          newOpenGroups[item.id] = true;
          changed = true;
        }
      }
    });
    
    if (changed) {
      setOpenGroups(newOpenGroups);
    }
  }, [pathname, searchParams, collapsed]);

  return (
    <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const hasSubItems = !!item.subItems;
        const isOpen = !!openGroups[item.id];
        
        // Determine active state
        let isGroupActive = false;
        if (hasSubItems) {
          isGroupActive = item.subItems!.some(sub => {
             const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
             return currentUrl === sub.href;
          });
        } else if (item.href) {
          isGroupActive = isExactActive(item.href);
        }

        return (
          <div key={item.id} className="flex flex-col gap-1">
            {hasSubItems ? (
              <button
                onClick={() => toggleGroup(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200 w-full border-l-2",
                  collapsed ? "justify-center py-2.5 px-0" : "justify-between py-2.5 pl-[10px] pr-3",
                  isGroupActive && !isOpen
                    ? "bg-primary/10 text-primary font-semibold shadow-2xs border-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("size-4 shrink-0 transition-colors", isGroupActive && !isOpen ? "text-primary" : "text-muted-foreground")} />
                  {!collapsed && <span>{item.label}</span>}
                </div>
                {!collapsed && (
                  <ChevronDown className={cn("size-4 transition-transform duration-200 text-muted-foreground", isOpen && "rotate-180")} />
                )}
              </button>
            ) : item.comingSoon ? (
              <div
                aria-disabled="true"
                title={collapsed ? `${item.label} (Wkrótce)` : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium w-full cursor-not-allowed text-muted-foreground/60",
                  collapsed ? "justify-center py-2.5 px-0" : "justify-start py-2.5 px-3"
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground/60" />
                {!collapsed && (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{item.label}</span>
                    <Badge variant="secondary" className="shrink-0">Wkrótce</Badge>
                  </span>
                )}
              </div>
            ) : (
              <Link
                href={item.href!}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200 w-full border-l-2",
                  collapsed ? "justify-center py-2.5 px-0" : "justify-start py-2.5 pl-[10px] pr-3",
                  isGroupActive
                    ? "bg-primary/10 text-primary font-semibold shadow-2xs border-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent"
                )}
              >
                <Icon className={cn("size-4 shrink-0 transition-colors", isGroupActive ? "text-primary" : "text-muted-foreground")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )}

            {/* Sub Items Dropdown */}
            {hasSubItems && isOpen && !collapsed && (
              <div className="flex flex-col gap-1 pl-9 pr-2 mt-1 mb-2 animate-in slide-in-from-top-2 fade-in-50 duration-200">
                {item.subItems!.map(sub => {
                  const isSubActive = isExactActive(sub.href);
                  if (sub.comingSoon) {
                    return (
                      <div
                        key={sub.id}
                        aria-disabled="true"
                        className="flex items-center justify-between gap-2 py-2 px-3 rounded-md text-[13px] font-medium text-muted-foreground/60 cursor-not-allowed"
                      >
                        <span className="truncate">{sub.label}</span>
                        <Badge variant="secondary" className="shrink-0">Wkrótce</Badge>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={sub.id}
                      href={sub.href}
                      className={cn(
                        "flex items-center py-2 pl-[10px] pr-3 rounded-md text-[13px] font-medium transition-colors border-l-2",
                        isSubActive
                          ? "bg-primary/10 text-primary font-semibold shadow-2xs border-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent"
                      )}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? 64 : 260 }}
        className="flex flex-col shrink-0 bg-sidebar border-r border-border transition-[width] duration-300 ease-in-out z-20"
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2.5 justify-center h-16 border-b border-border shrink-0",
          collapsed ? "px-0 py-5" : "px-4 py-5"
        )}>
          {collapsed ? (
            <div className="flex items-center justify-center shrink-0 rounded-xl size-8 bg-primary shadow-sm">
              <Thermometer className="size-4 text-primary-foreground" />
            </div>
          ) : (
            <Link href="/leads" className="flex items-center gap-3 flex-shrink-0 transition-opacity duration-200 hover:opacity-90">
              <img
                src="/logo.png"
                alt="Klik Klima"
                className="h-[40px] w-auto"
              />
            </Link>
          )}
        </div>

        {/* Navigation wrapped in Suspense for useSearchParams */}
        <Suspense fallback={<div className="flex-1" />}>
          <SidebarNavigation collapsed={collapsed} setCollapsed={setCollapsed} />
        </Suspense>

        {/* Collapse toggle */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center gap-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full",
              collapsed ? "justify-center py-2 px-0" : "justify-start py-2 px-3"
            )}
            title={collapsed ? "Rozwiń panel" : "Zwiń panel"}
          >
            {collapsed
              ? <ChevronRight className="size-4" />
              : <><ChevronLeft className="size-4" /><span>Zwiń panel</span></>
            }
          </button>
        </div>

        {/* User */}
        <div className="border-t border-border p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0 shadow-xs">
                {user && user.email ? getInitials(user.email) : 'AK'}
              </div>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md"
                title="Wyloguj się"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0 shadow-xs">
                {user && user.email ? getInitials(user.email) : 'AK'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user ? user.email : 'Ładowanie...'}
                </p>
                <p className="text-xs text-muted-foreground font-medium">Administrator</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-1.5 rounded-md shrink-0"
                title="Wyloguj się"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-6 flex items-center gap-4 h-16 shrink-0 shadow-2xs">
          <div className="flex-1"></div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-md">
              <Bell className="size-5" />
              {/* Odznaka nieprzeczytanych powiadomień usunięta — Centrum Powiadomień to placeholder, brak logiki liczenia. Przywrócić po zbudowaniu modułu. */}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
