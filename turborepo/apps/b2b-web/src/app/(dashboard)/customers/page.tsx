import { getCustomers } from "./actions"
import { CustomersClient } from "./customers-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function CustomersPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  const [{ customers, totalPages }, actorRole] = await Promise.all([
    getCustomers({ page }),
    getCurrentActorRole(),
  ]);

  return (
    <CustomersClient
      initialCustomers={customers}
      actorRole={actorRole}
      totalPages={totalPages}
      currentPage={page}
    />
  );
}
