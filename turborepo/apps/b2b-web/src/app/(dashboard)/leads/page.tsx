import React from "react";
import { notFound } from "next/navigation";
import { LeadsClient } from "./leads-client";
import { getLeads, getAuditors } from "./actions";
import { LeadStatus } from "@repo/database";
import { getCurrentActorRole } from "@/utils/supabase/server";

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

  const [result, auditors, actorRole] = await Promise.all([
    getLeads({
      status: bucket ? undefined : status,
      bucket,
      page,
      limit: 50
    }),
    getAuditors(),
    getCurrentActorRole(),
  ]);
  // SEC-RLS-AUDITOR-SCOPE: getLeads() zwraca { success: false, error } dla ról
  // bez uprawnień do odczytu (monter) i przypadków fail-closed.
  if (!("leads" in result)) {
    notFound();
    return;
  }

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
      actorRole={actorRole}
    />
  );
}
