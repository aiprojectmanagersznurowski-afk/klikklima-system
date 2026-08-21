/**
 * KONTRAKT: Role, uprawnienia i zasady RODO.
 * Źródła: b2b_app_requirements.md (Epic 5), database_model.md (§4), b2b_crm_specifications.md (globalne „Usuń")
 *
 * Zasada nadrzędna: DELETE w każdym widoku CRM = wyłącznie rola `admin`,
 * egzekwowane w TRZECH warstwach (UI, Server Action, RLS). Test kontraktowy sprawdza wszystkie trzy.
 */

export const ROLES = ['admin', 'dyspozytor', 'audytor', 'monter'];

export const RESOURCES = [
  'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
  'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates', 'authorized_users', 'audit_log',
  // ── ADR-012 (2026-08-18) ──
  'bookings', 'absences', 'regions', 'documents', 'invoices', 'contact_log', 'notes', 'vehicles', 'soft_leads',
  // ── FLD-AVAILABILITY-SPLIT (D-A, 2026-08-21) ──
  // Odpowiada tabeli public.availability_declarations (migracja 20260821120000).
  'availability_declarations',
  // ── FLD-CONSENT-DOCS (D-C, 2026-08-21) ──
  // Odpowiadają tabelom public.legal_document_versions i public.employee_consents
  // (migracja 20260821130000). D-C: NOWY zasób, nie rozszerzenie `documents` — tamten ma
  // `create` przyznane audytorowi i monterowi, więc rozszerzenie zlałoby „tworzę dokument"
  // z „akceptuję dokument" w jednym zasobie, a macierz nie rozróżnia rodzajów w obrębie zasobu.
  'legal_document_versions', 'employee_consents',
];

/** capability: read | create | update | delete | assign */
export const MATRIX = [
  { resource: 'clients',            read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'leads',              read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin'] },
  { resource: 'quotes',             read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['audytor', 'admin'],    update: ['audytor:own', 'admin'], delete: ['admin'] },
  { resource: 'installations',      read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'services',           read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'incidents',          read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'auditors',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'crews',              read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'shipments',          read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'notification_queue', read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'message_templates',  read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'authorized_users',   read: ['admin'],                                   create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: [],                      delete: [] },
  // ── ADR-012: zasoby dodane 2026-08-18 ──
  // Klient rezerwuje termin przez publiczny link z tokenem, a nie jako rola w RBAC — nie ma konta
  // w authorized_users. Ta ścieżka jest osobnym, wąskim endpointem z własnym guardem, nie wpisem w macierzy.
  { resource: 'bookings',           read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin', 'dyspozytor'] },
  { resource: 'absences',           read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'regions',            read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'documents',          read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor', 'audytor', 'monter'], update: ['admin'], delete: ['admin'] },
  { resource: 'invoices',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'contact_log',        read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: [],                      delete: ['admin'] },
  { resource: 'notes',              read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'vehicles',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'soft_leads',         read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  // ── FLD-AVAILABILITY-SPLIT: zasób dodany 2026-08-21 (decyzja D-A + rozstrzygnięcie R2) ──
  // Jedyny zasób, na którym role terenowe mają `update`. Istnieje po to, żeby to prawo NIE niosło
  // ze sobą prawa zapisu do audytorzy.is_active i audytorzy.leave_status: macierz nie rozróżnia
  // kolumn, więc rozdzielenie musi przebiegać po granicy tabeli.
  //
  // `auditors.update` i `crews.update` powyżej zostają ['admin'] — TO JEST SEDNO tego wiersza.
  // Dopisanie tam 'audytor:own' skasowałoby cały sens zmiany: pracownik odzyskałby ścieżkę
  // do zdjęcia sobie blokady administracyjnej i urlopu wpisanego przez kadry.
  //
  // `create` z wariantem :own jest konieczne, nie ozdobne: pracownik dodany po migracji nie ma
  // jeszcze wiersza deklaracji (backfill objął wyłącznie stan z dnia wdrożenia), więc pierwsza
  // zmiana dostępności jest wstawieniem, a nie aktualizacją.
  // `delete` wyłącznie admin (R13) — pracownik nie kasuje własnej deklaracji, tylko ją przełącza;
  // usunięcie wiersza znaczy „dostępny", więc byłoby drugą, cichą ścieżką do tego samego skutku.
  { resource: 'availability_declarations', read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'audytor:own', 'monter:own'], update: ['admin', 'audytor:own', 'monter:own'], delete: ['admin'] },
  // ── FLD-CONSENT-DOCS: zasoby dodane 2026-08-21 (decyzje D-C i D-D) ──
  //
  // legal_document_versions — treść zgód RODO i regulaminu, wersjonowana.
  // `read` bez wariantu :own i dla wszystkich ról: dokument prawny nie jest „czyjś". Pracownik
  // MUSI przeczytać treść, żeby ją zaakceptować, a akceptacja treści, do której nie ma dostępu,
  // byłaby bezwartościowa dowodowo — czyli byłaby zaprzeczeniem powodu, dla którego ten rejestr istnieje.
  // `create`/`update`/`delete` wyłącznie admin (AC7): wgranie i opublikowanie wersji to czynność
  // administratora, sprawdzana po stronie serwera. Ukrycie przycisku w UI nie jest zabezpieczeniem,
  // bo Prisma omija RLS (pułapka 1 w CLAUDE.md).
  // `update` dla admina istnieje, bo publikacja i wycofanie wersji TO JEST update kolumny is_current.
  // Niezmienności treści opublikowanej NIE pilnuje ten wiersz — macierz nie rozróżnia kolumn —
  // tylko wyzwalacz legal_document_versions_freeze_published_trg w bazie (AC1).
  { resource: 'legal_document_versions', read: ['admin', 'dyspozytor', 'audytor', 'monter'], create: ['admin'], update: ['admin'], delete: ['admin'] },
  //
  // employee_consents — rejestr akceptacji. APPEND-ONLY, profil audit_log.
  // `update: []` i `delete: []` — NIKT, łącznie z adminem. To jest świadoma decyzja, a nie skutek
  // złapania przez regułę: mutacja R22-audit-append-only w kk-selftest.mjs jest przypięta do
  // literalnego wiersza `audit_log`, więc TEGO zasobu by nie złapała. Powód jest ten sam co tam:
  // rejestr, który administrator może poprawić, nie jest dowodem niczego, a poprawiony wpis zgody
  // to dowód wobec organu wystawiony po fakcie. Zmiana zdania = nowy wiersz (nowa akceptacja),
  // nigdy edycja starego. W bazie odpowiada temu wyzwalacz employee_consents_append_only_trg (AC5).
  // `delete: []` przechodzi R13 (reguła dopuszcza pustą listę, jak przy audit_log). Retencja RODO
  // (AUDIT_REQUIREMENTS.retentionDays) to purge operacyjny po upływie okresu, a nie uprawnienie roli.
  // `create` dla ról terenowych bez wariantu :own — wariant :own zapisałby „pracownik akceptuje
  // własną zgodę", ale właściciela wiersza wyznacza tu dopiero para (auditor_id | crew_id), której
  // macierz nie widzi; ograniczenie „tylko za siebie" musi wyrazić polityka RLS i Server Action.
  // `admin` w `create` jest celowo NIEOBECNY: administrator nie akceptuje zgody w imieniu pracownika.
  // To jedyny wiersz w tej macierzy, w którym admina nie ma w `create`, i to jest sedno — akceptacja
  // wpisana przez kogoś innego niż pracownik nie jest akceptacją.
  { resource: 'employee_consents', read: ['admin', 'audytor:own', 'monter:own'], create: ['audytor', 'monter'], update: [], delete: [] },
];

/** Polityki kluczy obcych przy usuwaniu — database_model.md §4.2 */
export const DELETE_POLICIES = [
  { entity: 'clients',   strategy: 'ANONYMIZE_OR_SET_NULL', rationale: 'RODO bez utraty historii finansowej montażu.', cascades: [] },
  { entity: 'leads',     strategy: 'CASCADE',               rationale: 'Duplikat/błąd systemowy — encje zależne w trakcie tworzenia idą w kaskadzie.', cascades: ['quotes', 'shipments'] },
  { entity: 'auditors',  strategy: 'BLOCK_UNTIL_REASSIGNED', rationale: 'Wymusza przepięcie wiszących leadów.', cascades: [] },
  { entity: 'crews',     strategy: 'BLOCK_UNTIL_REASSIGNED', rationale: 'Wymusza przepięcie aktywnych instalacji.', cascades: [] },
];

/**
 * Wymogi audytowe (ADR-008, rozstrzygnięte 2026-08-18).
 * Tabela audit_log jest append-only — RLS odrzuca UPDATE i DELETE dla wszystkich ról,
 * łącznie z admin. Rejestr, który administrator może poprawić, nie jest dowodem niczego.
 */
export const AUDIT_REQUIREMENTS = {
  appendOnly: true,
  mustLog: ['delete', 'anonymize', 'role_change', 'contract_override', 'manual_status_change', 'notification_resend'],
  legalBases: ['RODO_ERASURE_REQUEST', 'OPERATIONAL_ERROR', 'DUPLICATE', 'COURT_ORDER', 'OTHER'],
  requiresJustification: true,
  retentionDays: 1825,
  status: 'STABLE',
};
