// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const REQUIREMENT_IDS = ["FNL-E1-E2", "FNL-E2-E3", "FNL-E3-E4", "FNL-E3-BUCKET", "FNL-E4-E5", "FNL-E5-E6", "FNL-E5-BYPASS", "FNL-E6-E7", "FNL-E7-E8", "FNL-ROLLBACK", "FNL-ROLLBACK-EXIT", "FNL-NO-ILLEGAL-TRANSITIONS", "CRM-KLI-AC1", "CRM-KLI-AC2", "CRM-KLI-AC3", "CRM-INST-AC1", "CRM-INST-AC2", "CRM-SRV-TRIGGER", "CRM-UST-AC1", "CRM-UST-AC2", "CRM-UST-AC3", "CRM-AUDYT-AC1", "CRM-AUDYT-AC2", "CRM-AUDYT-AC3", "CRM-AUDYT-KARTOTEKA", "CRM-ZESP-KARTOTEKA", "CRM-ZESP-AC1", "CRM-ZESP-AC2", "CRM-ZESP-AC3", "CRM-ZIMNE-AC1", "CRM-ZIMNE-AC2", "CRM-ZIMNE-AC3", "CRM-BOOK-HISTORY", "CRM-REGION-AUTO", "FNL-2PHASE", "FNL-2PHASE-BOOKING", "FNL-2PHASE-ROLLBACK-RELEASE", "FNL-ROLLBACK-BOOKING-RELEASE", "FNL-2PHASE-INVOICE", "NTF-PUSH-TOKEN", "NTF-I7-SLA", "SRV-SOURCE-OF-TRUTH", "SRV-REMINDER-ONCE", "CRM-ZESP-REP", "CRM-DELETE-ADMIN-ONLY", "CRM-DELETE-ADMIN-ONLY-CLIENTS", "CRM-CLIENT-ANONYMIZE-RODO", "SEC-AUDIT-LOG-APPEND-ONLY", "CRM-DELETE-ADMIN-ONLY-LEADS", "CRM-DELETE-ADMIN-ONLY-INSTALLATIONS", "CRM-DELETE-ADMIN-ONLY-SERVICES", "CRM-DELETE-ADMIN-ONLY-INCIDENTS", "CRM-DELETE-ADMIN-ONLY-AUDITORS", "CRM-DELETE-ADMIN-ONLY-CREWS", "CRM-CREW-UPDATE-ADMIN-ONLY", "CRM-CONTEXT-MENU", "SLA-QUOTE-14D", "SLA-LOG-COLORS", "UI-SLA-NO-GREEN", "UI-NO-HARDCODED-COLORS", "UI-ICONS-LUCIDE-ONLY", "UI-FORMS-RHF-ZOD", "SRV-NEXT-DATE", "SEC-SSO-GUARD", "SEC-AUTHZ-USER-MGMT", "SEC-RLS-AUDITOR-SCOPE", "SEC-ASSIGNMENT-POOL-MINIMIZE", "SEC-LEADS-LIST-MINIMIZE", "SEC-LEADS-LIST-SCALARS", "CRM-LEAD-UPDATE-ADMIN-DISPATCHER", "SEC-AUTHZ-B2B-MUTATIONS", "SEC-AUTHZ-B2B-READS", "SEC-EMAIL-UNIQUE", "SEC-EMAIL-CASE-NORMALIZE", "SEC-SERVICE-KEY-SERVER-ONLY", "SEC-RODO-DELETE", "SEC-AUDIT-LOG", "SEC-AUDIT-LOG-DELETE", "SEC-AUDIT-LOG-ROLE-CHANGE", "SEC-AUDIT-LOG-MANUAL-STATUS", "SEC-LAST-ADMIN-GUARD", "SEC-AUTHZ-DEFAULT-ROLE", "NTF-QUEUE-TABLE", "NTF-QUEUE-WINDOW", "NTF-POLY", "NTF-HISTORY", "NTF-RETRY", "NTF-CATALOG-PARITY", "B2C-LEAD-ENTRY", "B2C-LEAD-ATOMIC", "B2C-BOOKING-SLOT", "B2C-CONSENT-RODO", "B2C-RLS-PUBLIC", "B2C-TRIAGE-STEPS", "B2C-TRIAGE-DISQUALIFY", "B2C-TRIAGE-CONDITIONAL", "B2C-SOFT-LEAD", "B2C-BOOKING-VALIDATION", "B2C-PRICE-FROM", "B2C-CATALOG-LIST", "B2C-DEVICE-MODAL", "B2C-CATALOG-VIEW-TRACKED", "B2C-CONTENT-PAGES", "B2C-NAV-STATE", "FLD-GEO-COORDS", "FLD-GEO-UNLOCK", "FLD-GEO-EN-ROUTE", "FLD-GPS-RODO", "FLD-AUTH-BLOCKED", "FLD-CONSENT-TRIGGERS-INTEGRATION", "FLD-CONSENT-ACCEPT", "FLD-LEGAL-DOC-VERSION", "FLD-AVAIL-SELF", "FLD-AVAIL-RESTORE", "FLD-AVAIL-WEEKLY-RULES", "CAL-SLOT-ENGINE", "CAL-POOL-AGGREGATE", "FLD-BOOKING-ATOMIC-ASSIGN", "FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT", "CAL-VISIT-DURATION-BASKETS", "CAL-TRAVEL-BUFFER", "FLD-QUOTE-BASKET-SELECT", "FLD-BASE-LOCATION-EDIT", "CRM-PROJECT-NUMBER", "CRM-READABLE-IDENTIFIERS", "FLD-PHOTO-SET", "FNL-ADVANCE-STATUS-CONTRACT-BOUND", "FLD-APP-SHELL", "FLD-API-LAYER", "FLD-APP-DISTRIBUTION", "FLD-MOBILE-TEST-HARNESS", "FLD-JOBS-OWN", "FLD-CONSENT-ENFORCE", "FLD-CHECKLIST-PREINSTALL", "FLD-PHOTO-STORAGE", "FLD-PHOTO-UPLOAD-RESILIENT", "FLD-OFFLINE-OUTBOX", "FLD-HANDOVER-PROTOCOL", "DOC-PDF-RENDER", "FLD-INSTALL-PAYOUT-APPROVAL", "FLD-SIGN-DOC-FREEZE", "FLD-SIGN-CAPTURE", "FLD-SIGN-AUDIT-TRAIL", "FLD-SIGN-TSA", "FLD-SIGN-REMOTE", "FLD-SIGN-REMOTE-OTP", "FLD-SIGN-DELIVERY-PROOF", "FLD-SIGN-ABUSE-GUARD", "FLD-SIGN-DURABLE-COPY", "FLD-AUDIT-LEAD-CREATE", "FLD-AUDIT-FORM", "FLD-AUDIT-INSTALL-TYPE", "FLD-QUOTE-BASKET-SELECT-AUDITOR", "FLD-QUOTE-VARIANTS", "PRICE-LIST-SCHEMA", "PRICE-LIST-IMPORT", "PRICE-LIST-ADMIN", "STD-INSTALL-CONFIG", "B2C-TRIAGE-PRICE-FROM-PRICE-LIST", "FLD-QUOTE-CALC", "FLD-QUOTE-ROOMS", "FLD-QUOTE-GENERAL-ITEMS", "PRICE-VAT-RATE", "FLD-QUOTE-MANUAL-ITEM", "FLD-QUOTE-PRICE-SNAPSHOT", "FLD-CONTRACT-GENERATE", "DOC-LEGAL-VERSION-REGISTRY", "INV-PROFORMA", "INV-ADVANCE-AUTO", "INV-FINAL", "PAY-DEPOSIT-LINK", "FLD-PHOTO-SET-PHASE-ONE", "B2C-PROPERTY-AREA-BAND", "FLD-API-IDEMPOTENCY-REGISTRY", "SEC-ACCESS-DENIED-LOG", "NTF-TEMPLATE-STORE", "NTF-QUEUE-RENDERED-BODY", "NTF-QUEUE-CLAIM", "NTF-DISPATCH-CRON", "SEC-WEBHOOK-SECRET-REQUIRED", "B2C-SOFT-LEAD-CONSENT", "QA-E2E-SUITE-REPAIR", "QA-E2E-REQUIRED-CHECK", "GATE-EVASION-DETECT"] as const;
export type RequirementId = (typeof REQUIREMENT_IDS)[number];

export const REQUIREMENTS = [
  {
    "id": "FNL-E1-E2",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#etap-1",
    "statement": "Administrator ręcznie przypisuje audytora, co przenosi leada z E1 do E2."
  },
  {
    "id": "FNL-E2-E3",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#etap-2",
    "statement": "Wysłanie wyceny z Field App automatycznie przenosi leada do E3 (auto-transition)."
  },
  {
    "id": "FNL-E3-E4",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#etap-3",
    "statement": "Klient akceptuje wycenę i rezerwuje termin montażu, co przenosi leada do E4."
  },
  {
    "id": "FNL-E3-BUCKET",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#bucket-wyceny-odrzucone",
    "statement": "Brak akceptacji wyceny po 14 dniach automatycznie przenosi leada do bucketu QUOTE_REJECTED."
  },
  {
    "id": "FNL-E4-E5",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#etap-4",
    "statement": "Administrator przypisuje ekipę (Crew_ID), lead przechodzi do E5."
  },
  {
    "id": "FNL-E5-E6",
    "domain": "logistics",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "b2b_funnel_process.md#etap-5",
    "statement": "Akcja „Wysłano kurierem\" z Tracking ID przenosi leada do E6."
  },
  {
    "id": "FNL-E5-BYPASS",
    "domain": "logistics",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "b2b_funnel_process.md#etap-5",
    "statement": "Akcja „Dostawa z ekipą\" pomija E6 i przenosi leada bezpośrednio do E7."
  },
  {
    "id": "FNL-E6-E7",
    "domain": "logistics",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#etap-6",
    "statement": "Webhook kuriera „Doręczono\" lub ręczna akcja dyspozytora przenosi leada do E7."
  },
  {
    "id": "FNL-E7-E8",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#etap-7",
    "statement": "Monter zamyka montaż w Field App, lead przechodzi do E8."
  },
  {
    "id": "FNL-ROLLBACK",
    "domain": "logistics",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_funnel_process.md#rollback-engine",
    "statement": "Lead z etapów E4–E7 może trafić do bucketu ROLLBACK_RESCHEDULING."
  },
  {
    "id": "FNL-ROLLBACK-EXIT",
    "domain": "logistics",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_funnel_process.md#rollback-engine",
    "statement": "Wybór nowego terminu przez klienta zwraca leada do E4."
  },
  {
    "id": "FNL-NO-ILLEGAL-TRANSITIONS",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "contracts/funnel.contract.mjs",
    "statement": "Każde przejście stanu nieujęte w kontrakcie musi zostać odrzucone przez warstwę serwerową ORAZ przez bazę."
  },
  {
    "id": "CRM-KLI-AC1",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#1",
    "statement": "Globalna wyszukiwarka znajduje klienta po imieniu, nazwisku, telefonie lub e-mailu."
  },
  {
    "id": "CRM-KLI-AC2",
    "domain": "crm",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#1; PRZEPISANE 2026-09-24 na podstawie wyjaśnienia Michała (okno KK-IMPL-2026Q4) — pierwotne brzmienie opisywało propagację danych kontaktowych do leadów, czyli mechanizm duplikujący dane znormalizowane. Właściwym problemem jest wąski odczyt dla ról terenowych.",
    "statement": "Audytor i ekipa montażowa widzą dane kontaktowe klienta wyłącznie dla przypisanego sobie zlecenia i wyłącznie w zakresie potrzebnym w terenie — bez dostępu do kartoteki klienta i bez kopiowania tych danych na leada."
  },
  {
    "id": "CRM-KLI-AC3",
    "domain": "crm",
    "status": "TODO",
    "risk": "LOW",
    "source": "b2b_crm_specifications.md#1",
    "statement": "Karta 360 ładuje historię i pliki asynchronicznie (lazy loading)."
  },
  {
    "id": "CRM-INST-AC1",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#2",
    "statement": "Widok Instalacji odświeża status, gdy ekipa oznaczy montaż jako zakończony w aplikacji mobilnej."
  },
  {
    "id": "CRM-INST-AC2",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#2",
    "statement": "Dzisiejsze instalacje bez statusu Zakończona po godzinie 16:00 podświetlają się na pomarańczowo."
  },
  {
    "id": "CRM-SRV-TRIGGER",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#3",
    "statement": "Nocny job aktualizuje statusy zbliżających się serwisów i generuje N10 na 30 dni przed terminem."
  },
  {
    "id": "CRM-UST-AC1",
    "domain": "crm",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#4",
    "statement": "Usterka o priorytecie Krytyczny natychmiast wysyła PUSH do dyspozytora."
  },
  {
    "id": "CRM-UST-AC2",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#4",
    "statement": "Formularz usterki wymusza opis problemu i umożliwia załączenie zdjęć/wideo."
  },
  {
    "id": "CRM-UST-AC3",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#4",
    "statement": "Przekroczenie 48h od zgłoszenia bez akcji koloruje wiersz na czerwono."
  },
  {
    "id": "CRM-AUDYT-AC1",
    "domain": "crm",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#5",
    "statement": "Administrator może zablokować lub usunąć konto audytora w panelu B2B; usunięcie wymaga wcześniejszego przepięcia leadów."
  },
  {
    "id": "CRM-AUDYT-AC2",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#5",
    "statement": "Dzienny limit audytów (domyślnie 5) blokuje kolejne przypisania w tym samym dniu."
  },
  {
    "id": "CRM-AUDYT-AC3",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#5",
    "statement": "Wygasające uprawnienia F-Gaz i SEP audytora generują alert do administratora."
  },
  {
    "id": "CRM-AUDYT-KARTOTEKA",
    "domain": "crm",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "docs/workorders/CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.md (część A + rozszerzenie „edycja\", AC-A1..AC-A24) + decyzje człowieka z rozmowy 2026-08-28: D-A1 (react-hook-form + zod + @hookform/resolvers wchodzą do apps/b2b-web), D-A2 (zdjęcie przez Supabase Storage, nie base64), D-A4 (edycja wchodzi do zakresu), R-A3 wariant (b) (osobna akcja getAuditorForEdit(id) z bramką update, zamiast poszerzania listy). Brak źródła w dokumentach architektury — b2b_crm_specifications.md#5 opisuje blokadę i usunięcie audytora (CRM-AUDYT-AC1), nie zakładanie ani edycję kartoteki. R-A1 POTWIERDZONE 2026-08-28 zapytaniem SELECT * FROM storage.buckets: buckety audytorzy i zespoly ISTNIEJĄ. R-A2 POTWIERDZONE tym samym sposobem: storage.objects ma RLS włączone i ZERO polityk, więc upload z przeglądarki dziś nie działa dla nikogo poza service_role — także ten „działający\" dla ekipy; odblokowuje go migracja kartoteki_storage_policies (admin-only). KONTEKST NA PRZYSZŁOŚĆ, POZA TYM WYMAGANIEM: człowiek zadeklarował, że w fazie Field App pracownik będzie sam wgrywał własne zdjęcie do TEGO SAMEGO bucketu — rozszerzenie polityki storage.objects o ścieżkę samoobsługową będzie miało własne ID i własną migrację. ERRATA A-2 (2026-08-31, sekcja „ERRATA A-2\" tego samego WO): pierwotna rejestracja POMINĘŁA kolumny fgaz_valid_until i sep_valid_until — BŁĄD REJESTRACJI WYMAGANIA, nie regresja implementacji. Po stronie audytora NIE MA regresji funkcjonalnej, jest luka danych: getAuditors() nie filtruje po żadnej z tych kolumn, fgaz_valid_until zasila wyłącznie plakietkę „wygasa za N dni\" w auditors-client.tsx, a sep_valid_until audytora nie jest dziś czytane NIGDZIE. Decyzje człowieka z 2026-08-31 identyczne jak przy CRM-ZESP-KARTOTEKA: data w przeszłości dozwolona, brak ograniczenia górnej granicy roku. Kolumny już istnieją (DateTime? @db.Date) — bez zmiany schematu, migracji i macierzy uprawnień.",
    "statement": "Administrator zakłada i edytuje kartotekę audytora z panelu B2B: jeden formularz w dwóch rozłącznych trybach, komplet 14 pól kartoteki (w tym fgaz_valid_until i sep_valid_until — daty ważności certyfikatów), bez pól administracyjnych is_active i leave_status."
  },
  {
    "id": "CRM-ZESP-KARTOTEKA",
    "domain": "crm",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "docs/workorders/CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.md (część A + rozszerzenie „edycja\", AC-A1..AC-A24) + te same decyzje człowieka z 2026-08-28 co przy CRM-AUDYT-KARTOTEKA (D-A1, D-A2, D-A4, R-A3 wariant b). Brak źródła w dokumentach architektury — b2b_crm_specifications.md#6 opisuje certyfikaty i pulę w E4 (CRM-ZESP-AC1..AC3), nie zakładanie ani edycję kartoteki. Bucket zespoly ISTNIEJE (potwierdzone zapytaniem SELECT * FROM storage.buckets, 2026-08-28), ale upload z przeglądarki dziś fizycznie nie działa: storage.objects ma RLS włączone i zero polityk — dotyczy to także istniejącego, uchodzącego za działający wzorca crews-client.tsx. Odblokowuje go migracja kartoteki_storage_policies, admin-only. Przyszła samoobsługa pracownika z Field App do tego samego bucketu: osobne ID, osobna migracja. CZĘŚĆ B tego WO (przypisywanie ekipy do leada poza E4) jest ŚWIADOMIE ODŁOŻONA — nie ma i nie ma mieć ID. ERRATA A-2 (2026-08-31, ta sama sekcja WO): pierwotna rejestracja tego wymagania POMINĘŁA kolumny fgaz_valid_until i sep_valid_until — jest to BŁĄD REJESTRACJI WYMAGANIA, nie regresja implementacji; implementer zbudował dokładnie to, co było zapisane. Skutek potwierdzony na żywej bazie 2026-08-31: jedyna istniejąca ekipa („Ekipa Eweliny\") ma obie kolumny NULL i jest przez to trwale wykluczona z puli przypisania, bo isCertValidForDate traktuje NULL jako nieważny (fail-closed, D6). Decyzje człowieka z 2026-08-31: data w przeszłości w polu ważności certyfikatu jest DOZWOLONA (rekord dokumentuje stan faktyczny), brak dodatkowego ograniczenia górnej granicy roku poza naturalną walidacją formatu daty. Kolumny już istnieją w schemacie (DateTime? @db.Date), więc errata NIE pociąga zmiany schema.prisma, migracji ani macierzy uprawnień.",
    "statement": "Administrator zakłada i edytuje kartotekę zespołu montażowego z panelu B2B: jeden formularz w dwóch rozłącznych trybach, komplet 14 pól kartoteki (w tym fgaz_valid_until i sep_valid_until — daty ważności certyfikatów), bez pól administracyjnych aktywny i leave_status."
  },
  {
    "id": "CRM-ZESP-AC1",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#6",
    "statement": "Powiadomienie do administratora na 30 dni przed wygaśnięciem certyfikatu przedstawiciela zespołu."
  },
  {
    "id": "CRM-ZESP-AC2",
    "domain": "crm",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#6",
    "statement": "Zespół z nieważnym certyfikatem jest automatycznie ukrywany z puli brygad przy przypisywaniu w E4."
  },
  {
    "id": "CRM-ZESP-AC3",
    "domain": "crm",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#6",
    "statement": "Profil zespołu jest zintegrowany z kalendarzem rezerwacyjnym — dostępne terminy klienta zależą od dostępności ekipy."
  },
  {
    "id": "CRM-ZIMNE-AC1",
    "domain": "crm",
    "status": "TODO",
    "risk": "LOW",
    "source": "b2b_crm_specifications.md#7",
    "statement": "Tabela zimnych leadów sortuje domyślnie od najświeższych wejść do bucketu."
  },
  {
    "id": "CRM-ZIMNE-AC2",
    "domain": "crm",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#7",
    "statement": "Akcja „Zwróć do obiegu\" wymaga potwierdzenia lub odświeżenia ceny po 30 dniach w bucketcie."
  },
  {
    "id": "CRM-ZIMNE-AC3",
    "domain": "crm",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#7",
    "statement": "Trwała archiwizacja wymaga powodu utraty, który zasila moduł analityczny."
  },
  {
    "id": "CRM-BOOK-HISTORY",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-012",
    "statement": "Zmiana terminu zachowuje historię — poprzednia rezerwacja nie jest nadpisywana."
  },
  {
    "id": "CRM-REGION-AUTO",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#5; ADR-012 (model regionowy, 2026-08-18); ZMIANA MODELU 2026-09-10 — decyzja Michała w oknie FLD-CALENDAR-FOUNDATION, uzasadnienie w docs/architecture/FIELD-APP-PLAN.md 6.4b: model regionowy zastąpiony PROMIENIOWYM, bo pola promienia i kodu pocztowego bazy JUŻ ISTNIEJĄ w schemacie dla obu ról, a `regions`/`region_postal_codes` nie istnieją i wymagałyby utrzymywania słownika tysięcy polskich kodów pocztowych; nakładające się promienie dodatkowo wspierają cel sprawiedliwego rozdziału zleceń, bo przy remisie jest z czego wybierać; ROZBIEŻNOŚĆ NAZW ZAMKNIĘTA 2026-09-10 w oknie FLD-AUDITOR-RADIUS-RENAME — decyzja Michała: audytorzy.max_promien_dojazdu_km przemianowane na promien_dzialania_km (migracja 20260910101000_fld_auditor_radius_rename.sql), więc obie tabele mają dziś tę samą nazwę kolumny i zapis o „zamrożonym długu nazewniczym\" z poprzedniej tury jest nieaktualny",
    "statement": "Audytor jest auto-przypisywany na podstawie ODLEGŁOŚCI adresu zlecenia od bazy audytora: obsługuje go ten, w czyim promieniu działania adres się mieści."
  },
  {
    "id": "FNL-2PHASE",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-005; ZMIANA NOŚNIKA 2026-09-16 — decyzja Michała D1 w WO FNL-2PHASE-BOOKING-MECHANICS: tryb montażu mieszka na instalacji (instalacje.installation_type, migracja 20260916060000), NIE na leadzie i NIE na nieistniejącej tabeli `quotes`. Wariant „obie kolumny, kopiowane\" odrzucony jako druga droga do tej samej prawdy. NASTĘPSTWO ŚWIADOMIE OTWARTE (R4 w WO): wiersz instalacji powstaje dopiero przy przypisaniu ekipy, więc audytor nie ma dziś ŚCIEŻKI ZAPISU trybu w chwili wyceny — kryterium 2 ma od 2026-09-16 NOŚNIK, ale domyka się dopiero razem z UI audytora, co jest osobnym zadaniem",
    "statement": "Mieszkanie w stanie deweloperskim realizowane jest w dwóch etapach: przygotowanie instalacji przed wykończeniem, montaż jednostek po wykończeniu."
  },
  {
    "id": "FNL-2PHASE-BOOKING",
    "domain": "funnel",
    "status": "DONE",
    "risk": "HIGH",
    "source": "ADR-005; PRZENIESIENIE KRYTERIUM 2026-09-16 (okno FNL-2PHASE-BOOKING-SCHEMA-2, decyzja Michała D3 w WO FNL-2PHASE-BOOKING-MECHANICS): kryterium 7 („ZALEŻNOŚĆ POZA TYM WYMAGANIEM\", zgłoszone 2026-09-10) opisywało rozszerzenie N8a o handover_protocol, amount i rozdzielenie `link` na booking_link + payment_link. Treść NIE ZOSTAŁA SKASOWANA — przeniesiona w całości do FNL-2PHASE-INVOICE, bo dotyczy faktury i protokołu odbioru, a te zależą od czterech nieistniejących podsystemów (Field App, upload zdjęć, generowanie PDF, płatności) i wymagają ADR-013. To wymaganie zawęża się do MECHANIKI REZERWACJI w panelu B2B i domyka się bez tamtej zmiany katalogu powiadomień; konsekwencja przyjęta świadomie: dopóki N8a niesie jeden `link`, jest to link do rezerwacji etapu II",
    "statement": "Każdy etap montażu ma własną rezerwację terminu — klient rezerwuje etap II dopiero po zakończeniu etapu I."
  },
  {
    "id": "FNL-2PHASE-ROLLBACK-RELEASE",
    "domain": "funnel",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "WO FNL-2PHASE-BOOKING-MECHANICS, przypadek brzegowy 7; wyniesione 2026-09-16 przy zamykaniu FNL-2PHASE-BOOKING (zgłoszone jako punkt otwarty przez test-author i implementer-server)",
    "statement": "Przełożenie terminu po zamknięciu etapu I zwalnia rezerwację etapu II, ale nie odwraca pracy już wykonanej."
  },
  {
    "id": "FNL-ROLLBACK-BOOKING-RELEASE",
    "domain": "funnel",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "WO FNL-2PHASE-ROLLBACK-RELEASE, ryzyko D1 wariant (b); zarejestrowane 2026-09-16 przy domykaniu FNL-2PHASE-ROLLBACK-RELEASE, którego zakres człowiek zawęził do wariantu (a) — wyłącznie rezerwacja etapu II",
    "statement": "Rollback zwalnia każdą aktywną rezerwację podmiotu, nie tylko rezerwację etapu II montażu dwuetapowego."
  },
  {
    "id": "FNL-2PHASE-INVOICE",
    "domain": "funnel",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-005; PRZYJĘCIE KRYTERIUM 2026-09-16 (okno FNL-2PHASE-BOOKING-SCHEMA-2): kryterium 4 przeniesione z FNL-2PHASE-BOOKING (tam kryterium 7, zgłoszone 2026-09-10). PRZYJĘTO TU TAKŻE EFEKT do:issuePhaseOneInvoice, usunięty 2026-09-16 z T17.effects (rozstrzygnięcie R7, wariant (b)): efekt domenowy jest obowiązkową zmianą stanu sprawdzaną testem kontraktowym, a tabela `invoices` nie istnieje — zostawienie go na T17 dałoby efekt zadeklarowany i niezrealizowany. Efekt WRACA na T17 razem z realizacją tego wymagania. ──── PRZEPISANE 2026-09-23 (D9, okno KK-IMPL-2026Q4): powyższy akapit opisuje stan sprzed rozstrzygnięcia i zostaje jako zapis historii, ale JEGO KONKLUZJA JEST JUŻ NIEAKTUALNA. Michał rozstrzygnął 2026-09-23 łańcuch trzech dokumentów (proforma -> faktura zaliczkowa po wpłacie -> faktura rozliczeniowa po montażu) i moment rozliczenia przy montażu dwuetapowym: PO ETAPIE II. Etap I kończy T17, które jest PĘTLĄ na AWAITING_INSTALLATION (sprawdzone wprost w contracts/funnel.contract.mjs), a montaż zamyka dopiero T09 — więc reguła jest jedna dla obu trybów: faktura rozliczeniowa przy T09, NIGDY przy T17. Konsekwencje: (1) efekt do:issuePhaseOneInvoice NIE WRACA na T17 i nie ma go czym zastąpić — po etapie I nie powstaje żaden dokument rozliczeniowy; (2) załącznik invoice_phase_1 znika z N8a, bo nie ma faktury, która mogłaby nim być",
    "statement": "Przy montażu dwuetapowym klient NIE otrzymuje faktury po etapie I — rozliczenie następuje po etapie II, tym samym przejściem T09, które zamyka montaż jednoetapowy."
  },
  {
    "id": "NTF-PUSH-TOKEN",
    "domain": "notifications",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-006",
    "statement": "Kanał PUSH dostarcza wiadomości na zarejestrowane urządzenia pracowników."
  },
  {
    "id": "NTF-I7-SLA",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#4",
    "statement": "Usterka krytyczna wyzwala natychmiastowy push do dyspozytora i uruchamia zegar SLA 48h."
  },
  {
    "id": "SRV-SOURCE-OF-TRUTH",
    "domain": "service",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-010",
    "statement": "Dopóki klient nie zarezerwuje terminu, obowiązuje wyliczona data należności; po rezerwacji obowiązuje rekord serwisu."
  },
  {
    "id": "SRV-REMINDER-ONCE",
    "domain": "service",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-010",
    "statement": "Przypomnienie o zbliżającym się serwisie wysyłane jest raz na cykl."
  },
  {
    "id": "CRM-ZESP-REP",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-009",
    "statement": "Zespół reprezentuje jedna osoba, która posiada uprawnienia i odpowiada za montaż."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY",
    "domain": "security",
    "status": "SUPERSEDED",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne; rozbite 2026-09-01 (WO BATCH-MEDIUM-LOW-CLEANUP, punkt 22) na siedem wymagań per zasób: CRM-DELETE-ADMIN-ONLY-CLIENTS, -LEADS, -INSTALLATIONS, -SERVICES, -INCIDENTS, -AUDITORS, -CREWS. Ten wpis nie jest już samodzielnie egzekwowalny — pokrycie liczy się na wpisach potomnych.",
    "statement": "ZASTĄPIONE. Akcja „Usuń\" we WSZYSTKICH 7 widokach CRM dostępna wyłącznie dla roli admin. Reguła obowiązuje dalej, ale jej pokrycie jest śledzone per zasób we wpisach potomnych CRM-DELETE-ADMIN-ONLY-<RESOURCE>."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-CLIENTS",
    "domain": "security",
    "status": "SUPERSEDED",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/customers/actions.ts. ERRATA 2026-09-01 (WO CLIENT-ANONYMIZATION-RODO, Faza A punkt A5): kryterium warstwy Server Action mówiło o metodzie delete Prismy na tabeli clients; po Fazie B ta metoda nie jest wywoływana NIGDY (delete zastąpiony anonimizacją przez updateMany), więc kryterium przechodziłoby trywialnie dla każdej roli. ZASTĄPIONE 2026-09-03 decyzją człowieka w oknie kontraktowym SEC-RODO-DELETE-RECONCILE: WO docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md odradzał ten krok wyłącznie z powodu brakującego dowodu warstwy RLS (Blok A3), a dowód powstał — apps/b2b-web/tests/rls-deny-by-default-freeze.test.ts, blok „AC-A3”. Pokrycie liczy się teraz na CRM-CLIENT-ANONYMIZE-RODO.",
    "statement": "ZASTĄPIONE przez CRM-CLIENT-ANONYMIZE-RODO. Reguła (usunięcie klienta wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS) obowiązuje dalej i ma dowód w trzech warstwach, ale jej kryteria żyją we wpisie następcy, bo dla zasobu clients samo usunięcie zostało zastąpione anonimizacją. Dowód warstwy RLS jest testem statycznym nad tekstem migracji 20260824185845_security_enable_rls_baseline.sql (RLS włączone, zero polityk DELETE/ALL na tabeli clients), nie próbą na żywej bazie — to świadomie przyjęty poziom dowodu, wynikający z braku Postgresa w tym środowisku."
  },
  {
    "id": "CRM-CLIENT-ANONYMIZE-RODO",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/workorders/CLIENT-ANONYMIZATION-RODO.md (2026-09-01); rbac.contract.mjs DELETE_POLICIES.clients = ANONYMIZE_OR_SET_NULL; schemat: klienci.anonymized_at + audit_log (migracja 20260901220000 — ZASTOSOWANA na żywej bazie; SPROSTOWANIE 2026-09-03: wcześniejsze zdanie „NIE uruchomiona na żywej bazie\" było nieaktualne. Podstawą jest bezpośrednie zapytanie do bazy z 2026-09-03, nie ewidencja pliku migracji ani supabase_migrations.schema_migrations — to rozróżnienie jest w tym repozytorium istotne, bo ewidencja myliła w obie strony, patrz SEC-EMAIL-UNIQUE. Odczyt pokazał tabelę audit_log z 9 kolumnami (id, actor_email, actor_role, operation, resource, record_id, justification, legal_basis, created_at; kolumny before_snapshot NIE ma), 4 ograniczenia CHECK w tym audit_log_operation_check dopuszczające wartość delete, wyzwalacz audit_log_append_only_trg oraz 0 wierszy); ścieżka kodu (Faza B): apps/b2b-web/src/app/(dashboard)/customers/actions.ts → anonymizeClientAction",
    "statement": "Usunięcie klienta jest realizowane jako ANONIMIZACJA danych osobowych z zachowaniem rekordu i całej historii powiązanej, w jednej transakcji z wpisem w audit_log. Twarde DELETE na tabeli klienci nie istnieje w kodzie aplikacji."
  },
  {
    "id": "SEC-AUDIT-LOG-APPEND-ONLY",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "rbac.contract.mjs AUDIT_REQUIREMENTS.appendOnly = true oraz MATRIX audit_log (update: [], delete: []); ADR-008; docs/workorders/CLIENT-ANONYMIZATION-RODO.md, Faza A punkt A1; schemat: model AuditLog, migracja 20260901220000 — ZASTOSOWANA na żywej bazie. SPROSTOWANIE 2026-09-03: wcześniejsze zdanie „NIE uruchomiona na żywej bazie\" było nieaktualne. Podstawa: bezpośrednie zapytanie do bazy z 2026-09-03, nie ewidencja pliku migracji (tabela audit_log z 9 kolumnami, 4 ograniczenia CHECK w tym audit_log_operation_check dopuszczające delete, wyzwalacz audit_log_append_only_trg, 0 wierszy)",
    "statement": "Wpisu w audit_log nie da się zmienić ani usunąć ŻADNĄ ścieżką dostępną aplikacji — łącznie z rolą admin i łącznie z zapisem przez Prismę, która omija RLS. Sprostowanie błędnego wpisu jest nowym wierszem."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-LEADS",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/leads/actions.ts → prisma.leady.delete. ZAMKNIĘTE 2026-09-08: Server Action (deleteLeadAction) i UI (canDeleteLeads w leads-client.tsx, wyliczane z can(actorRole,\"leads\",\"delete\") === \"yes\") były poprawne od dawna — brakowało wyłącznie POKRYCIA testem, i to na dwóch z trzech warstw. Trzy warstwy, trzy osobne pliki: UI — apps/b2b-web/tests/leads-delete-ui-gate.test.ts (dowodzi, że OBA wystąpienia przycisku „Usuń (Tylko Admin)\" — widok Kanban i widok listy — są owinięte {canDeleteLeads && …}; liczba wystąpień asertowana wprost, bo sprawdzenie tylko pierwszego przepuszczało regresję w drugim, patrz leads-detail-edit-ui-gate.test.ts); Server Action — apps/b2b-web/tests/leads-delete-admin-only.test.ts (retagowany z rodzica CRM-DELETE-ADMIN-ONLY, który jest SUPERSEDED; dyspozytor/audytor/monter odrzuceni przed jakimkolwiek zapytaniem, fail-closed przy braku roli i przy błędzie zapytania o rolę, kontrola pozytywna dla admina); RLS — apps/b2b-web/tests/leads-rls-deny-by-default.test.ts (test statyczny nad tekstem migracji 20260824185845_security_enable_rls_baseline.sql: RLS włączone na public.leady i WHITELISTA polityk — dokładnie jedna polityka wskazująca leady, FOR INSERT TO anon). Whitelista, nie blacklista na literale FOR DELETE/FOR ALL, i to jest istotne: review 2026-09-08 znalazło dwóch przeżywających mutantów, którzy realnie dawali DELETE — polityka bez klauzuli FOR (w Postgresie domyślnie FOR ALL, więc literał nigdy nie występuje) oraz polityka na leady bez kwalifikatora public. (regex ON public\\.leady nie dopasowywał). Poziom dowodu warstwy RLS jest STATYCZNY, nie zachowaniowy — ten sam co przyjęto dla CRM-DELETE-ADMIN-ONLY-CREWS i CRM-CLIENT-ANONYMIZE-RODO, bo zestaw testów nie ma połączenia z żywym Postgresem; wykrywa usunięcie ochrony z migracji, nie wykryje rozjazdu między plikiem a stanem serwera.",
    "statement": "Usunięcie leada (zasób leads) jest dostępne wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-INSTALLATIONS",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/installations/actions.ts → prisma.instalacje.delete. ZAMKNIĘTE 2026-09-08. RÓŻNICA WOBEC CRM-DELETE-ADMIN-ONLY-LEADS I -CREWS: tam brakowało wyłącznie pokrycia testem, tutaj warstwa UI była REALNĄ LUKĄ — installations-client.tsx renderował przycisk „Usuń (Tylko Admin)\" BEZWARUNKOWO wewnątrz DropdownMenuContent, widoczny dla dyspozytora, audytora i montera (odrzucenie następowało dopiero w Server Action). Naprawione w tej samej turze: page.tsx przekazuje actorRole do <InstallationsClient>, komponent liczy canDeleteInstallations = !!actorRole && can(actorRole,\"installations\",\"delete\") === \"yes\" i owija RAZEM separator + pozycję menu. Trzy warstwy, trzy osobne pliki: UI — apps/b2b-web/tests/installations-delete-ui-gate.test.ts (asertuje liczbę wystąpień przycisku wprost — dziś dokładnie jedno, inaczej niż dwa w leads-client.tsx — sprawdza każde w pętli ORAZ osobno, że <DropdownMenuSeparator /> nie został wypchnięty przed gate; osierocony separator jest widoczny dla każdej roli, a asercja „owinięte\" sama go nie łapie); Server Action — apps/b2b-web/tests/installations-authz-gates.test.ts, blok „deleteInstallationAction — bramka roli\" (retagowany 2026-09-08 z SEC-AUTHZ-B2B-MUTATIONS; role odrzucane wyliczane z macierzy RBAC przez ROLES.filter, nie z listy literałów, więc nowa rola nie umknie; dowód, że tx.instalacje.delete NIE zostało wywołane, fail-closed przy braku roli i przy błędzie zapytania o rolę, kontrola pozytywna dla admina); RLS — apps/b2b-web/tests/installations-rls-deny-by-default.test.ts (instalacje leży w sekcji „tabele bez konsumenta supabase-js\" migracji 20260824185845: RLS włączone i ZERO polityk, prostszy przypadek niż leady). Dowód RLS skanuje WSZYSTKIE pliki .sql w supabase/migrations/, nie tylko bazowy — polityka dodana późniejszą migracją w innym pliku przeszłaby test ograniczony do jednego pliku. Poziom dowodu warstwy RLS jest STATYCZNY, nie zachowaniowy — ten sam co przyjęto dla -LEADS, -CREWS i CRM-CLIENT-ANONYMIZE-RODO, bo zestaw testów nie ma połączenia z żywym Postgresem; wykrywa usunięcie ochrony z migracji, nie wykryje rozjazdu między plikiem a stanem serwera. Efekt uboczny tury: naprawione 3 błędy TS1501 (zbędna flaga regex „s\" przy klasie [^;], semantycznie bez zmian) — w tym w scommitowanym wcześniej apps/b2b-web/tests/leads-rls-deny-by-default.test.ts. Weryfikacja mutacyjna stewarda 2026-09-08: separator wypchnięty przed gate → 2 testy czerwone; CREATE POLICY na instalacje (bez kwalifikatora public.) w osobnym pliku migracji → AC-INSTALLATIONS-RLS.3 czerwone.",
    "statement": "Usunięcie instalacji (zasób installations) jest dostępne wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-SERVICES",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/services/actions.ts → tx.serwisy.delete (wewnątrz transakcji). DEZAKTUALIZACJA WCZEŚNIEJSZEJ NOTATKI: do 2026-09-08 ten wpis niósł ostrzeżenie „ścieżka jest dziś martwa (kasuje encję z innej tabeli niż ta, którą pokazuje widok)\" i to był powód odłożenia go jako ostatniego z rodziny. Ostrzeżenie jest NIEAKTUALNE i zostało tu usunięte: martwą ścieżkę naprawiono WCZEŚNIEJ, w commicie 784d8df (SRV-SOURCE-OF-TRUTH) — NIE była to część tury domykającej. getServices() buduje wiersz źródłowy z prisma.serwisy.findMany i ustawia service_id = service.id (klucz serwisy.id), a wiersz prognozowany (source: \"forecast\", wyliczony z instalacje.next_service_date) ma service_id = null i nie oferuje usuwania; dowód: apps/b2b-web/tests/services-source-of-truth.test.ts. Steward zweryfikował to samodzielnie przed zamknięciem, jako warunek wstępny. ZAMKNIĘTE 2026-09-08. JAK W -INSTALLATIONS I -INCIDENTS (a NIE jak w -LEADS, -CREWS i -AUDITORS, gdzie brakowało wyłącznie pokrycia): warstwa UI była REALNĄ LUKĄ, tylko innego kształtu niż u rodzeństwa — pozycja „Usuń (Tylko Admin)\" nie była wprawdzie bezwarunkowa, ale jej jedyny warunek isDeleteMenuItemVisible(service) sprawdzał WYŁĄCZNIE, czy wiersz jest realnym serwisem (source === \"service\"), a NIE rolę; przy wierszu serwisowym pozycja była widoczna dla dyspozytora, audytora i montera, odrzucenie następowało dopiero w Server Action. Naprawione w tej samej turze: page.tsx przekazuje actorRole do <ServicesClient>, komponent liczy canDeleteServices = !!actorRole && can(actorRole,\"services\",\"delete\") === \"yes\" i KONIUNKCJĘ isDeleteMenuItemVisible(service) && canDeleteServices. DECYZJA ŚWIADOMA: menu-visibility.ts NIE zostało zmienione — funkcja isDeleteMenuItemVisible pozostaje czystym predykatem pochodzenia wiersza pod SRV-SOURCE-OF-TRUTH i ma własny test; dołożenie do niej roli zepsułoby tamten dowód i zlepiło dwie niezależne reguły w jednym miejscu. Bramka roli mieszka więc w komponencie, obok predykatu, nie wewnątrz niego. Trzy warstwy, trzy osobne pliki: UI — apps/b2b-web/tests/services-delete-ui-gate.test.ts (canDeleteServices wyliczane z can(), nie z literału roli; liczba wystąpień przycisku asertowana wprost — dziś dokładnie jedno — każde sprawdzane w pętli na obecność OBU członów koniunkcji, bo sam canDeleteServices bez predykatu przywróciłby usuwanie na wierszu prognozowanym, a sam predykat bez roli jest dokładnie tą luką, którą tura zamyka; PLUS osobna asercja, że <DropdownMenuSeparator /> poprzedzający pozycję nie został wypchnięty przed gate — osierocony separator jest widoczny dla każdej roli; asercja sygnatury propsów rozbita na destrukturyzację i typ osobno, wzorem -INCIDENTS, po uwadze o kruchości dopasowania na dosłowny kształt); Server Action — apps/b2b-web/tests/services-authz-gates.test.ts, blok „deleteServiceAction — bramka roli\" (kod był poprawny od dawna i obszernie pokryty; 2026-09-08 dopisano TRZECI tag @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES na 9 testach bramki roli, obok istniejących SEC-AUTHZ-B2B-MUTATIONS i SRV-SOURCE-OF-TRUTH — retag, nie nowy test. Bramka `!actorRole || can(actorRole,\"services\",\"delete\") !== \"yes\"` stoi przed pobraniem e-maila, przed walidacją uzasadnienia i przed prisma.$transaction; asercja `transactionMock` NIE wywołany odróżnia „odrzucone PRZED otwarciem transakcji\" od „transakcja otwarta, delete w niej pominięty\"); RLS — apps/b2b-web/tests/services-rls-deny-by-default.test.ts (serwisy leży w sekcji „tabele bez konsumenta supabase-js\" migracji bazowej: ENABLE bez ŻADNEJ polityki; whitelist, nie blacklist — liczone są WSZYSTKIE CREATE POLICY wskazujące serwisy, bo brak klauzuli FOR to w Postgresie domyślnie FOR ALL, a brak kwalifikatora public. umyka regexowi; dowód globalny skanuje WSZYSTKIE pliki .sql w supabase/migrations/, nie tylko baseline). WARIANT MOCNIEJSZY, ten sam co w -AUDITORS i -INCIDENTS: dochodzi AC-SERVICES-RLS.4 — żaden plik migracji nie wykonuje DISABLE ROW LEVEL SECURITY na serwisy; bez tej asercji AC.1-3 przechodziłyby dalej na zielono przy tabeli w pełni otwartej. Poziom dowodu warstwy RLS jest STATYCZNY, nie zachowaniowy — zestaw testów nie ma połączenia z żywym Postgresem; wykrywa usunięcie ochrony z migracji, nie wykryje rozjazdu między plikiem a stanem serwera. Weryfikacja mutacyjna stewarda 2026-09-08 (mutant wstrzyknięty jako osobny plik migracji, następnie usunięty): ALTER TABLE public.serwisy DISABLE ROW LEVEL SECURITY + CREATE POLICY ON serwisy FOR DELETE TO authenticated → 2 testy czerwone (AC-SERVICES-RLS.3 i .4). Komplet 51 testów w czterech plikach (trzy warstwy + services-source-of-truth) zielony. Ten wpis DOMYKA CAŁĄ rodzinę CRM-DELETE-ADMIN-ONLY-* — wszystkie siedem wymagań potomnych ma status końcowy.",
    "statement": "Usunięcie serwisu (zasób services) jest dostępne wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-INCIDENTS",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/incidents/actions.ts → prisma.usterki_incidents.delete. ZAMKNIĘTE 2026-09-08. JAK W -INSTALLATIONS (a NIE jak w -LEADS, -CREWS i -AUDITORS, gdzie brakowało wyłącznie pokrycia): warstwa UI była REALNĄ LUKĄ — incidents-client.tsx renderował pozycję „Usuń (Tylko Admin)\" wraz z poprzedzającym <DropdownMenuSeparator /> BEZWARUNKOWO wewnątrz DropdownMenuContent, widoczną dla dyspozytora, audytora i montera (odrzucenie następowało dopiero w Server Action). Naprawione w tej samej turze: page.tsx przekazuje actorRole do <IncidentsClient>, komponent liczy canDeleteIncidents = !!actorRole && can(actorRole,\"incidents\",\"delete\") === \"yes\" i owija RAZEM separator + pozycję menu. Trzy warstwy, trzy osobne pliki: UI — apps/b2b-web/tests/incidents-delete-ui-gate.test.ts (canDeleteIncidents wyliczane z can(), nie z literału roli; liczba wystąpień przycisku asertowana wprost — dziś dokładnie jedno — każde sprawdzane w pętli, PLUS osobna asercja, że separator nie został wypchnięty przed gate, bo osierocony separator jest widoczny dla każdej roli; asercja sygnatury propsów rozbita na dwie luźniejsze — destrukturyzacja i typ „actorRole: Role | null\" osobno — po uwadze MINOR z review o kruchości dopasowania na dosłowny kształt sygnatury); Server Action — apps/b2b-web/tests/incidents-authz-gates.test.ts, blok „deleteIncidentAction — bramka roli\" (retagowany 2026-09-08 z SEC-AUTHZ-B2B-MUTATIONS; kod był poprawny od dawna: bramka `!actorRole || can(actorRole,\"incidents\",\"delete\") !== \"yes\"` stoi przed pobraniem e-maila, przed walidacją uzasadnienia i przed prisma.$transaction; role odrzucane wyliczane z macierzy RBAC przez ROLES.filter, nie z listy literałów, więc nowa rola nie umknie; do czterech ścieżek odmowy — rola bez uprawnień, brak roli, błąd zapytania o rolę, rekord nieistniejący — dopisana asercja `transactionMock` NIE wywołany, która odróżnia „odrzucone PRZED otwarciem transakcji\" od „transakcja otwarta, ale delete w niej pominięty\"); RLS — apps/b2b-web/tests/incidents-rls-deny-by-default.test.ts (usterki_incidents leży w sekcji „tabele bez konsumenta supabase-js\" migracji bazowej: ENABLE bez ŻADNEJ polityki, więc przypadek prostszy niż leady; whitelist, nie blacklist — liczone są WSZYSTKIE CREATE POLICY, bo brak klauzuli FOR oznacza w Postgresie FOR ALL; dowód globalny skanuje WSZYSTKIE pliki .sql w supabase/migrations/, nie tylko baseline, PLUS — wzorem AC-AUDITORS-RLS.4 i po uwadze MINOR z review — asercja, że żaden plik migracji nie wykonuje DISABLE ROW LEVEL SECURITY na tej tabeli; bez niej AC.1-3 przechodziłyby dalej na zielono przy w pełni otwartej tabeli). Domyka rodzinę CRM-DELETE-ADMIN-ONLY-* z jedynym wyjątkiem -SERVICES, świadomie odłożonym, bo tamta ścieżka kodu jest martwa (kasuje encję z innej tabeli niż pokazuje widok). SPROSTOWANIE 2026-09-08: to ostatnie zdanie było już wtedy nieaktualne — martwą ścieżkę naprawiono w commicie 784d8df (SRV-SOURCE-OF-TRUTH), a CRM-DELETE-ADMIN-ONLY-SERVICES został zamknięty tego samego dnia; rodzina jest kompletna.",
    "statement": "Usunięcie usterki (zasób incidents) jest dostępne wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-AUDITORS",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/auditors/actions.ts → tx.audytorzy.delete (wewnątrz transakcji). ZAMKNIĘTE 2026-09-08: jak w -LEADS i -CREWS (a NIE jak w -INSTALLATIONS, gdzie UI była realną luką) — Server Action (deleteAuditorAction: bramka `!actorRole || can(actorRole,\"auditors\",\"delete\") !== \"yes\"` stoi na początku funkcji, przed createClient(), przed walidacją uzasadnienia i przed prisma.$transaction) oraz UI (auditors-client.tsx: canDeleteAuditors = !!actorRole && can(actorRole,\"auditors\",\"delete\") === \"yes\", actorRole przekazywany z page.tsx) były poprawne od dawna; brakowało wyłącznie POKRYCIA testem. Trzy warstwy, trzy osobne pliki: UI — apps/b2b-web/tests/auditors-delete-ui-gate.test.ts (canDeleteAuditors wyliczane z can(), nie z literału roli; liczba wystąpień przycisku „Usuń (Tylko Admin)\" asertowana wprost — dziś dokładnie jedno — każde sprawdzane w pętli, PLUS osobna asercja, że tuż przed gate'em nie stoi osierocony <DropdownMenuSeparator />, bo separator wypchnięty przed warunek jest widoczny dla każdej roli); Server Action — apps/b2b-web/tests/auditors-delete.test.ts (drugi tag @REQ dopisany do trzech testów bramki roli, które wcześniej niosły tylko CRM-AUDYT-AC1: odmowa dla nie-admina, fail-closed przy braku roli, kontrola pozytywna dla admina; asercja `transactionMock` NIE wywołany odróżnia „odrzucone PRZED otwarciem transakcji\" od „transakcja otwarta, delete wewnątrz pominięty\", czego sam auditorDeleteMock nie rozstrzyga; whitelista PERMISSIONS.auditors.delete === [admin] zamiast blacklisty jednej roli — blacklista na „dyspozytor\" przepuściłaby mutanta rozszerzającego macierz o „monter\"); RLS — apps/b2b-web/tests/auditors-rls-deny-by-default.test.ts (whitelista nad WSZYSTKIMI plikami .sql w supabase/migrations/: dokładnie JEDNA polityka wskazująca audytorzy, FOR SELECT TO authenticated USING (email = auth.email()), regex tolerancyjny na brak kwalifikatora public., bo polityka bez FOR to w Postgresie domyślnie FOR ALL, a bez public. umyka regexowi — ten sam wzorzec dwóch przeżywających mutantów co w -LEADS). DOWÓD RLS MOCNIEJSZY NIŻ W -LEADS, -INSTALLATIONS I -CREWS: dochodzi AC-AUDITORS-RLS.4 — żaden plik migracji nie zawiera ALTER TABLE audytorzy DISABLE ROW LEVEL SECURITY. Bez tej asercji przyszła migracja wyłączająca RLS w całości zostawia poprawne polityki jako martwy zapis, a tabelę otwartą na DELETE dla authenticated; testy 1-3 tego nie łapią. Ta sama luka ZOSTAJE w -LEADS, -INSTALLATIONS i -CREWS (już DONE) — świadomie odłożony dług, osobna przyszła praca, ewidencja: .claude/agent-memory/test-author/project_rls_disable_debt_family.md. Poziom dowodu warstwy RLS jest STATYCZNY, nie zachowaniowy — zestaw testów nie ma połączenia z żywym Postgresem; wykrywa usunięcie ochrony z migracji, nie wykryje rozjazdu między plikiem a stanem serwera. Weryfikacja mutacyjna stewarda 2026-09-08 (mutanty wstrzyknięte jako osobny plik migracji, następnie usunięte): ALTER TABLE public.audytorzy DISABLE ROW LEVEL SECURITY → AC-AUDITORS-RLS.4 czerwone; CREATE POLICY ON audytorzy FOR DELETE (bez kwalifikatora public.) → AC-AUDITORS-RLS.3 czerwone. Komplet 18 testów w trzech plikach zielony.",
    "statement": "Usunięcie audytora (zasób auditors) jest dostępne wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS."
  },
  {
    "id": "CRM-DELETE-ADMIN-ONLY-CREWS",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne (rozbicie CRM-DELETE-ADMIN-ONLY, WO BATCH-MEDIUM-LOW-CLEANUP punkt 22, 2026-09-01); ścieżka kodu: apps/b2b-web/src/app/(dashboard)/crews/actions.ts → tx.zespoly_monterskie.delete (wewnątrz transakcji); warstwa Server Action pokryta przez apps/b2b-web/tests/crews-admin-gates.test.ts. ZAMKNIĘTE 2026-09-07: UI (crews-client.tsx, przycisk „Usuń\" owinięty canDeleteCrews, commit adae428), Server Action (deleteCrewAction, pokryte wcześniej), RLS (test statyczny crews-rls-deny-by-default.test.ts, commit 11c4f83, zamraża ENABLE ROW LEVEL SECURITY + zero CREATE POLICY na zespoly_monterskie w migracji bazowej). Trzy warstwy, trzy osobne testy.",
    "statement": "Usunięcie ekipy montażowej (zasób crews) jest dostępne wyłącznie dla roli admin, egzekwowane niezależnie w interfejsie, w Server Action i w RLS."
  },
  {
    "id": "CRM-CREW-UPDATE-ADMIN-ONLY",
    "domain": "security",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "review 2026-08-25 (luka znaleziona przy przeglądzie apps/b2b-web/src/app/(dashboard)/crews/actions.ts) — brak źródła w dokumentach architektury; regułę niesie wyłącznie macierz w contracts/rbac.contract.mjs (crews.update = [admin]), która była poprawna, zanim powstało to wymaganie, bo kod akcji nigdy do niej nie zajrzał — ten sam wzorzec błędu co SEC-AUTHZ-USER-MGMT, inny zasób. ZAMKNIĘTE 2026-09-07: to wymaganie nie ma osobnej warstwy RLS w AC — tylko UI (crews-client.tsx, przycisk „Wgraj zdjęcie zespołu\" owinięty canUpdateCrews, commit adae428) i Server Action (updateCrewAvatar już sprawdzał can(actorRole,\"crews\",\"update\") !== \"yes\", pokryte przez crews-admin-gates.test.ts). Dwie warstwy, dwa osobne testy.",
    "statement": "Zmiana rekordu ekipy jest dostępna wyłącznie dla roli admin, egzekwowana po stronie serwera przed jakimkolwiek zapytaniem zapisującym do bazy. Dziś jedyną taką ścieżką jest ustawienie zdjęcia ekipy przez updateCrewAvatar, które nie ma ŻADNEGO sprawdzenia roli — dowolne zalogowane konto może podstawić dowolną ścieżkę Storage jako zdjęcie dowolnej ekipy. Reguła obowiązuje każdą kolejną Server Action zapisującą do tabeli ekip (crews.update = [admin]), nie tylko tę jedną."
  },
  {
    "id": "CRM-CONTEXT-MENU",
    "domain": "ui",
    "status": "TODO",
    "risk": "LOW",
    "source": "b2b_crm_specifications.md#interfejs-akcji",
    "statement": "Każda tabela w panelu B2B ma akcje kontekstowe pod ikoną trzech kropek (MoreHorizontal) w ostatniej kolumnie."
  },
  {
    "id": "SLA-QUOTE-14D",
    "domain": "funnel",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_app_requirements.md#epic-1",
    "statement": "Okno ważności wyceny wynosi 14 dni i jest zdefiniowane w jednym miejscu."
  },
  {
    "id": "SLA-LOG-COLORS",
    "domain": "ui",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_app_requirements.md#epic-2",
    "statement": "Kolorowanie wierszy logistyki: czerwony < 3 dni, pomarańczowy 3–7 dni do montażu."
  },
  {
    "id": "UI-SLA-NO-GREEN",
    "domain": "ui",
    "status": "TODO",
    "risk": "LOW",
    "source": "ui_ux_guidelines.md#8",
    "statement": "Zakaz zielonych alertów SLA w interfejsie."
  },
  {
    "id": "UI-NO-HARDCODED-COLORS",
    "domain": "ui",
    "status": "TODO",
    "risk": "LOW",
    "source": "ui_ux_guidelines.md#8",
    "statement": "Zakaz hardkodowanych wartości Hex/RGB w komponentach — wyłącznie tokeny."
  },
  {
    "id": "UI-ICONS-LUCIDE-ONLY",
    "domain": "ui",
    "status": "TODO",
    "risk": "LOW",
    "source": "ui_ux_guidelines.md#1",
    "statement": "Wyłącznie ikony z lucide-react."
  },
  {
    "id": "UI-FORMS-RHF-ZOD",
    "domain": "ui",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ui_ux_guidelines.md#8",
    "statement": "Formularze wyłącznie react-hook-form + zodResolver; zakaz useState na pojedyncze pola tekstowe."
  },
  {
    "id": "SRV-NEXT-DATE",
    "domain": "service",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_app_requirements.md#epic-4",
    "statement": "Zamknięcie montażu generuje next_service_date dla instalacji."
  },
  {
    "id": "SEC-SSO-GUARD",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_app_requirements.md#epic-5",
    "statement": "Logowanie wyłącznie przez Google; e-mail spoza authorized_users jest odrzucany z komunikatem o braku uprawnień."
  },
  {
    "id": "SEC-AUTHZ-USER-MGMT",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "review 2026-08-24 (rls-security-auditor, znalezisko poboczne przy FLD-AVAILABILITY-SPLIT) — brak źródła w dokumentach architektury; regułę niesie wyłącznie macierz w contracts/rbac.contract.mjs, która była poprawna, zanim powstało to wymaganie; zakres rozszerzony 2026-08-25 o zdolność read (ten sam audytor, przy weryfikacji naprawy create/delete) — settings/page.tsx czytał pełną listę kont bez sprawdzenia roli, ten sam wzorzec błędu, inna zdolność",
    "statement": "Dodanie konta, usunięcie konta i przypisanie mu roli w authorized_users jest dostępne wyłącznie dla roli admin, a sama rola pochodzi z zamkniętego słownika ROLES — jedno i drugie egzekwowane po stronie serwera. Tej samej regule podlega odczyt listy kont (e-maile i role wszystkich pracowników): authorized_users.read = [admin], egzekwowane po stronie serwera również na ścieżce renderowania widoku, nie tylko w Server Actions."
  },
  {
    "id": "SEC-RLS-AUDITOR-SCOPE",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "ZAMKNIĘTE 2026-09-01 (WO BATCH-MEDIUM-LOW-CLEANUP, punkt 13). Zastrzeżenie proceduralne z ostatniego kryterium jest spełnione: leads-auditor-scope.test.ts dowodzi kryterium dowodowego na argumencie where (audytor dostaje audytor_id z sesji, admin i dyspozytor nie dostają tego klucza wcale) ORAZ czterech wariantów fail-closed (rola null, wyjątek z getCurrentActorRole, brak rekordu w audytorzy, brak e-maila w sesji) — w każdym findMany NIE jest wołane, więc where z undefined nie powstaje. Liczniki i paginacja pokryte osobno (groupBy i count z tym samym filtrem), /logistics zamknięte dla audytora i montera (D4), konto is_active=false odrzucane w samej akcji, a rls-deny-by-default-freeze.test.ts zamraża eskalację bokiem przez supabase-js. b2b_app_requirements.md#epic-5 (linia 139: „Audytor widzi tylko zlecenia przypisane do siebie, a Dyspozytor widzi wszystko\") + docs/workorders/SEC-RLS-AUDITOR-SCOPE.md, decyzje człowieka D1-D6 z rozmowy 2026-08-26. ZAKRES DZIAŁANIA (D6, potwierdzone przez człowieka przy bazie produkcyjnej): dziś w tabeli authorized_users NIE ISTNIEJE ani jedno konto o roli innej niż admin — żadnego audytora, żadnego montera. To czyni tę naprawę PREWENCYJNĄ, nie pożarową: nikt dziś tej dziury nie eksploatuje, bo nie ma kim. Ryzyko zostaje mimo to HIGH i wpis nie schodzi z kolejki, bo aktywacja luki nie wymaga żadnej zmiany w kodzie — wystarczy jeden wiersz w authorized_users. Kod jest już na te konta przygotowany (dedykowana gałąź roli audytor w apps/b2b-web/src/utils/supabase/middleware.ts), a Field App — docelowe miejsce pracy audytora i montera — nie istnieje w tym repozytorium (apps/ to wyłącznie b2b-web i b2c-web), więc pierwsze utworzone konto audytora lub montera dostanie panel B2B jako JEDYNĄ aplikację, do której może się zalogować, i trafi po zalogowaniu prosto na /leads. Trzy wcześniejsze wymagania (SEC-ASSIGNMENT-POOL-MINIMIZE, SEC-LEADS-LIST-MINIMIZE, SEC-LEADS-LIST-SCALARS) uzasadniają obniżone ryzyko zdaniem „dostęp jest już ograniczony rolą i zakresem audytora\" — ta przesłanka jest FAŁSZYWA do czasu zamknięcia tego ID i jej prawdziwość zależy właśnie od niego",
    "statement": "Odczyt leadów w panelu B2B jest bramkowany rolą i zawężony do zakresu aktora. Audytor widzi wyłącznie leady przypisane do siebie; dyspozytor i admin widzą wszystko; monter nie widzi leadów w ogóle. Dziś getLeads() w apps/b2b-web/src/app/(dashboard)/leads/actions.ts buduje where wyłącznie z filtra statusu i kubełka, nie wywołuje ani getCurrentActorRole(), ani can() — ani razu — więc każde zalogowane konto, niezależnie od roli, dostaje komplet leadów wszystkich audytorów wraz z licznikami wolumenu. Ta sama tabela leadów jest czytana drugim wejściem przez getLogisticsLeads() w logistics/actions.ts, również bez bramki; zostawienie tego wejścia otwartego czyni zawężenie na /leads fikcją, bo obejście to jedno kliknięcie w menu. Reguła jest reguła DANYCH, nie interfejsu: Prisma omija RLS (pułapka 1 z CLAUDE.md), więc jedyną granicą jest warunek where w Server Action."
  },
  {
    "id": "SEC-ASSIGNMENT-POOL-MINIMIZE",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "review 2026-08-25 (luka znaleziona przy przeglądzie apps/b2b-web/src/app/(dashboard)/leads/actions.ts) — brak źródła w dokumentach architektury; regułę niesie zasada minimalizacji danych (ta sama, z której żyje SEC-RODO-DELETE), tyle że po stronie odczytu: SEC-RLS-AUDITOR-SCOPE pilnuje, KTÓRE rekordy wolno pobrać, a nikt nie pilnował, KTÓRE KOLUMNY tych rekordów wolno wysłać do przeglądarki. Dostęp do puli jest już poprawnie ograniczony rolą — to nie jest luka RBAC i nie naprawia się jej macierzą uprawnień",
    "statement": "Pula wyboru audytora (getAuditors()) i pula wyboru ekipy (getCrews()) w leads/actions.ts przekazują przez granicę serwer/klient wyłącznie te pola, które konsument faktycznie renderuje — nigdy surowego rekordu Prismy. Dziś obie funkcje wołają findMany() bez select, więc do przeglądarki dyspozytora trafia komplet kolumn pracownika, w tym iban, numer NIP, adres, telefon, e-mail i bazowy kod pocztowy, mimo że żaden z trzech konsumentów (leads-client.tsx, assign-auditor.tsx, assign-crew-dialog.tsx) nie renderuje ani jednego z nich. Reguła obowiązuje obie granice: Server Action wywoływaną z komponentu klienckiego ORAZ przekazanie propsów z Server Componentu do komponentu klienckiego, bo payload RSC serializuje cały props, a nie to, co JSX wyświetli."
  },
  {
    "id": "SEC-LEADS-LIST-MINIMIZE",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "review 2026-08-25 (przegląd apps/b2b-web/src/app/(dashboard)/leads/actions.ts, funkcja getLeads()) — brak źródła w dokumentach architektury; ta sama zasada minimalizacji danych po stronie odczytu, z której żyje SEC-ASSIGNMENT-POOL-MINIMIZE, tyle że zastosowana do zapytania listy leadów. Poprzednie wymaganie zostawiło ten przeciek świadomie i nazwało go wprost jako osobne ID — to jest to ID. Dostęp do listy jest już poprawnie ograniczony rolą i zakresem audytora (SEC-RLS-AUDITOR-SCOPE), więc nie jest to luka RBAC i nie naprawia się jej macierzą uprawnień",
    "statement": "Widok listy leadów (getLeads() w leads/actions.ts) przekazuje przez granicę serwer/klient wyłącznie te pola, które leads-client.tsx faktycznie renderuje — nigdy surowego zagnieżdżonego rekordu Prismy. Dziś zapytanie woła findMany() z include całych relacji: klienta, adresu, instalacji wraz z ekipą, więc do przeglądarki dyspozytora jedzie komplet danych kontaktowych KAŻDEGO klienta na stronie (numer telefonu, e-mail) oraz komplet danych rozliczeniowych ekipy (numer konta bankowego, numer NIP, telefon kontaktowy, e-mail), a także współrzędne geograficzne adresu. Konsument czyta z tych trzech relacji dokładnie trzy wartości: nazwę klienta (kolumna o porzuconej nazwie polskiej, przekład w docs/architecture/NAMING.md → full_name), adres w postaci ulicy z miastem (→ street_city) i nazwę ekipy pierwszej instalacji (→ name). Skala odróżnia ten przypadek od widoku szczegółów: strona listy oddaje do pięćdziesięciu kompletów danych osobowych naraz, komuś, kto otworzył ekran po to, żeby zobaczyć statusy."
  },
  {
    "id": "SEC-LEADS-LIST-SCALARS",
    "domain": "security",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "review 2026-08-26 (rls-security-auditor, znalezisko przy zamknięciu SEC-LEADS-LIST-MINIMIZE — przegląd apps/b2b-web/src/app/(dashboard)/leads/actions.ts, funkcja getLeads()) + decyzja człowieka z rozmowy 2026-08-26, który zatwierdził zarówno rejestrację, jak i naprawę; brak źródła w dokumentach architektury. Ta sama zasada minimalizacji danych po stronie odczytu co w SEC-ASSIGNMENT-POOL-MINIMIZE i SEC-LEADS-LIST-MINIMIZE, tyle że zastosowana do SKALARÓW samego leada, a nie do jego relacji. Poprzednie wymaganie świadomie ograniczyło się do relacji i zapisało to w komentarzu przy select — to jest ID domykające drugą połowę tego samego zapytania. Dostęp do listy jest już poprawnie ograniczony rolą i zakresem audytora (SEC-RLS-AUDITOR-SCOPE), więc nie jest to luka RBAC i nie naprawia się jej macierzą uprawnień",
    "statement": "Widok listy leadów (getLeads() w leads/actions.ts) przekazuje przez granicę serwer/klient wyłącznie te SKALARNE pola samego leada, które leads-client.tsx faktycznie zużywa — dokładnie tak, jak SEC-LEADS-LIST-MINIMIZE nakazało to już dla relacji. Dziś select wylicza wszystkie kolumny tabeli leadów, więc do przeglądarki każdego dyspozytora jedzie dla maksymalnie pięćdziesięciu leadów naraz notatka wewnętrzna o kliencie i audycie (pole swobodnego tekstu — może zawierać dowolne dane osobowe wpisane ręcznie przez pracownika) oraz surowe odpowiedzi klienta z formularza triage B2C (adres, dane kontaktowe, preferencje w postaci, w jakiej klient je podał). Żadne z tych dwóch pól nie jest przez listę renderowane w jakiejkolwiek formie. Obok nich jadą bez potrzeby pola operacyjne i handlowe: wybrana konfiguracja, wycena finalna, przewidywany czas montażu, powód utraty wraz z notatką, powód auto-odrzucenia, data ostatniego kontaktu, klucze obce klienta i adresu oraz znaczniki czasu wejścia do kubełka i aktualizacji rekordu."
  },
  {
    "id": "CRM-LEAD-UPDATE-ADMIN-DISPATCHER",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "ZAMKNIĘTE 2026-09-08 po weryfikacji wszystkich 13 kryteriów acceptance wobec stanu kodu. Bramka bazowa: commit 55280b9 (can(actorRole,\"leads\",\"update\") === \"yes\" w updateLeadAuditor i updateLeadData, przed pierwszym zapytaniem Prismy). Dokończenie: apps/b2b-web/src/app/(dashboard)/leads/[id]/actions.ts (fail-closed — getCurrentActorRole() w osobnym try/catch PRZED głównym blokiem zapisu w obu akcjach, wzorem getLeadDetail; wyjątek przy odczycie roli daje odmowę uprawnień, nie komunikat błędu zapisu), page.tsx (ustala actorRole i przekazuje go w dół), edit-lead-modal.tsx (cały modal zwraca null bez leads.update, więc znika też niekontrolowane otwarcie przez ?edit=true), assign-auditor.tsx (przyciski „Zmień\" i „Przypisz audytora\" za canUpdateLead, sam odczyt przypisanego audytora zostaje — to leads.read). Testy: apps/b2b-web/tests/leads-update-data-gate.test.ts, leads-auditor-pool.test.ts (obie rozszerzone o fail-closed z dokładną treścią komunikatu), leads-detail-edit-ui-gate.test.ts (nowy, warstwa UI). Trzy warstwy poza zakresem świadomie: RLS, audit_log i wariant :own — patrz kryteria 12 i 13. Pochodzenie: review 2026-08-25 (luka znaleziona przy przeglądzie apps/b2b-web/src/app/(dashboard)/leads/[id]/actions.ts) — brak źródła w dokumentach architektury; regułę niesie wyłącznie macierz w contracts/rbac.contract.mjs (leads.update = [admin, dyspozytor]), która była poprawna, zanim powstało to wymaganie, bo kod tego pliku nigdy do niej nie zajrzał — czwarte wystąpienie wzorca SEC-AUTHZ-USER-MGMT / CRM-CREW-UPDATE-ADMIN-ONLY, tym razem w pliku BLIŹNIACZYM wobec już naprawionego: leads/actions.ts sprawdza rolę w trzech akcjach, leads/[id]/actions.ts w żadnej",
    "statement": "Zmiana rekordu leada z widoku szczegółów jest dostępna dla ról admin ORAZ dyspozytor — nie jest to bramka admin-only — i jest egzekwowana po stronie serwera przed jakimkolwiek zapytaniem do bazy. Dotyczy dwóch Server Actions, które dziś nie mają ŻADNEGO sprawdzenia roli: updateLeadAuditor (przypisanie/odpięcie audytora, pociągające za sobą zmianę statusu leada) i updateLeadData (nadpisanie danych kontaktowych klienta, adresu i estymowanej wyceny). Dowolne zalogowane konto — w tym monter i audytor spoza sprawy — może dziś przez bezpośrednie wywołanie tych akcji podmienić audytora dowolnego leada, cofnąć jego status albo nadpisać telefon i e-mail klienta. Reguła obowiązuje każdą kolejną akcję zapisującą do rekordu leada w tym pliku, nie tylko te dwie."
  },
  {
    "id": "SEC-AUTHZ-B2B-MUTATIONS",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md (skan tools/kk-authz-gate.mjs, 2026-08-26) — brak źródła w dokumentach architektury; regułę niesie wyłącznie macierz w contracts/rbac.contract.mjs, do której kod akcji nigdy nie zaglądał. Rejestracja RETROAKTYWNA: implementacja i testy zamknięte przed powstaniem tego ID, wpis odzwierciedla stan faktyczny warstwy Server Action, nie pierwotny plan Work Ordera. Ten sam wzorzec błędu co SEC-AUTHZ-USER-MGMT, CRM-CREW-UPDATE-ADMIN-ONLY i CRM-LEAD-UPDATE-ADMIN-DISPATCHER, tyle że wykryty maszynowo i na wszystkich zasobach naraz — trzy poprzednie wymagania zawężone do konkretnych nazw funkcji zostawiły dziurę przy czwartej akcji, dlatego to ID wiąże regułę z TABELĄ DOCELOWĄ ZAPISU, nie z plikiem ani nazwą funkcji",
    "statement": "Każda Server Action w apps/b2b-web, która wykonuje mutację przez Prismę (create, update, delete, także wewnątrz $transaction), rozstrzyga uprawnienie przez can(actorRole, <zasób>, <zdolność>) z @klikklima/contracts, zanim powstanie pierwsze zapytanie do bazy. Granicę wyznacza tabela docelowa zapisu, nie plik, w którym akcja mieszka. Skaner tools/kk-authz-gate.mjs znalazł 14 takich akcji BEZ jakiegokolwiek sprawdzenia roli — dowolne zalogowane konto, łącznie z audytorem i monterem, mogło bezpośrednim wywołaniem POST skasować klienta wraz z historią, skasować leada z pominięciem naprawionej wcześniej bramki, przesunąć dowolnego leada na dowolny status, oznaczyć przesyłkę jako wysłaną i dostarczoną albo cofnąć gotowy montaż do rollbacku. Interfejs nie jest granicą uprawnień: Prisma omija RLS (pułapka 1 z CLAUDE.md), więc jedyną granicą jest kod akcji. Zasoby i zdolności pochodzą z istniejących wierszy MATRIX — to wymaganie NIE zmienia macierzy uprawnień, tylko domaga się, żeby kod w ogóle do niej zajrzał."
  },
  {
    "id": "SEC-AUTHZ-B2B-READS",
    "domain": "security",
    "status": "IMPLEMENTING",
    "risk": "HIGH",
    "source": "docs/workorders/SEC-READ-GATES.md (skan AST tools/kk-authz-gate.mjs rozszerzony o odczyty i o pliki inne niż actions.ts, 2026-09-02/03) — brak źródła w dokumentach architektury; regułę niesie wyłącznie MATRIX w contracts/rbac.contract.mjs. Dopełnia SEC-AUTHZ-B2B-MUTATIONS, które jest jawnie zawężone do mutacji, i SEC-RLS-AUDITOR-SCOPE, które objęło JEDEN odczyt (getLeads). Skala znaleziska: siedem eksportowanych funkcji odczytowych (getCustomers, getCrews z crews/actions.ts, getCrews(installationDate) z leads/actions.ts, getAuditors, getInstallations, getUpcomingServices, getIncidents) i siedem stron nie sprawdzało roli WCALE — każde zalogowane konto, w tym monter i audytor, czytało dane osobowe wszystkich klientów wbrew clients.read = [admin, dyspozytor]. Ósmy i najgroźniejszy przypadek — customers/[id]/page.tsx wołająca prisma.klienci.findUnique BEZPOŚREDNIO ze strony — wymykał się skanerowi ograniczonemu do plików o nazwie actions.ts: audytor brał UUID klienta z leada, do którego miał prawo, i przez sam adres URL czytał kartotekę 360 z leadami innych audytorów, omijając SEC-RLS-AUDITOR-SCOPE nie joinem, tylko adresem. Znalezione przez rls-security-auditor przy przeglądzie, nie przez pierwotny skan. Rejestracja RETROAKTYWNA: implementacja i testy powstały przed tym ID (test-author dostał instrukcję pisania bez @REQ, bo wymaganie jeszcze nie istniało), więc wpis odzwierciedla stan FAKTYCZNY kodu po naprawie, nie pierwotny plan Work Ordera.",
    "statement": "Każda ścieżka w apps/b2b-web, która ODCZYTUJE dane przez Prismę — Server Action w actions.ts, ale też komponent serwerowy page.tsx wołający klienta wprost — rozstrzyga uprawnienie przez can(actorRole, <zasób>, read) z @klikklima/contracts, ZANIM powstanie pierwsze zapytanie do bazy. Wynik own zawęża zapytanie po właścicielu wyznaczonym z sesji i nigdy nie jest traktowany jak yes. Strona każdego widoku odmawia renderu przez notFound() roli, dla której can() zwraca no. Granicę wyznacza TABELA CZYTANA, nie plik ani nazwa funkcji — Prisma omija RLS (pułapka 1 z CLAUDE.md), więc kod odczytu jest jedyną granicą."
  },
  {
    "id": "SEC-EMAIL-UNIQUE",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "docs/workorders/SEC-EMAIL-UNIQUE.md (Faza A) — rozwinięcie kryterium 8 z SEC-AUTHZ-B2B-READS, które opisało ten brak dla jednej tabeli i jednej funkcji. STAN WYJŚCIOWY (audyt 2026-09-03, przed naprawą): pg_indexes i pg_constraint dla audytorzy i zespoly_monterskie zwracały WYŁĄCZNIE klucz główny — nie było audytorzy_email_key ani zespoly_monterskie_email_key, mimo że schema.prisma deklaruje @unique w obu miejscach, a migracja 20260822120000_fld_availability_split_employee_email_unique.sql zawiera oba CREATE UNIQUE INDEX. Tamta migracja nigdy nie została uruchomiona: supabase_migrations.schema_migrations ma DWA wpisy przy 15 plikach w repozytorium, _prisma_migrations nie istnieje. Dryf był jednokierunkowy (schemat wyprzedzał bazę), więc schema.prisma NIE jest zmieniany — usunięcie @unique zalegalizowałoby podatność zamiast ją zamknąć. STAN DZISIEJSZY (2026-09-03, po naprawie): dryf ZAMKNIĘTY. Migracja 20260903061000_security_employee_email_unique_reassert.sql uruchomiona na żywej bazie i zweryfikowana trzema niezależnymi odczytami — pg_indexes pokazuje audytorzy_email_key i zespoly_monterskie_email_key jako UNIQUE INDEX na (email); próba wstawienia duplikatu kończy się błędem 23505 unique_violation (ograniczenie DZIAŁA, nie tylko istnieje, dane testowe posprzątane); prisma migrate diff nie zgłasza już różnicy na kolumnie email (pozostałe rozbieżności diffa dotyczą kluczy obcych w availability_declarations i employee_consents i są NIEZWIĄZANE z tym ID). Dane bezkolizyjne w chwili audytu: audytorzy 3 wiersze, zespoly_monterskie 2 wiersze, zero duplikatów także po lower(email), zero pustych stringów. Rejestracja RETROAKTYWNA: kod i testy Fazy A powstały przed tym ID, więc wpis opisuje stan FAKTYCZNY repozytorium po naprawie, nie pierwotny szkic Work Ordera — w dwóch miejscach różni się od niego jawnie (patrz kryterium o setSelfAvailabilityAction).",
    "statement": "Żadna ścieżka w apps/b2b-web nie wyznacza tożsamości zalogowanego pracownika przez prisma.<tabela>.findUnique({ where: { email } }). Wyznaczenie „czyj to rekord” idzie przez findMany({ where: { email }, take: 2 }) i kończy się ODMOWĄ, gdy liczba trafień jest różna od 1. Powód: findUnique kompiluje się wyłącznie dzięki @unique w schema.prisma, czyli dzięki DEKLARACJI, a nie dzięki sprawdzeniu bazy — przy duplikacie zwróciłby wiersz nieokreślony, czyli mógłby wskazać CUDZĄ osobę lub ekipę. Gdy to wymaganie powstawało, deklaracja faktycznie rozjeżdżała się z żywą bazą. Od 2026-09-03 ograniczenie na bazie ISTNIEJE, ale reguła NIE jest przez to nieaktualna i nie podlega cofnięciu: zależność od obietnicy schematu jest zła sama w sobie, a indeks da się zdjąć jednym DROP INDEX (sekcja ROLLBACK migracji). findMany weryfikuje fakt zamiast ufać deklaracji i to jest trwały powód jego użycia."
  },
  {
    "id": "SEC-EMAIL-CASE-NORMALIZE",
    "domain": "security",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "Wydzielone z SEC-EMAIL-UNIQUE (kryterium „Poza zakresem tego ID\"). Stan na 2026-09-03 zweryfikowany w kodzie: ani apps/b2b-web/src/app/(dashboard)/auditors/schema.ts, ani .../crews/schema.ts nie wywołuje .toLowerCase() na polu email — obie definicje kończą się na .trim().email(). Ograniczenie UNIQUE na żywej bazie (SEC-EMAIL-UNIQUE, uruchomione 2026-09-03) stoi na SUROWEJ kolumnie, więc adresy różniące się wyłącznie wielkością liter są dla bazy różnymi wartościami i przechodzą.",
    "statement": "Adres e-mail pracownika jest zapisywany w postaci znormalizowanej (małymi literami), żeby ograniczenie UNIQUE na surowej kolumnie faktycznie odpowiadało tożsamości, a nie zapisowi znaków."
  },
  {
    "id": "SEC-SERVICE-KEY-SERVER-ONLY",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "system_architecture.md#3",
    "statement": "Klucz serwisowy Supabase nigdy nie trafia do bundla klienckiego."
  },
  {
    "id": "SEC-RODO-DELETE",
    "domain": "security",
    "status": "SUPERSEDED",
    "risk": "HIGH",
    "source": "database_model.md#4 (ślad historyczny — zachowany celowo); zastąpione 2026-09-03 decyzją człowieka w oknie kontraktowym SEC-RODO-DELETE-RECONCILE, na podstawie analizy w docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md (sekcja „Ryzyka i nieznane”). Następcą jest CRM-CLIENT-ANONYMIZE-RODO — tam liczy się pokrycie testami.",
    "statement": "ZASTĄPIONE przez CRM-CLIENT-ANONYMIZE-RODO. Zasada (usunięcie klienta na żądanie RODO anonimizuje dane kontaktowe, zachowując wartość zrealizowanego montażu) obowiązuje dalej, ale jej kryteria i pokrycie żyją we wpisie następcy. Z trzech dawnych kryteriów pierwsze (brak kaskadowego kasowania) przeszło do następcy, a dwa pozostałe odpadły: legal_basis nie jest stałą RODO_ERASURE_REQUEST, bo operator świadomie wybiera podstawę prawną z zamkniętej listy pięciu wartości, natomiast migawka before_snapshot jest nierealizowalna — jest wprost sprzeczna z kryterium następcy „żadna funkcja nie przechowuje kopii danych osobowych klienta sprzed anonimizacji”, zamrożonym testem customers-anonymize-rodo.test.ts, a model AuditLog nie ma i nie dostanie takiej kolumny."
  },
  {
    "id": "SEC-AUDIT-LOG",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "database_model.md#4",
    "statement": "Operacje wrażliwe (delete, anonimizacja, zmiana roli) są rejestrowane w append-only audit_log."
  },
  {
    "id": "SEC-AUDIT-LOG-DELETE",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/workorders/SEC-AUDIT-LOG-DELETE.md (2026-09-03) — część 1 z 4 rozbicia SEC-AUDIT-LOG. Siedem punktów zapisu w apps/b2b-web/src/app/(dashboard)/: leads/actions.ts (deleteLeadAction), installations/actions.ts (deleteInstallationAction), incidents/actions.ts (deleteIncidentAction), services/actions.ts (deleteServiceAction), settings/actions.ts (deleteAuthorizedUser), auditors/actions.ts (deleteAuditorAction), crews/actions.ts (deleteCrewAction). Ósme wejście, logistics/actions.ts (deleteLogisticsOrderAction), NIE ma własnego wpisu w tej liście, bo deleguje do deleteLeadAction — jest drugim wywołującym ten sam punkt zapisu, a nie punktem zapisu. Wzorzec referencyjny: anonymizeClientAction w customers/actions.ts. STAN BAZY: migracja 20260901220000 jest ZASTOSOWANA na żywej bazie — potwierdzone bezpośrednim zapytaniem 2026-09-03 (nie ewidencją pliku migracji): tabela audit_log z 9 kolumnami, 4 ograniczenia CHECK w tym audit_log_operation_check dopuszczające wartość 'delete', wyzwalacz audit_log_append_only_trg, 0 wierszy. To sprostowanie nieaktualnych zdań w source wpisów CRM-CLIENT-ANONYMIZE-RODO i SEC-AUDIT-LOG-APPEND-ONLY, poprawionych w tym samym oknie. Zmiana schematu ani migracja NIE są potrzebne. AUDIT_REQUIREMENTS.legalBases zostaje bez zmian — zawiera już neutralne OPERATIONAL_ERROR i OTHER.",
    "statement": "Każde usunięcie rekordu w panelu B2B tworzy wpis w audit_log w TEJ SAMEJ transakcji co samo usunięcie, z obowiązkowym uzasadnieniem operatora i podstawą prawną z zamkniętej listy. Nie istnieje ścieżka kodu kasująca rekord bez śladu audytowego. Wymaganie dotyczy WYŁĄCZNIE operacji delete — pozostałe operacje z AUDIT_REQUIREMENTS.mustLog mają własne wpisy potomne."
  },
  {
    "id": "SEC-AUDIT-LOG-ROLE-CHANGE",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/workorders/SEC-AUDIT-LOG-ROLE-CHANGE.md (2026-09-04) — część 2 z 4 rozbicia SEC-AUDIT-LOG. Jedyny punkt zapisu: apps/b2b-web/src/app/(dashboard)/settings/actions.ts, nowa akcja updateAuthorizedUserRoleAction(id, input) — parametr input obowiązkowy, bo wartość domyślna albo input? przywróciłaby zmianę roli bez śladu. Wzorzec zapisu kopiowany 1:1 z deleteAuthorizedUser (:204). TO NIE JEST DOPISANIE AUDYTU DO ISTNIEJĄCEJ AKCJI: grep na authorizedUser.update|upsert w apps/ i packages/ daje zero trafień poza generowanym klientem Prismy — w panelu B2B nie istnieje dziś ŻADNA ścieżka zmiany roli istniejącego konta, zmiana wymaga ręcznego UPDATE na bazie, czyli operacji całkowicie poza audytem. Wymaganie tworzy funkcjonalność, a nie tylko audytuje istniejącą. BEZ ZMIANY KONTRAKTU RBAC: contracts/rbac.contract.mjs:40 ma już authorized_users.update = ['admin']. BEZ MIGRACJI I BEZ ZMIANY SCHEMATU PRISMY: migracja 20260901220000 jest ZASTOSOWANA (potwierdzone przy SEC-AUDIT-LOG-DELETE), audit_log_operation_check dopuszcza już 'role_change', audit_log_resource_check dopuszcza 'authorized_users', wyzwalacz audit_log_append_only_trg działa. Trzy decyzje człowieka z 2026-09-04, podjęte PRZED fazą RED: D1 — legal_basis dla operacji kadrowej to OTHER (ewentualnie OPERATIONAL_ERROR przy roli nadanej błędnie); słownika AUDIT_REQUIREMENTS.legalBases ANI nie rozszerzamy o wartość kadrową (pociągnęłoby migrację CHECK-a audit_log_legal_basis_check), ANI nie zawężamy listy w formularzu (zawężenie = druga lista obok kontraktu, zakazana przez sec-audit-log-delete-static.test.ts:230); przyjęta cena: statystyka po legal_basis zmiesza usunięcia z awansami. D2 — serwer dokleja do justification deterministyczny prefiks 'stara → nowa rola', bo audit_log NIE MA kolumn przed/po (before_snapshot świadomie nie istnieje, rozstrzygnięcie z okna SEC-RODO-DELETE-RECONCILE) i bez prefiksu rejestr po dwóch kolejnych zmianach roli nie pozwala odtworzyć ścieżki uprawnień. D3 — ochrona ostatniego admina WĄSKO, wyłącznie na ścieżce zmiany roli; pełna ochrona przy delete oraz twarda gwarancja bazodanowa są ODROCZONE do osobnego, jeszcze niezarejestrowanego SEC-LAST-ADMIN-GUARD (wymaga migracji). Ochrona jest zatem świadomie połowiczna i tak ma być opisywana. Zamyka dług odroczony w apps/b2b-web/tests/settings-authorized-users.test.ts:52-53 („kryterium audit_log / role_change świadomie pominięte, pokrywa je SEC-AUDIT-LOG”). Sąsiaduje z SEC-AUTHZ-USER-MGMT (bramka roli i słownik ROLES) oraz SEC-AUDIT-LOG-APPEND-ONLY (nienaruszalność wpisu).",
    "statement": "Zmiana roli istniejącego konta w authorized_users jest możliwa z panelu B2B dokładnie jedną ścieżką serwerową i tworzy wpis w audit_log w TEJ SAMEJ transakcji co sam UPDATE, z obowiązkowym uzasadnieniem operatora i podstawą prawną z zamkniętej listy. Nie istnieje ścieżka kodu zmieniająca rolę bez śladu audytowego, a ostatniego konta admin nie da się zdegradować. Wymaganie dotyczy WYŁĄCZNIE operacji role_change — pozostałe operacje z AUDIT_REQUIREMENTS.mustLog mają własne wpisy potomne."
  },
  {
    "id": "SEC-AUDIT-LOG-MANUAL-STATUS",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/workorders/SEC-AUDIT-LOG-MANUAL-STATUS.md (2026-09-04) — część 3 z 4 rozbicia SEC-AUDIT-LOG. PIĘĆ objętych funkcji, wszystkie w apps/b2b-web/src/app/(dashboard)/: advanceLeadStatus (leads/actions.ts:626 — WARUNKOWO, tylko wywołania spełniające K1/K2/K3/K4), bypassLogisticsOrder (logistics/actions.ts:144), rollbackLogisticsOrder (logistics/actions.ts:217), archiveLost (leads/actions.ts:841), returnToFunnel (leads/actions.ts:763). ŚWIADOMIE WYKLUCZONE: assignCrewToLead (T05, aktor ADMIN, guardy sprawdzane — wzorcowy krok procesu), shipLogisticsOrder (T06, normalny bieg; niewyegzekwowany guard trackingIdPresent to defekt guardu, należy do LOGISTICS-SHIPPING-EFFECTS), markAsDelivered, updateLeadAuditor (zmiana statusu jest skutkiem ubocznym przypisania audytora; brakującą krawędź AWAITING_AUDIT → NEW_LEAD należy DOPISAĆ do kontraktu, a nie audytować dziurę w nim — osobne ID), releaseCrewSlot/suspendLogisticsSla (nie są Server Actions, wołane w tx wywołującego — dałyby drugi wpis o tej samej operacji), akcje serwisów i usterek (NIE ISTNIEJĄ — services/actions.ts i incidents/actions.ts mają wyłącznie odczyty i delete), ścieżki cron/webhook (T04 i webhook kuriera niezaimplementowane; gdy powstaną, manual_status_change będzie dla nich operacją niewłaściwą z definicji). DECYZJE CZŁOWIEKA 2026-09-04, PRZED fazą RED: D1 — powyższa lista pięciu funkcji jest zamknięta. D2 = TAK — rollback dyspozytora (T10-T12) LICZY SIĘ jako ręczna zmiana statusu mimo właściwego aktora, bo przerywa opłacony, zaplanowany proces (zwalnia slot ekipy, wstrzymuje SLA, wysyła klientowi N_ROLLBACK); konsekwencją jest wejście K3 do kryteriów obok K1/K2. D3 = TAK — dodane pole override w TRANSITIONS (w tym samym oknie), zamiast listy literałów nazw funkcji w kodzie aplikacji, której nikt nie zaktualizuje przy osiemnastym przejściu; oznaczone nim jest DOKŁADNIE JEDNO przejście, T07 deliverWithCrew, bo jako jedyne wymyka się K1-K3 (aktor DISPATCHER właściwy, przejście istnieje, STAGE→STAGE). D4 = WARIANT MIESZANY: justification + legalBasis obowiązkowe dla archiveLost, returnToFunnel i wywołań advanceLeadStatus spełniających kryteria; dla bypassLogisticsOrder i rollbackLogisticsOrder pole reason staje się OBOWIĄZKOWE (dziś opcjonalne) i przechodzi walidację ≥10 znaków po trim, a legalBasis ustala serwer na OTHER bez wyboru operatora — przyjęta świadomie cena: statystyka po legal_basis miesza te wpisy z usunięciami, bo słownik legalBases jest słownikiem RODO i nie ma wartości sensownej dla „pominąłem kuriera”. D5 = ODROCZONE — updateInstallationStatus (installations/actions.ts:99) NIE wchodzi do tego wymagania mimo że ustawia leady.status literałem z pominięciem T09: ma dziś DWA osobne prisma.*.update POZA transakcją, więc awaria drugiego zostawia instalację COMPLETED przy leadzie w AWAITING_INSTALLATION. Wpis audytowy dowodziłby stanu, który nie zaszedł w całości, dlatego naprawa spójności międzytabelowej musi być PIERWSZA i wraca jako osobne, jeszcze niezarejestrowane INST-STATUS-TRANSACTIONAL; audyt tej funkcji dopiero po nim. BEZ MIGRACJI I BEZ ZMIANY SCHEMATU PRISMY: audit_log_operation_check dopuszcza już 'manual_status_change', audit_log_resource_check dopuszcza 'leads' i 'installations', wyzwalacz audit_log_append_only_trg działa (potwierdzone przy SEC-AUDIT-LOG-DELETE). BEZ ZMIANY MACIERZY RBAC: leads.update = ['admin','dyspozytor'] i shipments.update = ['admin','dyspozytor'] są już właściwe (domknięte przez SEC-AUTHZ-B2B-MUTATIONS, commit 6a43a21). PUŁAPKA: RESOURCES nie zawiera wartości 'logistics' — zapisy z logistics/actions.ts idą do tabeli leady, więc resource = 'leads', a record_id to identyfikator LEADA, nie zamówienia logistycznego (ta sama pułapka co przy deleteLogisticsOrderAction). Poza zakresem, jawnie: naprawa advanceLeadStatus jako maszyny stanów — fakt, że jego lokalna mapa ALLOWED_TRANSITIONS (leads/actions.ts:604-621) jest równoległa do kontraktu i pomija wszystkie guardy oraz efekty, jest defektem POWAŻNIEJSZYM niż brak audytu; to wymaganie go dokumentuje i audytuje, ale NIE naprawia (osobne ID, propozycja FNL-ADVANCE-STATUS-CONTRACT-BOUND). Sąsiaduje z SEC-AUDIT-LOG-DELETE (wzorzec zapisu i schemat justification), SEC-AUDIT-LOG-ROLE-CHANGE (wzorzec .extend()), SEC-AUDIT-LOG-APPEND-ONLY, SEC-AUTHZ-B2B-MUTATIONS, CRM-SAFE-RECORD-ACTIONS, LOGISTICS-SHIPPING-EFFECTS.",
    "statement": "Ręczna zmiana statusu leada — czyli taka, którą kontrakt lejka klasyfikuje jako obejście reguły procesu (aktor spoza operatorów panelu, ruch nieznany maszynie stanów, krawędź bucketu albo przejście oznaczone override) — tworzy wpis w audit_log w TEJ SAMEJ transakcji co sama zmiana statusu, z uzasadnieniem operatora i podstawą prawną. Zwykła praca dyspozytora NIE generuje wpisów. O tym, która zmiana jest ręczna, rozstrzyga kontrakt, a nie lista nazw funkcji w kodzie aplikacji. Wymaganie dotyczy WYŁĄCZNIE operacji manual_status_change — pozostałe operacje z AUDIT_REQUIREMENTS.mustLog mają własne wpisy potomne."
  },
  {
    "id": "SEC-LAST-ADMIN-GUARD",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Zapowiedziane, ale nie zarejestrowane, w oknie SEC-AUDIT-LOG-ROLE-CHANGE (2026-09-04) — patrz komentarz przy SEC-AUDIT-LOG-ROLE-CHANGE (:361-363) i AC7 tego wymagania: 'ochrona ostatniego admina jest tu WĄSKA — wyłącznie na ścieżce zmiany roli (decyzja D3). Ścieżka delete zostaje niezabezpieczona i czeka na osobne, jeszcze niezarejestrowane SEC-LAST-ADMIN-GUARD'. Jedyny punkt zapisu objęty tym wymaganiem: apps/b2b-web/src/app/(dashboard)/settings/actions.ts, deleteAuthorizedUser (:205) — dziś usuwa konto bez sprawdzenia, czy jest ono jedynym administratorem, w przeciwieństwie do sąsiedniej updateAuthorizedUserRoleAction (:286), która liczy adminów wewnątrz transakcji Serializable PRZED update'em i odrzuca degradację jedynego konta sentinel-em LastAdminError. To wymaganie przenosi ten wzorzec na ścieżkę delete. WYMAGA DECYZJI (jawnie odroczone, NIE rozstrzygane w tym oknie kontraktowym): czy poza warstwą Server Action potrzebna jest dodatkowo twarda gwarancja bazodanowa (constraint/trigger Postgres blokujący DELETE, który redukuje COUNT(*) WHERE role='admin' do zera) — notatka z 2026-09-04 mówiła 'wymaga migracji', decyzja o tym zapadnie w Work Order, nie tutaj. Sąsiaduje z SEC-AUDIT-LOG-ROLE-CHANGE (wzorzec LastAdminError i transakcji Serializable) oraz SEC-AUDIT-LOG-DELETE (wzorzec zapisu audit_log przy delete, punkt siódmy z siedmiu to właśnie ta akcja).",
    "statement": "Usunięcie jedynego konta o roli admin w authorized_users jest odrzucone błędem domenowym — analogicznie do ochrony przy zmianie roli (SEC-AUDIT-LOG-ROLE-CHANGE, AC7), liczenie adminów odbywa się WEWNĄTRZ tej samej transakcji co delete, PRZED samym usunięciem, żeby uniknąć wyścigu między sprawdzeniem a zapisem (TOCTOU, pułapka nr 4 z CLAUDE.md). Przy co najmniej dwóch kontach admin usunięcie jednego z nich przebiega normalnie, z wpisem audytowym jak dziś (SEC-AUDIT-LOG-DELETE). WYMAGA DECYZJI: czy poza tą warstwą Server Action potrzebna jest twarda gwarancja bazodanowa (constraint/trigger) — nierozstrzygnięte w tym wpisie."
  },
  {
    "id": "SEC-AUTHZ-DEFAULT-ROLE",
    "domain": "security",
    "status": "DONE",
    "risk": "HIGH",
    "source": "Znalezisko przy przeglądzie packages/database/prisma/schema.prisma, model AuthorizedUser (linia 86-92): pole role (linia 89) ma wartość domyślną @default(\"admin\"). Dziś JEDYNY punkt zapisu tego modelu w kodzie aplikacji jest apps/b2b-web/src/app/(dashboard)/settings/actions.ts:19, addAuthorizedUser(email, role) — role jest parametrem obowiązkowym funkcji i jest zawsze przekazywane explicite (wołający musi je podać), więc przez istniejące UI panelu B2B nie da się dziś stworzyć konta bez wskazanej roli i nie da się skorzystać z tego defaultu. Problem jest w samym schemacie, nie w dzisiejszym zachowaniu: kolumna bez NOT NULL bez default jest fail-open dla KAŻDEGO przyszłego punktu zapisu, który pominie role — nowa Server Action, migracja z seedem, ręczny skrypt/INSERT administracyjny, potencjalny trigger Supabase Auth przy rejestracji konta. Każdy z nich dostałby konto z rolą 'admin', czyli pełnymi uprawnieniami z rbac.contract.mjs, bez jakiejkolwiek decyzji o tym w kodzie wołającym — cichy privilege escalation, sprzeczny z zasadą fail-closed z .claude/CLAUDE.md, pułapka nr 1: 'Prisma omija RLS. […] Brak sprawdzenia roli to podatność, nie niedopatrzenie' — to jest ten sam problem przesunięty z warstwy Server Action na warstwę schematu bazy. Sąsiaduje z SEC-LAST-ADMIN-GUARD i SEC-AUDIT-LOG-ROLE-CHANGE (ten sam model AuthorizedUser, te same akcje w settings/actions.ts), ale nie zależy od żadnego z nich i nie jest przez nie zamykane. ZAMKNIĘTE 2026-09-07: migracja 20260907173000_security_authorized_user_role_no_default.sql (commit 02738c3) URUCHOMIONA na żywej bazie produkcyjnej za jawną zgodą człowieka i zweryfikowana bezpośrednim zapytaniem (nie tylko treścią pliku) — information_schema.columns dla AuthorizedUser.role: is_nullable='NO', column_default=NULL (default usunięty); pg_constraint: nowy authorized_user_role_check obecny z definicją CHECK ((role = ANY (ARRAY['admin','dyspozytor','audytor','monter']))); wszystkie 4 istniejące konta AuthorizedUser mają niezmienione, poprawne role. AC3 rozstrzygnięte: CHECK dodany w tej samej migracji.",
    "statement": "Kolumna AuthorizedUser.role w schema.prisma nie ma wartości domyślnej — jest wymagana (NOT NULL, bez @default) — tak, aby próba wstawienia wiersza w authorized_users bez explicite podanej roli była odrzucona przez samą bazę, a nie tylko przez warstwę aplikacji. Usunięcie defaultu wymaga migracji Postgres (ALTER COLUMN role DROP DEFAULT); czy migracja powinna dodatkowo dodać CHECK (role IN (...)) egzekwujący ROLES z rbac.contract.mjs jako drugą, bazodanową linię obrony, czy to osobne przyszłe zadanie — WYMAGA DECYZJI, nierozstrzygniętej w tym wpisie."
  },
  {
    "id": "NTF-QUEUE-TABLE",
    "domain": "notifications",
    "status": "DONE",
    "risk": "HIGH",
    "source": "docs/workorders/LOGISTICS-SHIPPING-EFFECTS.md#zmiana-kontraktu-schematu-wymagana, ADR-007 (contracts/notifications.contract.mjs QUEUE_POLICY)",
    "statement": "Tabela notification_queue istnieje w schemacie i pozwala zapisać wpis kolejki w tej samej transakcji Prisma co zmianę statusu leada/instalacji/serwisu/usterki, zanim istnieje jakikolwiek nadawca (SMS/e-mail/push)."
  },
  {
    "id": "NTF-QUEUE-WINDOW",
    "domain": "notifications",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_app_requirements.md#epic-4",
    "statement": "SMS wysyłane wyłącznie w oknie 8:00–18:00; poza oknem kolejkowane na najbliższe okno."
  },
  {
    "id": "NTF-POLY",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-007",
    "statement": "Kolejka obsługuje powiadomienia niezwiązane z leadem: serwisowe i usterkowe."
  },
  {
    "id": "NTF-HISTORY",
    "domain": "notifications",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_app_requirements.md#epic-0",
    "statement": "Karta 360 pokazuje pełną historię komunikacji z klientem."
  },
  {
    "id": "NTF-RETRY",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_app_requirements.md#epic-0",
    "statement": "Centrum Powiadomień pozwala ponowić wysyłkę błędnych powiadomień."
  },
  {
    "id": "NTF-CATALOG-PARITY",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "notification_definitions.md",
    "statement": "Każde powiadomienie z katalogu ma szablon w bazie i odwrotnie — brak sierot w obie strony."
  },
  {
    "id": "B2C-LEAD-ENTRY",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2c_app_requirements.md#1",
    "statement": "Ukończony Triage tworzy leada w stanie NEW_LEAD — to jest wejście KLIENCKIE do maszyny stanów lejka (drugim, pracowniczym, jest FLD-AUDIT-LEAD-CREATE)."
  },
  {
    "id": "B2C-LEAD-ATOMIC",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2c_app_requirements.md#1",
    "statement": "Lead, klient, adres i rezerwacja terminu audytu powstają w jednej transakcji albo nie powstaje żaden z tych rekordów."
  },
  {
    "id": "B2C-BOOKING-SLOT",
    "domain": "b2c",
    "status": "DONE",
    "risk": "HIGH",
    "source": "docs/prompts/figma_triage_ui_prompt.md#ekran-rezerwacji",
    "statement": "Rezerwacja terminu audytu przez klienta jest atomowa — ten sam slot może zostać zajęty tylko raz."
  },
  {
    "id": "B2C-CONSENT-RODO",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "database_model.md#4",
    "statement": "Zgoda na regulamin i politykę prywatności jest zapisywana razem z leadem."
  },
  {
    "id": "B2C-RLS-PUBLIC",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "system_architecture.md#3",
    "statement": "Aplikacja B2C czyta dane kluczem anonimowym z aktywnym RLS, a klucz serwisowy występuje wyłącznie w Server Actions."
  },
  {
    "id": "B2C-TRIAGE-STEPS",
    "domain": "b2c",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "docs/prompts/figma_triage_ui_prompt.md",
    "statement": "Triage prowadzi klienta przez siedem kroków, po jednym pytaniu na ekran, z paskiem postępu i działającym cofaniem."
  },
  {
    "id": "B2C-TRIAGE-DISQUALIFY",
    "domain": "b2c",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "contracts/triage.contract.mjs",
    "statement": "Konfiguracja spełniająca którąkolwiek regułę z DISQUALIFICATION_RULES kieruje klienta na ekran Eksperta zamiast na wycenę."
  },
  {
    "id": "B2C-TRIAGE-CONDITIONAL",
    "domain": "b2c",
    "status": "TODO",
    "risk": "LOW",
    "source": "docs/prompts/figma_triage_ui_prompt.md",
    "statement": "Pytania zależne pojawiają się wyłącznie w kontekście, w którym mają sens."
  },
  {
    "id": "B2C-SOFT-LEAD",
    "domain": "b2c",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2c_app_requirements.md#1",
    "statement": "Exit Intent zapisuje kontakt cząstkowy do soft_leads i nie wprowadza nikogo do lejka."
  },
  {
    "id": "B2C-BOOKING-VALIDATION",
    "domain": "b2c",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ui_ux_guidelines.md#8",
    "statement": "Formularz kontaktowy rezerwacji działa na react-hook-form z zodResolver, a ten sam schemat Zod waliduje dane powtórnie po stronie serwera."
  },
  {
    "id": "B2C-PRICE-FROM",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2c_app_requirements.md#3",
    "statement": "Cena „od\" jest wyliczana w locie jako suma jednostki wewnętrznej, dedykowanego agregatu i usługi montażu, powiększona o VAT."
  },
  {
    "id": "B2C-CATALOG-LIST",
    "domain": "b2c",
    "status": "TODO",
    "risk": "LOW",
    "source": "docs/prompts/figma_landing_page_ui_prompt.md",
    "statement": "Katalog prezentuje urządzenia w jednej sekcji z filtrami marki i koloru."
  },
  {
    "id": "B2C-DEVICE-MODAL",
    "domain": "b2c",
    "status": "TODO",
    "risk": "LOW",
    "source": "docs/prompts/figma_device_modal_prompt.md",
    "statement": "Modal urządzenia prezentuje galerię, cechy i standardowy zakres montażu oraz oferuje dwa CTA."
  },
  {
    "id": "B2C-CATALOG-VIEW-TRACKED",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "supabase/migrations/20260910090000_b2c_catalog_view_tracked.sql",
    "statement": "Widok zmaterializowany available_combinations wraz z funkcjami, indeksami i triggerami odświeżania ma definicję w migracjach repozytorium, a nie wyłącznie na serwerze produkcyjnym."
  },
  {
    "id": "B2C-CONTENT-PAGES",
    "domain": "b2c",
    "status": "TODO",
    "risk": "LOW",
    "source": "docs/prompts/figma_landing_page_ui_prompt.md",
    "statement": "Strony Baza wiedzy, O nas, Polityka prywatności i Regulamin renderują się i są osiągalne z nawigacji."
  },
  {
    "id": "B2C-NAV-STATE",
    "domain": "b2c",
    "status": "TODO",
    "risk": "LOW",
    "source": "docs/prompts/figma_landing_page_ui_prompt.md",
    "statement": "Powrót z podstrony przywraca pozycję przewijania strony głównej."
  },
  {
    "id": "FLD-GEO-COORDS",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "field_app_requirements.md#6.3",
    "statement": "Adres klienta przechowuje współrzędne geograficzne, a ścieżka tworzenia leada w B2C zapisuje je zamiast odrzucać po drodze."
  },
  {
    "id": "FLD-GEO-UNLOCK",
    "domain": "field",
    "status": "BLOCKED",
    "risk": "HIGH",
    "source": "field_app_requirements.md#6.1",
    "statement": "Field App odblokowuje rozpoczęcie i zakończenie zlecenia dopiero wtedy, gdy pozycja GPS pracownika mieści się w promieniu SLA.GEOFENCE_UNLOCK_RADIUS od punktu docelowego."
  },
  {
    "id": "FLD-GEO-EN-ROUTE",
    "domain": "field",
    "status": "BLOCKED",
    "risk": "HIGH",
    "source": "field_app_requirements.md#6.2",
    "statement": "Przecięcie promienia SLA.GEOFENCE_EN_ROUTE_RADIUS w oknie dnia wizyty wyzwala klientowi SMS „w drodze\"; Field App jest producentem zdarzenia, nie nowym typem powiadomienia."
  },
  {
    "id": "FLD-GPS-RODO",
    "domain": "field",
    "status": "BLOCKED",
    "risk": "HIGH",
    "source": "field_app_requirements.md#6.4",
    "statement": "GPS pracownika jest zbierany wyłącznie w oknie aktywnego, przypisanego zlecenia i zapisywany jako zdarzenia punktowe, nigdy jako ciągły ślad trasy."
  },
  {
    "id": "FLD-AUTH-BLOCKED",
    "domain": "field",
    "status": "BLOCKED",
    "risk": "HIGH",
    "source": "field_app_requirements.md#4.1",
    "statement": "Konto pracownika z odebranym dostępem (is_active = false) nie przechodzi bramki logowania do aplikacji terenowej."
  },
  {
    "id": "FLD-CONSENT-TRIGGERS-INTEGRATION",
    "domain": "field",
    "status": "BLOCKED",
    "risk": "HIGH",
    "source": "WO BATCH-MEDIUM-LOW-CLEANUP punkt 23 (2026-09-01) — dług zarejestrowany jawnie, żeby pokrycie statyczne nie było mylone z pokryciem integracyjnym. Migracja 20260821130000 jest uruchomiona na produkcji od 2026-08-27, więc mechanizmy DZIAŁAJĄ na żywej bazie — nikt tego jednak nie weryfikuje automatycznie.",
    "statement": "Cztery mechanizmy bazodanowe chroniące zgody pracownicze (freeze opublikowanej wersji dokumentu, append-only na employee_consents, version-must-be-current przy akceptacji, częściowy indeks unikalny na aktualnej wersji) są zweryfikowane testem uruchamianym na żywym Postgresie, nie asercją nad tekstem pliku migracji."
  },
  {
    "id": "FLD-CONSENT-ACCEPT",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "field_app_requirements.md#4.1",
    "statement": "System rejestruje akceptację dokumentów prawnych przez pracownika terenowego: kto, którą wersję i kiedy — w sposób nieodwracalny i odporny na późniejszą zmianę treści."
  },
  {
    "id": "FLD-LEGAL-DOC-VERSION",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "field_app_requirements.md#4.1",
    "statement": "Administrator ma miejsce, w którym wgrywa i wersjonuje treść zgód RODO oraz regulaminu pracowniczego; wersja opublikowana jest niezmienna, a obowiązująca jest zawsze dokładnie jedna na rodzaj dokumentu."
  },
  {
    "id": "FLD-AVAIL-SELF",
    "domain": "field",
    "status": "DONE",
    "risk": "HIGH",
    "source": "field_app_requirements.md#4.2",
    "statement": "Pracownik terenowy sam deklaruje własną niedostępność, a deklaracja jest rozłączna z blokadą administracyjną (is_active) i ze statusem kadrowym (leave_status), których właścicielem pozostaje administrator."
  },
  {
    "id": "FLD-AVAIL-RESTORE",
    "domain": "field",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "field_app_requirements.md#4.2",
    "statement": "Powrót pracownika do statusu dostępnego przywraca wcześniej wprowadzoną dostępność bez ponownego jej wprowadzania (D3)."
  },
  {
    "id": "FLD-AVAIL-WEEKLY-RULES",
    "domain": "field",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "field_app_requirements.md#4.2 (D3); docs/architecture/FIELD-APP-PLAN.md 6.2 i 6.4 (R5, R6); decyzja Michała 2026-09-10 w oknie FLD-CALENDAR-FOUNDATION; kryteria silnika odjęć i sumy puli wyniesione 2026-09-10 do CAL-SLOT-ENGINE i CAL-POOL-AGGREGATE",
    "statement": "Pracownik terenowy definiuje własną dostępność cykliczną — godziny od–do dla każdego dnia tygodnia — a system odczytuje z nich efektywne okno pracy na konkretną datę. Odejmowanie nieobecności, rezerwacji, bufora dojazdu i dziennego limitu należy do CAL-SLOT-ENGINE, dla którego te reguły są wejściem."
  },
  {
    "id": "CAL-SLOT-ENGINE",
    "domain": "field",
    "status": "DONE",
    "risk": "HIGH",
    "source": "wyniesione 2026-09-10 z FLD-AVAIL-WEEKLY-RULES (kryterium silnika odjęć), bo docs/workorders/FLD-AVAIL-WEEKLY-RULES.md sekcja „Poza zakresem\" jawnie wyłączyła je z tamtej tury; docs/architecture/FIELD-APP-PLAN.md 6.3 i 6.4; powiązane: FLD-BOOKING-ATOMIC-ASSIGN (wstawienie wiersza), CAL-TRAVEL-BUFFER (wartość bufora), CAL-VISIT-DURATION-BASKETS (długość wizyty)",
    "statement": "Silnik wolnych terminów wylicza dostępność pracownika, odejmując od jego reguły tygodniowej nieobecności, istniejące rezerwacje, bufor dojazdu i dzienny limit wizyt."
  },
  {
    "id": "CAL-POOL-AGGREGATE",
    "domain": "b2c",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "wyniesione 2026-09-10 z FLD-AVAIL-WEEKLY-RULES (kryterium widoku puli), bo docs/workorders/FLD-AVAIL-WEEKLY-RULES.md sekcja „Poza zakresem\" jawnie wyłączyła je z tamtej tury; docs/architecture/FIELD-APP-PLAN.md 6.3",
    "statement": "Klient wybierający termin widzi sumę wolnych terminów całej puli wykonawców, a nie kalendarz konkretnej osoby."
  },
  {
    "id": "FLD-BOOKING-ATOMIC-ASSIGN",
    "domain": "field",
    "status": "DONE",
    "risk": "HIGH",
    "source": "docs/architecture/FIELD-APP-PLAN.md 6.4 R3 (rozstrzygnięcie „z przypisaniem\", decyzja Michała 2026-09-09/2026-09-10); ADR-012; nośnik atomowości dla FNL-E3-E4 i B2C-BOOKING-SLOT",
    "statement": "Rezerwacja terminu jest atomowa i od razu wiąże konkretnego wykonawcę: system wybiera wolną osobę z puli i zapisuje rezerwację na nią w jednej operacji, a dyspozytor może to przypisanie nadpisać."
  },
  {
    "id": "FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT",
    "domain": "field",
    "status": "DONE",
    "risk": "HIGH",
    "source": "rozstrzygnięcie D-3 z docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md (decyzja Michała 2026-09-10: wariant b — ograniczenie w bazie, nie sprawdzenie w kodzie); migracja supabase/migrations/20260910110000_fld_booking_one_active_per_subject.sql",
    "statement": "Jeden podmiot — lead, serwis albo usterka — ma w danym momencie najwyżej JEDNĄ aktywną rezerwację, a pilnuje tego baza, nie kod akcji."
  },
  {
    "id": "CAL-VISIT-DURATION-BASKETS",
    "domain": "crm",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "docs/architecture/FIELD-APP-PLAN.md 6.4 R1 i tabela koszyków; decyzja Michała 2026-09-09, korekta montażu dużego 2026-09-10; AC2 zawężone 2026-09-15 (okno CAL-SCHEDULING-CONFIG-CLOSE), połowa dotycząca ekranu wyceny wyniesiona do FLD-QUOTE-BASKET-SELECT",
    "statement": "Czas trwania wizyty pochodzi ze słownika koszyków konfigurowalnego w panelu B2B: audytor przy wycenie WYBIERA koszyk, a nie wpisuje godziny z palca, i ten sam słownik zasila Triage jako wstępne oszacowanie."
  },
  {
    "id": "CAL-TRAVEL-BUFFER",
    "domain": "crm",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "docs/architecture/FIELD-APP-PLAN.md 6.4 R2; decyzja Michała 2026-09-09 (1 h, konfigurowalny w panelu B2B)",
    "statement": "Między dwiema wizytami tego samego pracownika silnik dostępności rezerwuje bufor dojazdu, którego długość administrator ustawia w panelu B2B."
  },
  {
    "id": "FLD-QUOTE-BASKET-SELECT",
    "domain": "field",
    "status": "DONE",
    "risk": "MEDIUM",
    "source": "WYNIESIONE 2026-09-15 z CAL-VISIT-DURATION-BASKETS, kryterium AC2 (okno CAL-SCHEDULING-CONFIG-CLOSE) — połowa dotycząca KONSUMENTA słownika, podczas gdy tamten wpis opisuje sam słownik; docs/architecture/FIELD-APP-PLAN.md 6.4 R1; decyzja Michała 2026-09-09",
    "statement": "Osoba tworząca rezerwację (dziś admin albo dyspozytor w panelu B2B) WYBIERA koszyk czasu trwania z listy — ekran wyceny nie ma pola na dowolną liczbę godzin ani minut. BRZMIENIE SKORYGOWANE 2026-09-16 (okno FLD-QUOTE-BASKET-WORDING) na podstawie decyzji Michała D-1 = (A) i D-2 = (a) z docs/workorders/FLD-QUOTE-BASKET-SELECT.md: ekran powstaje w panelu B2B, dla dyspozytora/admina, TERAZ — bez czekania na Field App i ADR-013 — a macierz uprawnień zostaje BEZ ZMIAN, to znaczy audytor NIE dostaje bookings.create (dziś create: admin, dyspozytor). Poprzednie brzmienie („Audytor przy wycenie WYBIERA koszyk\") zakładało ekran w Field App, która jako aplikacja nie istnieje, i tym samym wskazywało aktora niewykonalnego w dzisiejszym kontrakcie uprawnień — createBookingAction odmówiłaby audytorowi przed jakimkolwiek zapytaniem do bazy. Ścieżka audytora w Field App zostaje na później i użyje TEGO SAMEGO słownika koszyków. ŻADNE z czterech kryteriów akceptacji nie zostało przy tej korekcie zmienione: trzy pierwsze mówią o „ekranie wyceny\" i „wyborze\" bezosobowo, a „wizyta audytora\" w kryterium czwartym dotyczy PRZEDMIOTU wizyty i puli AUDITOR, nie operatora ekranu — nie wolno jej przepisywać tą decyzją."
  },
  {
    "id": "FLD-BASE-LOCATION-EDIT",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/architecture/FIELD-APP-PLAN.md 6.4b (w tym uwaga o gamifikacji); decyzja Michała 2026-09-10: pola edytowalne w Field App ORAZ w panelu B2B, zmiana widoczna w audit_log",
    "statement": "Kod pocztowy bazowy i promień działania są edytowalne przez samego pracownika w Field App oraz przez administratora w panelu B2B, a każda taka zmiana zostawia ślad w rejestrze audytowym."
  },
  {
    "id": "CRM-PROJECT-NUMBER",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "decyzja Michała 2026-09-10 (okno FLD-CALENDAR-FOUNDATION, punkt 7): czytelny numer sekwencyjny obok UUID, BEZ zmiany klucza głównego",
    "statement": "Każdy lead ma czytelny, sekwencyjny numer projektu, którym posługują się ludzie — obok technicznego identyfikatora UUID, a nie zamiast niego."
  },
  {
    "id": "CRM-READABLE-IDENTIFIERS",
    "domain": "crm",
    "status": "IMPLEMENTING",
    "risk": "MEDIUM",
    "source": "decyzja Michała 2026-09-12 (okno CRM-READABLE-IDENTIFIERS): czytelne identyfikatory biznesowe dla wszystkich głównych encji (Wariant 1: prefiks krótki + 6 cyfr)",
    "statement": "Główne encje biznesowe (klienci, instalacje, serwisy, usterki, adresy, ekipy, audytorzy, przesyłki, rezerwacje) posiadają unikalne, sekwencyjne numery czytelne dla ludzi obok technicznego identyfikatora UUID."
  },
  {
    "id": "FLD-PHOTO-SET",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D7 rozstrzygnięte 2026-09-23 (zestaw zmienny 4 + 2n), docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 0 i 3 D7; wcześniej field_app_requirements.md#8",
    "statement": "Zamknięcie montażu wymaga kompletu zdjęć o składzie zmiennym: czterech zdjęć części stałej oraz dwóch zdjęć na każdą zamontowaną jednostkę wewnętrzną."
  },
  {
    "id": "FNL-ADVANCE-STATUS-CONTRACT-BOUND",
    "domain": "funnel",
    "status": "IMPLEMENTING",
    "risk": "MEDIUM",
    "source": "Zobowiązanie z contracts/requirements.contract.mjs, wpis SEC-AUDIT-LOG-MANUAL-STATUS (2026-09-04): \"naprawa advanceLeadStatus jako maszyny stanów — fakt, że jego lokalna mapa ALLOWED_TRANSITIONS (leads/actions.ts:604-621) jest równoległa do kontraktu i pomija wszystkie guardy oraz efekty, jest defektem POWAŻNIEJSZYM niż brak audytu\". Potwierdzone bezpośrednio w kodzie 2026-09-07 (Fala C dodała klasyfikację audytową przez findTransitionByFromTo, ale NIE naprawiła struktury maszyny stanów): apps/b2b-web/src/app/(dashboard)/leads/actions.ts, funkcja advanceLeadStatus (dziś linie 648-765). Sekwencja realna: (1) linia 697, `const allowed = ALLOWED_TRANSITIONS[currentStatus] || []` i linia 699 `if (!allowed.includes(targetStatus)) throw` — to jest JEDYNA bramka decydująca, czy zapis się wykona; to lokalna, ręcznie utrzymywana mapa (from -> to[]), zdefiniowana w tym samym pliku (linie 606-627), nie w contracts/funnel.contract.mjs. (2) Linia 711, `findTransitionByFromTo(currentStatus, targetStatus)` woła kontrakt, ale WYŁĄCZNIE w celu klasyfikacji audytowej (linia 718, `isManualStatusChange(transition.id)`) — jeśli transition istnieje i nie jest 'manual', jego guards i effects z contracts/funnel.contract.mjs są odczytane z obiektu `transition`, ale NIGDZIE nie są wykonane; kod idzie prosto do `tx.leady.update` (linia 731). (3) Konkretne pominięcia potwierdzone przez porównanie z TRANSITIONS: T03 acceptQuoteAndBook ma guard 'slotAvailable' (funnel.contract.mjs:110) i effect 'do:reserveInstallationSlot' (funnel.contract.mjs:111) — advanceLeadStatus nie sprawdza dostępności slotu przed zapisem AUDIT_COMPLETED -> AWAITING_CREW_ASSIGNMENT i nie rezerwuje go po. T14 rebookInstallation ma guard 'slotAvailable' (funnel.contract.mjs:175) — to samo pominięcie przy powrocie z ROLLBACK_RESCHEDULING (linia lokalnej mapy 624, ROLLBACK_RESCHEDULING -> AWAITING_CREW_ASSIGNMENT). T10-T13 (rollback, funnel.contract.mjs:168-171) mają effects ['N_ROLLBACK', 'I4', 'do:releaseCrewSlot', 'do:suspendLogisticsSla'] — advanceLeadStatus dopuszcza te przejścia przez lokalną mapę (linie 614-617, wpisy '...ROLLBACK_RESCHEDULING') i owinięte SEC-AUDIT-LOG-MANUAL-STATUS Wave B/K3 tworzy wpis audytowy (isManual=true), ale sam nie woła releaseCrewSlot ani suspendLogisticsSla — te efekty istnieją TYLKO jako funkcje wołane z rollbackLogisticsOrder (logistics/actions.ts:217), nie z advanceLeadStatus; lead przesunięty tą ścieżką pozostaje z zajętym slotem ekipy i aktywnym SLA logistyki. T02 sendQuote ma effects ['N4', 'do:createQuote', 'do:startQuoteValidityClock'] — nie wołane. Ocena ryzyka: rls-security-auditor w tej sesji (SEC-AUDIT-LOG-MANUAL-STATUS Wave B) ocenił brak releaseCrewSlot/suspendLogisticsSla na ścieżce rollback jako 'dług operacyjny, nie luka bezpieczeństwa' — nie ma tu obejścia RBAC ani wycieku danych, jest niespójność stanu procesu (slot zajęty mimo rollbacku, SLA nie wstrzymane, klient nie dostaje powiadomienia N_ROLLBACK jeśli ta gałąź nie woła go wprost — do zweryfikowania per przejście przy implementacji). Stąd risk = MEDIUM, nie HIGH: wpływ jest na integralność danych operacyjnych i doświadczenie klienta (zły SMS albo brak SMS), nie na autoryzację ani bezpieczeństwo w sensie RODO/RBAC. WYMAGA DECYZJI CZŁOWIEKA, NIE ROZSTRZYGNIĘTE TUTAJ: (a) czy to jedna duża zmiana (advanceLeadStatus czyta guard+effect z kontraktu dla WSZYSTKICH siedemnastu przejść naraz) czy trzeba ją rozbić na sub-wymagania per przejście albo per kategoria guardów (wzorem rozbicia SEC-AUDIT-LOG na DELETE/ROLE-CHANGE/MANUAL-STATUS/NOTIFICATION-RESEND) — ryzyko jednego dużego przebiegu RED→GREEN jest wyższe niż przy audycie, bo dotyka ścieżki zapisu używanej przez WSZYSTKIE przejścia sterowane z leads/actions.ts, nie tylko pięć już zaudytowanych; (b) czy guardy dotykające zewnętrznych systemów (dziś tylko 'slotAvailable' odpytuje dostępność terminu, ale przyszłe guardy mogą dotykać systemów kurierskich) mogą być sprawdzane synchronicznie WEWNĄTRZ tej samej transakcji Prisma (tak jak dziś robi to rezerwacja slotu w innych ścieżkach, `FOR UPDATE` + sprawdzenie), czy wymagają wzorca kompensacji/rezerwacji poza transakcją — od tej decyzji zależy, czy `findTransitionByFromTo` (już istniejące z Fali C) rozszerza się o wykonanie guard/effect, czy potrzebny jest nowy mechanizm. Sąsiaduje z: SEC-AUDIT-LOG-MANUAL-STATUS (bezpośredni rodzic tego długu), FNL-ROLLBACK (T10-T13, właściciel effects releaseCrewSlot/suspendLogisticsSla), LOGISTICS-SHIPPING-EFFECTS (analogiczny defekt guardu na T06, trackingIdPresent, tam już zarejestrowany jako osobne ID).",
    "statement": "advanceLeadStatus (apps/b2b-web/src/app/(dashboard)/leads/actions.ts) przestaje mieć własną, równoległą mapę przejść (ALLOWED_TRANSITIONS) i czyta WYŁĄCZNIE z contracts/funnel.contract.mjs (TRANSITIONS): dozwolone przejście to wyłącznie takie, które istnieje w kontrakcie dla danego (from, to); przed zapisem statusu sprawdzane są guardy zdefiniowane na tym przejściu (np. slotAvailable dla T03/T14), a po zapisie — w TEJ SAMEJ transakcji Prisma, tam gdzie to możliwe — wywoływane są jego effects (np. do:reserveInstallationSlot, do:releaseCrewSlot, do:suspendLogisticsSla). Zakres podziału na sub-wymagania i podejście do guardów/effectów dotykających zewnętrznych systemów pozostają otwarte dla Work Ordera (patrz `source`, sekcja WYMAGA DECYZJI)."
  },
  {
    "id": "FLD-APP-SHELL",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D1 (React Native + Expo), D12 (telefon dla obu ról), docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M1",
    "statement": "Istnieje aplikacja terenowa apps/field-app (Expo), do której audytor i monter logują się tym samym kontem co do panelu B2B."
  },
  {
    "id": "FLD-API-LAYER",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D2 potwierdzone 2026-09-23 (Route Handlery + can() + Prisma jako aneks ADR-013); ryzyko R13 w docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 9",
    "statement": "Każdy zapis z aplikacji terenowej przechodzi przez warstwę Route Handlerów, która weryfikuje token i wywołuje tę samą bramkę can() oraz te same funkcje domenowe co panel B2B."
  },
  {
    "id": "FLD-APP-DISTRIBUTION",
    "domain": "field",
    "status": "TODO",
    "risk": "LOW",
    "source": "D1; ryzyko R11 (D-U-N-S) w docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 9",
    "statement": "Aplikacja terenowa jest dystrybuowana do pracowników przez sklepy (EAS Build/Update, TestFlight, Play Console), a nie przez ręczne wgrywanie plików."
  },
  {
    "id": "FLD-MOBILE-TEST-HARNESS",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D1; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 6.3",
    "statement": "Aplikacja terenowa ma własną pętlę RED→GREEN wpiętą w bramkę CI (Jest + React Native Testing Library, E2E Maestro)."
  },
  {
    "id": "FLD-JOBS-OWN",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M1; macierz RBAC (warianty :own)",
    "statement": "Pracownik widzi w aplikacji wyłącznie własne zlecenia — zawężenie jest wykonywane po stronie serwera, nie filtrem w interfejsie."
  },
  {
    "id": "FLD-CONSENT-ENFORCE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Decyzja D-D z 2026-08-21 (blokada w aplikacji, nie w panelu); zapowiedź w FLD-CONSENT-ACCEPT kryt. 9; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M2",
    "statement": "Pracownik bez kompletu aktualnych zgód nie może rozpocząć zlecenia w aplikacji terenowej."
  },
  {
    "id": "FLD-CHECKLIST-PREINSTALL",
    "domain": "field",
    "status": "TODO",
    "risk": "LOW",
    "source": "docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M3 (N15)",
    "statement": "Monter odhacza checklistę przedmontażową przed rozpoczęciem prac, a jej wynik jest zapisany przy instalacji."
  },
  {
    "id": "FLD-PHOTO-STORAGE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M3; FLD-PHOTO-SET kryt. 3",
    "statement": "Zdjęcia montażowe trafiają do dedykowanego bucketu z własnymi politykami dostępu, nie do bucketu awatarów pracowników."
  },
  {
    "id": "FLD-PHOTO-UPLOAD-RESILIENT",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D11 (wersja wąska: szkic + kolejka); backlogowe FLD-PHOTO-OPTIMIZE; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M3",
    "statement": "Zdjęcia są kompresowane na urządzeniu i wysyłane ponownie po powrocie zasięgu, bez tworzenia duplikatów."
  },
  {
    "id": "FLD-OFFLINE-OUTBOX",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D11 rozstrzygnięte 2026-09-21 (wersja wąska: szkic lokalny + kolejka wysyłki, expo-sqlite); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M3",
    "statement": "Praca bez zasięgu zapisuje się jako szkic lokalny i wysyła się z kolejki po powrocie sieci; przeglądanie danych bez zasięgu jest świadomie poza zakresem."
  },
  {
    "id": "FLD-HANDOVER-PROTOCOL",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D7 (parametry prób liczbowo), K5 (numery seryjne z tabliczek), D10 = A; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M4",
    "statement": "Monter wypełnia protokół zdawczo-odbiorczy: numery seryjne i modele urządzeń, parametry prób wpisane liczbowo, potwierdzenie instruktażu."
  },
  {
    "id": "DOC-PDF-RENDER",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M4 i 6.3; wzory w docs/legal/",
    "statement": "Jeden silnik po stronie serwera renderuje PDF protokołu, umowy i oferty na podstawie wzorów z docs/legal/."
  },
  {
    "id": "FLD-INSTALL-PAYOUT-APPROVAL",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D10 = A rozstrzygnięte 2026-09-21 (monter zamyka, dyspozytor zatwierdza tylko wypłatę); KPI OPS-06; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M4",
    "statement": "Dyspozytor zatwierdza zakończony montaż do wypłaty ekipie; zatwierdzenie nie wstrzymuje ani powiadomienia N8, ani dokumentów dla klienta."
  },
  {
    "id": "FLD-SIGN-DOC-FREEZE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D4 (2026-09-21), S3; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M5",
    "statement": "Klient podpisuje dokładnie tę wersję dokumentu, którą zobaczył — treść jest zamrożona przed prezentacją i weryfikowalna po podpisie."
  },
  {
    "id": "FLD-SIGN-CAPTURE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D4.3, D12 (telefon, podpis palcem), D1 (React Native Skia); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M5",
    "statement": "Klient podpisuje palcem na ekranie telefonu pracownika; podpis jest przechwytywany, dający się cofnąć i eksportowany razem z danymi przechwycenia."
  },
  {
    "id": "FLD-SIGN-AUDIT-TRAIL",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D4 (2026-09-21); wzorzec audit_log_append_only_trg; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M5",
    "statement": "Każdy podpis ma nieusuwalny ślad zdarzeń (wysłano, doręczono, otwarto, podpisano) z łańcuchem skrótów między wpisami, a karta podpisu jest dołączona do dokumentu."
  },
  {
    "id": "FLD-SIGN-TSA",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D4.1 (TSA obowiązkowy) i D6 (EuroCert, 2026-09-23); ryzyko R5 i R8; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M5",
    "statement": "Podpis otrzymuje kwalifikowany znacznik czasu (RFC 3161) od EuroCert, osadzony przy dokumencie i weryfikowalny niezależnie od nas."
  },
  {
    "id": "FLD-SIGN-REMOTE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D4.2; blokowane pytaniami prawnymi z D5; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M5, etap 5",
    "statement": "Klient podpisuje zdalnie ze strony publicznej otwieranej z linku w mailu; link jest jednorazowy, wygasający i o wysokiej entropii."
  },
  {
    "id": "FLD-SIGN-REMOTE-OTP",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D4.2 rozstrzygnięte 2026-09-21 (OTP obowiązkowy w trybie zdalnym, na miejscu nie); SMSAPI — pole nadawcy gotowe",
    "statement": "Podpis zdalny wymaga kodu SMS wysłanego na numer klienta; kod wiąże kliknięcie w link z numerem telefonu."
  },
  {
    "id": "FLD-SIGN-DELIVERY-PROOF",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D13 (Mailtrap, 2026-09-21); zależność Z1 (wysyłka powiadomień)",
    "statement": "Doręczenie linku do podpisu jest udokumentowane zdarzeniem delivery od dostawcy poczty, zapisanym jako dowód."
  },
  {
    "id": "FLD-SIGN-ABUSE-GUARD",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Ryzyko R3 (strona publiczna, skutek prawny); przegląd rls-security-auditor przed wdrożeniem",
    "statement": "Publiczna ścieżka podpisu jest chroniona przed nadużyciem: limit prób, ochrona przed enumeracją tokenów i osobny przegląd bezpieczeństwa przed wdrożeniem."
  },
  {
    "id": "FLD-SIGN-DURABLE-COPY",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D5 pytanie prawne 2 (trwały nośnik) — ZALEŻNE OD OPINII PRAWNIKA; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M5",
    "statement": "Klient otrzymuje kopię podpisanego dokumentu na trwałym nośniku w formie rozstrzygniętej przez opinię prawną."
  },
  {
    "id": "FLD-AUDIT-LEAD-CREATE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D14 rozstrzygnięte 2026-09-21 (lead od audytora W ZAKRESIE); luka nr 6 w docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 4",
    "statement": "Audytor zakłada leada bezpośrednio w terenie dla klienta, który nie przeszedł przez Triage — to drugie, świadomie dopuszczone wejście do maszyny stanów lejka."
  },
  {
    "id": "FLD-AUDIT-FORM",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "K7 (moc wpisywana, nie wyliczana); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M7",
    "statement": "Audytor wypełnia na miejscu formularz audytu pomieszczenie po pomieszczeniu: nazwa, moc jednostki, notatki, zdjęcia."
  },
  {
    "id": "FLD-AUDIT-INSTALL-TYPE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "FNL-2PHASE kryt. 2 (nośnik istnieje od migracji 20260916060000, BRAKUJE ŚCIEŻKI ZAPISU); luka nr 1 w docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 4",
    "statement": "Audytor ustawia na miejscu tryb montażu (jednoetapowy albo dwuetapowy) — to jest ścieżka zapisu, której FNL-2PHASE kryt. 2 nie ma od 2026-09-16."
  },
  {
    "id": "FLD-QUOTE-BASKET-SELECT-AUDITOR",
    "domain": "field",
    "status": "TODO",
    "risk": "LOW",
    "source": "FLD-QUOTE-BASKET-SELECT (DONE dla dyspozytora w panelu, 2026-09-16, ścieżka audytora odłożona wprost); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M7",
    "statement": "Audytor wybiera koszyk czasu trwania wizyty w aplikacji terenowej, korzystając z tego samego słownika co dyspozytor w panelu."
  },
  {
    "id": "FLD-QUOTE-VARIANTS",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "K2; D8 potwierdzone 2026-09-23 (zaliczka = netto x (1 + stawka VAT obiektu) x 1,1); ryzyko R16; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M7",
    "statement": "Oferta zawiera od jednego do trzech wariantów; klient wybiera jeden, a kwota zaliczki liczy się z wybranego wariantu."
  },
  {
    "id": "PRICE-LIST-SCHEMA",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D15 = A (pełny kalkulator) i D16; docs/architecture/CENNIK-ROBOCIZNY.md (39 pozycji); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M9",
    "statement": "Cennik kosztorysowy żyje w bazie (price_list_items): koszt zakupu osobno od ceny sprzedaży, kategoria, jednostka miary, zasięg pozycji i wersjonowanie ceny w czasie."
  },
  {
    "id": "PRICE-LIST-IMPORT",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "Z2 — cennik dostarczony 2026-09-23: docs/architecture/cennik-robocizny.csv (39 pozycji); plan §4.3 pkt 2 (ujednolicenie kategorii MR/RM)",
    "statement": "Cennik robocizny importuje się z dostarczonego arkusza do price_list_items, z ujednoliceniem kategorii i zachowaniem podziału na zasięgi."
  },
  {
    "id": "PRICE-LIST-ADMIN",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D15 rozszerzenie pkt 2 (cennik prowadzi administrator, nie programista); ekran /settings/pricing",
    "statement": "Administrator prowadzi cennik wyceny w ustawieniach panelu B2B: dodaje pozycje i zmienia ceny, a każda zmiana ceny jest nową wersją."
  },
  {
    "id": "STD-INSTALL-CONFIG",
    "domain": "crm",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D15 rozszerzenie pkt 3 (montaż standardowy jako dane, nie tekst); ryzyko R19; ekran /settings/standard-installation",
    "statement": "Montaż standardowy jest konfiguracją w bazie zbudowaną z pozycji cennika i ich ilości — jedno źródło ilości dla Triage i dla oferty audytora."
  },
  {
    "id": "B2C-TRIAGE-PRICE-FROM-PRICE-LIST",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D15 rozszerzenie pkt 1 (jeden cennik dla audytora i Triage); ryzyko R18 (cena publiczna rośnie ok. dwukrotnie)",
    "statement": "Triage liczy cenę montażu z tego samego cennika i konfiguracji montażu standardowego co audytor, zamiast z pozycji „Montaż wzorcowy\" i literału 1200 zł."
  },
  {
    "id": "FLD-QUOTE-CALC",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D15 = A; D8; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M9",
    "statement": "Silnik wyceny liczy pozycje razy ilości, sumę netto i brutto, marżę na pozycji oraz kwotę zaliczki."
  },
  {
    "id": "FLD-QUOTE-ROOMS",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D17 rozstrzygnięte 2026-09-23 (formularz w dwóch częściach; 23 pozycje ROOM); docs/architecture/CENNIK-ROBOCIZNY.md",
    "statement": "Pierwsza część formularza wyceny to pozycje przypisane do pomieszczeń: audytor dodaje pomieszczenie i uzupełnia przy nim ilości pozycji o zasięgu ROOM."
  },
  {
    "id": "FLD-QUOTE-GENERAL-ITEMS",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D17 rozstrzygnięte 2026-09-23 (pozycji ogólnych NIE BYŁO NIGDZIE — ani w planie, ani w wymaganiach; realna luka); 16 pozycji INSTALLATION",
    "statement": "Druga część formularza wyceny to pozycje ogólne całej instalacji, niededykowane żadnemu pomieszczeniu."
  },
  {
    "id": "PRICE-VAT-RATE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D16 i D17 rozstrzygnięte 2026-09-23 (stawka z obiektu; próg 300 m2 w kontrakcie SLA); R21 zamknięte",
    "statement": "Stawka VAT wynika z rodzaju obiektu: lokal mieszkalny do 300 m2 to 8%, powyżej 300 m2 to 23%, lokal usługowy zawsze 23%."
  },
  {
    "id": "FLD-QUOTE-MANUAL-ITEM",
    "domain": "field",
    "status": "TODO",
    "risk": "LOW",
    "source": "D15; plan §4.3 (pozycje indywidualne wyłączone z automatu); docs/architecture/CENNIK-ROBOCIZNY.md pkt 5",
    "statement": "Audytor dodaje do oferty pozycję indywidualną spoza cennika (stelaż, zwyżka) z opisem i ceną wpisaną ręcznie."
  },
  {
    "id": "FLD-QUOTE-PRICE-SNAPSHOT",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D15 (rekomendacja: zamrożenie cen od pierwszej wysłanej oferty); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M9",
    "statement": "Wysłana oferta i wycena z Triage pamiętają ceny z dnia wystawienia; późniejsza zmiana cennika nie zmienia tego, co klient dostał."
  },
  {
    "id": "FLD-CONTRACT-GENERATE",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D5 (pakiet dokumentów, wzory robocze w docs/legal/); ryzyko R17 (lorem ipsum nie może wyjść do klienta)",
    "statement": "Umowa montażu powstaje z zaakceptowanej oferty na wzorze z docs/legal/, z jawnym numerem wersji wzorca."
  },
  {
    "id": "DOC-LEGAL-VERSION-REGISTRY",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "Luka opisana w docs/legal/README.md; D5; docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 6.3",
    "statement": "Wersje dokumentów prawnych dla KLIENTA są rejestrowane w bazie, tak jak wersje dokumentów pracowniczych w legal_document_versions."
  },
  {
    "id": "INV-PROFORMA",
    "domain": "funnel",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D9 krok 1 rozstrzygnięte 2026-09-23 (proforma albo wezwanie do zapłaty przed wpłatą); inFakt",
    "statement": "Przed wpłatą klient dostaje proformę albo wezwanie do zapłaty — dokument, który nie jest fakturą w rozumieniu VAT."
  },
  {
    "id": "INV-ADVANCE-AUTO",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D9 krok 2 rozstrzygnięte 2026-09-23 (faktura zaliczkowa automatycznie po wpłacie); ryzyko R15 (podwójna faktura przy ponowionym webhooku); rozstrzygnięcie Michała 2026-09-23: zapis automatyczny przechodzi przez can(), a nie obok niego",
    "statement": "Faktura zaliczkowa wystawia się automatycznie po zaksięgowaniu wpłaty, bez udziału człowieka, dokładnie raz na płatność."
  },
  {
    "id": "INV-FINAL",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D9 krok 3 rozstrzygnięte 2026-09-23 (faktura rozliczeniowa po montażu, przy dwuetapowym po etapie II); S7",
    "statement": "Faktura rozliczeniowa wystawia się przy zamknięciu montażu (T09) i domyka VAT od pozostałej kwoty."
  },
  {
    "id": "PAY-DEPOSIT-LINK",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D8; styk z Pakietem Dodatkowym A roadmapy (PayU); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 5 M8",
    "statement": "Klient dostaje link do płatności zaliczki, a zaksięgowanie wpłaty jest zdarzeniem uruchamiającym fakturę zaliczkową."
  },
  {
    "id": "FLD-PHOTO-SET-PHASE-ONE",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D7 rozstrzygnięte 2026-09-23 (etap I: trasy przed zakryciem + manometr próby azotem); docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md rozdz. 3 D7",
    "statement": "Zamknięcie etapu I montażu dwuetapowego wymaga własnego, mniejszego kompletu zdjęć: tras instalacji przed zakryciem oraz manometru próby azotem."
  },
  {
    "id": "B2C-PROPERTY-AREA-BAND",
    "domain": "b2c",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "D17 rozstrzygnięte 2026-09-23 (pytanie warunkowe o przedział powierzchni, bez wpisywania metrażu); R20 zamknięte",
    "statement": "Triage pyta o przedział powierzchni lokalu (do 300 m2 / powyżej 300 m2) wyborem z listy, wyłącznie dla nieruchomości mieszkalnych."
  },
  {
    "id": "FLD-API-IDEMPOTENCY-REGISTRY",
    "domain": "field",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D-API-1 rozstrzygnięte 2026-09-24 (rejestr CENTRALNY, nie per-endpoint); docs/workorders/FLD-API-LAYER.md sekcja WYMAGA DECYZJI; warunek 3 z ADR-013",
    "statement": "Wszystkie zapisy z aplikacji terenowej przechodzą przez JEDEN centralny rejestr kluczy idempotencji, w którym wiersz klucza powstaje jako pierwszy krok transakcji wykonującej operację."
  },
  {
    "id": "SEC-ACCESS-DENIED-LOG",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "D-API-2 rozstrzygnięte 2026-09-24 (OSOBNY nośnik, nie audit_log); docs/workorders/FLD-API-LAYER.md sekcja WYMAGA DECYZJI; kryterium 3 z FLD-API-LAYER („odmowa can() zostawia ślad\")",
    "statement": "Odmowa dostępu wobec uwierzytelnionego aktora zostawia ślad w osobnym dzienniku security_events, a nie w rejestrze RODO audit_log."
  },
  {
    "id": "NTF-TEMPLATE-STORE",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Decyzja Michała 2026-09-24 (szablony wędrują do bazy i stają się edytowalne w panelu); kryterium NTF-CATALOG-PARITY, które OD ZAWSZE mówi o tabeli message_templates, podczas gdy implementacja trzymała stałą w TypeScript",
    "statement": "Treści szablonów powiadomień mieszkają w wersjonowanej tabeli message_templates i są edytowalne z panelu; edycja tworzy nową wersję, opublikowana wersja jest zamrożona."
  },
  {
    "id": "NTF-QUEUE-RENDERED-BODY",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Decyzja Michała 2026-09-24; stan stwierdzony w packages/database/prisma/schema.prisma (model NotificationQueue) — wiersz trzyma payload i template_key, ale NIE trzyma tekstu, który poszedł",
    "statement": "Wiersz kolejki zapisuje wyrenderowaną treść wiadomości oraz wersję szablonu w momencie kolejkowania."
  },
  {
    "id": "NTF-QUEUE-CLAIM",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Recenzja gałęzi feat/ntf-gateway (bloker: dispatcher pobiera, wysyła, dopiero potem oznacza); decyzja Michała 2026-09-24 o rozszerzeniu CHECK-a notification_queue_status_check o SENDING",
    "statement": "Dispatcher przejmuje wiersz kolejki atomowo przed wysyłką, przez stan pośredni SENDING — dwa równoległe uruchomienia nie mogą wysłać tej samej wiadomości dwa razy."
  },
  {
    "id": "NTF-DISPATCH-CRON",
    "domain": "notifications",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Decyzja Michała 2026-09-24 (zamiatacz kolejki na pg_cron po stronie Supabase); stan rozszerzeń potwierdzony na ŻYWEJ bazie 2026-09-24",
    "statement": "Wysyłkę z kolejki wyzwala zamiatacz czasowy oparty o pg_cron po stronie Supabase; zakolejkowanie pozostaje zdarzeniowe, w transakcji ze zmianą statusu."
  },
  {
    "id": "SEC-WEBHOOK-SECRET-REQUIRED",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Znalezisko 2026-09-24 w apps/b2b-web/src/app/api/webhooks/services-cron/route.ts:13-17 oraz .../shipping/route.ts:25-29. Zweryfikowane: żadna z dwóch zmiennych (CRON_SECRET, SHIPPING_WEBHOOK_SECRET) nie jest ustawiona w żadnym pliku .env w repozytorium",
    "statement": "Publiczny endpoint chroniony sekretem odmawia dostępu, gdy sekret nie jest skonfigurowany — brak konfiguracji to odmowa, nigdy przepustka."
  },
  {
    "id": "B2C-SOFT-LEAD-CONSENT",
    "domain": "b2c",
    "status": "TODO",
    "risk": "HIGH",
    "source": "Potwierdzenie Michała 2026-09-24, że to luka RODO; gałąź feat/b2c-triage włącza zbieranie numeru telefonu na stronie lądowania; stan tabeli soft_leady potwierdzony odczytem information_schema na żywej bazie 2026-09-24",
    "statement": "Porzucony lead (soft lead) zapisuje się wyłącznie razem ze zgodą wskazującą KONKRETNĄ wersję dokumentu prawnego — tak samo jak lead pełny."
  },
  {
    "id": "QA-E2E-SUITE-REPAIR",
    "domain": "qa",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "Decyzja Michała 2026-09-24 o wpięciu E2E jako wymaganego statusu, poprzedzona naprawą pakietu; stan pakietu Playwright stwierdzony w recenzji (selektory wskazują na tekst, którego nie ma w komponentach)",
    "statement": "Pakiet E2E (Playwright) jest sprawny: testy faktycznie się uruchamiają, selektory wskazują na tekst istniejący w komponentach, a brak testów przestaje być traktowany jak sukces."
  },
  {
    "id": "QA-E2E-REQUIRED-CHECK",
    "domain": "qa",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "Decyzja Michała 2026-09-24 (E2E jako wymagany status bramki)",
    "statement": "Pakiet E2E jest wymaganym statusem bramki — czerwony pakiet blokuje merge."
  },
  {
    "id": "GATE-EVASION-DETECT",
    "domain": "security",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "Trzy wzorce omijania bramek znalezione w recenzjach 2026-09-24: sklejanie identyfikatorów ze stringów (feat/crm-cards), „prisma as unknown as SomeDynamicType\" (as any w przebraniu), test definiujący testowaną funkcję wewnątrz pliku testu (dwie gałęzie niezależnie)",
    "statement": "Bramka wykrywa udokumentowane wzorce jej omijania: sklejanie porzuconych identyfikatorów ze stringów oraz zdejmowanie typów Prismy podwójnym rzutowaniem."
  }
] as const;
