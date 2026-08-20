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
    'spec-analyst': ['.claude/state/', 'docs/workorders/'],
    'contract-steward': ['contracts/', 'packages/contracts/', 'packages/database/prisma/', 'supabase/migrations/', 'docs/architecture/generated/', '.claude/state/', 'tools/'],
    'test-author': ['tests/', 'e2e/', '__tests__/', '.claude/state/', 'apps/**/tests/', 'packages/**/tests/'],
    'implementer-server': ['apps/', 'packages/', '.claude/state/'],
    'implementer-ui': ['apps/', 'packages/ui/', '.claude/state/'],
    'e2e-runner': ['.claude/state/', 'test-results/'],
    'doc-scribe': ['docs/', '.claude/state/', 'README.md'],
    // reviewer i rls-security-auditor nie mają Write/Edit w ogóle (patrz frontmatter agenta)
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
    { id: 'green-sla', re: '(bg|border|text)-(green|emerald)-\\d{3}', appliesTo: 'apps/.*\\.(tsx)$', msg: 'ui_ux_guidelines.md §8.7: zakaz zielonych alertów SLA.' },
    { id: 'service-key', re: 'SUPABASE_SERVICE_ROLE_KEY|service_role', appliesTo: "(app|components|hooks)/.*\\.(tsx)$", msg: 'Klucz serwisowy nie może trafić do komponentu klienckiego.' },
    // ── ADR-008: audit_log jest append-only, rozstrzygnięte 2026-08-18 ──
    { id: 'adr008-audit-mutate', re: '(auditLog|audit_log)\\s*\\.\\s*(update|updateMany|delete|deleteMany|upsert)\\b|(UPDATE|DELETE)\\s+(FROM\\s+)?audit_log\\b', appliesTo: '\\.(ts|tsx|sql)$', msg: 'ADR-008: audit_log jest append-only. Rejestr, który da się zmienić, nie jest dowodem — a to administrator wykonuje operacje, które ten rejestr dokumentuje.' },

    // ── ADR-010: next_service_date jest polem pochodnym, rozstrzygnięte 2026-08-18 ──
    { id: 'adr010-derived-write', re: 'next_service_date\\s*:\\s*(?!undefined)|set\\s*\\(\\s*[\'\"]next_service_date', appliesTo: 'apps/.*\\.(ts|tsx)$', msg: 'ADR-010: next_service_date jest polem pochodnym, wyliczanym przy zamknięciu montażu. Termin wizyty zapisuje się w services i bookings.' },

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
