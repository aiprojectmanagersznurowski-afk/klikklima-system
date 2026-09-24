-- ============================================================================
-- FLD-API-IDEMPOTENCY-REGISTRY — centralny rejestr kluczy idempotencji Field App
-- WYMAGANIE: FLD-API-IDEMPOTENCY-REGISTRY (contracts/requirements.contract.mjs)
-- Źródło decyzji: D-API-1 rozstrzygnięte 2026-09-24 (docs/workorders/FLD-API-LAYER.md,
--                 sekcja WYMAGA DECYZJI); warunek 3 z ADR-013.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHAMIANA na żadnej bazie. Napisana w oknie KK-IMPL-2026Q4 (2026-09-24).       ║
-- ║  Po uruchomieniu PRZEPISZ TEN NAGŁÓWEK na stan faktyczny — wzorzec cyklu opisany      ║
-- ║  przy 20260915120000 (napisana jako niezaaplikowana -> uruchomiona -> nagłówek        ║
-- ║  przepisany). Nagłówek mylący w którąkolwiek stronę już raz kosztował w tym repo.     ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA: nowa tabela, zero DROP, zero RENAME, zero ALTER na
-- istniejącej tabeli, zero backfillu (tabela jest nowa i pusta z definicji).
--
-- ── DLACZEGO REJESTR JEST JEDEN, A NIE PO JEDNYM NA ENDPOINT ──
-- ADR-013 warunek 3 mówi „każdy zapis z urządzenia niesie klucz idempotencji", ale nie mówi,
-- GDZIE ten klucz mieszka. Dopóki nie mieszka nigdzie, każdy endpoint rozwiązuje to po swojemu:
-- jeden kolumną UNIQUE na tabeli docelowej, drugi sprawdzeniem w kodzie, trzeci wcale. Jeden
-- rejestr znaczy jedna reguła i jedno miejsce, w którym da się ją sprawdzić testem.
--
-- ── MECHANIZM, KTÓREGO NIE WOLNO ZAMIENIĆ NA „SPRAWDŹ, POTEM ZRÓB" ──
-- Wiersz klucza wstawia się JAKO PIERWSZY KROK transakcji wykonującej operację. Blokadą jest
-- SAMO `INSERT`: dwa równoległe żądania z tym samym kluczem kolidują na UNIQUE natychmiast,
-- zanim którekolwiek wykona pracę. Wariant „SELECT, czy klucz istnieje; jeśli nie — wykonaj;
-- na koniec zapisz klucz" przegrywa wyścig, bo między SELECT a INSERT mieści się drugie
-- żądanie — to jest pułapka nr 4 z CLAUDE.md, ta sama co przy rezerwacji slotu.
--
-- ── CZEGO TU ŚWIADOMIE NIE MA ──
-- Tabela NIE jest dopisana do RESOURCES w contracts/rbac.contract.mjs ani do CHECK-a
-- audit_log_resource_check. To infrastruktura TRANSPORTU, nie zasób biznesowy: wiersz jest
-- zużytym biletem na powtórzenie żądania, nie danymi, do których ktoś ma albo nie ma prawa.
-- Nikt go nie czyta z panelu, nie ma ekranu, nie ma odczytu przez can().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.field_request_idempotency (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Klucz nadany NA URZĄDZENIU (FLD-OFFLINE-OUTBOX). UNIQUE jest tu CAŁYM mechanizmem
  -- wzajemnego wykluczania, a nie zabezpieczeniem pomocniczym — patrz nagłówek.
  idempotency_key   TEXT NOT NULL,

  -- Kto wykonał żądanie: e-mail z ZWERYFIKOWANEGO tokenu, NIGDY z treści żądania
  -- (kryterium 2 z FLD-API-LAYER). Tekst, a nie klucz obcy — „pracownik" nie jest dziś encją
  -- (audytorzy i zespoly_monterskie to dwie niepowiązane tabele), a ten rejestr nie jest
  -- dowodem, więc nie warto kupować za to polimorfizmu z CHECK num_nonnulls.
  actor_email       TEXT NOT NULL,

  -- Endpoint, którego dotyczyło żądanie. Ten sam klucz na DWÓCH różnych endpointach to błąd
  -- generatora na urządzeniu, a nie legalne powtórzenie — kolumna pozwala to rozpoznać.
  endpoint          TEXT NOT NULL,

  -- Odcisk treści żądania. TEN SAM KLUCZ Z INNYM request_hash TO JAWNY BŁĄD: odrzucamy
  -- żądanie komunikatem o konflikcie treści, nigdy nie nadpisujemy po cichu i nigdy nie
  -- zwracamy po cichu starej odpowiedzi. Bez tego kolizja kluczy (błąd generatora) zwracałaby
  -- telefonowi odpowiedź na CUDZE żądanie.
  request_hash      TEXT NOT NULL,

  -- Zapisana odpowiedź. Powtórzenie z tym samym kluczem I tym samym odciskiem oddaje TO,
  -- zamiast wykonywać operację drugi raz. Kolejka offline ponawia z definicji, więc
  -- powtórzenie jest przypadkiem NORMALNYM, nie błędem.
  response_body     JSONB,

  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT field_request_idempotency_idempotency_key_key UNIQUE (idempotency_key)
);

-- Obsługa zamiatania po upływie retencji (SLA.FIELD_IDEMPOTENCY_RETENTION = 30 dni).
-- To jedyna tabela w tym systemie, którą WOLNO czyścić w całości: wiersz po upływie okna
-- nie jest ani dowodem, ani danymi osobowymi.
CREATE INDEX IF NOT EXISTS field_request_idempotency_created_at_idx
  ON public.field_request_idempotency (created_at);

ALTER TABLE public.field_request_idempotency ENABLE ROW LEVEL SECURITY;
-- Brak CREATE POLICY: deny-by-default, ten sam wzorzec co notification_queue
-- (20260908065000) i reszta tabel Prisma-only z 20260824185845. Jedynym pisarzem jest
-- Prisma (rolbypassrls = true), a polityka bez wskazanego konsumenta supabase-js byłaby
-- zgadywanką, nie zabezpieczeniem.

COMMENT ON TABLE public.field_request_idempotency IS
  'FLD-API-IDEMPOTENCY-REGISTRY (D-API-1): centralny rejestr kluczy idempotencji dla CALEJ warstwy zapisu Field App. Wiersz klucza wstawiany JAKO PIERWSZY w tej samej transakcji co operacja — blokada to samo INSERT na UNIQUE, nie sprawdzenie w kodzie. NIE jest zasobem RBAC: infrastruktura transportu, nie byt uprawnieniowy.';
COMMENT ON COLUMN public.field_request_idempotency.request_hash IS
  'Odcisk tresci zadania. Ten sam klucz z INNYM odciskiem to jawny blad (konflikt tresci), nigdy ciche nadpisanie ani ciche zwrocenie starej odpowiedzi.';
COMMENT ON COLUMN public.field_request_idempotency.response_body IS
  'Zapisana odpowiedz. Powtorzenie z tym samym kluczem I odciskiem oddaje TO, zamiast wykonywac operacje drugi raz — kolejka offline ponawia z definicji.';
COMMENT ON COLUMN public.field_request_idempotency.actor_email IS
  'E-mail z ZWERYFIKOWANEGO tokenu, nigdy z tresci zadania (kryterium 2 z FLD-API-LAYER).';
COMMENT ON COLUMN public.field_request_idempotency.created_at IS
  'Podstawa retencji SLA.FIELD_IDEMPOTENCY_RETENTION (30 dni). Po tym czasie powtorzenie NIE jest juz rozpoznawane jako powtorzenie.';
