"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, Users, Clock, Settings, Bell, HardHat, Briefcase, Store, Box, AirVent, ChevronDown, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  { id: "kanban", label: "Lejek", icon: Filter, href: "/kanban" },
  { id: "installations", label: "Instalacje", icon: Truck, href: "/installations" },
  { id: "services", label: "Serwisy", icon: Clock, href: "/services" },
  { id: "clients", label: "Klienci", icon: Users, href: "/clients" },
  { id: "logistics", label: "Logistyka", icon: Truck, href: "/logistics" },
  { id: "auditors", label: "Audytorzy", icon: Briefcase, href: "/auditors" },
  { id: "crews", label: "Zespoły", icon: HardHat, href: "/crews" },
  { 
    id: "shop", 
    label: "Sklep", 
    icon: Store, 
    isDropdown: true,
    items: [
      { id: "devices", label: "Urządzenia", href: "/shop/devices", icon: AirVent },
      { id: "3d-models", label: "Modele 3D", href: "/shop/3d-models", icon: Box }
    ]
  },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
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
        <div className="px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Logo />
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {TABS.map(tab => {
                const isActive = tab.href ? pathname.startsWith(tab.href) : (tab.items && tab.items.some(item => pathname.startsWith(item.href)));
                
                if (tab.isDropdown && tab.items) {
                  return (
                    <DropdownMenu key={tab.id}>
                      <DropdownMenuTrigger className={cn(
                        "relative px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 outline-none whitespace-nowrap",
                        isActive 
                          ? "text-blue-700 bg-blue-50/50" 
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      )}>
                        <tab.icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                        {tab.label}
                        <ChevronDown size={14} className="opacity-50" />
                        {isActive && (
                          <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        {tab.items.map(item => (
                          <DropdownMenuItem key={item.id} className="p-0">
                            <Link href={item.href} className="flex items-center gap-2 cursor-pointer w-full px-2 py-1.5">
                              <item.icon size={14} className="text-gray-500" />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }

                return (
                  <Link
                    key={tab.id}
                    href={tab.href as string}
                    className={cn(
                      "relative px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap",
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
          <div className="flex items-center gap-5 flex-shrink-0">
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
