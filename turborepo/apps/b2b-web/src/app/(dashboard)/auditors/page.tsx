import React from "react";
import { getAudytorzy } from "./actions";
import { AuditorsClient } from "./auditors-client";

export default async function AuditorsPage() {
  const result = await getAudytorzy();
  
  if (!result.success || !result.data) {
    return (
      <div className="p-8 text-center text-red-500">
        Błąd ładowania danych audytorów: {result.error}
      </div>
    );
  }

  return <AuditorsClient initialAuditors={result.data} />;
}
