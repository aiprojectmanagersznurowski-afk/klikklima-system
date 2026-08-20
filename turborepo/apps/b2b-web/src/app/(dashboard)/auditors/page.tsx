import { getAuditors } from "./actions"
import { AuditorsClient } from "./auditors-client"
import { getCurrentActorRole } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function AuditorsPage() {
  const [auditors, actorRole] = await Promise.all([
    getAuditors(),
    getCurrentActorRole(),
  ]);
  return <AuditorsClient initialAuditors={auditors} actorRole={actorRole} />;
}
