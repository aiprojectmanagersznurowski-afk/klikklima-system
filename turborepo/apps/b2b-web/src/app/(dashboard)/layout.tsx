"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, Users, Clock, Settings, Bell, HardHat, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const Logo = () => (
  <Link href="/" className="flex items-center gap-3 flex-shrink-0">
    <img
      src="/logo.png"
      alt="Klik Klima"
      className="h-[60px] w-auto"
    />
  </Link>
);

const TABS = [
  { id: "kanban", label: "Lejek", icon: LayoutDashboard, href: "/kanban" },
  { id: "logistics", label: "Logistyka", icon: Truck, href: "/logistics" },
  { id: "clients", label: "Klienci", icon: Users, href: "/clients" },
  { id: "installations", label: "Instalacje", icon: Truck, href: "/installations" },
  { id: "services", label: "Serwisy", icon: Clock, href: "/services" },
  { id: "auditors", label: "Audytorzy", icon: Briefcase, href: "/auditors" },
  { id: "crews", label: "Zespoły", icon: HardHat, href: "/crews" },
  { id: "settings", label: "Ustawienia", icon: Settings, href: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
      <header className="bg-white border-b border-gray-200 z-20">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Logo />
            <nav className="hidden lg:flex items-center gap-1">
              {TABS.map(tab => {
                const isActive = pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      "relative px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                      isActive 
                        ? "text-blue-700 bg-blue-50/50" 
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <tab.icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                    {tab.label}
                    {isActive && (
                      <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-5">
            <button className="relative text-gray-400 hover:text-gray-600 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <Link href="/login" className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Anna K.</p>
                <p className="text-xs text-gray-500">Wyloguj</p>
              </div>
              <Avatar>
                <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">AK</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-white">
        {children}
      </main>
    </div>
  )
}
