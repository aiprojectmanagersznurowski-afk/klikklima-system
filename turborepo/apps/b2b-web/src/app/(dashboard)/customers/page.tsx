import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { getCustomers } from "./actions"
import { CustomersClient } from "./customers-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function CustomersPage(props: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
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

  const searchParams = await props.searchParams;
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const query = searchParams.q || "";

  const { customers, totalPages } = await getCustomers({ page, query });

  return (
    <CustomersClient
      initialCustomers={customers}
      actorRole={actorRole}
      totalPages={totalPages}
      currentPage={page}
      initialQuery={query}
    />
  );
}
