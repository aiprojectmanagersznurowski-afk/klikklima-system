"use server";

import { prisma } from "@repo/database";

/**
 * B2C-CONSENT-RODO, AC6 (`B2C-CONTENT-PAGES` kryt. 4): `Step8Booking` nie może zgadywać ani
 * doklejać „najnowszej" wersji dokumentu po cichu — musi przekazać do `saveLead` dokładnie tę
 * wersję, którą klient widział pod odnośnikiem na stronie. Ta funkcja jest jedynym źródłem tych
 * identyfikatorów po stronie UI: czyta OBOWIĄZUJĄCE (`is_current: true`) wersje obu rodzajów
 * dokumentu klienta B2C (`B2C_PRIVACY_POLICY`, `B2C_TERMS`) z `legal_document_versions`.
 *
 * Wzorzec: `getCurrentSoftLeadConsentVersionId()` (`leads.ts:72-89`) — z tą różnicą, że tam
 * `RODO_CONSENT` był „tymczasowym przybliżeniem" (dokumenty klienta jeszcze nie miały własnego
 * rodzaju); tutaj oba rodzaje już istnieją w `LegalDocumentKind` (D-C1 = b), więc czytamy je
 * wprost, bez przybliżenia.
 *
 * Brak obowiązującej wersji (jednej albo obu — realny stan na dziś, D-C2: administrator nie
 * opublikował jeszcze treści na żywej produkcji) zwraca `null` w odpowiednim polu — wołający
 * (`Step8Booking`) MUSI zablokować wysyłkę i pokazać komunikat, nigdy nie fabrykować zgody.
 */
export interface CurrentB2cLegalVersions {
  privacyPolicyVersionId: string | null;
  termsVersionId: string | null;
}

export async function getCurrentB2cLegalVersions(): Promise<CurrentB2cLegalVersions> {
  try {
    const [privacyPolicyVersion, termsVersion] = await Promise.all([
      prisma.legalDocumentVersion.findFirst({
        where: { documentKind: "B2C_PRIVACY_POLICY", isCurrent: true },
        select: { id: true },
      }),
      prisma.legalDocumentVersion.findFirst({
        where: { documentKind: "B2C_TERMS", isCurrent: true },
        select: { id: true },
      }),
    ]);

    return {
      privacyPolicyVersionId: privacyPolicyVersion?.id ?? null,
      termsVersionId: termsVersion?.id ?? null,
    };
  } catch (err: unknown) {
    console.error(
      "Error reading current B2C legal document versions:",
      err instanceof Error ? err.message : String(err),
    );
    return { privacyPolicyVersionId: null, termsVersionId: null };
  }
}
