import React from "react";
import { LeadsClient } from "./leads-client";
import { getLeads, getAuditors } from "./actions";
import { LeadStatus } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function LeadsPage(props: {
  searchParams: Promise<{ status?: string; page?: string; bucket?: string }>;
}) {
  const searchParams = await props.searchParams;
  
  // Bucket query param takes priority (from Sidebar links like ?bucket=cold)
  const bucket = searchParams.bucket;
  const status = bucket 
    ? undefined 
    : ((searchParams.status as LeadStatus | "ALL") || "NEW_LEAD");
  
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  const result = await getLeads({ 
    status: bucket ? undefined : status, 
    bucket,
    page, 
    limit: 50 
  });
  const auditors = await getAuditors();

  // Determine which status to highlight in the dropdown
  const activeStatus: LeadStatus | "ALL" = (bucket === "cold" || bucket === "rejected_auto")
    ? "QUOTE_REJECTED" 
    : bucket === "rollback" 
      ? "ROLLBACK_RESCHEDULING" 
      : (status || "NEW_LEAD");

  return (
    <LeadsClient 
      initialLeads={result.leads} 
      auditors={auditors} 
      totalPages={result.totalPages}
      currentPage={page}
      initialStatus={activeStatus}
      stageCounts={result.stageCounts}
    />
  );
}
