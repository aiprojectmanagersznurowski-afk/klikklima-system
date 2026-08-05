import React from "react";
import { getAudytorzy, getCrews } from "./actions";
import { AuditorsClient } from "./auditors-client";

export default async function AuditorsPage() {
  const [auditorsResult, crewsResult] = await Promise.all([
    getAudytorzy(),
    getCrews()
  ]);
  
  if (!auditorsResult.success || !auditorsResult.data) {
    return (
      <div className="p-8 text-center text-red-500">
        Błąd ładowania danych audytorów: {auditorsResult.error}
      </div>
    );
  }

  return (
    <AuditorsClient 
      initialAuditors={auditorsResult.data} 
      initialCrews={crewsResult.data || []}
    />
  );
}
