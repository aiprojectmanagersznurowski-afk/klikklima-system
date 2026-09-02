import { prisma } from "@repo/database"
import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { User, Phone, Mail, MapPin, Building, Calendar, FileText, ClipboardList, PenTool, CheckCircle, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Customer360Tabs } from "./tabs-client"
import { getCurrentActorRole } from "../../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  if (!actorRole || can(actorRole, "clients", "read") !== "yes") {
    notFound();
    return;
  }

  const { id } = await params;
  const customer = await prisma.klienci.findUnique({
    where: { id },
    include: {
      adresy: true,
      leady: {
        include: {
          instalacje: true,
          logistyka_zamowienia: true
        }
      },
      serwisy: true,
      usterki_incidents: true
    }
  });

  if (!customer) {
    notFound();
    return;
  }

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      {/* Top Header / Breadcrumbs */}
      <div className="flex flex-col gap-4 bg-card p-6 border-b border-border">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <User className="size-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.imie_i_nazwisko || "Nieznany Klient"}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground font-medium">
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-4" /> {customer.email}
                  </span>
                )}
                {customer.telefon && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-4" /> {customer.telefon}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" /> W bazie od: {format(new Date(customer.created_at), "dd MMM yyyy", { locale: pl })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="font-semibold shadow-sm">
              Wyślij Wiadomość
            </Button>
            <Button className="font-semibold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
              Zgłoś Usterkę (Auto-Fill)
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background p-6">
        <Customer360Tabs customer={customer} />
      </div>
    </div>
  );
}
