// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const REQUIREMENT_IDS = ["FNL-E1-E2", "FNL-E2-E3", "FNL-E3-E4", "FNL-E3-BUCKET", "FNL-E4-E5", "FNL-E5-E6", "FNL-E5-BYPASS", "FNL-E6-E7", "FNL-E7-E8", "FNL-ROLLBACK", "FNL-ROLLBACK-EXIT", "FNL-NO-ILLEGAL-TRANSITIONS", "CRM-KLI-AC1", "CRM-KLI-AC2", "CRM-KLI-AC3", "CRM-INST-AC1", "CRM-INST-AC2", "CRM-SRV-TRIGGER", "CRM-UST-AC1", "CRM-UST-AC2", "CRM-UST-AC3", "CRM-AUDYT-AC1", "CRM-AUDYT-AC2", "CRM-AUDYT-AC3", "CRM-ZESP-AC1", "CRM-ZESP-AC2", "CRM-ZESP-AC3", "CRM-ZIMNE-AC1", "CRM-ZIMNE-AC2", "CRM-ZIMNE-AC3", "CRM-BOOK-HISTORY", "CRM-REGION-AUTO", "FNL-2PHASE", "FNL-2PHASE-BOOKING", "FNL-2PHASE-INVOICE", "NTF-PUSH-TOKEN", "NTF-I7-SLA", "SRV-SOURCE-OF-TRUTH", "SRV-REMINDER-ONCE", "CRM-ZESP-REP", "CRM-DELETE-ADMIN-ONLY", "CRM-CREW-UPDATE-ADMIN-ONLY", "CRM-CONTEXT-MENU", "SLA-QUOTE-14D", "SLA-LOG-COLORS", "UI-SLA-NO-GREEN", "UI-NO-HARDCODED-COLORS", "UI-ICONS-LUCIDE-ONLY", "UI-FORMS-RHF-ZOD", "SRV-NEXT-DATE", "SEC-SSO-GUARD", "SEC-AUTHZ-USER-MGMT", "SEC-RLS-AUDITOR-SCOPE", "SEC-ASSIGNMENT-POOL-MINIMIZE", "SEC-LEADS-LIST-MINIMIZE", "CRM-LEAD-UPDATE-ADMIN-DISPATCHER", "SEC-SERVICE-KEY-SERVER-ONLY", "SEC-RODO-DELETE", "SEC-AUDIT-LOG", "NTF-QUEUE-WINDOW", "NTF-POLY", "NTF-HISTORY", "NTF-RETRY", "NTF-CATALOG-PARITY", "B2C-LEAD-ENTRY", "B2C-LEAD-ATOMIC", "B2C-BOOKING-SLOT", "B2C-CONSENT-RODO", "B2C-RLS-PUBLIC", "B2C-TRIAGE-STEPS", "B2C-TRIAGE-DISQUALIFY", "B2C-TRIAGE-CONDITIONAL", "B2C-SOFT-LEAD", "B2C-BOOKING-VALIDATION", "B2C-PRICE-FROM", "B2C-CATALOG-LIST", "B2C-DEVICE-MODAL", "B2C-CONTENT-PAGES", "B2C-NAV-STATE", "FLD-GEO-COORDS", "FLD-GEO-UNLOCK", "FLD-GEO-EN-ROUTE", "FLD-GPS-RODO", "FLD-AUTH-BLOCKED", "FLD-CONSENT-ACCEPT", "FLD-LEGAL-DOC-VERSION", "FLD-AVAIL-SELF", "FLD-AVAIL-RESTORE", "FLD-PHOTO-SET"] as const;
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
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "b2b_funnel_process.md#etap-5",
    "statement": "Akcja „Wysłano kurierem\" z Tracking ID przenosi leada do E6."
  },
  {
    "id": "FNL-E5-BYPASS",
    "domain": "logistics",
    "status": "TODO",
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
    "status": "TODO",
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
    "risk": "MEDIUM",
    "source": "b2b_crm_specifications.md#1",
    "statement": "Zmiana danych kontaktowych na Karcie 360 propaguje się do aktywnych leadów."
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
    "source": "b2b_crm_specifications.md#5",
    "statement": "Audytor jest auto-przypisywany na podstawie kodu pocztowego adresu."
  },
  {
    "id": "FNL-2PHASE",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-005",
    "statement": "Mieszkanie w stanie deweloperskim realizowane jest w dwóch etapach: przygotowanie instalacji przed wykończeniem, montaż jednostek po wykończeniu."
  },
  {
    "id": "FNL-2PHASE-BOOKING",
    "domain": "funnel",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-005",
    "statement": "Każdy etap montażu ma własną rezerwację terminu — klient rezerwuje etap II dopiero po zakończeniu etapu I."
  },
  {
    "id": "FNL-2PHASE-INVOICE",
    "domain": "funnel",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-005",
    "statement": "Po zakończeniu etapu I klient otrzymuje fakturę za ten etap."
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
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_crm_specifications.md#globalne",
    "statement": "Akcja „Usuń\" we WSZYSTKICH 7 widokach CRM dostępna wyłącznie dla roli admin."
  },
  {
    "id": "CRM-CREW-UPDATE-ADMIN-ONLY",
    "domain": "security",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "review 2026-08-25 (luka znaleziona przy przeglądzie apps/b2b-web/src/app/(dashboard)/crews/actions.ts) — brak źródła w dokumentach architektury; regułę niesie wyłącznie macierz w contracts/rbac.contract.mjs (crews.update = [admin]), która była poprawna, zanim powstało to wymaganie, bo kod akcji nigdy do niej nie zajrzał — ten sam wzorzec błędu co SEC-AUTHZ-USER-MGMT, inny zasób",
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
    "status": "TODO",
    "risk": "HIGH",
    "source": "b2b_app_requirements.md#epic-5",
    "statement": "Audytor widzi wyłącznie zlecenia przypisane do siebie; dyspozytor widzi wszystko."
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
    "status": "TODO",
    "risk": "HIGH",
    "source": "review 2026-08-25 (przegląd apps/b2b-web/src/app/(dashboard)/leads/actions.ts, funkcja getLeads()) — brak źródła w dokumentach architektury; ta sama zasada minimalizacji danych po stronie odczytu, z której żyje SEC-ASSIGNMENT-POOL-MINIMIZE, tyle że zastosowana do zapytania listy leadów. Poprzednie wymaganie zostawiło ten przeciek świadomie i nazwało go wprost jako osobne ID — to jest to ID. Dostęp do listy jest już poprawnie ograniczony rolą i zakresem audytora (SEC-RLS-AUDITOR-SCOPE), więc nie jest to luka RBAC i nie naprawia się jej macierzą uprawnień",
    "statement": "Widok listy leadów (getLeads() w leads/actions.ts) przekazuje przez granicę serwer/klient wyłącznie te pola, które leads-client.tsx faktycznie renderuje — nigdy surowego zagnieżdżonego rekordu Prismy. Dziś zapytanie woła findMany() z include całych relacji: klienta, adresu, instalacji wraz z ekipą, więc do przeglądarki dyspozytora jedzie komplet danych kontaktowych KAŻDEGO klienta na stronie (numer telefonu, e-mail) oraz komplet danych rozliczeniowych ekipy (numer konta bankowego, numer NIP, telefon kontaktowy, e-mail), a także współrzędne geograficzne adresu. Konsument czyta z tych trzech relacji dokładnie trzy wartości: nazwę klienta (kolumna o porzuconej nazwie polskiej, przekład w docs/architecture/NAMING.md → full_name), adres w postaci ulicy z miastem (→ street_city) i nazwę ekipy pierwszej instalacji (→ name). Skala odróżnia ten przypadek od widoku szczegółów: strona listy oddaje do pięćdziesięciu kompletów danych osobowych naraz, komuś, kto otworzył ekran po to, żeby zobaczyć statusy."
  },
  {
    "id": "CRM-LEAD-UPDATE-ADMIN-DISPATCHER",
    "domain": "security",
    "status": "TODO",
    "risk": "HIGH",
    "source": "review 2026-08-25 (luka znaleziona przy przeglądzie apps/b2b-web/src/app/(dashboard)/leads/[id]/actions.ts) — brak źródła w dokumentach architektury; regułę niesie wyłącznie macierz w contracts/rbac.contract.mjs (leads.update = [admin, dyspozytor]), która była poprawna, zanim powstało to wymaganie, bo kod tego pliku nigdy do niej nie zajrzał — czwarte wystąpienie wzorca SEC-AUTHZ-USER-MGMT / CRM-CREW-UPDATE-ADMIN-ONLY, tym razem w pliku BLIŹNIACZYM wobec już naprawionego: leads/actions.ts sprawdza rolę w trzech akcjach, leads/[id]/actions.ts w żadnej",
    "statement": "Zmiana rekordu leada z widoku szczegółów jest dostępna dla ról admin ORAZ dyspozytor — nie jest to bramka admin-only — i jest egzekwowana po stronie serwera przed jakimkolwiek zapytaniem do bazy. Dotyczy dwóch Server Actions, które dziś nie mają ŻADNEGO sprawdzenia roli: updateLeadAuditor (przypisanie/odpięcie audytora, pociągające za sobą zmianę statusu leada) i updateLeadData (nadpisanie danych kontaktowych klienta, adresu i estymowanej wyceny). Dowolne zalogowane konto — w tym monter i audytor spoza sprawy — może dziś przez bezpośrednie wywołanie tych akcji podmienić audytora dowolnego leada, cofnąć jego status albo nadpisać telefon i e-mail klienta. Reguła obowiązuje każdą kolejną akcję zapisującą do rekordu leada w tym pliku, nie tylko te dwie."
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
    "status": "TODO",
    "risk": "HIGH",
    "source": "database_model.md#4",
    "statement": "Usunięcie klienta (RODO) anonimizuje dane kontaktowe, zachowując wartość zrealizowanego montażu."
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
    "statement": "Ukończony Triage tworzy leada w stanie NEW_LEAD — to jedyne legalne wejście do maszyny stanów lejka."
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
    "status": "TODO",
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
    "status": "TODO",
    "risk": "HIGH",
    "source": "field_app_requirements.md#4.2",
    "statement": "Pracownik terenowy sam deklaruje własną niedostępność, a deklaracja jest rozłączna z blokadą administracyjną (is_active) i ze statusem kadrowym (leave_status), których właścicielem pozostaje administrator."
  },
  {
    "id": "FLD-AVAIL-RESTORE",
    "domain": "field",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "field_app_requirements.md#4.2",
    "statement": "Powrót pracownika do statusu dostępnego przywraca wcześniej wprowadzoną dostępność bez ponownego jej wprowadzania (D3)."
  },
  {
    "id": "FLD-PHOTO-SET",
    "domain": "field",
    "status": "BLOCKED",
    "risk": "MEDIUM",
    "source": "field_app_requirements.md#8",
    "statement": "Zamknięcie montażu wymaga kompletu dokładnie czterech zdjęć: jednostka wewnętrzna, jednostka zewnętrzna, budynek z oddali, odpływ skroplin."
  }
] as const;
