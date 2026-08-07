import { getUpcomingServices } from "./actions"
import { ServicesClient } from "./services-client"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
  const services = await getUpcomingServices();
  return <ServicesClient initialServices={services} />;
}
