import { getCrews } from "./actions"
import { CrewsClient } from "./crews-client"
import { signStoragePaths } from "@/lib/storage/signed-urls"

export const dynamic = "force-dynamic"

export default async function CrewsPage() {
  const crews = await getCrews();

  const crewPaths = crews
    .map(c => c.zdjecie_url)
    .filter((url): url is string => Boolean(url));
  
  const signedUrlsMap = await signStoragePaths("zespoly", crewPaths, 60 * 60);

  const crewsWithAvatars = crews.map((crew) => ({
    ...crew,
    avatarUrl: crew.zdjecie_url ? signedUrlsMap[crew.zdjecie_url] : null,
  }));

  return <CrewsClient initialCrews={crewsWithAvatars} />;
}
