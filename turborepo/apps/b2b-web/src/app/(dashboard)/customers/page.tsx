import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { getCustomers } from "./actions"
import { CustomersClient } from "./customers-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function CustomersPage(props: {
  searchParams: Promise<{ page?: string }>;
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

  // MAJOR (audyt bezpieczeństwa 2026-09-24, runda 3): fraza wyszukiwania NIE jest już
  // czytana z query stringu URL-a (był to wyciek PII przez historię przeglądarki, nagłówek
  // Referer i logi serwera) — `customers-client.tsx` woła `getCustomers` bezpośrednio jako
  // Server Action, fraza nigdy nie trafia do adresu.
  const { customers, totalPages } = await getCustomers({ page });

  return (
    <CustomersClient
      initialCustomers={customers}
      actorRole={actorRole}
      totalPages={totalPages}
      currentPage={page}
    />
  );
}
