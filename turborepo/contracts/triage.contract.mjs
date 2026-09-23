/**
 * KONTRAKT: Słownictwo wejścia do lejka (Triage B2C).
 * Źródła: b2c_app_requirements.md (§1), docs/prompts/figma_triage_ui_prompt.md, ADR-005.
 *
 * Maszyna stanów zaczyna się od NEW_LEAD, ale nie opisuje, jak lead do tego stanu trafia.
 * Trafia stąd: z siedmiokrokowego formularza B2C. Dopóki jego słownik odpowiedzi żył w komponentach
 * (progi metrażu w Step3Sizes, typ budynku w store, próg pomieszczeń nigdzie), jedyny producent
 * NEW_LEAD był poza kontraktem — a zmiana progu w komponencie nie miała jak dotrzeć do testu ani do bazy.
 *
 * Ten plik jest źródłem prawdy dla:
 *   - kafelków odpowiedzi w kreatorze (etykiety PL),
 *   - kolumny leads.triage_answers (identyfikatory zapisywane w bazie),
 *   - reguł kierujących na ekran Eksperta zamiast na wycenę.
 *
 * Identyfikatory: angielskie SCREAMING_SNAKE_CASE (ADR-002). Polski wyłącznie w polu `pl`,
 * bo to jest treść widziana przez klienta, a nie identyfikator.
 */

/**
 * Progi metrażu pojedynczego pomieszczenia.
 * Wartości WIĄŻĄCE (decyzja człowieka 2026-08-19) — zgodne z tym, co dziś prezentuje kreator.
 * Granice są domknięte obustronnie i wyrażone w pełnych m²: `null` oznacza granicę otwartą.
 * Pasma muszą pokrywać oś bez dziur i bez zachodzenia — sprawdza to reguła R24 walidatora.
 */
export const ROOM_SIZE_BANDS = [
  { id: 'UP_TO_20',      pl: 'Do 20 m²',      minSqm: null, maxSqm: 20,   status: 'STABLE' },
  { id: 'FROM_21_TO_25', pl: '21-25 m²',      minSqm: 21,   maxSqm: 25,   status: 'STABLE' },
  { id: 'FROM_26_TO_35', pl: '26-35 m²',      minSqm: 26,   maxSqm: 35,   status: 'STABLE' },
  { id: 'OVER_35',       pl: 'Powyżej 35 m²', minSqm: 36,   maxSqm: null, status: 'STABLE' },
];

/**
 * Przedział powierzchni CAŁEGO LOKALU — pytanie warunkowe dodane 2026-09-23 (decyzja Michała D17).
 *
 * To NIE JEST to samo co ROOM_SIZE_BANDS. Tamte opisują metraż POJEDYNCZEGO POMIESZCZENIA i służą
 * doborowi mocy jednostki. Te opisują powierzchnię całego lokalu i służą WYŁĄCZNIE ustaleniu stawki
 * VAT (8% do progu, 23% powyżej — PRICE-VAT-RATE). Dwa różne pytania o metraż w jednym kreatorze
 * są mylące z natury, dlatego różnica jest wypowiedziana tutaj, a nie zostawiona do odgadnięcia.
 *
 * Wybór z DWÓCH KAFELKÓW, nigdy wpisywanie metrażu (D17) — klient zwykle nie zna powierzchni lokalu
 * na pamięć, a sumowanie powierzchni pomieszczeń dawałoby liczbę zaniżoną i podstawę do zarzutu
 * o zaniżenie stawki podatku. To zamyka ryzyko R20.
 *
 * Granica pochodzi z progu SLA.PROPERTY_AREA_VAT_THRESHOLD (300 m²) i NIE WOLNO jej tu powtórzyć
 * jako literału — gdyby księgowy zmienił próg, słownik i stawka muszą zmienić się jednym ruchem.
 * Dlatego pasma opisane są przez `boundary: 'BELOW_OR_EQUAL' | 'ABOVE'`, a nie przez liczby.
 */
export const PROPERTY_AREA_BANDS = [
  { id: 'UP_TO_300', pl: 'Do 300 m²',      boundary: 'BELOW_OR_EQUAL', status: 'STABLE' },
  { id: 'ABOVE_300', pl: 'Powyżej 300 m²', boundary: 'ABOVE',          status: 'STABLE' },
];

/** Typ nieruchomości — pytanie 1 kreatora. COMMERCIAL jest wartością dyskwalifikującą, patrz DISQUALIFICATION_RULES. */
export const BUILDING_TYPES = [
  { id: 'APARTMENT',  pl: 'Mieszkanie',       status: 'STABLE' },
  { id: 'HOUSE',      pl: 'Dom',              status: 'STABLE' },
  { id: 'COMMERCIAL', pl: 'Lokal komercyjny', status: 'STABLE' },
];

/**
 * Stan lokalu — deklaracja klienta zapisywana w `leads.declared_property_condition`.
 *
 * DECYZJA CZŁOWIEKA 2026-08-19: słownik ma trzy wartości. Kafelek „W trakcie remontu",
 * który kreator prezentował bez odpowiednika w enumie, dostaje wartość `RENOVATION`.
 *
 * `suggestsTwoPhase` to PRZESŁANKA DLA AUDYTORA, nie rozstrzygnięcie. Stąd taka nazwa, a nie
 * `isTwoPhase` ani kolumnowe `is_two_phase`: flaga mówi „przyjrzyj się temu na miejscu",
 * a nie „realizuj w dwóch etapach". Wiążącą decyzję podejmuje audytor, ustawiając
 * `quotes.installation_type` po oględzinach (FNL-2PHASE). To jest to samo rozstrzygnięcie,
 * które FNL-2PHASE deklaruje od strony wyceny — tutaj domknięte od strony wejścia do lejka.
 *
 * Konsekwencje, które muszą być widoczne w kryteriach akceptacji B2C-LEAD-ENTRY:
 *   - deklaracja trafia do bazy przy tworzeniu leada i jest widoczna dla audytora,
 *   - NIE wpływa na wycenę prezentowaną w Triage (B2C-PRICE-FROM pilnuje tego testem),
 *   - nie tworzy `installation_phases` ani nie ustawia trybu montażu.
 *
 * DŁUG MIGRACYJNY: `RENOVATION` nie istnieje jeszcze w enumie w bazie. Kontrakt opisuje zbiór
 * docelowy; migracja addytywna jest osobną pozycją i nie wchodzi w zakres tego okna.
 */
export const PROPERTY_CONDITIONS = [
  { id: 'FINISHED',        pl: 'Wykończony / Zamieszkany', suggestsTwoPhase: false, status: 'STABLE' },
  { id: 'RENOVATION',      pl: 'W trakcie remontu',        suggestsTwoPhase: true,  status: 'STABLE' },
  { id: 'DEVELOPER_SHELL', pl: 'Stan deweloperski',        suggestsTwoPhase: true,  status: 'STABLE' },
];

/**
 * Od tylu pomieszczeń instalacja przestaje być konfigurowalna samoobsługowo.
 * Próg mieszka tutaj, nie w komponencie i nie w teście — dokładnie jak progi SLA.
 */
export const ROOM_COUNT_EXPERT_THRESHOLD = 4;

/**
 * Pola odpowiedzi, na które wolno się powołać w regule dyskwalifikacji. `dictionary` wiąże pole ze słownikiem.
 *
 * WIDOCZNOŚĆ WARUNKOWA (`visibleWhen`) — dodana 2026-09-23 razem z PROPERTY_AREA_BAND (D17).
 * Do tej pory każde pole kreatora było zadawane zawsze i mechanizm warunku nie był potrzebny.
 * Nowe pytanie o powierzchnię lokalu ma sens wyłącznie dla nieruchomości mieszkalnych, bo lokal
 * komercyjny i tak nie dostaje automatycznej wyceny (reguła COMMERCIAL_PROPERTY kieruje go na ekran
 * eksperta), a stawkę 23% ma niezależnie od metrażu.
 *
 * Kształt celowo minimalny: `{ field, in: [...] }` — pole jest widoczne, gdy odpowiedź na wskazane
 * wcześniejsze pytanie należy do wymienionego zbioru. Brak klucza `visibleWhen` znaczy „zawsze
 * widoczne", więc cztery istniejące pola nie zmieniają zachowania.
 *
 * DLACZEGO TO NIE JEST DISQUALIFICATION_RULES: tamten mechanizm odpowiada na pytanie „czy w ogóle
 * wyceniamy tę konfigurację" i ma jedyny dozwolony skutek EXPERT_SCREEN. Tutaj chodzi o to, czy
 * ZADAĆ PYTANIE — kreator idzie dalej tak samo, niezależnie od odpowiedzi. Zlanie tych dwóch
 * mechanizmów oznaczałoby, że dołożenie pytania warunkowego wymaga dopisania reguły dyskwalifikującej,
 * czyli że każde nowe pytanie może przypadkiem wykluczyć klienta z wyceny. Z tego samego powodu NIE
 * rozszerzam DISQUALIFICATION_OPERATORS o operator `IN`: tamta lista opisuje operatory reguł
 * dyskwalifikujących i żadna reguła ich nie używa w tym znaczeniu.
 */
export const TRIAGE_FIELDS = [
  { id: 'BUILDING_TYPE',      kind: 'ENUM',   dictionary: 'BUILDING_TYPES' },
  { id: 'ROOM_COUNT',         kind: 'NUMBER', dictionary: null },
  { id: 'ROOM_SIZE_BAND',     kind: 'ENUM',   dictionary: 'ROOM_SIZE_BANDS' },
  { id: 'PROPERTY_CONDITION', kind: 'ENUM',   dictionary: 'PROPERTY_CONDITIONS' },
  { id: 'PROPERTY_AREA_BAND', kind: 'ENUM',   dictionary: 'PROPERTY_AREA_BANDS', visibleWhen: { field: 'BUILDING_TYPE', in: ['APARTMENT', 'HOUSE'] }, req: ['B2C-PROPERTY-AREA-BAND', 'PRICE-VAT-RATE'] },
];

export const DISQUALIFICATION_OPERATORS = ['EQUALS', 'GTE'];

/** Dokąd trafia klient, którego konfiguracji nie wyceniamy automatycznie. */
export const DISQUALIFICATION_OUTCOMES = ['EXPERT_SCREEN'];

/**
 * Reguły kierujące na ekran Eksperta zamiast na wycenę.
 * Dwie i tylko dwie (decyzja człowieka 2026-08-19). Reguła spełniona ⇒ kreator nie pokazuje ceny.
 */
export const DISQUALIFICATION_RULES = [
  {
    id: 'COMMERCIAL_PROPERTY',
    field: 'BUILDING_TYPE',
    operator: 'EQUALS',
    value: 'COMMERCIAL',
    outcome: 'EXPERT_SCREEN',
    pl: 'Lokal komercyjny wymaga indywidualnej oceny — nie wyceniamy go automatycznie.',
    req: ['B2C-TRIAGE-DISQUALIFY'],
    status: 'STABLE',
  },
  {
    id: 'ROOM_COUNT_AT_OR_ABOVE_THRESHOLD',
    field: 'ROOM_COUNT',
    operator: 'GTE',
    value: ROOM_COUNT_EXPERT_THRESHOLD,
    outcome: 'EXPERT_SCREEN',
    pl: 'Od czterech pomieszczeń dobór multisplitu wykracza poza automatyczną konfigurację.',
    req: ['B2C-TRIAGE-DISQUALIFY'],
    status: 'STABLE',
  },
];
