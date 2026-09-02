import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/FLD-CONSENT-DOCS.md — FLD-LEGAL-DOC-VERSION.
 * Wymaganie (contracts/requirements.contract.mjs, R('FLD-LEGAL-DOC-VERSION', ...), status TODO):
 *   "Administrator ma miejsce, w którym wgrywa i wersjonuje treść zgód RODO oraz regulaminu
 *   pracowniczego; wersja opublikowana jest niezmienna, a obowiązująca jest zawsze dokładnie
 *   jedna na rodzaj dokumentu."
 *
 * Warstwa kontrakt+schemat już wylądowała na main (commit 24681f4): tabela
 * `legal_document_versions` (model Prisma `LegalDocumentVersion`, enum `LegalDocumentKind`),
 * zasób RBAC `legal_document_versions` (create/update/delete: ['admin'], read: wszystkie
 * cztery role) — ale MIGRACJA `20260821130000_fld_consent_docs.sql` NIE BYŁA URUCHOMIONA
 * na żadnej bazie. Server Action dla tego wymagania DZIŚ NIE ISTNIEJE W OGÓLE (sprawdzone:
 * `grep -rn "LegalDocumentVersion\|legalDocumentVersion" apps/b2b-web/src` = brak wyników
 * poza samym schema.prisma).
 *
 * ═══════════════════════ KSZTAŁT I LOKALIZACJA (decyzja test-author) ═══════════════════════
 *
 * Dopisanie do ISTNIEJĄCEGO `apps/b2b-web/src/app/(dashboard)/settings/actions.ts`
 * (dziś `addAuthorizedUser`/`deleteAuthorizedUser`, zasób `authorized_users`), NIE nowy plik
 * `settings/legal-documents/actions.ts`. WO dawał wybór wprost ("Sam zdecyduj lokalizację...
 * albo płasko w settings/actions.ts"). Architektonicznie osobny podkatalog per-zasób byłby
 * czystszy (`legal_document_versions` to inny zasób RBAC niż `authorized_users`, D-C w
 * migracji świadomie rozdziela je od `documents` z tego samego powodu) — ale reguła tej roli
 * ma pierwszeństwo: "dopisanie nowego eksportu do ISTNIEJĄCEGO pliku jest bezpieczniejszym
 * RED-em niż wskazywanie na plik, który nikt jeszcze nie utworzył — brak eksportu w istniejącym
 * module daje `undefined is not a function`, nie błąd rozwiązania modułu" (wzorzec ustalony
 * i dosłownie wypowiedziany w `availability-self-declaration.test.ts`, gdzie z tego samego
 * powodu wybrano dopisanie do `auditors/actions.ts` zamiast nowego pliku). Migracja do
 * dedykowanego podkatalogu, jeśli `settings/actions.ts` urośnie zbyt mocno, jest decyzją
 * `implementer-server`/refaktoru poza zakresem tej tury, nie tego testu.
 *
 * Trzy eksporty (moja decyzja — WO sugerował minimalnie 2, tu dokładam trzeci, bo AC3
 * "szkic pozostaje edytowalny" inaczej nie miałby ŻADNEGO kodu Server Action do przetestowania
 * na tej warstwie — byłby to wyłącznie fakt o wyzwalaczu, sprawdzalny jedynie integracyjnie):
 *
 *   `createLegalDocumentVersionDraftAction(documentKind: string, content: string):
 *      Promise<{ success: boolean; error?: string; id?: string; versionNo?: number }>`
 *   `updateLegalDocumentVersionDraftAction(versionId: string, content: string):
 *      Promise<{ success: boolean; error?: string }>`
 *   `publishLegalDocumentVersionAction(versionId: string):
 *      Promise<{ success: boolean; error?: string }>`
 *
 * Jeśli implementer wybierze inną nazwę/lokalizację/kształt — to jest TEST-DEFECT do
 * zgłoszenia w tej turze, nie powód, żeby ten plik cichcem dopasować (wzorzec ustalony w
 * availability-self-declaration.test.ts).
 *
 * ═══════════════════════ OBLICZENIE version_no (AC5) ═══════════════════════
 *
 * WO wprost: "dziś nie ma sekwencji DB — obliczenie MAX(version_no)+1 musi żyć w transakcji,
 * żeby dwa równoległe utworzenia szkicu nie dostały tego samego numeru." Zakładam interaktywną
 * transakcję `prisma.$transaction(async (tx) => { ... })`: `tx.legalDocumentVersion.findFirst`
 * (odczyt MAX przez `orderBy: { versionNo: 'desc' }`) wewnątrz TEJ SAMEJ transakcji co
 * `tx.legalDocumentVersion.create`. Testy poniżej weryfikują KOLEJNOŚĆ (odczyt przed zapisem
 * w obrębie jednego wywołania `$transaction`) i WARTOŚĆ (`MAX+1`, `1` gdy pusto) — nie
 * weryfikują (nie mogą, na mocku) że Postgres faktycznie serializuje dwie równoległe
 * transakcje na tym samym `documentKind`; to zależy od poziomu izolacji, którego mock nie ma
 * (patrz sekcja "NIETESTOWALNE" niżej).
 *
 * ═══════════════════════ KOLEJNOŚĆ PUBLIKACJI (AC2, AC4) ═══════════════════════
 *
 * WO wprost: "najpierw zdjęcie isCurrent ze starej, potem ustawienie na nowej — częściowy
 * indeks unikalny jest sprawdzany na bieżąco w transakcji, nie dopiero przy commit, odwrotna
 * kolejność by go naruszyła." Zakładam: `prisma.$transaction(async (tx) => { const v =
 * await tx.legalDocumentVersion.findUnique({ where: { id: versionId } }); await
 * tx.legalDocumentVersion.updateMany({ where: { documentKind: v.documentKind, isCurrent:
 * true, NOT: { id: versionId } }, data: { isCurrent: false } }); return
 * tx.legalDocumentVersion.update({ where: { id: versionId }, data: { isCurrent: true,
 * publishedAt: new Date() } }); })`. `updateMany` na starej wersji wysyła WYŁĄCZNIE
 * `{ isCurrent: false }` — nie `content`/`versionNo`/`publishedAt` — bo stara wersja jest już
 * OPUBLIKOWANA i wyzwalacz `legal_document_versions_freeze_published_trg` odrzuciłby próbę
 * zmiany czegokolwiek innego (to jest dokładnie ta "dodatkowa warstwa obrony" z prompta:
 * Server Action wysyła zapytanie zgodne z ograniczeniem, którego prawdziwym strażnikiem
 * jest baza).
 *
 * ═══════════════════════ MOCKOWANE ZALEŻNOŚCI ═══════════════════════
 *
 * `@repo/database` (brak żywej instancji testowej), `../src/utils/supabase/server`
 * (`getCurrentActorRole` woła `next/headers cookies()`, niedostępne poza kontekstem żądania
 * Next.js — wzorzec z auditors/crews/settings actions), `next/cache` (`revalidatePath`).
 * `can()` z `@klikklima/contracts` NIE jest mockowane — leci na prawdziwej, już zmergowanej
 * macierzy RBAC (`legal_document_versions: create/update/delete: ['admin']`).
 *
 * Rodzaj dokumentu (`documentKind`) jest tu literałem `'RODO_CONSENT'` / `'EMPLOYEE_TERMS'`,
 * NIE importem enuma z `@repo/database` — świadomie: `@repo/database` jest w tym pliku
 * zamockowany w całości (`vi.mock('@repo/database', ...)`), więc import enuma sprzed mocka
 * i tak rozwiązałby się do zamockowanego modułu. `LegalDocumentKind` nie jest też eksportem
 * `@klikklima/contracts` (to enum Prisma ze schema.prisma, nie kontrakt lejka/SLA/powiadomień
 * — reguła "zero literałów" z instrukcji tej roli dotyczy stanów/akcji/progów SLA/ID
 * powiadomień generowanych z `contracts/`, nie enumów czysto schematowych). Precedens w tej
 * samej sesji: `availability-self-declaration.test.ts` i `availability-restore.test.ts` używają
 * literału `'ACTIVE'` dla `leave_status` z tego samego powodu.
 *
 * ═══════════════════════ NIETESTOWALNE NA TYM ETAPIE (jawnie, nie milcząco) ═══════════════════════
 *
 * - AC1 (dosłowne "odczyt starej wersji po publikacji nowej zwraca treść niezmienioną bajt
 *   w bajt"): wymaga żywego Postgresa — w tym pliku dowodzę wyłącznie WŁASNOŚCI STRUKTURALNEJ
 *   najbliższej temu kryterium (payload `updateMany` na starej wersji nie zawiera `content`),
 *   nie realnego odczytu z bazy po dwóch transakcjach.
 * - AC2 druga połowa (trigger faktycznie ODRZUCA UPDATE na `content`/`documentKind`/
 *   `versionNo`/`publishedAt` opublikowanego wiersza): to własność `legal_document_versions_
 *   freeze_published_trg` w Postgresie — test na zamockowanej Prismie nie wykona wyzwalacza.
 *   Wymaga testu integracyjnego z żywą instancją (migracja NIE uruchomiona na żadnej bazie —
 *   patrz WO).
 * - AC4 (częściowy indeks unikalny, "także przy dwóch równoległych publikacjach"): wymaga
 *   żywego Postgresa. Test "dwa równoległe wywołania publikacji" niżej sprawdza wyłącznie, że
 *   KAŻDE z dwóch wywołań niezależnie wysyła poprawną SEKWENCJĘ zapytań — nie dowodzi, że baza
 *   faktycznie odrzuci drugie, gdyby oba dotyczyły tego samego rodzaju dokumentu.
 * - AC6 (FK RESTRICT z `employee_consents` — wersji z akceptacjami nie da się usunąć): ten plik
 *   NIE definiuje żadnej akcji usuwania szkicu ani opublikowanej wersji (RBAC ma `delete:
 *   ['admin']`, ale WO nie wymaga jej w minimalnym zestawie, a samo `delete` bez
 *   `employee_consents` — którego FLD-CONSENT-ACCEPT jeszcze nie implementuje — nie miałoby
 *   nic realnego do złamania). Odnotowane jawnie, zgodnie z instrukcją WO, zamiast pomijane
 *   milcząco.
 * - AC7 (typ Postgresa — wartość `document_kind` spoza `LegalDocumentKind` odrzucona przez
 *   bazę): to gwarancja enuma Postgresa, nie logiki JS — nietestowalne na mocku, wymaga
 *   integracji.
 * - Warstwa RLS: migracja włącza RLS bez ŻADNEJ polityki (`ALTER TABLE ... ENABLE ROW LEVEL
 *   SECURITY` bez `CREATE POLICY`, komentarz w migracji: "Autor polityk: osobna pętla z
 *   rls-security-auditor, po decyzji o mapowaniu auth.users"). Panel B2B i tak używa Prismy,
 *   która RLS omija (CLAUDE.md, pułapka 1) — jedyną granicą jest dziś kod tego pliku.
 * - Warstwa UI: nie istnieje żaden komponent kliencki dla tego ekranu — poza zakresem tego WO.
 * - Idempotencja w sensie "drugie wywołanie crona/webhooka nie duplikuje skutku" nie ma tu
 *   naturalnego odpowiednika (to nie jest webhook ani cron) — najbliższy sensowny przypadek,
 *   "opublikowanie już opublikowanej wersji drugi raz", jest pokryty niżej jako test
 *   strukturalny: `is_current` jest flagą, nie operacją tworzącą nowy wiersz, więc powtórne
 *   wywołanie nie może "zduplikować" efektu w sensie, w jakim duplikuje go np. drugi SMS.
 */

const {
  transactionMock,
  txFindFirstMock,
  txCreateMock,
  txFindUniqueMock,
  txUpdateManyMock,
  txUpdateMock,
  draftFindUniqueMock,
  draftUpdateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txFindFirstMock: vi.fn(),
  txCreateMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
  txUpdateManyMock: vi.fn(),
  txUpdateMock: vi.fn(),
  draftFindUniqueMock: vi.fn(),
  draftUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    legalDocumentVersion: {
      findUnique: draftFindUniqueMock,
      update: draftUpdateMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const {
  createLegalDocumentVersionDraftAction,
  updateLegalDocumentVersionDraftAction,
  publishLegalDocumentVersionAction,
} = await import('../src/app/(dashboard)/settings/actions');

// Obiekt `tx` przekazywany do callbacku `prisma.$transaction(async (tx) => ...)` — jeden
// wspólny kształt, bo obie akcje transakcyjne (create, publish) operują na tym samym modelu.
const tx = {
  legalDocumentVersion: {
    findFirst: txFindFirstMock,
    create: txCreateMock,
    findUnique: txFindUniqueMock,
    updateMany: txUpdateManyMock,
    update: txUpdateMock,
  },
};

beforeEach(() => {
  transactionMock.mockReset();
  txFindFirstMock.mockReset();
  txCreateMock.mockReset();
  txFindUniqueMock.mockReset();
  txUpdateManyMock.mockReset();
  txUpdateMock.mockReset();
  draftFindUniqueMock.mockReset();
  draftUpdateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
});

describe('createLegalDocumentVersionDraftAction (settings/actions.ts) — FLD-LEGAL-DOC-VERSION', () => {
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — rola dyspozytor (create wyłącznie admin) jest odrzucona fail-closed, przed transakcją', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await createLegalDocumentVersionDraftAction('RODO_CONSENT', 'treść klauzuli');

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — role audytor i monter (create wyłącznie admin) są odrzucone fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    const auditorResult = await createLegalDocumentVersionDraftAction('EMPLOYEE_TERMS', 'regulamin');
    expect(auditorResult.success).toBe(false);

    getCurrentActorRoleMock.mockResolvedValue('monter');
    const crewResult = await createLegalDocumentVersionDraftAction('EMPLOYEE_TERMS', 'regulamin');
    expect(crewResult.success).toBe(false);

    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Fail-closed: brak roli (sesja nierozpoznana) nie może przejść jako "brak sprawdzenia" —
  // wzorzec ustalony w availability-self-declaration.test.ts i settings/actions.ts.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await createLegalDocumentVersionDraftAction('RODO_CONSENT', 'treść klauzuli');

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC5 — numer wersji to MAX(version_no) w obrębie rodzaju + 1, obliczone WEWNĄTRZ transakcji', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindFirstMock.mockResolvedValue({ versionNo: 3 });
    txCreateMock.mockResolvedValue({ id: 'v-4', versionNo: 4 });

    const result = await createLegalDocumentVersionDraftAction('RODO_CONSENT', 'treść v4');

    expect(result.success).toBe(true);
    expect(result.versionNo).toBe(4);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentKind: 'RODO_CONSENT' },
        orderBy: { versionNo: 'desc' },
      }),
    );
    expect(txCreateMock).toHaveBeenCalledWith({
      data: {
        documentKind: 'RODO_CONSENT',
        content: 'treść v4',
        versionNo: 4,
        publishedAt: null,
        isCurrent: false,
      },
    });
    // Kolejność: odczyt MAX przed zapisem, w obrębie JEDNEJ transakcji (AC5, WO).
    expect(txFindFirstMock.mock.invocationCallOrder[0]).toBeLessThan(
      txCreateMock.mock.invocationCallOrder[0],
    );
  });

  // Przypadek pusty (AC5): pierwszy dokument danego rodzaju w historii systemu.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC5 — przypadek pusty: brak istniejących wersji danego rodzaju daje version_no = 1', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindFirstMock.mockResolvedValue(null);
    txCreateMock.mockResolvedValue({ id: 'v-1', versionNo: 1 });

    const result = await createLegalDocumentVersionDraftAction('EMPLOYEE_TERMS', 'pierwszy regulamin');

    expect(result.success).toBe(true);
    expect(result.versionNo).toBe(1);
    expect(txCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNo: 1 }) }),
    );
  });

  // Przypadek "maksymalny" w sensie numeracji: sekwencja kontynuuje się bez zaokrągleń ani
  // resetu przy dużych numerach — dowód, że obliczenie to `+1`, nie stała ani modulo.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC5 — numeracja kontynuuje się poprawnie przy dużym version_no istniejącej wersji', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindFirstMock.mockResolvedValue({ versionNo: 999 });
    txCreateMock.mockResolvedValue({ id: 'v-1000', versionNo: 1000 });

    const result = await createLegalDocumentVersionDraftAction('RODO_CONSENT', 'treść v1000');

    expect(result.versionNo).toBe(1000);
  });

  // Numeracja jest niezależna między rodzajami dokumentu (AC5: "w obrębie rodzaju") — zapytanie
  // o MAX musi filtrować po documentKind, inaczej regulamin i klauzula RODO dzieliłyby jedną
  // sekwencję i AC5 byłoby złamane przy pierwszym mieszanym scenariuszu.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC5 — obliczenie MAX filtruje po documentKind (numeracja RODO_CONSENT i EMPLOYEE_TERMS są niezależne)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindFirstMock.mockResolvedValue({ versionNo: 7 });
    txCreateMock.mockResolvedValue({ id: 'v-8', versionNo: 8 });

    await createLegalDocumentVersionDraftAction('EMPLOYEE_TERMS', 'regulamin v8');

    expect(txFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentKind: 'EMPLOYEE_TERMS' } }),
    );
  });

  // AC3 (pochodna): nowy szkic NIGDY nie jest tworzony jako obowiązujący ani opublikowany —
  // wersjonowanie zaczyna się od publikacji, nie od zapisu roboczego. Payload create powyżej
  // (`isCurrent: false, publishedAt: null`) już to dowodzi wprost dla jednej ścieżki; ten test
  // dokłada asercję negatywną — draft NIGDY nie woła prisma.legalDocumentVersion.update (to jest
  // wyłącznie ścieżka publikacji/edycji), żeby wykluczyć implementację, która "od razu publikuje".
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC3 — utworzenie szkicu nigdy nie woła update (create ≠ publikacja)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindFirstMock.mockResolvedValue(null);
    txCreateMock.mockResolvedValue({ id: 'v-1', versionNo: 1 });

    await createLegalDocumentVersionDraftAction('RODO_CONSENT', 'szkic');

    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txUpdateManyMock).not.toHaveBeenCalled();
    expect(draftUpdateMock).not.toHaveBeenCalled();
  });
});

describe('updateLegalDocumentVersionDraftAction (settings/actions.ts) — FLD-LEGAL-DOC-VERSION', () => {
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — rola dyspozytor (update wyłącznie admin) jest odrzucona fail-closed, przed odczytem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await updateLegalDocumentVersionDraftAction('v-1', 'nowa treść');

    expect(result.success).toBe(false);
    expect(draftFindUniqueMock).not.toHaveBeenCalled();
    expect(draftUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateLegalDocumentVersionDraftAction('v-1', 'nowa treść');

    expect(result.success).toBe(false);
    expect(draftUpdateMock).not.toHaveBeenCalled();
  });

  // AC3: szkic (published_at IS NULL) pozostaje w pełni edytowalny.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC3 — szkic (publishedAt: null) jest edytowalny: treść zapisana przez update', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    draftFindUniqueMock.mockResolvedValue({ id: 'v-1', publishedAt: null, isCurrent: false });
    draftUpdateMock.mockResolvedValue({ id: 'v-1', content: 'poprawiona treść' });

    const result = await updateLegalDocumentVersionDraftAction('v-1', 'poprawiona treść');

    expect(result.success).toBe(true);
    expect(draftUpdateMock).toHaveBeenCalledWith({
      where: { id: 'v-1' },
      data: { content: 'poprawiona treść' },
    });
  });

  // AC2 / dodatkowa warstwa obrony (WO, sekcja "MOCKOWANE ZALEŻNOŚCI"): prawdziwym strażnikiem
  // niezmienności jest wyzwalacz w bazie, ale Server Action SAMA odrzuca próbę edycji
  // opublikowanego wiersza PRZED wysłaniem zapytania — dowód nie na tym, że baza by to
  // zablokowała (nietestowalne na mocku, patrz komentarz na górze pliku), tylko na tym, że
  // update w ogóle NIE ZOSTAJE wysłany.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC2 — próba edycji treści już OPUBLIKOWANEJ wersji jest odrzucona przez Server Action przed zapytaniem update', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    draftFindUniqueMock.mockResolvedValue({
      id: 'v-3',
      publishedAt: new Date('2026-08-20T10:00:00Z'),
      isCurrent: true,
    });

    const result = await updateLegalDocumentVersionDraftAction('v-3', 'próba nadpisania opublikowanej treści');

    expect(result.success).toBe(false);
    expect(draftUpdateMock).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy: wskazanie nieistniejącej wersji nie może cicho "powodzenie się",
  // ani wywołać update na niczym.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('próba edycji nieistniejącej wersji jest odrzucona bez wywołania update', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    draftFindUniqueMock.mockResolvedValue(null);

    const result = await updateLegalDocumentVersionDraftAction('nie-ma-takiej', 'treść');

    expect(result.success).toBe(false);
    expect(draftUpdateMock).not.toHaveBeenCalled();
  });
});

describe('publishLegalDocumentVersionAction (settings/actions.ts) — FLD-LEGAL-DOC-VERSION', () => {
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — rola dyspozytor (update wyłącznie admin) jest odrzucona fail-closed, przed transakcją', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await publishLegalDocumentVersionAction('v-2');

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — role audytor i monter (update wyłącznie admin) są odrzucone fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    expect((await publishLegalDocumentVersionAction('v-2')).success).toBe(false);

    getCurrentActorRoleMock.mockResolvedValue('monter');
    expect((await publishLegalDocumentVersionAction('v-2')).success).toBe(false);

    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC7 — brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await publishLegalDocumentVersionAction('v-2');

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC2 / AC4 — sedno WO: "najpierw zdjęcie isCurrent ze starej, potem ustawienie na nowej,
  // W JEDNEJ TRANSAKCJI" — odwrotna kolejność naruszyłaby częściowy indeks unikalny w trakcie
  // transakcji (sprawdzany na bieżąco, nie dopiero przy commit).
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC2/AC4 — kolejność publikacji: updateMany (zdjęcie isCurrent ze starej wersji) PRZED update (ustawienie nowej)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue({ id: 'v-2', documentKind: 'RODO_CONSENT' });
    txUpdateManyMock.mockResolvedValue({ count: 1 });
    txUpdateMock.mockResolvedValue({ id: 'v-2', isCurrent: true });

    const result = await publishLegalDocumentVersionAction('v-2');

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txUpdateManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      txUpdateMock.mock.invocationCallOrder[0],
    );
  });

  // AC2 — payload zdejmujący isCurrent ze starej wersji dotyka WYŁĄCZNIE is_current: stara
  // wersja jest już opublikowana, więc wyzwalacz freeze odrzuciłby próbę zmiany czegokolwiek
  // innego (content/versionNo/publishedAt) — Server Action nie wysyła nawet próby.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC2 — payload updateMany na starej wersji zawiera wyłącznie { isCurrent: false }', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue({ id: 'v-5', documentKind: 'EMPLOYEE_TERMS' });
    txUpdateManyMock.mockResolvedValue({ count: 1 });
    txUpdateMock.mockResolvedValue({ id: 'v-5', isCurrent: true });

    await publishLegalDocumentVersionAction('v-5');

    expect(txUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isCurrent: false } }),
    );
  });

  // AC2 — updateMany celuje WYŁĄCZNIE w poprzednio obowiązującą wersję TEGO SAMEGO rodzaju
  // dokumentu, wykluczając publikowaną wersję samą z siebie: filtr po documentKind (nie po
  // wszystkich zasobach) i NOT { id: versionId } (żeby update na wierszu nowej wersji nie
  // przeciął się z updateMany na starej, gdyby przez pomyłkę already-current).
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC2 — updateMany filtruje po documentKind publikowanej wersji i wyklucza jej własne id', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue({ id: 'v-9', documentKind: 'RODO_CONSENT' });
    txUpdateManyMock.mockResolvedValue({ count: 1 });
    txUpdateMock.mockResolvedValue({ id: 'v-9', isCurrent: true });

    await publishLegalDocumentVersionAction('v-9');

    expect(txUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentKind: 'RODO_CONSENT',
          isCurrent: true,
          NOT: { id: 'v-9' },
        }),
      }),
    );
  });

  // Publikowana wersja dostaje isCurrent: true I published_at (moment publikacji) w jednym
  // zapisie — to jest jedyny moment, w którym published_at wolno ustawić po raz pierwszy
  // (wyzwalacz freeze uruchamia się dopiero od NASTĘPNEGO update na już opublikowanym wierszu).
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('AC2 — payload update na publikowanej wersji ustawia isCurrent: true oraz publishedAt (Date)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue({ id: 'v-9', documentKind: 'RODO_CONSENT' });
    txUpdateManyMock.mockResolvedValue({ count: 1 });
    txUpdateMock.mockResolvedValue({ id: 'v-9', isCurrent: true });

    await publishLegalDocumentVersionAction('v-9');

    expect(txUpdateMock).toHaveBeenCalledWith({
      where: { id: 'v-9' },
      data: { isCurrent: true, publishedAt: expect.any(Date) },
    });
  });

  // Pierwsza publikacja danego rodzaju dokumentu (brak poprzednio obowiązującej wersji):
  // updateMany trafia w zero wierszy (fixture zwraca count: 0), co nie jest błędem — akcja
  // mimo to poprawnie kontynuuje do ustawienia nowej wersji jako obowiązującej.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('pierwsza publikacja rodzaju dokumentu (brak poprzedniej obowiązującej wersji) kończy się sukcesem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue({ id: 'v-1', documentKind: 'EMPLOYEE_TERMS' });
    txUpdateManyMock.mockResolvedValue({ count: 0 });
    txUpdateMock.mockResolvedValue({ id: 'v-1', isCurrent: true });

    const result = await publishLegalDocumentVersionAction('v-1');

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isCurrent: true }) }),
    );
  });

  // Przypadek brzegowy: publikacja wskazująca na nieistniejącą wersję jest odrzucona bez
  // dalszych zapytań pisanych do bazy.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('publikacja nieistniejącej wersji jest odrzucona bez wywołania updateMany/update', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue(null);

    const result = await publishLegalDocumentVersionAction('nie-ma-takiej');

    expect(result.success).toBe(false);
    expect(txUpdateManyMock).not.toHaveBeenCalled();
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  // AC4, przypadek strukturalny (patrz zastrzeżenie "NIETESTOWALNE" na górze pliku — to NIE
  // dowodzi realnej ochrony przed wyścigiem w bazie, wyłącznie że KAŻDE z dwóch równoległych
  // wywołań niezależnie zachowuje właściwą sekwencję zapytań). Wzorzec identyczny jak
  // "podwójne równoległe wywołanie" w availability-self-declaration.test.ts.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('dwa równoległe wywołania publikacji tego samego rodzaju dokumentu niezależnie zachowują kolejność updateMany→update', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, documentKind: 'RODO_CONSENT' }),
    );
    txUpdateManyMock.mockResolvedValue({ count: 1 });
    txUpdateMock.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, isCurrent: true }),
    );

    const [first, second] = await Promise.all([
      publishLegalDocumentVersionAction('v-a'),
      publishLegalDocumentVersionAction('v-b'),
    ]);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(txUpdateManyMock).toHaveBeenCalledTimes(2);
    expect(txUpdateMock).toHaveBeenCalledTimes(2);
  });

  // Idempotencja (patrz zastrzeżenie na górze pliku — najbliższy sensowny odpowiednik "drugie
  // wywołanie webhooka nie duplikuje skutku" dla flagi boolean, nie dla operacji tworzącej
  // wiersz): opublikowanie już opublikowanej i już obowiązującej wersji drugi raz z rzędu nie
  // gromadzi efektów — każde wywołanie niezależnie wysyła dokładnie jedną parę zapytań.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('drugie wywołanie publikacji tej samej, już obowiązującej wersji nie kumuluje zapytań', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txFindUniqueMock.mockResolvedValue({ id: 'v-9', documentKind: 'RODO_CONSENT', isCurrent: true });
    txUpdateManyMock.mockResolvedValue({ count: 0 });
    txUpdateMock.mockResolvedValue({ id: 'v-9', isCurrent: true });

    await publishLegalDocumentVersionAction('v-9');
    await publishLegalDocumentVersionAction('v-9');

    expect(txUpdateManyMock).toHaveBeenCalledTimes(2);
    expect(txUpdateMock).toHaveBeenCalledTimes(2);
  });
});
