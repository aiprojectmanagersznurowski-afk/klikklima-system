/**
 * Skrypt synchronizujący Backlog Produktu z Trello
 * Tablica: KlikKlima - Backlog Produktów (6aa2a798d6da4287d0cba862)
 *
 * Aktualizuje ukończone zadania, porządkuje listę HUMAN przenosząc zadania techniczne
 * do odpowiednich list z pełnymi opisami, oraz dodaje nowe karty z docs/funkcjonalnosci_do_wdrozenia.
 */

const apiKey = "6c97357d3659db40dfc1674beb00fa1d";
const token = "ATTAb2d94c6bb94c24e4f00c2520c259b927540da2fe972a464c189be6f1177edb9dA1E30578";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BOARD_KLIKKLIMA = "6aa2a798d6da4287d0cba862";

// ID list na tablicy KlikKlima - Backlog Produktów
const LISTS = {
  HUMAN: "6aa7ac718580d42072715ada",
  BLOCKED: "6aa2a7a38b27d77e59f0db43",
  SECURITY: "6aa2a7a015634feb3e04b193",
  ADMIN_B2B: "6aa2a79ed1fc98f0f2792063",
  LANDING_B2C: "6aa2a79d844dabc5349c1aa2",
  CALENDAR: "6aa2a79bca13cdd68bfb1f8d",
  FIELD_APP: "6aa2a79970df464096a58cd7",
  DONE: "6aa4f07fdd89050b72adb7d6",
};

// 1. Zadania do przeniesienia do "✅ Zrobione / Ukończone (Done)"
const CARDS_TO_MOVE_TO_DONE = [
  {
    id: "6aa2a79c917a0ecc98984128",
    name: "[DONE] CAL-TRAVEL-BUFFER: Automatyczny Bufor Czasu Dojazdu",
    desc: "Zasada pilnująca, aby pomiędzy dwoma oddzielnymi adresami dla jednej ekipy uwzględnić elastyczny, konfigurowalny bufor czasu na dojazd (tabela travel_buffers lub domyślnie 30 minut z kontraktu).\n\nStatus: ZAMKNIĘTE 2026-09-10 (WO FLD-CALENDAR-FOUNDATION, @REQ: CAL-TRAVEL-BUFFER).",
  },
  {
    id: "6aa4f0cbe09eef0c648aba7e",
    name: "[DONE] CAL-POOL-AGGREGATE: Sumaryczny widok wolnych slotów dla klienta",
    desc: "Klient wybierając termin audytu lub montażu widzi zagregowane wolne sloty całej puli wykonawców w swoim regionie, zamiast grafiku pojedynczego pracownika.\n\nStatus: ZAMKNIĘTE 2026-09-10 (WO FLD-CALENDAR-FOUNDATION, @REQ: CAL-POOL-AGGREGATE).",
  },
  {
    id: "6aaa4b895616d3deb5bb5cfc",
    name: "[DONE] Wszystkie scenariusze rozliczeniowe z klientem z opisem (KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE)",
    desc: "Opracowano kompleksowy dokument referencyjny architektury biznesowo-technologicznej: `docs/prezentacje/KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md` (oraz `docs/prezentacje/model_wspolpracy.md`).\n\nZawiera: 7 koszyków w `visit_duration_baskets`, czterostronny model rozliczeń, ścieżki leada, zaliczki 40-50% na sprzęt JIT, prowizje i tabele marż.",
  },
  {
    id: "6aa7b755a76a9fbff175d975",
    name: "[DONE] Roadmapa GTM, wymagania i prognoza developmentu (ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU)",
    desc: "Opracowano 5-fazową roadmapę Go-To-Market z harmonogramem (listopad 2026 r. – sierpień 2027 r.), prognozą roboczogodzin developmentu Michała oraz zakresem wkładu operacyjnego COO Piotra: `docs/prezentacje/ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md`.",
  },
  {
    id: "6aa7b68b4cc87cc2291bebec",
    name: "[DONE] Warunki współpracy: Zasady kooperacji z audytorami i ekipami (model_wspolpracy & ONE-PAGER)",
    desc: "Opracowano kompletne zestawienia: `docs/prezentacje/model_wspolpracy.md` oraz `docs/prezentacje/ONE-PAGER.md` z zasadami kooperacji, wymaganiami certyfikacyjnymi (F-Gaz, SEP) oraz transparentnym taryfikatorem stawek.",
  },
  {
    id: "6aa7b691034de59b14539667",
    name: "[DONE] Model prowizyjny: Siatka stawek i prowizji dla audytorów i ekip monterskich",
    desc: "Sfinalizowano jednolity model prowizyjny bez ukrytych narzutów w `docs/prezentacje/KOSZYKI-USLUG-I-MODELE-ROZLICZENIOWE.md` oraz `docs/prezentacje/model_wspolpracy.md`.",
  },
];

// 2. Zadania z listy HUMAN wymagające usystematyzowania, wzbogacenia opisu i przeniesienia do backlogu technicznego
const CARDS_TO_ORGANIZE = [
  {
    id: "6aa7ac7f2d30be34c91d8ec9",
    targetListId: LISTS.ADMIN_B2B,
    name: "AI-CHAT-SUITE: Ekosystem asystentów AI (B2C Landing, B2B Dyspozytor, Field App DTR)",
    // opis pozostaje bogaty / rozbudowany z transkrypcji i specyfikacji
  },
  {
    id: "6aa7aca1577d803c33f619e3",
    targetListId: LISTS.FIELD_APP,
    name: "FLD-PHOTO-OPTIMIZE: Kompresja zdjęć w locie po stronie klienta (WebP) i szybki upload do CDN",
    desc: `Klient mobilny/PWA przed wysłaniem zdjęcia wykonuje bezstratną/inteligentną kompresję w locie (browser-image-compression lub Canvas API):
- Zmniejszenie rozdzielczości do maks. 1920px na dłuższym boku, format WebP z jakością ~80% (redukcja rozmiaru z 8-12 MB do < 800 KB),
- Generowanie miniatur (thumbnails ~300px) do szybkiego podglądu siatki zdjęć na Karcie 360 i w historii leada,
- Bezpośredni upload do Supabase Storage przez signed upload URL z predyktywnym paskiem postępu.`,
  },
  {
    id: "6aa7b3589a44666345ba630f",
    targetListId: LISTS.ADMIN_B2B,
    name: "CRM-PROSPECTS: Baza potencjalnych podwykonawców do cold callingu, notatki i automatyczny import",
    desc: `Dedykowany rejestr potencjalnych podwykonawców (ekip monterskich i audytorów) z terenu Wrocławia i Dolnego Śląska:
- Tabela prospektów z polami: Nazwa firmy, NIP, Osoba kontaktowa, Telefon, E-mail, Miasto/Powiat, Status rozmowy (Nowy, Do kontaktu, Zainteresowany, Wysłano ofertę, Podpisano umowę, Odrzucono),
- Historia interakcji / notatki z rozmów telefonicznych (kto rozmawiał, data, ustalenia),
- Akcja „Konwertuj na Podwykonawcę” jednym kliknięciem tworząca profil w tabeli crews lub auditors,
- Moduł masowego importu z pliku CSV / bazy firm.`,
  },
  {
    id: "6aa9519dc8028ee2ba2f699f",
    targetListId: LISTS.ADMIN_B2B,
    name: "CRM-FILTER-WORKFORCE: Filtrowanie prac i analityka obciążenia per audytor i per zespół monterski",
    // opis z kryteriami akceptacji już istnieje na karcie
  },
  {
    id: "6aa945c1a22ce6f57fe7696c",
    targetListId: LISTS.FIELD_APP,
    name: "FLD-SPEC-CORE: Wdrożenie 19 wymagań operacyjnych Field App (N1–N19)",
    desc: `Realizacja kluczowych wymagań zebranych podczas analizy terenowej (opisanych w docs/architecture/FIELD-APP-PLAN.md):
- N1–N10 Rola audytora: skrócona ścieżka leada, adnotacje tekstowe/rysowane na zdjęciach, katalog urządzeń offline/tablet, wariantowość oferty (1-3 warianty),
- N11–N17 Rola montera: jedno konto na reprezentanta ekipy, przycisk startu prac, komunikacja z audytorem, checklista przedmontażowa, protokół zdawczo-odbiorczy,
- Rozliczenia z KSeF i czytelne numery projektów L-000123.`,
  },
];

// 3. Nowe karty do utworzenia w Trello z docs/funkcjonalnosci_do_wdrozenia/ oraz niedawnych wdrożeń
const NEW_CARDS_TO_CREATE = [
  {
    listId: LISTS.ADMIN_B2B,
    name: "PAYU-GATEWAY: Integracja produkcyjna płatności PayU (zaliczki 40-50% i transakcje online)",
    desc: `Pełna integracja z bramką płatności PayU (REST API v2.1):
- Automatyczne tworzenie zamówień płatniczych po akceptacji wyceny (zaliczka 40–50% na zakup urządzeń w modelu JIT),
- Obsługa metod płatności: BLIK, szybkie przelewy (Pay-By-Link), karty płatnicze oraz raty 0% (PayU Raty),
- Webhook powiadomień PayU (/api/webhooks/payu) z weryfikacją podpisu nagłówka OpenPayU-Signature (SHA-256),
- Idempotentne księgowanie wpłat na poczet leada i automatyczne odblokowanie przypisania ekipy i wysyłki z hurtowni (E4 -> E5),
- Obsługa zwrotów (refunds) w przypadku rezygnacji w ustawowym terminie 14 dni.`,
  },
  {
    listId: LISTS.FIELD_APP,
    name: "SIGN-ONLINE: Moduł elektronicznego podpisu umów i protokołów (rysik na tablecie / link e-mail)",
    desc: `Moduł prawnie wiążącego składania podpisów elektronicznych pod umowami i protokołami:
- Podpis bezpośredni (In-Person): komponent SignaturePad na ekranie tabletu audytora/montera z obsługą rysika i dotyku,
- Podpis zdalny (Remote): jednorazowy, bezpieczny token z linkiem wysyłanym w N4/N8 pozwalający klientowi złożyć podpis na smartfonie/komputerze,
- Zabezpieczenie integralności: wyliczanie SHA-256 z treści dokumentu i danych transakcji, rejestracja znacznika czasu (timestamp), adresu IP i User-Agenta,
- Osadzanie podpisu jako grafiki rastrowej w dedykowanym polu wynikowego pliku PDF.`,
  },
  {
    listId: LISTS.ADMIN_B2B,
    name: "DOC-GEN-PDF: Automatyczny generator umów montażowych, protokołów zdawczo-odbiorczych i DTR (PDF)",
    desc: `Silnik generowania dokumentów PDF po stronie serwera (@react-pdf/renderer):
- Umowa montażu klimatyzacji: automatyczne wypełnianie danych klienta, adresu, wybranego modelu klimatyzatora, numerów seryjnych, kwoty zaliczki i dopłaty końcowej,
- Protokół zdawczo-odbiorczy: parametry techniczne instalacji, długość trasy chłodniczej, pomiar ciśnienia azotu, próżnia, podpisy obu stron,
- Karta gwarancyjna: numery seryjne jednostek wewnętrznych i zewnętrznych, data montażu, pieczęć certyfikowanego instalatora,
- Zapis wygenerowanych plików PDF w Supabase Storage i dołączanie linków/załączników do kolejki powiadomień.`,
  },
  {
    listId: LISTS.ADMIN_B2B,
    name: "NTF-TEMPLATES: Responsywne szablony transakcyjne HTML e-mail i standaryzacja SMS (N1–N12, I1–I7)",
    desc: `Profesjonalne wdrożenie szablonów wiadomości dla wszystkich 19 zdarzeń z kontraktu notifications.contract.mjs:
- Responsywne szablony HTML e-mail oparte o React Email: spójny branding KlikKlima, logo, czytelne klocki z informacjami o montażu, duże przyciski CTA (np. 'Zaakceptuj ofertę i wybierz termin', 'Opłać zaliczkę online', 'Pobierz protokół odbioru'),
- Optymalizacja szablonów SMS: ograniczenie do pojedynczego segmentu SMS (lub bezpiecznych multipartów), zastąpienie długich linków bezpiecznym skracaczem klikklima.pl/r/...,
- Obsługa fallbacku tekstowego (plain text) dla klientów poczty blokujących HTML.`,
  },
  {
    listId: LISTS.FIELD_APP,
    name: "MKT-PHOTO-CONSENT: Zgody marketingowe na publikację zdjęć z realizacji w Social Media",
    desc: `Formalny i systemowy mechanizm zbierania zgód na publikację zdjęć z montażu:
- Opcjonalna klauzula marketingowa w protokole odbioru (lub osobny checkbox zgody): zgoda na anonimowe wykorzystanie zdjęć estetycznych zamontowanych jednostek w materiałach marketingowych, portfolio www oraz mediach społecznościowych (Instagram, Facebook),
- Flaga w bazie danych social_media_consent: boolean przy rekordzie instalacji,
- W Field App i panelu B2B: oznaczanie zdjęć gwiazdką 'Dopuszczone do publikacji (Instagram/Portfolio)' z automatyczną weryfikacją zgody klienta,
- Zabezpieczenie: filtr wykluczający zdjęcia z widocznymi twarzami, dokumentami czy elementami prywatnymi klienta.`,
  },
  {
    listId: LISTS.DONE,
    name: "[DONE] FNL-2PHASE-BOOKING & ROLLBACK-RELEASE: Mechanika rezerwacji montażu dwuetapowego (B2B)",
    desc: `Zrealizowano i wdrożono na produkcji:
- Migracja PostgreSQL 20260916060000_fnl_2phase_booking_schema: tabela installation_phases (7 kolumn, relacje, unikalny indeks częściowy na booking_id), instalacje.installation_type,
- completePhaseOneAction i bookPhaseTwoAction w apps/b2b-web,
- releasePhaseTwoBooking zwalniający rezerwację etapu II przy rollbacku z zachowaniem completed_at etapu I,
- Preferencja wyboru tej samej ekipy w create-booking.ts,
- Pokryte 69 testami automatycznymi, status w kontrakcie: DONE.`,
  },
  {
    listId: LISTS.DONE,
    name: "[DONE] DOCS-BROWSER: Wewnętrzna przeglądarka dokumentacji systemowej i biznesowej w panelu B2B (/dokumentacja)",
    desc: `Wdrożono moduł wewnętrznej przeglądarki dokumentacji w panelu B2B:
- Bezpieczny routing /dokumentacja z bramką autoryzacji RBAC (role: admin, dispatcher),
- Parsowanie plików Markdown z katalogu docs/ (w tym dokumentów architektonicznych i prezentacji biznesowych),
- Obsługa interaktywnych diagramów Mermaid, tabel GFM oraz nawigacji powrotnej,
- Wdrożono i zweryfikowano na branchu main.`,
  },
];

async function updateTrello() {
  console.log("=== 1. Przenoszenie zadań ukończonych do 'Zrobione / Ukończone (Done)' ===");
  for (const card of CARDS_TO_MOVE_TO_DONE) {
    console.log(`Przenoszenie: ${card.name} (${card.id})...`);
    let url = `https://api.trello.com/1/cards/${card.id}?idList=${LISTS.DONE}&name=${encodeURIComponent(card.name)}&dueComplete=true&key=${apiKey}&token=${token}`;
    if (card.desc) {
      url += `&desc=${encodeURIComponent(card.desc)}`;
    }
    const res = await fetch(url, { method: "PUT" });
    if (!res.ok) {
      console.error(` -> Błąd [${res.status}]:`, await res.text());
    } else {
      console.log(` -> Sukces! Przeniesiono do Done.`);
    }
    await sleep(250);
  }

  console.log("\n=== 2. Porządkowanie zadań z listy HUMAN i przenoszenie do kategorii technicznych ===");
  for (const card of CARDS_TO_ORGANIZE) {
    console.log(`Aktualizacja i przenoszenie: ${card.name} (${card.id})...`);
    let url = `https://api.trello.com/1/cards/${card.id}?idList=${card.targetListId}&name=${encodeURIComponent(card.name)}&key=${apiKey}&token=${token}`;
    if (card.desc) {
      url += `&desc=${encodeURIComponent(card.desc)}`;
    }
    const res = await fetch(url, { method: "PUT" });
    if (!res.ok) {
      console.error(` -> Błąd [${res.status}]:`, await res.text());
    } else {
      console.log(` -> Sukces! Zaktualizowano i przeniesiono do listy ${card.targetListId}.`);
    }
    await sleep(250);
  }

  console.log("\n=== 3. Dodawanie nowych kart funkcjonalności do Backlogu ===");
  for (const card of NEW_CARDS_TO_CREATE) {
    console.log(`Tworzenie karty: "${card.name}" w liście ${card.listId}...`);
    const url = `https://api.trello.com/1/cards?idList=${card.listId}&name=${encodeURIComponent(card.name)}&desc=${encodeURIComponent(card.desc)}&key=${apiKey}&token=${token}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      console.error(` -> Błąd tworzenia [${res.status}]:`, await res.text());
    } else {
      const created = await res.json();
      console.log(` -> Utworzono kartę ID: ${created.id}`);
    }
    await sleep(250);
  }

  console.log("\n✅ Synchronizacja Trello zakończona pełnym sukcesem!");
}

updateTrello().catch((err) => {
  console.error("Błąd krytyczny skryptu Trello:", err);
  process.exit(1);
});
