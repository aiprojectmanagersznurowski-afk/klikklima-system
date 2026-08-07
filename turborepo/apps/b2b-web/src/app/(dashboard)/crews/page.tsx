import { getCrews } from "./actions"
import { CrewsClient } from "./crews-client"

export const dynamic = "force-dynamic"

export default async function CrewsPage() {
  const crews = await getCrews();
  return <CrewsClient initialCrews={crews} />;
}
