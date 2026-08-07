import { getInstallations } from "./actions"
import { InstallationsClient } from "./installations-client"

export const dynamic = "force-dynamic"

export default async function InstallationsPage() {
  const installations = await getInstallations();

  return <InstallationsClient initialInstallations={installations} />;
}
