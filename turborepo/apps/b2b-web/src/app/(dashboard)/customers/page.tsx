import { getCustomers } from "./actions"
import { CustomersClient } from "./customers-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function CustomersPage() {
  const [customers, actorRole] = await Promise.all([
    getCustomers(),
    getCurrentActorRole(),
  ]);

  return <CustomersClient initialCustomers={customers} actorRole={actorRole} />;
}
