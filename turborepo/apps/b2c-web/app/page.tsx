import { getBestsellers } from "./actions/getBestsellers";
import { getFomoSlots } from "./actions/getFomoSlots";
import HomePageClient from "./HomePageClient";

// Opt-out of static caching if bestsellers/slots update frequently,
// or let Next.js revalidate it periodically (e.g. export const revalidate = 3600;)
export const revalidate = 60; // odświeżaj co 60 sekund
export const dynamic = 'force-dynamic'; // zapobiega wywalaniu błędu podczas npm run build (brak env)

export default async function Page() {
  const [fomoData, dbProducts] = await Promise.all([
    getFomoSlots(),
    getBestsellers()
  ]);

  return <HomePageClient initialFomoData={fomoData} initialDbProducts={dbProducts} />;
}
