import React from "react";
import { KanbanClient } from "./kanban-client";
import { getLeads } from "./actions";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const leads = await getLeads();

  return (
    <KanbanClient initialLeads={leads} />
  );
}
