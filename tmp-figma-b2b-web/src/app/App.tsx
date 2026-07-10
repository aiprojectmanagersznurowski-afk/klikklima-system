import React, { useState } from "react";
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Wrench, 
  Settings, 
  Bell, 
  Search, 
  MoreVertical,
  Calendar,
  Plus,
  MapPin,
  FileText,
  Clock,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
  X,
  Filter
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- SHADCN/UI MOCKS ---
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden", className)}>{children}</div>
);
const CardHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("p-6 flex flex-col space-y-1.5", className)}>{children}</div>
);
const CardTitle = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <h3 className={cn("font-semibold leading-none tracking-tight text-gray-900", className)}>{children}</h3>
);
const CardContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("p-6 pt-0", className)}>{children}</div>
);
const Badge = ({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning", className?: string }) => {
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "text-gray-900 border border-gray-200",
    destructive: "bg-red-100 text-red-700 border border-red-200",
    success: "bg-green-100 text-green-700 border border-green-200",
    warning: "bg-orange-100 text-orange-700 border border-orange-200",
  };
  return (
    <div className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </div>
  );
};
const Button = ({ children, variant = "default", size = "default", className, ...props }: any) => {
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-900",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-900",
  };
  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-8",
    icon: "h-9 w-9",
  };
  return (
    <button className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50", variants[variant as keyof typeof variants], sizes[size as keyof typeof sizes], className)} {...props}>
      {children}
    </button>
  );
};
const Avatar = ({ initials, className }: { initials: string, className?: string }) => (
  <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold", className)}>
    {initials}
  </div>
);

// --- LOGO ---
const Logo = () => (
  <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
    <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white text-sm">
      KK
    </div>
    KlikKlima
  </div>
);

// --- EKRAN LOGOWANIA & GUARD ---
const LoginScreen = ({ onLogin }: { onLogin: (status: 'success' | 'denied') => void }) => {
  const [status, setStatus] = useState<'idle' | 'denied'>('idle');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
      <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-5"></div>
      
      <Card className="w-full max-w-md z-10 shadow-xl border-gray-200/60 backdrop-blur-sm bg-white/95">
        <CardHeader className="text-center space-y-4 pb-8 pt-10">
          <div className="flex justify-center mb-2"><Logo /></div>
          <CardTitle className="text-2xl">Panel Dyspozytora B2B</CardTitle>
          <p className="text-sm text-gray-500">Zaloguj się za pomocą konta służbowego Google, aby kontynuować.</p>
        </CardHeader>
        
        <CardContent className="space-y-4 pb-10">
          {status === 'idle' ? (
            <>
              <Button className="w-full py-6 text-base gap-3" onClick={() => onLogin('success')}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 bg-white rounded-full p-0.5 fill-current text-blue-600">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Zaloguj się przez Google
              </Button>
              <button onClick={() => setStatus('denied')} className="w-full text-xs text-gray-400 hover:text-gray-600 underline">
                Symuluj brak uprawnień
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold mb-1">Brak autoryzacji.</p>
                  <p>Twój adres email (<b>jan.kowalski@gmail.com</b>) nie posiada uprawnień do tego panelu. Skontaktuj się z Administratorem.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setStatus('idle')}>
                Wróć do logowania
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// --- KANBAN BOARD ---
const KANBAN_STAGES = [
  "Nowy lead", "Przypisanie audytora", "Wykonany audyt", "Wycena zaakcept.", 
  "Oczekuje na ekipę", "Wysyłka", "Dostarczony", "Instalacja", "Zakończona"
];

const mockLeads = [
  { id: 1, name: "Jan Kowalski", city: "Warszawa", stage: 0, priority: "Wysoki", assignee: "AK" },
  { id: 2, name: "Anna Nowak", city: "Kraków", stage: 3, priority: "Normalny", assignee: "PJ" },
  { id: 3, name: "Firma X Sp. z o.o.", city: "Poznań", stage: 5, priority: "Pilny", assignee: "ML" },
];

const KanbanBoard = () => {
  return (
    <div className="h-full flex flex-col bg-white animate-in fade-in duration-300">
      {/* Sub-header / Tool bar */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-800">Leady i Proces</h2>
          <div className="h-6 w-px bg-gray-300"></div>
          <button className="text-gray-600 flex items-center gap-2 text-sm hover:text-blue-600 transition-colors">
            <Filter size={16} /> Filtruj
          </button>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-sm">
          <Plus size={16} /> Nowy Lead
        </button>
      </div>
      
      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-gray-100/30">
        <div className="flex gap-4 h-full min-w-max">
          {KANBAN_STAGES.map((stage, index) => (
            <div key={index} className="w-[280px] flex flex-col bg-gray-100 rounded-xl border border-gray-200/60 overflow-hidden shadow-sm h-full max-h-full">
              <div className="p-3 bg-white/60 border-b border-gray-200/60 flex justify-between items-center backdrop-blur-sm shrink-0">
                <h3 className="font-semibold text-sm text-gray-700 truncate pr-2">{stage}</h3>
                <span className="bg-white border border-gray-200 text-gray-600 text-xs py-0.5 px-2 rounded-full font-bold shadow-sm">
                  {mockLeads.filter(l => l.stage === index).length}
                </span>
              </div>
              <div className="p-2.5 flex-1 flex flex-col gap-2.5 overflow-y-auto">
                {mockLeads.filter(l => l.stage === index).map(lead => (
                  <div key={lead.id} className="bg-white p-3.5 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-blue-400 hover:shadow-md transition-all group shrink-0">
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                        lead.priority === "Pilny" ? "bg-red-50 text-red-600 border border-red-100" :
                        lead.priority === "Wysoki" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                        "bg-blue-50 text-blue-600 border border-blue-100"
                      )}>
                        {lead.priority}
                      </span>
                      <button className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical size={16} /></button>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm mb-0.5">{lead.name}</div>
                    <div className="text-xs text-gray-500 mb-3">{lead.city}</div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[9px] font-bold text-blue-700">
                          {lead.assignee}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400">#{lead.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- EKRAN KLIENTA (360) ---
const Client360View = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-5">
          <Avatar initials="JK" className="w-20 h-20 text-2xl" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Jan Kowalski</h1>
            <div className="flex gap-2">
              <Badge variant="secondary">B2C</Badge>
              <Badge variant="outline">Stały Klient</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Dodaj notatkę</Button>
          <Button>Edytuj dane</Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: "overview", label: "Informacje Ogólne" },
            { id: "installations", label: "Instalacje i Leady" },
            { id: "documents", label: "Dokumenty i Faktury" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 px-1 text-sm font-medium transition-all border-b-2 relative -bottom-px",
                activeTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-2">
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Dane kontaktowe</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-4">
                  <div className="text-gray-500">E-mail</div>
                  <div className="col-span-2 font-medium text-gray-900">jan.kowalski@example.com</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-4">
                  <div className="text-gray-500">Telefon</div>
                  <div className="col-span-2 font-medium text-gray-900">+48 123 456 789</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-gray-500">Pref. kanał</div>
                  <div className="col-span-2 font-medium text-gray-900">Email</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle>Adresy</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3 items-start">
                  <MapPin className="text-blue-600 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-sm mb-1 text-gray-900">Adres główny (Instalacji)</div>
                    <div className="text-sm text-gray-500 leading-relaxed">ul. Słoneczna 12/4<br/>00-112 Warszawa</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <FileText className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <div className="font-semibold text-sm mb-1 text-gray-900">Adres korespondencyjny</div>
                    <div className="text-sm text-gray-500">Taki sam jak główny</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "installations" && (
          <Card>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 font-medium">Data utworzenia</th>
                  <th className="px-6 py-3 font-medium">Typ sprzętu (Model)</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Przypisany Audytor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4">12 Maj 2026</td>
                  <td className="px-6 py-4 font-medium text-gray-900">Daikin Sensira 3.5kW</td>
                  <td className="px-6 py-4"><Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Wycena zaakceptowana</Badge></td>
                  <td className="px-6 py-4 flex items-center gap-2"><Avatar initials="AK" className="w-6 h-6 text-[10px]" /> Anna K.</td>
                </tr>
                <tr className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4">01 Kwi 2024</td>
                  <td className="px-6 py-4 font-medium text-gray-900">Mitsubishi Heavy 2.5kW</td>
                  <td className="px-6 py-4"><Badge variant="success">Instalacja zakończona</Badge></td>
                  <td className="px-6 py-4 flex items-center gap-2"><Avatar initials="PJ" className="w-6 h-6 text-[10px]" /> Piotr J.</td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === "documents" && (
          <Card>
            <div className="divide-y divide-gray-100">
              {['Wycena_Daikin_Kowalski.pdf', 'Protokol_Odbioru_2024.pdf', 'Faktura_FV_123_2024.pdf'].map((doc) => (
                <div key={doc} className="p-4 px-6 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{doc}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600">Pobierz</Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// --- EKRAN INSTALACJI (Szczegóły) ---
const InstallationDetails = () => {
  const steps = ["Wycena", "Oczekuje na ekipę", "Wysyłka", "Dostarczony", "Instalacja", "Zakończona"];
  const currentStepIndex = 4;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm text-blue-600 font-semibold mb-1">Zlecenie #INST-2026-892</div>
          <h1 className="text-2xl font-bold text-gray-900">Instalacja: Jan Kowalski</h1>
        </div>
        <Button variant="outline">Anuluj zlecenie</Button>
      </div>

      <Card className="p-6">
        <div className="relative flex justify-between items-center w-full">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 transition-all" 
            style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
          ></div>
          
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            
            return (
              <div key={step} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-colors",
                  isCompleted ? "bg-blue-600 border-blue-600 text-white" :
                  isCurrent ? "bg-white border-blue-600 text-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.1)]" :
                  "bg-white border-gray-300 text-gray-400"
                )}>
                  {isCompleted ? <CheckCircle2 size={16} /> : idx + 4}
                </div>
                <span className={cn(
                  "text-xs font-medium absolute -bottom-6 whitespace-nowrap",
                  (isCompleted || isCurrent) ? "text-gray-900" : "text-gray-400"
                )}>{step}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-8 mt-12">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Zestawienie Sprzętu</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded border border-gray-200 flex items-center justify-center">
                    <Wrench className="text-gray-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Daikin Sensira 3.5kW</div>
                    <div className="text-sm text-gray-500">Model: FTXC35C/RXC35C</div>
                  </div>
                </div>
                <Badge variant="success">Na stanie</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Przypisani pracownicy</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-3">Inżynier / Audytor</div>
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                  <Avatar initials="AK" className="bg-purple-100 text-purple-700" />
                  <div>
                    <div className="font-medium text-sm text-gray-900">Anna Kowalska</div>
                    <div className="text-xs text-gray-500">Wycena zaakceptowana</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-3">Ekipa Monterska</div>
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100 hover:border-blue-300 cursor-pointer transition-colors group">
                  <Avatar initials="M1" className="bg-orange-100 text-orange-700" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">Ekipa "Południe"</div>
                    <div className="text-xs text-gray-500">M. Nowak, T. Kot</div>
                  </div>
                  <ChevronDown size={16} className="text-gray-400 group-hover:text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Data Instalacji</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 p-4 rounded-lg">
                <div className="flex items-center gap-3 text-blue-900">
                  <Calendar size={20} className="text-blue-600" />
                  <span className="font-medium">14 Lipca 2026, godz. 08:00</span>
                </div>
                <Button variant="outline" size="sm" className="bg-white">Zmień termin</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1">
          <Card className="h-full">
            <CardHeader className="border-b border-gray-100 pb-4"><CardTitle>Aktywności i Komunikacja</CardTitle></CardHeader>
            <CardContent className="pt-6 relative">
              <div className="absolute left-8 top-6 bottom-6 w-px bg-gray-200"></div>
              <div className="space-y-6 relative">
                
                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-blue-600 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Zmieniono status na: Instalacja</p>
                    <p className="text-xs text-gray-500 mt-1">Dziś, 09:41 przez System</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-gray-300 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm text-gray-800">Sprzęt odebrany z magazynu</p>
                    <p className="text-xs text-gray-500 mt-1">Dziś, 07:15 przez M. Nowak</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm text-gray-800">Płatność za pośrednictwem Stripe zakończona sukcesem</p>
                    <p className="text-xs text-gray-500 mt-1">Wczoraj, 14:20</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-4 h-4 rounded-full bg-gray-300 shadow-[0_0_0_4px_rgba(255,255,255,1)] relative z-10 mt-1"></div>
                  <div>
                    <p className="text-sm text-gray-800">Wysłano SMS z przypomnieniem o płatności</p>
                    <p className="text-xs text-gray-500 mt-1">11 Lipca, 10:00</p>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- EKRAN SERWISU ---
const ServiceScreen = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Przeglądy i Serwisy</h1>
        <p className="text-sm text-gray-500 mt-1">Zarządzanie cyklem posprzedażowym i przypomnieniami.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-500">Serwisy w tym miesiącu</span>
          <span className="text-3xl font-bold text-gray-900">24</span>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-red-600">Przeterminowane</span>
          <span className="text-3xl font-bold text-red-700">3</span>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-orange-600">Oczekuje na wysyłkę SMS</span>
          <span className="text-3xl font-bold text-orange-700">12</span>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-green-600">Umówione</span>
          <span className="text-3xl font-bold text-green-700">9</span>
        </CardContent></Card>
      </div>

      <Card>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium">Klient</th>
              <th className="px-6 py-4 font-medium">Model sprzętu</th>
              <th className="px-6 py-4 font-medium text-gray-400">Ostatni serwis</th>
              <th className="px-6 py-4 font-semibold text-gray-900">Następny serwis</th>
              <th className="px-6 py-4 font-medium">Status komunikacji</th>
              <th className="px-6 py-4 text-right font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { client: "Jan Kowalski", model: "Daikin Sensira 3.5kW", last: "10 Kwi 2025", next: "10 Kwi 2026", status: "Przeterminowane", badge: "destructive" },
              { client: "Firma XYZ", model: "LG Standard Plus", last: "15 Sie 2025", next: "15 Sie 2026", status: "Oczekuje na SMS", badge: "warning" },
              { client: "Anna Nowak", model: "Mitsubishi Heavy", last: "01 Wrz 2025", next: "01 Wrz 2026", status: "Wysłano przypomnienie", badge: "secondary" },
              { client: "Piotr Wiśniewski", model: "Gree Lomo", last: "20 Wrz 2025", next: "20 Wrz 2026", status: "Termin umówiony", badge: "success" },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-blue-600 hover:underline cursor-pointer">{row.client}</td>
                <td className="px-6 py-4 text-gray-600">{row.model}</td>
                <td className="px-6 py-4 text-gray-400">{row.last}</td>
                <td className="px-6 py-4 font-bold text-gray-900">{row.next}</td>
                <td className="px-6 py-4"><Badge variant={row.badge as any}>{row.status}</Badge></td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-600"><MoreVertical size={16}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// --- EKRAN USTAWIEŃ (RBAC) ---
const SettingsScreen = () => {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Ustawienia platformy</h1>
      
      <div className="flex gap-8 items-start">
        <div className="w-64 shrink-0 space-y-1">
          {["Ogólne", "Zarządzanie Dostępem", "Integracje (Stripe)"].map((item, i) => (
            <button key={item} className={cn(
              "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              i === 1 ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}>
              {item}
            </button>
          ))}
        </div>

        <Card className="flex-1">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Konta Pracowników</h2>
              <p className="text-sm text-gray-500">Zarządzaj dostępem do platformy KlikKlima B2B.</p>
            </div>
            <Button onClick={() => setShowInviteModal(true)} className="gap-2"><Plus size={16}/> Zaproś pracownika</Button>
          </div>
          
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 font-medium">Użytkownik</th>
                <th className="px-6 py-3 font-medium">Rola</th>
                <th className="px-6 py-3 font-medium">Ostatnie logowanie</th>
                <th className="px-6 py-3 font-medium text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-6 py-4 flex items-center gap-3">
                  <Avatar initials="MK" className="w-8 h-8 text-xs bg-blue-100 text-blue-700" />
                  <div>
                    <div className="font-medium text-gray-900">Michał Kowalski</div>
                    <div className="text-xs text-gray-500">michal@klikklima.pl</div>
                  </div>
                </td>
                <td className="px-6 py-4"><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200" variant="outline">Dyspozytor</Badge></td>
                <td className="px-6 py-4 text-gray-500">Dzisiaj, 08:32</td>
                <td className="px-6 py-4 text-right"><Button variant="ghost" size="sm" className="text-gray-400">Edytuj</Button></td>
              </tr>
              <tr>
                <td className="px-6 py-4 flex items-center gap-3">
                  <Avatar initials="AD" className="w-8 h-8 text-xs bg-purple-100 text-purple-700" />
                  <div>
                    <div className="font-medium text-gray-900">Admin Główny</div>
                    <div className="text-xs text-gray-500">admin@klikklima.pl</div>
                  </div>
                </td>
                <td className="px-6 py-4"><Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200" variant="outline">Administrator</Badge></td>
                <td className="px-6 py-4 text-gray-500">Wczoraj, 22:15</td>
                <td className="px-6 py-4 text-right"><Button variant="ghost" size="sm" className="text-gray-400">Edytuj</Button></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl scale-in-95 duration-200">
            <CardHeader className="flex flex-row justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <CardTitle className="text-lg">Zaproś pracownika</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Wyślij zaproszenie z odpowiednią rolą do systemu.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Email pracownika</label>
                <input type="email" placeholder="jan@klikklima.pl" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Rola w systemie</label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white">
                  <option>Dyspozytor</option>
                  <option>Audytor</option>
                  <option>Administrator</option>
                  <option>Monter</option>
                </select>
              </div>
            </CardContent>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowInviteModal(false)}>Anuluj</Button>
              <Button>Wyślij zaproszenie</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};


// --- GŁÓWNY SHELL APLIKACJI ---
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTab, setCurrentTab] = useState("kanban"); // Ustawiamy Kanban z powrotem jako domyślny!

  if (!isAuthenticated) {
    return <LoginScreen onLogin={(status) => { if(status === 'success') setIsAuthenticated(true); }} />;
  }

  const TABS = [
    { id: "kanban", label: "Kanban", icon: LayoutDashboard },
    { id: "clients", label: "Klienci", icon: Users },
    { id: "installations", label: "Instalacje", icon: Truck },
    { id: "services", label: "Serwisy", icon: Clock },
    { id: "settings", label: "Ustawienia", icon: Settings },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
      <header className="bg-white border-b border-gray-200 z-20">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Logo />
            <nav className="hidden lg:flex items-center gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={cn(
                    "relative px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    currentTab === tab.id 
                      ? "text-blue-700 bg-blue-50/50" 
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <tab.icon size={16} className={currentTab === tab.id ? "text-blue-600" : "text-gray-400"} />
                  {tab.label}
                  {currentTab === tab.id && (
                    <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-5">
            <button className="relative text-gray-400 hover:text-gray-600 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsAuthenticated(false)}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Anna K.</p>
                <p className="text-xs text-gray-500">Wyloguj</p>
              </div>
              <Avatar initials="AK" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-white">
        {currentTab === "kanban" && <KanbanBoard />}
        {currentTab === "clients" && <Client360View />}
        {currentTab === "installations" && <InstallationDetails />}
        {currentTab === "services" && <ServiceScreen />}
        {currentTab === "settings" && <SettingsScreen />}
      </main>
    </div>
  );
}
