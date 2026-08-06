"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { LayoutDashboard, Users, UserCheck, Wrench, Bell, Search, LogOut, ChevronLeft, ChevronRight, Thermometer, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { id: 'dashboard', label: 'Pulpit', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'leads', label: 'Leady', icon: Users, href: '/leads' },
  { id: 'clients', label: 'Klienci', icon: UserCheck, href: '/clients' },
  { id: 'team', label: 'Audytorzy i Ekipy', icon: Wrench, href: '/auditors' },
  { id: 'notifications', label: 'Centrum Powiadomień', icon: Bell, href: '/notifications' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
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

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? 64 : 232 }}
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

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200 w-full",
                  collapsed ? "justify-center py-2.5 px-0" : "justify-start py-2.5 px-3",
                  active
                    ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

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
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Szukaj klientów, leadów, numerów..."
              className="w-full pl-9 pr-9 py-2 bg-secondary focus:bg-white border border-transparent focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/20 rounded-md text-sm font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-md">
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-destructive rounded-full ring-2 ring-card" />
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
