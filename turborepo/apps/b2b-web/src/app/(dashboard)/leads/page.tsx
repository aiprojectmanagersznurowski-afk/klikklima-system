import React from "react";
import { LeadsClient } from "./leads-client";
import { getLeads, getAuditors } from "./actions";
import { LeadStatus } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function LeadsPage(props: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const status = (searchParams.status as LeadStatus) || "NEW_LEAD";
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  const result = await getLeads({ status, page, limit: 50 });
  const auditors = await getAuditors();

  return (
    <LeadsClient 
      initialLeads={result.leads} 
      auditors={auditors} 
      totalPages={result.totalPages}
      currentPage={page}
      initialStatus={status}
      stageCounts={result.stageCounts}
    />
  );
}
