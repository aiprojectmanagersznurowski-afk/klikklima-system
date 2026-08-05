import React from "react";
import { getClients } from "./actions";
import { ClientsTable } from "./clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const result = await getClients({ limit: 100 });

  return <ClientsTable initialClients={result.clients} />;
}
