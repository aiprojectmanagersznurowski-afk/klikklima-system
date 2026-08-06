import { getLogisticsLeads } from "./actions"
import { LogisticsClient } from "./logistics-client"

export const dynamic = "force-dynamic"

export default async function LogisticsPage() {
  const leads = await getLogisticsLeads();

  return <LogisticsClient initialShipments={leads} />;
}
