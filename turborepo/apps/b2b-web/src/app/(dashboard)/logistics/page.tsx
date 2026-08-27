import { notFound } from "next/navigation"
import { getLogisticsLeads } from "./actions"
import { LogisticsClient } from "./logistics-client"

export const dynamic = "force-dynamic"

export default async function LogisticsPage() {
  const leads = await getLogisticsLeads();

  // SEC-RLS-AUDITOR-SCOPE (D4): audytor i monter nie mają dostępu do /logistics
  // wcale — getLogisticsLeads() zwraca { success: false, error } zamiast tablicy.
  if (!Array.isArray(leads)) {
    notFound();
    return;
  }

  return <LogisticsClient initialShipments={leads} />;
}
