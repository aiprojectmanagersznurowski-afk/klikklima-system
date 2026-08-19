import { test, expect, type Page } from '@playwright/test';
import { ROOM_COUNT_EXPERT_THRESHOLD } from '@klikklima/contracts';

/**
 * WO: docs/workorders/B2C-TRIAGE-DISQUALIFY.md
 *
 * Zgodnie z poleceniem: ten plik NIE jest uruchamiany w fazie RED. `playwright.config.ts`
 * ma `webServer.command: 'npm run start'`, czyli wymaga działającego `next build`, a ten
 * najprawdopodobniej dziś pada — `@klikklima/contracts` eksportuje surowy TypeScript, a
 * `apps/b2c-web/next.config.ts` nie ma `transpilePackages`. Czerwień tego pliku zostanie
 * zweryfikowana w fazie VERIFY, po stronie implementera i e2e-runnera.
 *
 * Próg pomieszczeń jest ZAWSZE importowany z kontraktu i nigdy nie pojawia się jako
 * literał — łącznie z etykietami kafelków Step2Rooms, które są zbudowane z tej samej
 * reguły odmiany liczebnika co w `triage.spec.ts`, a nie z wpisanej na sztywno liczby.
 */

const roomsLabel = (count: number) =>
  `${count} ${count === 1 ? 'pomieszczenie' : count >= 5 ? 'pomieszczeń' : 'pomieszczenia'}`;

const BELOW_THRESHOLD = ROOM_COUNT_EXPERT_THRESHOLD - 1;
const AT_THRESHOLD = ROOM_COUNT_EXPERT_THRESHOLD;

// Wzorzec dowolnej kwoty w złotówkach, tak jak formatuje ją `fmt()` w DeviceModal
// i ekrany kreatora ("12 990 zł", "1234 zł"...). AC6 i AC19 zakazują tego wzorca.
const MONEY_PATTERN = /\d[\d\s]*\s*zł/;

const clickOption = async (page: Page, text: string) => {
  const locator = page.locator(`text="${text}"`).first();
  await expect(locator).toBeVisible({ timeout: 15000 });
  await locator.click({ force: true });
  await page.waitForTimeout(600); // Framer Motion — czas na wymianę komponentu, jak w triage.spec.ts
};

const fillSizesForRooms = async (page: Page, count: number, size = 'Do 20 m²') => {
  if (count === 1) {
    await clickOption(page, size);
    return;
  }
  for (let i = 0; i < count; i++) {
    const roomContainer = page.locator(`text=Pokój ${i + 1}`).locator('..');
    const btn = roomContainer.locator(`text="${size}"`).first();
    await expect(btn).toBeVisible();
    await btn.click({ force: true });
  }
  await clickOption(page, 'Dalej');
};

// Mechanika D3: kroki 1-5 są identyczne na obu ścieżkach, rozstrzygnięcie zapada
// dopiero w kroku 6 (Step6Loader). Po nim: Step7Success (cena) ALBO StepExpert.
const runQualifyingSteps = async (
  page: Page,
  { location, rooms, state = 'Wykończony', balcony = 'Tak' }: { location: string; rooms: number; state?: string; balcony?: string },
) => {
  await page.goto('/triage');
  await page.waitForLoadState('networkidle');

  await clickOption(page, location);
  await clickOption(page, roomsLabel(rooms));
  await fillSizesForRooms(page, rooms);
  await clickOption(page, state);

  if (location === 'Mieszkanie') {
    await clickOption(page, balcony);
  }
  // Dla Dom/Lokal komercyjny Step5Conditions pomija się sam (Step5Conditions.tsx,
  // useEffect: `if (state.location !== 'Mieszkanie') nextStep()`).
};

test.describe('Triage — dyskwalifikacja prowadzi na ekran Eksperta (D3, D6)', () => {
  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC1 — Lokal komercyjny (1 pomieszczenie) kończy się ekranem Eksperta, nigdy ekranem wyceny', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 1 });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).not.toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC1 — Lokal komercyjny (3 pomieszczenia) kończy się ekranem Eksperta, nigdy ekranem wyceny', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 3 });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).not.toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC2 — Mieszkanie z liczbą pomieszczeń = ROOM_COUNT_EXPERT_THRESHOLD kończy się ekranem Eksperta', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Mieszkanie', rooms: AT_THRESHOLD, balcony: 'Tak' });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC2 — Dom z liczbą pomieszczeń = ROOM_COUNT_EXPERT_THRESHOLD kończy się ekranem Eksperta', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Dom', rooms: AT_THRESHOLD });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC2 (kontrola negatywna) — ta sama ścieżka z ROOM_COUNT_EXPERT_THRESHOLD - 1 dociera do ekranu z ceną', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Dom', rooms: BELOW_THRESHOLD });

    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Cena z montażem (brutto)').first()).toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC3 — koniunkcja (Lokal komercyjny + próg pomieszczeń) daje JEDEN ekran Eksperta, nie dwa komunikaty', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: AT_THRESHOLD });

    // Jeden ekran: dokładnie jedno wystąpienie nagłówka, żadnej ceny.
    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText(MONEY_PATTERN);

    // Zbiór DWÓCH identyfikatorów reguł (COMMERCIAL_PROPERTY + ROOM_COUNT_AT_OR_ABOVE_THRESHOLD)
    // jest dowiedziony na poziomie jednostkowym: apps/b2c-web/tests/store/triageStore.test.ts,
    // test "koniunkcja obu reguł". Tutaj sprawdzamy WYŁĄCZNIE skutek w UI — jeden ekran.
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC4 (kontrola negatywna) — Mieszkanie i Dom poniżej progu docierają do ekranu z ceną', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Mieszkanie', rooms: BELOW_THRESHOLD, balcony: 'Tak' });

    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Cena z montażem (brutto)').first()).toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC6 — ekran Eksperta nie zawiera żadnej kwoty ani treści cenowej', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 1 });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });

    const expertScreen = page.locator('body');
    await expect(expertScreen).not.toContainText(MONEY_PATTERN);
    await expect(expertScreen).not.toContainText('Szacunkowy koszt');
    await expect(expertScreen).not.toContainText('brutto');
    await expect(expertScreen).not.toContainText('Wybieram ten zestaw');
    // "Cena" — uwaga: ekran zawiera frazę "dokładną wycenę", to NIE jest to samo
    // słowo i nie koliduje z tą asercją.
    await expect(expertScreen).not.toContainText('Cena');
    await expect(expertScreen).not.toContainText('Rezerwuj termin audytu');
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC5 — komunikat ekranu Eksperta wyświetla wartość progu, nie tekst "4 i więcej"', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 1 });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator(`text=/${ROOM_COUNT_EXPERT_THRESHOLD}\\s*i\\s*wi[eę]cej\\s*pomieszcze/i`),
    ).toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC10 — wejście z karty produktu (deep link) z roomsCount = próg prowadzi na ekran Eksperta', async ({ page }) => {
    const params = new URLSearchParams();
    params.set('series', 'TestSeries');
    params.set('roomsCount', String(AT_THRESHOLD));
    for (let i = 1; i <= AT_THRESHOLD; i++) params.set(`area_${i}`, 'M');

    await page.goto(`/triage?${params.toString()}`);
    await page.waitForLoadState('networkidle');

    // Krok 1 nadal się renderuje — wejście z karty produktu nie ma własnej mechaniki
    // (WO, Mechanika D3 pkt 6): dopiero wybór lokalizacji odpala `nextStep()`, który
    // przeskakuje z kroku 1 na 4, bo `selectedDeviceLine` jest już ustawiony z URL.
    await clickOption(page, 'Mieszkanie');
    await clickOption(page, 'Wykończony');
    await clickOption(page, 'Tak'); // balkon — krok 5, tylko dla Mieszkania

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).not.toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC11 — powrót z ekranu Eksperta wraca do ostatniego wypełnionego kroku, nie do kroku 1, i pozwala zakwalifikować się po korekcie', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Dom', rooms: AT_THRESHOLD });
    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });

    // Korekta nie prowadzi na krok 8 (formularz rezerwacji) — wraca do kreatora.
    await clickOption(page, 'Wróć i zmień odpowiedzi');
    await expect(page.locator('text=Wybierz termin darmowej wyceny')).not.toBeVisible();

    // Dom: krok 5 nie istnieje (Step5Conditions pomija się sam), więc ostatni wypełniony
    // krok to krok 4 (stan lokalu) — zmiana odpowiedzi na kroku 2 wymaga cofnięcia się
    // dalej. Test sprawdza, że odpowiedzi z kroku 1 (lokalizacja) NIE zostały skasowane:
    // stan lokalu jest nadal widoczny do zmiany, a kreator nie wrócił do kroku 1.
    await expect(page.locator('text=Gdzie chcesz zamontować klimatyzację?')).not.toBeVisible();
    await expect(page.locator('text=Jaki jest stan lokalu?')).toBeVisible();

    // Cofamy się jeszcze o dwa kroki (Metraż, Pomieszczenia), żeby dotrzeć do liczby
    // pomieszczeń i zmienić ją na wartość kwalifikującą.
    await page.locator('button:has-text("Wstecz")').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Wstecz")').click({ force: true });
    await page.waitForTimeout(600);
    await expect(page.locator('text=W ilu pomieszczeniach?')).toBeVisible();

    await clickOption(page, roomsLabel(BELOW_THRESHOLD));
    await fillSizesForRooms(page, BELOW_THRESHOLD);
    await clickOption(page, 'Wykończony');

    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible({ timeout: 20000 });
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC12 — pasek postępu i licznik kroków zachowują się identycznie na obu ścieżkach w krokach 1-5', async ({ page }) => {
    // Kontrprzykład z REVIEW: cofnięcie ProgressBar.tsx do
    // `progress = isExpertScreen ? 100 : ...` (zamiast `step === 7 && isExpertScreen`)
    // skoczyłoby na 100% już w kroku 2 na ścieżce dyskwalifikującej — bo `isExpertScreen`
    // przelicza się w store już przy pierwszej odpowiedzi. Licznik "Krok N / 8" tego NIE
    // złapałby, bo jest niezależny od `isExpertScreen`. Dlatego mierzymy geometrię paska
    // (fill/track), a nie tylko tekst licznika — i robimy to na OBU ścieżkach w TYCH
    // SAMYCH krokach, w jednym teście.
    //
    // Obie ścieżki startują od "Mieszkanie", żeby krok 5 (balkon) realnie istniał na
    // obu — dla "Lokal komercyjny"/"Dom" Step5Conditions pomija się sam (WO, Ryzyka pkt 5),
    // co uniemożliwiłoby porównanie kroku 5. Dyskwalifikacja zapada więc przez regułę
    // liczby pomieszczeń (ROOM_COUNT_AT_OR_ABOVE_THRESHOLD), nie COMMERCIAL_PROPERTY —
    // ta druga reguła jest już pokryta przez AC1/AC3/AC6/AC19 w tym pliku.
    type StepMeasurement = { label: string; ratio: number; backVisible: boolean; backEnabled: boolean };

    const measureAt = async (stepNum: number): Promise<StepMeasurement> => {
      const label = `Krok ${stepNum} / 8`;
      await expect(page.locator(`text=${label}`)).toBeVisible();

      const backButton = page.locator('button:has-text("Wstecz")');
      const backVisible = await backButton.isVisible();
      const backEnabled = backVisible && (await backButton.isEnabled());

      // Framer Motion animuje szerokość paska przez 500ms (ProgressBar.tsx,
      // `transition={{ duration: 0.5 }}`) — bez odczekania boundingBox() trafia
      // w połowę animacji. Ten sam wzorzec 600ms co w `clickOption` wyżej.
      await page.waitForTimeout(600);

      const track = page.locator('div.bg-border').first();
      const fill = track.locator('div.bg-primary.h-full').first();
      await expect(fill).toBeVisible();

      const trackBox = await track.boundingBox();
      const fillBox = await fill.boundingBox();
      expect(trackBox, `tor paska postępu musi być zmierzalny w kroku ${stepNum}`).not.toBeNull();
      expect(fillBox, `wypełnienie paska postępu musi być zmierzalne w kroku ${stepNum}`).not.toBeNull();
      const ratio = trackBox && fillBox ? fillBox.width / trackBox.width : NaN;

      return { label, ratio, backVisible, backEnabled };
    };

    // Przechodzi kroki 1->5 ścieżką "Mieszkanie" z podaną liczbą pomieszczeń, zbierając
    // pomiar paska/licznika/"Wstecz" PO każdym z kroków 2-5. Zostawia stronę tuż przed
    // krokiem 6 (loader), gdzie ścieżki się rozchodzą.
    const runSteps2to5 = async (roomsCount: number): Promise<StepMeasurement[]> => {
      await page.goto('/triage');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=Krok 1 / 8')).toBeVisible();

      await clickOption(page, 'Mieszkanie');
      const m2 = await measureAt(2);

      await clickOption(page, roomsLabel(roomsCount));
      const m3 = await measureAt(3);

      await fillSizesForRooms(page, roomsCount);
      const m4 = await measureAt(4);

      await clickOption(page, 'Wykończony');
      const m5 = await measureAt(5);

      await clickOption(page, 'Tak'); // balkon — krok 5, tylko dla Mieszkania
      return [m2, m3, m4, m5];
    };

    // Ścieżka dyskwalifikująca: Mieszkanie + AT_THRESHOLD pomieszczeń.
    const disqualifying = await runSteps2to5(AT_THRESHOLD);
    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });

    // Na ekranie Eksperta pasek pokazuje 100% (WO, Mechanika D3 pkt 4).
    // `toHaveCSS('width', ...)` czyta computed style w PIKSELACH, nie procentach —
    // wariant `100%` nigdy by nie zaszedł, a jedyna realna alternatywa (`>= 300px`
    // dla kontenera ~1024px) przepuszczała też 50% wypełnienia (buggy implementacja
    // dająca 87,5% zamiast 100% też by przeszła — poprzedni defekt REVIEW).
    await page.waitForTimeout(600);
    const expertTrack = page.locator('div.bg-border').first();
    const expertFill = expertTrack.locator('div.bg-primary.h-full').first();
    await expect(expertFill).toBeVisible();
    const expertTrackBox = await expertTrack.boundingBox();
    const expertFillBox = await expertFill.boundingBox();
    expect(expertTrackBox, 'tor paska postępu musi być zmierzalny na ekranie Eksperta').not.toBeNull();
    expect(expertFillBox, 'wypełnienie paska postępu musi być zmierzalne na ekranie Eksperta').not.toBeNull();
    if (expertTrackBox && expertFillBox) {
      expect(Math.abs(expertFillBox.width - expertTrackBox.width)).toBeLessThanOrEqual(2);
    }

    // Ścieżka kwalifikująca: Mieszkanie + BELOW_THRESHOLD pomieszczeń, ten sam pomiar.
    const qualifying = await runSteps2to5(BELOW_THRESHOLD);
    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible({ timeout: 20000 });

    // Porównanie w TYM SAMYM kroku między obiema ścieżkami — sedno tego testu.
    for (let i = 0; i < disqualifying.length; i++) {
      const d = disqualifying[i];
      const q = qualifying[i];

      expect(d.label, `licznik kroku musi się zgadzać (indeks ${i})`).toBe(q.label);

      expect(d.backVisible, `"Wstecz" widoczny na ścieżce dyskwalifikującej, ${d.label}`).toBe(true);
      expect(d.backEnabled, `"Wstecz" aktywny na ścieżce dyskwalifikującej, ${d.label}`).toBe(true);
      expect(q.backVisible, `"Wstecz" widoczny na ścieżce kwalifikującej, ${q.label}`).toBe(true);
      expect(q.backEnabled, `"Wstecz" aktywny na ścieżce kwalifikującej, ${q.label}`).toBe(true);

      expect(
        Math.abs(d.ratio - q.ratio),
        `pasek postępu rozjeżdża się w ${d.label}: dyskwalifikująca=${d.ratio}, kwalifikująca=${q.ratio}`,
      ).toBeLessThanOrEqual(0.02);
    }
  });
});

test.describe('Ścieżka Eksperta do rezerwacji (D6)', () => {
  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC18 — CTA "Umów bezpłatny audyt" prowadzi na ten sam formularz rezerwacji co ścieżka kwalifikująca', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 1 });
    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });

    await expect(page.locator('text="Audyt jest bezpłatny i niezobowiązujący."')).toBeVisible();
    // Telefon zostaje jako wyjście drugorzędne, ale nie jest już jedyne.
    await expect(page.locator('a[href^="tel:"]')).toBeVisible();

    await clickOption(page, 'Umów bezpłatny audyt');
    await expect(page.locator('text=Wybierz termin darmowej wyceny')).toBeVisible({ timeout: 10000 });
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC19 (główny scenariusz) — pełna ścieżka Eksperta do formularza rezerwacji bez ANI JEDNEJ kwoty', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: AT_THRESHOLD });

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('body')).not.toContainText(MONEY_PATTERN);

    await clickOption(page, 'Umów bezpłatny audyt');

    await expect(page.locator('text=Wybierz termin darmowej wyceny')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toContainText(MONEY_PATTERN);

    // Wybór terminu — kalendarz i godzina, tak jak na ścieżce kwalifikującej.
    const dateButton = page.locator('div.grid-cols-7 button:not([disabled])').first();
    await dateButton.click({ force: true });
    await page.waitForTimeout(300);

    const timeSlot = page.locator('button:has-text(":")').first();
    if (await timeSlot.isVisible()) {
      await timeSlot.click({ force: true });
    }

    await expect(page.locator('body')).not.toContainText(MONEY_PATTERN);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC20 — cofnięcie z formularza rezerwacji na ścieżce Eksperta wraca na ekran Eksperta, nie na ekran wyceny', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 1 });
    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });

    await clickOption(page, 'Umów bezpłatny audyt');
    await expect(page.locator('text=Wybierz termin darmowej wyceny')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Wstecz")').click({ force: true });
    await page.waitForTimeout(600);

    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible();
    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).not.toBeVisible();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC21 — formularz rezerwacji ze ścieżki Eksperta zbiera ten sam komplet pól co ścieżka kwalifikująca, bez żadnej wyceny', async ({ page }) => {
    await runQualifyingSteps(page, { location: 'Lokal komercyjny', rooms: 1 });
    await expect(page.locator('text=Twoja instalacja zasługuje na dokładną wycenę')).toBeVisible({ timeout: 20000 });
    await clickOption(page, 'Umów bezpłatny audyt');
    await expect(page.locator('text=Wybierz termin darmowej wyceny')).toBeVisible({ timeout: 10000 });

    // Ten sam komplet pól co Step8Booking na ścieżce kwalifikującej (imię i nazwisko,
    // telefon, e-mail, adres, zgoda) — WO: "Poza zakresem" pkt 1, "AC21 jest asercją
    // bez zmiany kodu produkcyjnego". Rzeczywisty zapis (`saveLead`, `priceDevices`/
    // `priceInstallation` = 0 => `estimatedQuote` puste) jest poza zasięgiem Playwrighta
    // bez klikania submit — a submit celowo NIE jest tu wykonywany (patrz
    // booking-validation.spec.ts: "We do NOT click submit to avoid polluting the DB").
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#phone')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#address')).toBeVisible();
    await expect(page.locator('input#terms')).toBeVisible();

    await expect(page.locator('body')).not.toContainText(MONEY_PATTERN);
    // Celowo bez `clickOption(page, 'Potwierdź rezerwację')` — patrz komentarz wyżej.
  });
});
