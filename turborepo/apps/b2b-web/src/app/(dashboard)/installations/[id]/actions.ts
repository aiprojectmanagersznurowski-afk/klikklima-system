"use server"

import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, getCurrentUser } from "../../../../utils/supabase/server"

/**
 * getInstallationDetail — dane jednej instalacji ("historia" dla widoku szczegółów):
 * rekord instalacji + klient/adres/audytor (przez `lead`) + ekipa montażowa (`zespol`)
 * oraz powiązane zgłoszenia serwisowe (`serwisy`) i usterki (`usterki_incidents`),
 * obie listy posortowane malejąco (najnowsze na górze).
 *
 * Bramka 1:1 z `getInstallations()` (`installations/actions.ts`): installations.read
 * daje `'yes'` (admin, dyspozytor) lub `'own'` (monter — zawężenie do własnej ekipy
 * przez `zespoly_monterskie.email = <e-mail z sesji>`, fail-closed przy braku/duplikacie
 * rekordu lub `aktywny === false`).
 *
 * Zawężenie dla pojedynczego rekordu (D1 z WO installations/actions.ts, zastosowane
 * analogicznie): monter, który poda ID instalacji NIE przypisanej do jego ekipy,
 * dostaje `null` — dokładnie tak samo jak przy rekordzie, który w ogóle nie istnieje
 * (wzorzec nieodróżnialności odmowy używany w `leads/[id]/actions.ts::getLeadDetail`).
 * UI (page.tsx) reaguje na `null` wywołaniem `notFound()`.
 */
export type InstallationDetail = Awaited<ReturnType<typeof getInstallationDetail>>

export async function getInstallationDetail(id: string) {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return null;
  }

  const access = actorRole ? can(actorRole, "installations", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return null;
  }

  let ownCrewId: string | undefined;
  if (access === "own") {
    let user;
    try {
      ({ data: { user } } = await getCurrentUser());
    } catch (error) {
      console.error("Failed to resolve current user:", error);
      return null;
    }
    if (!user?.email) {
      return null;
    }

    const matches = await prisma.zespoly_monterskie.findMany({
      where: { email: user.email },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].aktywny === false) {
      return null;
    }
    ownCrewId = matches[0].id;
  }

  const installation = await prisma.instalacje.findUnique({
    where: { id },
    include: {
      lead: {
        include: {
          klient: true,
          adres: true,
          audytor: true,
        },
      },
      zespol: true,
      serwisy: {
        orderBy: { data_zgloszenia: "desc" },
      },
      usterki_incidents: {
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!installation || (access === "own" && installation.zespol_id !== ownCrewId)) {
    // Nieodróżnialność: instalacja cudzej ekipy i instalacja nieistniejąca dają
    // dokładnie ten sam wynik (`null`) — monter zgadujący ID nie może w ten sposób
    // odkryć, że rekord w ogóle istnieje.
    return null;
  }

  return installation;
}
