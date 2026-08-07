import { getCrews } from "./actions"
import { CrewsClient } from "./crews-client"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export default async function CrewsPage() {
  const crews = await getCrews();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const crewPaths = crews
    .map(c => c.zdjecie_url)
    .filter((url): url is string => Boolean(url));
  
  let signedUrlsMap: Record<string, string> = {};
  if (crewPaths.length > 0) {
    const { data } = await supabase.storage
      .from("zespoly")
      .createSignedUrls(crewPaths, 60 * 60);
    
    if (data) {
      data.forEach(item => {
        if (!item.error && item.signedUrl && item.path) {
          signedUrlsMap[item.path as string] = item.signedUrl;
        }
      });
    }
  }

  const crewsWithAvatars = crews.map((crew) => ({
    ...crew,
    avatarUrl: crew.zdjecie_url ? signedUrlsMap[crew.zdjecie_url] : null,
  }));

  return <CrewsClient initialCrews={crewsWithAvatars as any} />;
}
