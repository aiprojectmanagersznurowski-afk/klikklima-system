import { getCrews } from "./actions"
import { CrewsClient } from "./crews-client"
import { signStoragePaths } from "@/lib/storage/signed-urls"
import { getCurrentActorRole } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function CrewsPage() {
  const [crews, actorRole] = await Promise.all([
    getCrews(),
    getCurrentActorRole(),
  ]);

  const crewPaths = crews
    .map(c => c.zdjecie_url)
    .filter((url): url is string => Boolean(url));

  const signedUrlsMap = await signStoragePaths("zespoly", crewPaths, 60 * 60);

  const crewsWithAvatars = crews.map((crew) => ({
    ...crew,
    avatarUrl: crew.zdjecie_url ? signedUrlsMap[crew.zdjecie_url] : null,
  }));

  return <CrewsClient initialCrews={crewsWithAvatars} actorRole={actorRole} />;
}
