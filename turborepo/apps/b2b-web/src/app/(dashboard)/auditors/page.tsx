import { getAuditors } from "./actions"
import { AuditorsClient } from "./auditors-client"

export const dynamic = "force-dynamic"

export default async function AuditorsPage() {
  const auditors = await getAuditors();
  return <AuditorsClient initialAuditors={auditors} />;
}
