import React from "react";
import { LeadsClient } from "./leads-client";
import { getLeads, getAuditors } from "./actions";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads();
  const auditors = await getAuditors();

  return (
    <LeadsClient initialLeads={leads} auditors={auditors} />
  );
}
