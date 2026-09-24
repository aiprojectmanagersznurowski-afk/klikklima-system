-- ============================================================================
-- NTF-QUEUE-CLAIM + NTF-QUEUE-RENDERED-BODY — stan przejęcia wiersza i zapis treści
-- WYMAGANIA: NTF-QUEUE-CLAIM, NTF-QUEUE-RENDERED-BODY (contracts/requirements.contract.mjs)
-- Źródło decyzji: Michał, 2026-09-24, po recenzji gałęzi feat/ntf-gateway (bloker: dispatcher
--                 pobiera oczekujące, wysyła, dopiero potem oznacza — dwa równoległe
--                 uruchomienia wysyłają ten sam SMS dwa razy).
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHAMIANA na żadnej bazie. Napisana w oknie KK-IMPL-2026Q4 (2026-09-24).       ║
-- ║  Po uruchomieniu PRZEPISZ TEN NAGŁÓWEK na stan faktyczny (wzorzec: 20260915120000).   ║
-- ║                                                                                        ║
-- ║  STAN ZASTANY POTWIERDZONY NA ŻYWEJ BAZIE 2026-09-24 (pg_get_constraintdef):          ║
-- ║  notification_queue_status_check => CHECK (status = ANY (ARRAY['PENDING','SENT',      ║
-- ║  'ERROR','DEAD_LETTER'])). Cztery wartości, zgodnie z 20260908065000.                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Zmiana ADDYTYWNA: nowe kolumny NULLOWALNE + ROZSZERZENIE słownika CHECK (piąta wartość
-- dochodzi, żadna nie znika). Zero DROP kolumn, zero RENAME, zero backfillu.
-- Rozszerzenie słownika nie wymaga backfillu, bo żaden istniejący wiersz nie przestaje
-- spełniać warunku — to jest ta sama klasa zmiany co 20260915120000 przy audit_log.
--
-- ════════════════════════════════════════════════════════════════════════════════════════
-- DLACZEGO POTRZEBNY JEST STAN POŚREDNI, A NIE „SPRAWDZENIE, CZY JUŻ WYSŁANE"
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Dzisiejszy dispatcher: SELECT status='PENDING' -> wyślij -> UPDATE status='SENT'.
-- Między SELECT a UPDATE mieści się DRUGI proces, który przeczyta ten sam wiersz jako PENDING
-- i wyśle tę samą wiadomość. Przy zamiataczu uruchamianym cronem (NTF-DISPATCH-CRON) nakładanie
-- się przebiegów jest NORMĄ, nie wypadkiem. To jest pułapka nr 4 z CLAUDE.md w wydaniu
-- kolejkowym: sprawdzenie w JS nie wystarcza, potrzebna jest blokada w bazie.
--
-- NAPRAWĄ JEST ATOMOWE PRZEJĘCIE WIERSZA, a nie kolejna flaga:
--     UPDATE notification_queue SET status='SENDING', claimed_at=now()
--      WHERE id = $1 AND status='PENDING';
-- i wysyłka WYŁĄCZNIE gdy liczba zmienionych wierszy = 1. Przegrany wyścig dostaje 0 i nie
-- robi nic. Rozstrzyga baza, nie kolejność wywołań.
--
-- SENDING MUSI BYĆ OSOBNYM STANEM. Gdyby przejęcie ustawiało od razu SENT, awaria dostawcy SMS
-- zostawiłaby wiersz oznaczony jako wysłany, którego NIKT nie wysłał — czyli zamieniłaby duble
-- (widoczne, wkurzające klienta) na ciche gubienie wiadomości (niewidoczne, gorsze).
--
-- CENA, KTÓRĄ TRZEBA ZNAĆ I OBSŁUŻYĆ: wiersz w SENDING po awarii procesu (kill, timeout,
-- restart kontenera) zostaje w tym stanie NA ZAWSZE i nikt go nie podejmie. Dlatego dochodzi
-- kolumna claimed_at — „SENDING starszy niż próg wraca do PENDING" jest CZĘŚCIĄ NTF-QUEUE-CLAIM,
-- a nie ulepszeniem na później. Bez tego mechanizm przejęcia zamienia duble na wiadomości,
-- których nikt nigdy nie wyśle.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Treść wyrenderowana i wersja szablonu (NTF-QUEUE-RENDERED-BODY)
-- ─────────────────────────────────────────────────────────────────────────────
-- Wszystkie kolumny NULLOWALNE, bo tabela ma dane produkcyjne, a kolumna NOT NULL bez wartości
-- domyślnej na istniejącej tabeli jest zabroniona. Backfill NIE ISTNIEJE i nie da się go
-- wymyślić: wiersze zakolejkowane przed tą zmianą nie mają zapisanej treści, a odtworzenie jej
-- dziś dałoby treść z AKTUALNEGO szablonu — czyli dokładnie to kłamstwo, któremu ta zmiana
-- ma zapobiegać. Puste pole uczciwie znaczy „nie wiemy".
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS rendered_body       TEXT,
  ADD COLUMN IF NOT EXISTS rendered_subject    TEXT,
  ADD COLUMN IF NOT EXISTS template_version_id UUID,
  ADD COLUMN IF NOT EXISTS claimed_at          TIMESTAMPTZ(6);

-- FK do wersji szablonu, RESTRICT: wersji, na którą powołuje się wysłana wiadomość, nie wolno
-- usunąć — ten sam wybór i to samo uzasadnienie co przy employee_consents.version_id.
--
-- OSŁONIĘTY to_regclass, bo migracja 20260926092000 tworząca message_templates może NIE BYĆ
-- jeszcze uruchomiona przy ręcznym odpaleniu poza kolejnością na produkcji (precedens:
-- 20260910101000 puszczone przed wcześniejszym timestampowo 20260910100000). W świeżym replayu
-- wg nazw plików tabela istnieje i FK powstaje; przy uruchomieniu poza kolejnością migracja
-- NIE WYWRACA SIĘ, tylko zostawia NOTICE. Stan końcowy po obu plikach jest w obu porządkach
-- identyczny, pod warunkiem ponownego przebiegu tego bloku — dlatego jest idempotentny.
DO $$
BEGIN
  IF to_regclass('public.message_templates') IS NULL THEN
    RAISE NOTICE 'message_templates jeszcze nie istnieje — FK notification_queue.template_version_id NIE zalozony. Uruchom 20260926092000, a potem ponownie ten plik.';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notification_queue_template_version_id_fkey'
       AND conrelid = to_regclass('public.notification_queue')
  ) THEN
    ALTER TABLE public.notification_queue
      ADD CONSTRAINT notification_queue_template_version_id_fkey
      FOREIGN KEY (template_version_id)
      REFERENCES public.message_templates(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Rozszerzenie słownika statusów o SENDING (NTF-QUEUE-CLAIM)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cztery istniejące wartości przepisane DOSŁOWNIE z migracji źródłowej 20260908065000,
-- nie z pamięci — ta sama dyscyplina co przy audit_log_resource_check (20260915120000),
-- gdzie odtwarzanie listy „mniej więcej" byłoby cichym skasowaniem wartości.
--
-- TEXT + CHECK, a nie natywny ENUM — wybór z 20260908065000 zostaje i właśnie się opłacił:
-- ALTER TYPE ... ADD VALUE nie działa w tej samej transakcji co reszta migracji, a CHECK
-- aktualizuje się jednym ALTER-em. Gdyby status był enumem, ta zmiana byłaby dwoma plikami.
ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_status_check;

ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_status_check CHECK (status IN (
    'PENDING', 'SENDING', 'SENT', 'ERROR', 'DEAD_LETTER'
  ));

-- Indeks pod przejmowanie wierszy: dispatcher pyta o PENDING gotowe do wysyłki, a zamiatacz
-- wierszy osieroconych pyta o SENDING starsze niż próg. Jeden indeks (status, claimed_at)
-- obsługuje obie strony.
CREATE INDEX IF NOT EXISTS notification_queue_status_claimed_at_idx
  ON public.notification_queue (status, claimed_at);

COMMENT ON COLUMN public.notification_queue.status IS
  'PENDING|SENDING|SENT|ERROR|DEAD_LETTER. Slownik pochodzi z QUEUE_POLICY.statuses (contracts/notifications.contract.mjs), nie z literalu w kodzie. SENDING (2026-09-24) to STAN PRZEJECIA WIERSZA: dispatcher przejmuje atomowo (UPDATE ... WHERE status=''PENDING'') i wysyla wylacznie gdy zmieniono 1 wiersz — bez tego dwa rownolegle uruchomienia wysylaja ten sam SMS dwa razy (NTF-QUEUE-CLAIM).';
COMMENT ON COLUMN public.notification_queue.claimed_at IS
  'Moment przejecia wiersza przez dispatcher. Istnieje WYLACZNIE po to, zeby dalo sie odzyskac wiersze osierocone: proces zabity miedzy przejeciem a wysylka zostawia wiersz w SENDING, ktorego nikt nie podejmie. „SENDING starsze niz prog wraca do PENDING" jest czescia NTF-QUEUE-CLAIM.';
COMMENT ON COLUMN public.notification_queue.rendered_body IS
  'Tresc WYRENDEROWANA w chwili kolejkowania (NTF-QUEUE-RENDERED-BODY). Po przeniesieniu szablonow do edytowalnej tabeli message_templates tresci NIE DA SIE juz odtworzyc z gita — odtworzenie daloby tresc aktualna, nie te wyslana. NULL dla wierszy sprzed tej migracji: backfill nie istnieje i uczciwie znaczy „nie wiemy".';
COMMENT ON COLUMN public.notification_queue.rendered_subject IS
  'Temat dla EMAIL; NULL dla SMS i PUSH — kanal bez tego pojecia, a nie brakujace dane.';
COMMENT ON COLUMN public.notification_queue.template_version_id IS
  'Wersja szablonu UZYTA do wyrenderowania (FK RESTRICT do message_templates). Zapisywana OBOK tresci, nie zamiast niej: sam numer wymagalby dolaczania do tabeli wersji przy kazdym pytaniu, a tresc bez numeru nie mowi, ktora wersje widzial wtedy administrator.';
