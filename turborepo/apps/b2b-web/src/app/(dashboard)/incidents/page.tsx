import { getIncidents } from "./actions"
import { IncidentsClient } from "./incidents-client"

export const dynamic = "force-dynamic"

export default async function IncidentsPage() {
  const incidents = await getIncidents();
  return <IncidentsClient initialIncidents={incidents} />;
}
