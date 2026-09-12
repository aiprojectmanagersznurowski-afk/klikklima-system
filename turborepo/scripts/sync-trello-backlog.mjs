const apiKey = "6c97357d3659db40dfc1674beb00fa1d";
const token = "ATTAb2d94c6bb94c24e4f00c2520c259b927540da2fe972a464c189be6f1177edb9dA1E30578";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BOARD_KLIKKLIMA = "6aa2a798d6da4287d0cba862";
const BOARD_KK = "6a6cb12ebaab1e3be9d4a36d";

const DONE_LIST_KLIKKLIMA = "6aa4f07fdd89050b72adb7d6"; // ✅ Zrobione / Ukończone (Done)
const DONE_LIST_KK = "6a6cb12ebaab1e3be9d4a389"; // Zrobione

const COMPLETED_CARDS_KLIKKLIMA = [
  { id: "6aa2a7a42a57b85d8aa05332", name: "[DONE] Check-types w CI/CD (P2 Dług)" },
  { id: "6aa2a7a1e34236495f0d5e44", name: "[DONE] P0 SEC-READ-GATES: Autoryzacja widoków danych" },
  { id: "6aa2a7a18255de3b03c08930", name: "[DONE] SEC-AUTHZ-USER-MGMT: Zarządzanie w RBAC" },
  { id: "6aa2a7a2d6a237e4e7bb6b32", name: "[DONE] SEC-AUDIT-LOG: Historyzacja (Zapis Audytu)" },
  { id: "6aa2a7a28b1905e1ffe2e9e5", name: "[DONE] SEC-ASSIGNMENT-POOL-MINIMIZE: Przeciek Payloadów" },
  { id: "6aa2a79e260a73af0f4a92a9", name: "[DONE] CRM-AUDYT-KARTOTEKA & ZESP-KARTOTEKA: Kartoteki Osobiste" },
  { id: "6aa2a79f50c0411bfc33a76e", name: "[DONE] LOGISTICS-SHIPPING-EFFECTS (Faza B & C): System Powiadomień" },
  { id: "6aa2a7a0d8ec54c957d7a87e", name: "[DONE] CRM-PROJECT-NUMBER: Sekwencyjna numeracja zleceń" },
  { id: "6aa2a7a02a0dd375021ec267", name: "[DONE] CRM-CLIENT-ANONYMIZE-RODO: Wykreślenie RODO z bazy" },
  { id: "6aa2a79da9991050238ac4d8", name: "[DONE] B2C-TRIAGE-DISQUALIFY: Mechanizm Dyskwalifikacji" },
  { id: "6aa2a79e9ccda10421af0a09", name: "[DONE] B2C-LEAD-GEO-PERSIST: Translacja Adresów" },
  { id: "6aa2a79b016a0c8425f2e86a", name: "[DONE] FLD-BOOKING-ATOMIC-ASSIGN: Atomowe rezerwacje slotów" },
  { id: "6aa2a79ccea1912fa6bc5528", name: "[DONE] CAL-VISIT-DURATION-BASKETS: Moduł Koszyków Czasowych" },
  { id: "6aa2a79901374b84fc36d03e", name: "[DONE] FLD-AVAIL-SELF: Samodzielna deklaracja niedostępności" },
  { id: "6aa2a79945b74673fdc2f97a", name: "[DONE] FLD-AVAIL-WEEKLY-RULES: Dostępność cykliczna" },
  { id: "6aa2a79a03537a5488cfb11c", name: "[DONE] FLD-BASE-LOCATION-EDIT: Edycja lokalizacji bazowej" },
  { id: "6aa2a79a6355807047d28931", name: "[DONE] FLD-CONSENT-ACCEPT: Akceptacja regulaminów" },
  { id: "6aa2a79b6f77d5b9b9290be7", name: "[DONE] FLD-LEGAL-DOC-VERSION: Zarządzanie dokumentami prawnymi" },
];

const COMPLETED_CARDS_KK = [
  { id: "6a6cb1a8cc25a392b70fd9d2", name: "[DONE] [Baza Danych] Wielka Aktualizacja Jesienna (Hurtownia)" },
  { id: "6a9e9efb95409cd5f7df85b0", name: "[DONE] Ustawienia: z-e userami , z-e cennikiem i kalulatorem wycen, z-e wzorcowym montażem" },
];

const NEW_TASKS = [
  // 🌐 Landing Page (B2C) - 6aa2a79d844dabc5349c1aa2
  {
    listId: "6aa2a79d844dabc5349c1aa2",
    name: "B2C-BOOKING-FLOW: Atomowa rezerwacja terminu audytu na Landing Page",
    desc: "Klient wybiera wolny termin audytu, podaje dane kontaktowe i wyraża zgody RODO. Zapis w jednej transakcji: lead w stanie NEW_LEAD + klient + adres z geokodowaniem + rezerwacja slotu w tabeli bookings ze statusem RESERVED.\nWymagania: B2C-LEAD-ENTRY, B2C-LEAD-ATOMIC, B2C-BOOKING-SLOT, B2C-CONSENT-RODO.",
  },
  {
    listId: "6aa2a79d844dabc5349c1aa2",
    name: "B2C-PRICE-FROM: Dynamiczne wyliczanie cen „od\" w katalogu",
    desc: "Cena „od\" klimatyzatora wyliczana w locie jako suma: jednostka wewnętrzna + agregat zewnętrzny + montaż standardowy (z cennika usług) + VAT 8% dla osób prywatnych (lub 23% dla firm).\nWymaganie: B2C-PRICE-FROM.",
  },
  {
    listId: "6aa2a79d844dabc5349c1aa2",
    name: "B2C-TRIAGE-STEPS: Rozbudowa formularza Triage 7 kroków",
    desc: "Optymalizacja UX formularza doboru klimatyzacji: 7 kroków pytań z paskiem postępu, walidacja react-hook-form + zod, zapamiętywanie stanu w sessionStorage i płynne cofanie kroków.\nWymaganie: B2C-TRIAGE-STEPS.",
  },
  {
    listId: "6aa2a79d844dabc5349c1aa2",
    name: "B2C-SOFT-LEAD: Obsługa okna Exit-Intent (kontakt cząstkowy)",
    desc: "Wyskakujące okno przy próbie opuszczenia strony zbierające numer telefonu lub e-mail i zapisujące rekord do tabeli soft_leady (bez wprowadzania do głównego lejka sprzedażowego).\nWymaganie: B2C-SOFT-LEAD.",
  },
  {
    listId: "6aa2a79d844dabc5349c1aa2",
    name: "B2C-DEVICE-COMPARE: Porównywarka klimatyzatorów na stronie",
    desc: "Narzędzie porównujące do 3 modeli jednocześnie: moc chłodnicza/grzewcza, klasa energetyczna A+++, głośność (dB w trybie cichym), funkcje WiFi/jonizacja, estymowany koszt eksploatacji.",
  },
  {
    listId: "6aa2a79d844dabc5349c1aa2",
    name: "B2C-CATALOG-REFRESH: Automatyczne odświeżanie widoku available_combinations",
    desc: "Procedura automatycznego odświeżania zmaterializowanego widoku katalogu po aktualizacji jednostek wewnętrznych lub agregatów zewnętrznych w bazie.\nWymaganie: B2C-CATALOG-VIEW-TRACKED.",
  },

  // 🏢 Admin B2B (CRM & Logistyka) - 6aa2a79ed1fc98f0f2792063
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-E2-E3: Auto-transition leada do E3 po wysłaniu wyceny (Quote)",
    desc: "Po przygotowaniu i wysłaniu wyceny następuje automatyczne przejście stanu leada z AWAITING_AUDIT do AUDIT_COMPLETED, start 14-dniowego zegara ważności oferty i wygenerowanie powiadomienia N4 z linkiem akceptacyjnym.\nWymagania: FNL-E2-E3, SLA-QUOTE-14D.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-E3-E4: Akceptacja wyceny online i rezerwacja terminu montażu",
    desc: "Klient pod dedykowanym linkiem akceptuje regulamin oraz ofertę i wybiera dogodny termin montażu z wolnych slotów, co przenosi zlecenie do E4 (AWAITING_CREW_ASSIGNMENT) i generuje powiadomienie I2 dla dyspozytora.\nWymaganie: FNL-E3-E4.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-E3-BUCKET: Nocny cron wygaszania ofert (Zimne Leady po 14 dniach)",
    desc: "Automatyczny proces pg_cron weryfikujący codziennie wyceny starsze niż 14 dni (SLA.QUOTE_VALIDITY_DAYS). Wygaszone oferty automatycznie przechodzą do bucketu QUOTE_REJECTED ze stemplami bucket_entered_at i powiadomieniem N_REJECT.\nWymaganie: FNL-E3-BUCKET.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-E4-E5: Przypisanie ekipy montażowej i zlecenie wysyłki sprzętu (E5)",
    desc: "Administrator wybiera certyfikowaną ekipę z listy i zatwierdza termin montażu. Utworzenie rekordu logistyka_zamowienia, przejście leada do HARDWARE_IN_WAREHOUSE i wysyłka powiadomienia I3 do ekipy.\nWymaganie: FNL-E4-E5.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-E6-E7: Webhook kuriera (DPD/DHL) potwierdzający doręczenie",
    desc: "Endpoint webhooka kuriera odbierający status doręczenia paczki na podstawie tracking_id i automatycznie przełączający zlecenie do E7 (AWAITING_INSTALLATION) z zachowaniem pełnej idempotencji.\nWymaganie: FNL-E6-E7.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-E7-E8: Zamknięcie montażu, protokół odbioru i wyznaczenie serwisu (+1 rok)",
    desc: "Zakończenie montażu przez ekipę w aplikacji/panelu: lead przechodzi do INSTALLATION_COMPLETED, baza wylicza next_service_date = data_zakonczenia + 1 rok, wysyłka powiadomienia N8 z protokołem zdawczo-odbiorczym.\nWymagania: FNL-E7-E8, SRV-NEXT-DATE.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "FNL-2PHASE: Obsługa montażu dwuetapowego (stan deweloperski)",
    desc: "Obsługa lokali deweloperskich: przejście T17 (etap I: instalacja chłodnicza w ścianie) z wystawieniem faktury za etap I i linkiem do rezerwacji etapu II (montaż jednostek i uruchomienie) po zakończeniu prac wykończeniowych.\nWymagania: FNL-2PHASE, FNL-2PHASE-INVOICE, FNL-2PHASE-BOOKING.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "CRM-SRV-TRIGGER: Nocny cron przeglądów gwarancyjnych i powiadomienia N10",
    desc: "Nocne zadanie skanujące instalacje zbliżające się do terminu serwisu (next_service_date) i generujące powiadomienie N10 do klienta na 30 dni przed upływem terminu gwarancji.\nWymagania: CRM-SRV-TRIGGER, SRV-REMINDER-ONCE.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "CRM-UST-AC1: Zgłoszenia usterek i reklamacji z obsługą priorytetu Krytyczny",
    desc: "Obsługa zgłoszeń awarii i usterek w CRM: formularz z opisem i załącznikami, zgłoszenie krytyczne natychmiast wysyła push/alert do dyspozytora i uruchamia licznik SLA 48h (czerwone podświetlenie po przekroczeniu).\nWymagania: CRM-UST-AC1, CRM-UST-AC2, CRM-UST-AC3, NTF-I7-SLA.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "CRM-KLI-SEARCH: Globalna wyszukiwarka klientów i Karta 360",
    desc: "Wyszukiwarka klientów w nagłówku panelu po nazwisku, telefonie i mailu z przejściem do Karty 360: historia zleceń, instalacji, dokumentów, historii kontaktów i zgód RODO.\nWymagania: CRM-KLI-AC1, CRM-KLI-AC2, CRM-KLI-AC3, NTF-HISTORY.",
  },
  {
    listId: "6aa2a79ed1fc98f0f2792063",
    name: "NTF-GATEWAY: Integracja produkcyjna bramki SMS (SMSAPI) i Email",
    desc: "Proces consumera odczytujący oczekujące wpisy z notification_queue, wysyłający wiadomości przez SMSAPI i dostawcę email w dozwolonym oknie czasowym (8:00–18:00 dla SMS) z obsługą retry i dead-letter.\nWymagania: NTF-QUEUE-WINDOW, NTF-RETRY.",
  },

  // 📅 Kalendarz & Rezerwacje - 6aa2a79bca13cdd68bfb1f8d
  {
    listId: "6aa2a79bca13cdd68bfb1f8d",
    name: "CAL-POOL-AGGREGATE: Sumaryczny widok wolnych slotów dla klienta",
    desc: "Klient wybierając termin audytu lub montażu widzi zagregowane wolne sloty całej puli wykonawców w swoim regionie, zamiast grafiku pojedynczego pracownika.\nWymaganie: CAL-POOL-AGGREGATE.",
  },
  {
    listId: "6aa2a79bca13cdd68bfb1f8d",
    name: "CRM-REGION-AUTO: Automatyczne dopasowanie audytora/ekipy wg odległości",
    desc: "Silnik geo-dopasowania przypisujący audytora i ekipę montażową na podstawie odległości (Haversine) adresu klienta od lokalizacji bazowej pracownika i jego zadeklarowanego promienia działania.\nWymaganie: CRM-REGION-AUTO.",
  },
  {
    listId: "6aa2a79bca13cdd68bfb1f8d",
    name: "INT-GOOGLE-CALENDAR: Dwukierunkowa synchronizacja z Google Calendar",
    desc: "Synchronizacja wizyt audytowych i montażowych z kalendarzami Google pracowników terenowych za pośrednictwem skonfigurowanego konta serwisowego Google Calendar API.",
  },

  // 🔧 Field App (Aplikacja Terenowa) - 6aa2a79970df464096a58cd7
  {
    listId: "6aa2a79970df464096a58cd7",
    name: "FLD-APP-PWA: Responsywna aplikacja terenowa PWA dla wykonawców",
    desc: "Lekki, dedykowany interfejs mobilny PWA dla audytorów i monterów: dzisiejsza lista zleceń, nawigacja do klienta, protokół audytu, checklist montażu i generowanie protokołu odbioru.",
  },
  {
    listId: "6aa2a79970df464096a58cd7",
    name: "FLD-AUTH-BLOCKED: Bramka autoryzacyjna aplikacji terenowej",
    desc: "Zablokowanie logowania do aplikacji terenowej dla kont wyłączonych administracyjnie (is_active = false) lub z niezaakceptowanymi aktualnymi regulaminami pracowniczymi.\nWymaganie: FLD-AUTH-BLOCKED.",
  },
  {
    listId: "6aa2a79970df464096a58cd7",
    name: "FLD-AUDIT-PHONE-SHORTCUT: Skrócona ścieżka audytu telefonicznego",
    desc: "Szybki formularz dla audytora / handlowca rozmawiającego z dzwoniącym klientem: natychmiastowe utworzenie leada, wypełnienie uproszczonego triage i bezpośrednia rezerwacja terminu wizyty.",
  },

  // 🔒 Security & Tech Debt - 6aa2a7a015634feb3e04b193
  {
    listId: "6aa2a7a015634feb3e04b193",
    name: "SEC-SSO-GUARD: Ostateczne wymuszenie Google SSO w produkcji",
    desc: "Logowanie do panelu B2B wyłącznie przez Google OAuth, odrzucanie logowań spoza tabeli authorized_users, walidacja formatu e-mail małymi literami (case-normalization).\nWymagania: SEC-SSO-GUARD, SEC-EMAIL-CASE-NORMALIZE.",
  },
  {
    listId: "6aa2a7a015634feb3e04b193",
    name: "SEC-AUDIT-LOG-RETENTION: Polityka retencji i archiwizacji logów audytowych",
    desc: "Mechanizm retencji logów audytowych zgodny z wymogami prawnymi (np. bezpieczna archiwizacja starszych niż 5 lat), bez naruszania zasady append-only w tabeli roboczej.",
  },
];

async function updateTrello() {
  console.log("=== 1. Aktualizacja ukończonych zadań na KlikKlima - Backlog Produktów ===");
  for (const card of COMPLETED_CARDS_KLIKKLIMA) {
    console.log(`Przenoszenie karty: ${card.name} (${card.id}) do Zrobione...`);
    const url = `https://api.trello.com/1/cards/${card.id}?idList=${DONE_LIST_KLIKKLIMA}&name=${encodeURIComponent(card.name)}&dueComplete=true&key=${apiKey}&token=${token}`;
    const res = await fetch(url, { method: "PUT" });
    if (!res.ok) {
      console.error(`Błąd przy karcie ${card.id}:`, res.status, await res.text());
    } else {
      console.log(` -> Sukces!`);
    }
    await sleep(200);
  }

  console.log("\n=== 2. Aktualizacja ukończonych zadań na tablicy KK ===");
  for (const card of COMPLETED_CARDS_KK) {
    console.log(`Przenoszenie karty na KK: ${card.name} (${card.id}) do Zrobione...`);
    const url = `https://api.trello.com/1/cards/${card.id}?idList=${DONE_LIST_KK}&name=${encodeURIComponent(card.name)}&dueComplete=true&key=${apiKey}&token=${token}`;
    const res = await fetch(url, { method: "PUT" });
    if (!res.ok) {
      console.error(`Błąd przy karcie KK ${card.id}:`, res.status, await res.text());
    } else {
      console.log(` -> Sukces!`);
    }
    await sleep(200);
  }

  console.log("\n=== 3. Dodawanie nowych zadań do ukończenia systemu na KlikKlima - Backlog Produktów ===");
  for (const task of NEW_TASKS) {
    console.log(`Tworzenie nowej karty: "${task.name}" w liście ${task.listId}...`);
    const url = `https://api.trello.com/1/cards?idList=${task.listId}&name=${encodeURIComponent(task.name)}&desc=${encodeURIComponent(task.desc)}&key=${apiKey}&token=${token}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      console.error(`Błąd tworzenia karty:`, res.status, await res.text());
    } else {
      const created = await res.json();
      console.log(` -> Utworzono kartę: ${created.id}`);
    }
    await sleep(250);
  }

  console.log("\nSynchronizacja z Trello zakończona sukcesem!");
}

updateTrello().catch(err => {
  console.error("Błąd ogólny:", err);
  process.exit(1);
});
