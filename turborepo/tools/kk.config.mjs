/**
 * Jedyne miejsce, w którym opisujemy topologię repo.
 * Dostosuj ścieżki do swojego turborepo — reszta kitu (hooki, codegen, trace, verify) czyta stąd.
 */
export const config = {
  // Ścieżki względem katalogu głównego repo
  contractsDir: 'contracts',
  generatedTsDir: 'packages/contracts/src/generated',
  generatedDocsDir: 'docs/architecture/generated',
  architectureDocsDir: 'docs/architecture',
  stateDir: '.claude/state',

  // Ścieżki chronione — zmiana wymaga otwartego okna kontraktowego (patrz /kk-contract)
  contractProtectedPaths: [
    'contracts/',
    'packages/contracts/src/generated/',
    'packages/database/prisma/schema.prisma',
    'supabase/migrations/',
  ],

  // Uprawnienia zapisu per rola agenta (egzekwowane przez .claude/hooks/guard-paths.mjs)
  agentWriteScopes: {
    'spec-analyst': ['.claude/state/', 'docs/workorders/', '.claude/agent-memory/'],
    'contract-steward': ['contracts/', 'packages/contracts/', 'packages/database/prisma/', 'supabase/migrations/', 'docs/architecture/generated/', '.claude/state/', 'tools/', '.claude/agent-memory/'],
    'test-author': ['tests/', 'e2e/', '__tests__/', '.claude/state/', 'apps/**/tests/', 'packages/**/tests/'],
    'implementer-server': ['apps/', 'packages/', '.claude/state/'],
    'implementer-ui': ['apps/', 'packages/ui/', '.claude/state/'],
    'e2e-runner': ['.claude/state/', 'test-results/'],
    'doc-scribe': ['docs/', '.claude/state/', 'README.md'],
    // reviewer i rls-security-auditor: frontmatter obu deklaruje `tools` BEZ Write/Edit, ale
    // efektywnie je dostają. Dopóki nie było ich tutaj, guard-paths nie ograniczał ich WCALE
    // (`scopes` undefined => sprawdzenie pomijane), więc agenci opisani jako „tylko do odczytu"
    // byli jedynymi, którzy mogli pisać w całym repozytorium. Zweryfikowane 2026-08-20:
    // reviewer zapisał trzy pliki w .claude/agent-memory/reviewer/. Wąski zakres zamyka tę
    // odwrotność, zostawiając im pamięć, z której realnie korzystają między turami.
    'reviewer': ['.claude/agent-memory/'],
    'rls-security-auditor': ['.claude/agent-memory/'],
  },

  // Ścieżki testowe — implementerom nie wolno ich dotykać
  testPathPatterns: ['/tests/', '/e2e/', '/__tests__/', '.test.', '.spec.'],

  // Wzorce zakazane w kodzie aplikacji (guard-forbidden.mjs)
  forbiddenPatterns: [
    { id: 'ts-ignore', re: '@ts-(ignore|expect-error)', appliesTo: '\\.(ts|tsx)$', msg: 'Wyciszanie typów zamiast naprawy. Zgłoś problem w Work Order, nie ukrywaj go.' },
    { id: 'as-any', re: '\\bas\\s+any\\b', appliesTo: '\\.(ts|tsx)$', msg: 'engineering_standards.md §Types: opieramy się na typach generowanych przez Prisma, bez rzutowania.' },
    { id: 'skipped-test', re: '\\b(it|test|describe)\\.(skip|only)\\b', appliesTo: '\\.(ts|tsx)$', msg: 'Wyłączony lub wyizolowany test. Bramka RED/GREEN traci sens.' },
    { id: 'hardcoded-hex', re: '#[0-9a-fA-F]{6}\\b', appliesTo: 'apps/.*\\.(tsx|css)$', msg: 'ui_ux_guidelines.md §2: zakaz hardkodowania kolorów — użyj tokenów Tailwind.', allowIn: ['globals.css', 'tailwind.config', 'theme'] },
    { id: 'non-lucide-icons', re: "from\\s+['\\\"](react-icons|@heroicons|@fortawesome)", appliesTo: '\\.(tsx)$', msg: 'ui_ux_guidelines.md §1: wyłącznie lucide-react.' },
    // Zawężone 2026-09-01 (WO BATCH-MEDIUM-LOW-CLEANUP punkt 19b). Reguła łapała KAŻDĄ zieleń
    // w apps/**/*.tsx, więc blokowała neutralny badge statusu „Zakończone" (COMPLETED) i ikonę
    // CheckCircle2 w menu — a zakaz z ui_ux_guidelines §8.7 dotyczy WYŁĄCZNIE alertów SLA.
    // Zieleń jako kolor statusu jest dozwolona; zieleń jako sygnał „SLA w normie" nie jest,
    // bo zrównuje brak przekroczenia terminu z sukcesem i wygasza czujność dyspozytora.
    // Dlatego wymagamy współwystąpienia w tej samej linii sygnału kontekstu SLA.
    { id: 'green-sla', re: '^(?=.*(SLA|sla|Sla|overdue|Overdue|deadline|Deadline|przetermin|Przetermin|opoznien|Opoznien|opóźnien|Opóźnien|daysLeft|daysTo|differenceInDays|slaAlert|slaStatus)).*(bg|border|text)-(green|emerald)-\\d{3}', appliesTo: 'apps/.*\\.(tsx)$', msg: 'ui_ux_guidelines.md §8.7: zakaz zielonych alertów SLA. (Zieleń jako neutralny kolor statusu jest dozwolona — ta reguła wymaga sygnału kontekstu SLA w tej samej linii.)' },
    { id: 'service-key', re: 'SUPABASE_SERVICE_ROLE_KEY|service_role', appliesTo: "(app|components|hooks)/.*\\.(tsx)$", msg: 'Klucz serwisowy nie może trafić do komponentu klienckiego.' },
    // ── ADR-008: audit_log jest append-only, rozstrzygnięte 2026-08-18 ──
    { id: 'adr008-audit-mutate', re: '(auditLog|audit_log)\\s*\\.\\s*(update|updateMany|delete|deleteMany|upsert)\\b|(UPDATE|DELETE)\\s+(FROM\\s+)?audit_log\\b', appliesTo: '\\.(ts|tsx|sql)$', msg: 'ADR-008: audit_log jest append-only. Rejestr, który da się zmienić, nie jest dowodem — a to administrator wykonuje operacje, które ten rejestr dokumentuje.' },

    // ── ADR-010: next_service_date jest polem pochodnym, rozstrzygnięte 2026-08-18 ──
    // Zawężone 2026-09-01 (WO BATCH-MEDIUM-LOW-CLEANUP punkt 19b). Reguła dopasowywała samą nazwę
    // kolumny w dowolnym kontekście, więc traktowała ODCZYT jak zapis: deklarację typu
    // (`next_service_date: Date;`), filtr `where` (`next_service_date: { gte: … }`), sortowanie
    // (`next_service_date: 'asc'`) i przepisanie odczytanej wartości (`next_service_date: inst.next_service_date`).
    // Wykluczone są wyłącznie te cztery kształty ODCZYTU — każdy zapis wartości (null, new Date(),
    // zmienna, literał) nadal jest blokowany, bo o to w ADR-010 chodzi.
    // UWAGA na backtracking: `\\s*` PRZED lookaheadem nie działa jako wykluczenie — silnik
    // cofa je do zera znaków i sprawdza lookahead tuż za dwukropkiem, gdzie stoi spacja,
    // więc każdy wykluczony kształt i tak przechodził. Odstęp MUSI być wewnątrz lookaheadu.
    { id: 'adr010-derived-write', re: 'next_service_date\\s*:(?!\\s*(?:undefined|true|false|[\'\"]asc[\'\"]|[\'\"]desc[\'\"]|\\{|Date\\b))(?!.*\\.next_service_date)|set\\s*\\(\\s*[\'\"]next_service_date', appliesTo: 'apps/.*\\.(ts|tsx)$', msg: 'ADR-010: next_service_date jest polem pochodnym, wyliczanym przy zamknięciu montażu. Termin wizyty zapisuje się w services i bookings.' },

    // ── ADR-002: nazewnictwo rozstrzygnięte 2026-08-18. Porzucone nazwy polskie. ──
    { id: 'adr002-pl-tables', allowInWriteHook: true, re: '\\b(leady|klienci|adresy|audytorzy|zespoly_monterskie|serwisy|usterki_incidents|logistyka_zamowienia|instalacje|cennik_uslug|modele_3d)\\b', appliesTo: '\\.(ts|tsx|sql|prisma)$', msg: 'ADR-002: nazwa porzucona. Słownik przekładu: docs/architecture/NAMING.md.' },
    { id: 'adr002-pl-columns', allowInWriteHook: true, re: '\\b(imie_i_nazwisko|telefon_kontaktowy|zdjecie_url|zdjecia_z_montazu|zdjecia_wideo_url|certyfikat_fgaz|uprawnienia_sep|data_rezerwacji|data_planowana|data_zakonczenia|data_wysylki|status_akceptacji|status_platnosci|status_wysylki|uwagi_monterskie|uwagi_serwisowe|opis_problem_klienta|firma_kurierska|liczba_brygad|odpowiedzi_triage|wycena_items|finalna_wycena_pln|price_netto|set_price_netto|klient_id|zespol_id|instalacja_id|adres_id|audytor_id|wazna_do|priorytet)\\b', appliesTo: '\\.(ts|tsx|sql|prisma)$', msg: 'ADR-002: kolumna po polsku. Słownik przekładu: docs/architecture/NAMING.md.' },
    { id: 'adr002-camel-column', re: '@map\\(\"[a-z]+[A-Z]', appliesTo: '\\.(prisma)$', msg: 'ADR-002: @map musi wskazywać na snake_case, nie camelCase.' },

    // ── ADR-003: katalog powiadomień rozstrzygnięty 2026-08-18. ──
    { id: 'adr003-notif-literal', re: "['\\\"]N(1?[0-9]|[0-9])a?['\\\"]", appliesTo: 'apps/.*\\.(ts|tsx)$', msg: 'ADR-003: ID powiadomienia jako literał. Importuj z packages/contracts/src/generated/notifications — kolizja N1..N4 wzięła się dokładnie z luźnych stringów.' },
    { id: 'adr002-template-var', re: '\\{\\{\\s*(imie|nazwisko|adres|godzina|data|data_waznosci|numer_zlecenia|typ_certyfikatu|osoba_lub_zespol|kwota|telefon)\\s*\\}\\}', appliesTo: '\\.(ts|tsx|md|html)$', msg: 'ADR-002: zmienna szablonu po polsku. Słownik: docs/architecture/NAMING.md.', allowIn: ['NAMING.md', 'CHANGES-ADR-', '01-ADR-spec-conflicts.md'] },

    // ── ADR-001: stos rozstrzygnięty 2026-08-18. Odrzucone: tRPC, React Query, Drizzle, Vite. ──
    { id: 'adr001-trpc', re: "from\\s+['\\\"]@trpc/", appliesTo: '\\.(ts|tsx)$', msg: 'ADR-001: tRPC odrzucone. Mutacje wyłącznie przez Server Actions.' },
    { id: 'adr001-react-query', re: "from\\s+['\\\"]@tanstack/react-query", appliesTo: '\\.(ts|tsx)$', msg: 'ADR-001: React Query odrzucone. Optimistic UI przez useOptimistic (React 19). Wyjątek na złożony polling wymaga zgody człowieka i zmiany w kk.config.mjs.' },
    { id: 'adr001-drizzle', re: "from\\s+['\\\"]drizzle-orm", appliesTo: '\\.(ts|tsx)$', msg: 'ADR-001: Prisma jest jedynym ORM-em. Dwa ORM-y = dwa niekompatybilne zestawy typów.' },
    { id: 'adr001-api-route', re: 'export\\s+(async\\s+)?function\\s+(GET|POST|PUT|PATCH|DELETE)\\b', appliesTo: 'apps/.*/app/api/.*route\\.(ts)$', msg: 'engineering_standards.md §2 + ADR-001: brak API routes dla logiki wewnętrznej. Webhooki zewnętrzne (Stripe/P24, kurier, Polar) to wyjątek — dopisz ścieżkę do allowIn.', allowIn: ['app/api/webhooks/'] },
    // ── ADR-011: progi SLA wyłącznie z kontraktu, blokująco od 2026-08-18 ──
    { id: 'magic-sla', re: '(differenceInDays|differenceInHours|daysUntil|hoursSince)\\s*\\([^)]*\\)\\s*(<|>|<=|>=|===)\\s*\\d+', appliesTo: 'apps/.*\\.(ts|tsx)$', msg: 'ADR-011: próg SLA jako literał. Importuj nazwaną politykę z @klikklima/contracts/sla — cztery różne mechanizmy nazywały się „SLA" i to jest sposób, w jaki próg z jednego trafiał do drugiego.', allowIn: ['packages/contracts/'] },
    { id: 'magic-sla-hour', re: '(getHours\\(\\)|hour)\\s*(>=|>|===)\\s*16\\b', appliesTo: 'apps/.*\\.(ts|tsx)$', msg: 'ADR-011: godzina alertu instalacyjnego to SLA.INSTALL_DAY_ALERT.hourOfDay, nie literał 16.' },
    { id: 'magic-sla-days', re: '\\b(14|30|48)\\s*\\*\\s*24\\s*\\*\\s*60|\\b48\\s*\\*\\s*60\\s*\\*\\s*60', appliesTo: 'apps/.*\\.(ts|tsx)$', msg: 'ADR-011: okres SLA przeliczany z literału. Użyj nazwanej polityki z kontraktu.' },

    // ══════════════════════════════════════════════════════════════════════════════════════
    // WYKRYWANIE OMIJANIA BRAMEK (2026-09-24, wymaganie GATE-EVASION-DETECT)
    //
    // Te dwie reguły różnią się w zamiarze od wszystkich powyższych. Tamte pilnują DECYZJI
    // (ADR-001, ADR-002, ADR-008…) i łamie się je przez nieuwagę. Te pilnują SAMEJ BRAMKI
    // i łamie się je CELOWO — każdy z dwóch wzorców pochodzi z realnej gałęzi, nie z rozważań
    // o tym, co ktoś mógłby zrobić. Dlatego komunikat mówi wprost, że rzecz wygląda na obejście:
    // jeżeli w danym przypadku obejściem nie jest, to jest to rozmowa z człowiekiem i wpis
    // w allowIn, a nie cicha zmiana kodu tak, żeby regex przestał trafiać.
    //
    // ROZSZERZENIE TYCH REGUŁ JEST OBJĘTE TĄ SAMĄ DYSCYPLINĄ CO REGUŁY WALIDATORA: każda ma
    // stałą sondę w tools/kk-selftest.mjs (sekcja SONDY REGUŁ TREŚCIOWYCH), w tym sondę
    // NEGATYWNĄ. Reguła bez sondy negatywnej jest regułą, która zostanie wyciszona.
    // ══════════════════════════════════════════════════════════════════════════════════════

    // WZORZEC 1 (gałąź feat/crm-cards): identyfikator sklejony z kawałków, żeby skaner
    // nazewnictwa go nie zobaczył — `const TBL = ['kli','enci'].join('')`.
    //
    // DYSKRYMINATOR JEST WĄSKI I ŚWIADOMY: łapiemy wyłącznie join z PUSTYM separatorem oraz
    // konkatenację dwóch literałów BEZ SPACJI. Powód: `['a','b'].join(', ')` buduje tekst dla
    // człowieka i jest całkowicie legalne, a `'Witaj, ' + imie` to zwykła interpolacja. Sklejenie
    // pustym separatorem daje JEDEN identyfikator i nie ma innego zastosowania niż to, żeby
    // nazwa nie wystąpiła w pliku dosłownie. Reguła celuje w MECHANIZM, nie w listę porzuconych
    // nazw — zawężenie do dzisiejszego słownika (leady, klienci…) umarłoby po cichu w dniu,
    // w którym ktoś sklei nazwę spoza niego.
    //
    // allowIn NA ŚCIEŻKI TESTOWE JEST KONIECZNE, NIE WYGODNE — i jest znanym ograniczeniem:
    // dwa istniejące testy (no-as-any-odpowiedzi-triage.test.ts, chat-ai-input.test.ts) używają
    // DOKŁADNIE tego mechanizmu w celu legalnym — budują zakazany token (`['an','y'].join('')`),
    // żeby plik testu asertujący o zakazie sam się o ten zakaz nie odbił. Bez wyłączenia reguła
    // byłaby czerwona od pierwszego dnia na kodzie, który jest poprawny. CENA: obejście ukryte
    // w pliku testowym nie zostanie złapane. To jest akceptowalne, bo skaner nazewnictwa pilnuje
    // identyfikatorów PRODUKCYJNYCH — a tam reguła działa bez wyłączeń.
    { id: 'gate-evasion-split-identifier', re: '\\[\\s*(?:[\'"][A-Za-z_][A-Za-z0-9_]{0,15}[\'"]\\s*,\\s*)+[\'"][A-Za-z_][A-Za-z0-9_]{0,15}[\'"]\\s*\\]\\s*\\.\\s*join\\(\\s*(?:\'\'|"")\\s*\\)|[\'"][A-Za-z_][A-Za-z0-9_]*[\'"]\\s*\\+\\s*[\'"][A-Za-z_][A-Za-z0-9_]*[\'"]', appliesTo: '\\.(ts|tsx)$', allowIn: ['/tests/', '.test.', '.spec.', '/e2e/'], msg: 'Identyfikator sklejany z kawałków (join z pustym separatorem albo konkatenacja dwóch literałów bez spacji). To wygląda na omijanie skanera nazewnictwa (ADR-002) — nazwa nie występuje w pliku dosłownie, więc kk-naming jej nie widzi. Napisz nazwę wprost. Jeżeli to naprawdę nie jest obejście, dopisz ścieżkę do allowIn tej reguły ŚWIADOMIE, a nie przepisuj kodu tak, żeby regex przestał trafiać.' },

    // WZORZEC 2: `prisma as unknown as SomeDynamicType` — `as any` w przebraniu.
    //
    // Podwójne rzutowanie przez `unknown` zdejmuje typy Prismy z CAŁEGO pliku (od tego miejsca
    // każde wywołanie klienta jest nietypowane), a regułę `as-any` omija, bo nie zawiera słowa
    // `any`. Skutek jest gorszy niż przy `as any` w jednym miejscu: tamto widać w recenzji, to
    // wygląda na porządne typowanie.
    //
    // REGUŁA JEST CELOWO WĄSKA I TO JEST ROZSTRZYGNIĘCIE, NIE NIEDBAŁOŚĆ: `as unknown as`
    // SAMO W SOBIE ma w tym repozytorium ~20 zastosowań LEGALNYCH, w przeważającej części
    // w testach, które celowo podsuwają wartość niepoprawnego typu, żeby sprawdzić walidację
    // po stronie serwera (`undefined as unknown as string`, `badWeekday as unknown as number`).
    // Zakaz całej konstrukcji byłby maszynką do fałszywych alarmów, czyli regułą do wyciszenia.
    // Łapiemy zatem dwa kształty i tylko je: rzutowanie czegoś o nazwie zawierającej `prisma`
    // oraz rzutowanie NA typ prismowy. Oba miały w repozytorium ZERO wystąpień w chwili
    // dodania reguły (sprawdzone 2026-09-24), więc reguła wchodzi jako blokująca, a nie jako
    // ostrzeżenie do posprzątania kiedyś.
    { id: 'gate-evasion-prisma-recast', re: '\\b\\w*[Pp]risma\\w*\\s+as\\s+unknown\\s+as\\b|\\bas\\s+unknown\\s+as\\s+\\w*(?:Prisma|Delegate)\\w*\\b', appliesTo: '\\.(ts|tsx)$', msg: 'Podwójne rzutowanie klienta Prismy przez unknown (`prisma as unknown as X`). To jest `as any` w przebraniu: zdejmuje typy Prismy z całego pliku, a regułę as-any omija, bo nie zawiera słowa any. Opieramy się na typach generowanych przez Prismę (engineering_standards.md §Types) — jeżeli typ nie pasuje, to jest problem do zgłoszenia w Work Orderze, nie do rzutowania.' },
  ],

  // Komendy blokowane w Bashu agenta
  forbiddenBashPatterns: [
    { re: 'rm\\s+-rf\\s+(/|~|\\$HOME|\\*)', msg: 'Rekurencyjne kasowanie poza katalogiem roboczym.' },
    { re: 'git\\s+push\\s+(-f|--force)(?!-with-lease)', msg: 'Force push. Użyj --force-with-lease i tylko na swojej gałęzi.' },
    { re: 'git\\s+(checkout|switch)\\s+(main|master)\\s*$', msg: 'Praca bezpośrednio na gałęzi głównej.' },
    { re: 'prisma\\s+migrate\\s+reset', msg: 'Reset bazy. Wykonaj to sam, świadomie, na lokalnej instancji.' },
    { re: 'supabase\\s+db\\s+reset', msg: 'Reset bazy Supabase.' },
    { re: 'DROP\\s+(TABLE|DATABASE|SCHEMA)', msg: 'DDL kasujący dane.' },
    { re: 'npm\\s+publish|pnpm\\s+publish', msg: 'Publikacja pakietu.' },
    { re: 'vercel\\s+(deploy|--prod)', msg: 'Deployment. Wdrożenie zostaje po stronie człowieka.' },
  ],
};

export default config;
