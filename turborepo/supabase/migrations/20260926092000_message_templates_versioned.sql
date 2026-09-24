-- ============================================================================
-- NTF-TEMPLATE-STORE — szablony powiadomień w bazie, wersjonowane i edytowalne w panelu
-- WYMAGANIE: NTF-TEMPLATE-STORE (contracts/requirements.contract.mjs)
-- Źródło decyzji: Michał, 2026-09-24 („szablony wędrują do bazy i stają się edytowalne
--                 w panelu, z wersjonowaniem wzorem legal_document_versions").
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHAMIANA na żadnej bazie. Napisana w oknie KK-IMPL-2026Q4 (2026-09-24).       ║
-- ║  Po uruchomieniu PRZEPISZ TEN NAGŁÓWEK na stan faktyczny (wzorzec: 20260915120000).   ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA: nowa tabela + indeksy + wyzwalacz. Zero DROP, zero RENAME,
-- zero ALTER na istniejącej tabeli, zero backfillu w tym pliku.
--
-- ── NAZWA TABELI NIE JEST WYBOREM PROJEKTOWYM ──
-- `message_templates` jest w RESOURCES (contracts/rbac.contract.mjs) od ADR-012, ma tam wiersz
-- w MATRIX (read: admin+dyspozytor, create/update/delete: admin) i jest nazwą, o której MÓWI
-- kryterium wymagania NTF-CATALOG-PARITY: „test kontraktowy porównuje katalog z tabelą
-- message_templates". Do 2026-09-24 był to zasób BEZ NOŚNIKA — potwierdzone odczytem
-- information_schema na żywej bazie tego dnia (tabela nie istniała), a treści szablonów
-- siedziały w stałej TypeScript. Kryterium było więc niewykonalne od dnia zapisania.
--
-- ── DLACZEGO WERSJONOWANIE, A NIE EDYCJA W MIEJSCU ──
-- Powód jest twardy i nie jest nim „dobra praktyka": dopóki szablon był stałą w kodzie, treść
-- wysłanej wiadomości dawała się odtworzyć z gita (klucz + payload + commit z dnia wysyłki).
-- Edytowalna tabela tę drogę zamyka — odtworzenie dałoby treść AKTUALNĄ, nie tę wysłaną.
-- Bez wersjonowania po pierwszej edycji nie da się odpowiedzieć na pytanie „co dokładnie
-- napisaliście klientowi 14 marca", a to pytanie pada w sporze o ofertę albo o termin.
-- Drugą połową tej samej odpowiedzi jest NTF-QUEUE-RENDERED-BODY (treść zapisana w wierszu
-- kolejki) — wersjonowanie samo w sobie nie wystarcza, bo nie mówi, KTÓREJ wersji użyto.
--
-- Kształt 1:1 z legal_document_versions (20260821130000): JEDEN WIERSZ TO JEDNA WERSJA.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- templateKey z katalogu powiadomień (contracts/notifications.contract.mjs NOTIFICATIONS),
  -- np. 'funnel.auditor_assigned'. Parzystości w obie strony pilnuje NTF-CATALOG-PARITY.
  template_key  TEXT NOT NULL,

  -- Numer wersji rosnący W OBRĘBIE (klucz, kanał) — jak version_no przy dokumentach prawnych.
  -- Nadawany przez Server Action, nie sekwencją: sekwencja globalna dawałaby jednemu szablonowi
  -- numery z dziurami po wersjach innego.
  version_no    INTEGER NOT NULL,

  -- Kanał: SMS i EMAIL tego samego powiadomienia to RÓŻNE treści (SMS ma limit znaków, EMAIL
  -- ma temat), więc sam klucz szablonu nie identyfikuje treści.
  channel       TEXT NOT NULL,

  -- Wypełniany dla EMAIL, NULL dla SMS i PUSH. To nie są brakujące dane, tylko kanał bez
  -- tego pojęcia — dlatego NULL, a nie pusty łańcuch.
  subject       TEXT,

  body          TEXT NOT NULL,

  -- published_at IS NULL = szkic. Szkic wolno edytować i usunąć; wersja opublikowana jest
  -- niezmienna (wyzwalacz niżej).
  published_at  TIMESTAMPTZ(6),

  -- „Obowiązująca teraz". Osobna flaga, a nie „najwyższy version_no", bo wycofanie się do
  -- poprzedniej treści musi być możliwe bez podmiany numeracji.
  is_current    BOOLEAN NOT NULL DEFAULT false,

  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT message_templates_version_no_positive CHECK (version_no > 0),

  -- Szkic nie może być wersją obowiązującą. Bez tego dałoby się wskazać jako obowiązującą
  -- treść, której administrator nigdy nie opublikował — i wysłać ją klientowi.
  CONSTRAINT message_templates_current_is_published
    CHECK (is_current = false OR published_at IS NOT NULL)
);

-- DOKŁADNIE JEDNA obowiązująca wersja na (klucz, kanał) w danym momencie. Częściowy indeks
-- unikalny, czyli sprawdzenie w BAZIE — dwa równoległe żądania publikacji nie mogą zostawić
-- dwóch obowiązujących wersji, bo drugie odbije się od indeksu. Kod „sprawdź, czy jest inna
-- obowiązująca, potem ustaw" przegrywa ten wyścig (pułapka nr 4 z CLAUDE.md).
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_current_per_key_key
  ON public.message_templates (template_key, channel)
  WHERE is_current;

-- Numeracja bez duplikatów w obrębie klucza i kanału.
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_key_channel_version_key
  ON public.message_templates (template_key, channel, version_no);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
-- Deny-by-default (wzorzec z 20260824185845). Dostęp przez Prismę z bramką can()
-- na message_templates — create/update wyłącznie admin, zgodnie z MATRIX.

-- ─────────────────────────────────────────────────────────────────────────────
-- Niezmienność wersji opublikowanej — wyzwalacz, nie dyscyplina Server Action
-- ─────────────────────────────────────────────────────────────────────────────
-- Wzorzec z legal_document_versions (20260821130000, punkt 4a) i z tego samego powodu:
-- Prisma omija RLS, więc baza jest OSTATNIĄ warstwą, która cokolwiek gwarantuje. Na
-- opublikowanym wierszu wolno przestawić WYŁĄCZNIE is_current (publikacja/wycofanie)
-- i updated_at. Treść, temat, klucz, kanał i numer są zamrożone w chwili publikacji.
-- Nowa treść = NOWA WERSJA, nigdy edycja starej.
CREATE OR REPLACE FUNCTION public.message_templates_freeze_published()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.published_at IS NULL THEN
    RETURN NEW;  -- szkic: edycja dozwolona
  END IF;

  IF NEW.template_key  IS DISTINCT FROM OLD.template_key
     OR NEW.channel      IS DISTINCT FROM OLD.channel
     OR NEW.version_no   IS DISTINCT FROM OLD.version_no
     OR NEW.subject      IS DISTINCT FROM OLD.subject
     OR NEW.body         IS DISTINCT FROM OLD.body
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
  THEN
    RAISE EXCEPTION
      'message_templates: wersja opublikowana jest niezmienna (NTF-TEMPLATE-STORE). Wolno przestawic wylacznie is_current. Nowa tresc = NOWA WERSJA — inaczej nie da sie odtworzyc, co wyslano klientowi.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_templates_freeze_published_trg ON public.message_templates;
CREATE TRIGGER message_templates_freeze_published_trg
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.message_templates_freeze_published();

COMMENT ON TABLE public.message_templates IS
  'NTF-TEMPLATE-STORE: tresci szablonow powiadomien, WERSJONOWANE wzorem legal_document_versions — jeden wiersz to jedna wersja. Edycja w panelu TWORZY NOWA WERSJE; wersja opublikowana jest zamrozona (message_templates_freeze_published_trg). Bez tego po pierwszej edycji nie da sie odpowiedziec, co dokladnie wyslano klientowi danego dnia. Nazwa tabeli pochodzi z RESOURCES (ADR-012) i z kryterium NTF-CATALOG-PARITY.';
COMMENT ON COLUMN public.message_templates.is_current IS
  'Wersja obowiazujaca teraz. Czesciowy indeks unikalny message_templates_current_per_key_key dopuszcza DOKLADNIE JEDNA taka wersje na (klucz, kanal).';
COMMENT ON COLUMN public.message_templates.channel IS
  'SMS i EMAIL tego samego powiadomienia to ROZNE tresci (limit znakow vs temat), wiec sam template_key nie identyfikuje tresci.';
COMMENT ON COLUMN public.message_templates.subject IS
  'Wypelniany dla EMAIL, NULL dla SMS i PUSH — kanal bez tego pojecia, a nie brakujace dane.';
COMMENT ON FUNCTION public.message_templates_freeze_published() IS
  'Na wierszu opublikowanym dopuszcza zmiane wylacznie is_current i updated_at. Dziala takze przeciw zapisowi Prisma, ktora omija RLS.';
