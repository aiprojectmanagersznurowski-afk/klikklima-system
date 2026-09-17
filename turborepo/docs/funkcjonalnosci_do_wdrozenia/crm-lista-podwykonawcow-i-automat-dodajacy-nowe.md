# CRM — Baza Podwykonawców do Cold Callingu, Notatki i Import Kontaktów

> **Identyfikator zadania Trello:** `CRM-PROSPECTS`  
> **Kategoria:** Admin B2B (CRM & Logistyka)  
> **Status:** DO WDROŻENIA  
> **Szacowany czas prac:** 14–18 roboczogodzin  

---

## 1. Cel Biznesowy i Rynkowy

Zgodnie z roadmapą Go-To-Market (`ROADMAP-GTM-I-PROGNOZA-DEVELOPMENTU.md`) kluczowym zadaniem Piotra (COO) przed lutowym onboardingiem ekip jest **stworzenie bazy kontaktowej instalatorów HVAC z Wrocławia i Dolnego Śląska oraz przeprowadzenie akcji cold callingowej**.

Aby proces ten nie toczył się w luźnych arkuszach Excel, panel CRM zyskuje dedykowany moduł rekrutacyjny dla wykonawców:
1. **Prowadzenie rozmów z potencjalnymi podwykonawcami** bezpośrednio w systemie,
2. **Historia kontaktu i notatki z ustaleń** (stawki, dyspozycyjność, posiadane certyfikaty F-Gaz, preferowany rejon działania),
3. **Płynna konwersja do stałej współpracy:** jedno kliknięcie przekształca prospekt w aktywnego audytora (`auditors`) lub ekipę monterską (`crews`).

---

## 2. Model Danych (Prisma Schema)

```prisma
enum ProspectStatus {
  NEW                  // Świeżo dodany z bazy/rejestru
  CONTACT_ATTEMPTED    // Próba kontaktu (brak odpowiedzi)
  IN_CONVERSATION      // W trakcie rozmów / cold call
  OFFER_SENT           // Wysłano prospekt współpracy i cennik
  ONBOARDING           // Zgodził się, etap weryfikacji certyfikatów i umowy
  CONVERTED            // Podpisano umowę -> przeniesiono do crews/auditors
  REJECTED             // Brak zainteresowania / niespełnione wymogi
}

enum ProspectType {
  INSTALLATION_CREW    // Zespół montażowy
  TECHNICAL_AUDITOR    // Audytor techniczno-handlowy
  BOTH                 // Elastyczny (audyt + montaż)
}

model SubcontractorProspect {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  company_name    String          @db.VarChar(255)
  nip             String?         @db.VarChar(16)
  contact_person  String          @db.VarChar(255)
  phone           String          @db.VarChar(32)
  email           String?         @db.VarChar(255)
  city            String          @db.VarChar(128)
  postal_code     String?         @db.VarChar(16)
  operating_radius_km Int?        @default(50)
  target_type     ProspectType    @default(INSTALLATION_CREW)
  status          ProspectStatus  @default(NEW)
  has_fgaz        Boolean         @default(false)
  has_sep         Boolean         @default(false)
  rejection_reason String?        @db.Text
  notes           ProspectNote[]
  converted_crew_id    String?    @db.Uuid
  converted_auditor_id String?    @db.Uuid
  created_at      DateTime        @default(now()) @db.Timestamptz(6)
  updated_at      DateTime        @updatedAt @db.Timestamptz(6)

  @@index([status])
  @@index([city])
  @@map("subcontractor_prospects")
}

model ProspectNote {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  prospect_id     String          @db.Uuid
  author_id       String          @db.Uuid
  author_name     String          @db.VarChar(255)
  content         String          @db.Text
  call_outcome    String?         @db.VarChar(64) // np. "Odebrał, zainteresowany stawką 1400 zł", "Oddzwonić w piątek"
  created_at      DateTime        @default(now()) @db.Timestamptz(6)

  prospect        SubcontractorProspect @relation(fields: [prospect_id], references: [id], onDelete: Cascade)

  @@index([prospect_id])
  @@map("prospect_notes")
}
```

---

## 3. Kluczowe Funkcjonalności

1. **Widok Kanbana / Tabeli Prospektów:**
   - Filtrowanie wg statusu rozmowy, miasta, typu wykonawcy,
   - Szybkie kliknięcie numeru telefonu (`tel:+48...`) dla dzwonienia z telefonu/VoIP.
2. **Szybki Notatnik z Rozmowy:**
   - Dodawanie notatki podczas rozmowy z zapamiętaniem daty i godziny,
   - Oznaczenie planowanego terminu ponownego kontaktu (przypomnienie na pulpicie B2B).
3. **Automat Masowego Importu (CSV / JSON):**
   - Import listy firm z bazy REGON / Panoramy Firm / CEIDG po kodach PKD (43.22.Z — wykonywanie instalacji wodno-kanalizacyjnych, cieplnych, gazowych i klimatyzacyjnych),
   - Automatyczna deduplikacja po NIP lub numerze telefonu.
4. **Przycisk „Konwertuj na Podwykonawcę”:**
   - Automatyczne wywołanie formularza tworzenia karty ekipy (`/crews/new`) z przeniesieniem wprowadzonych wcześniej danych (Nazwa, NIP, Telefon, E-mail, Certyfikaty).

---

## 4. Kryteria Akceptacji
- [ ] Import pliku CSV z 50 kontaktami poprawnie tworzy wiersze w tabeli `subcontractor_prospects` bez duplikatów.
- [ ] Dodanie notatki natychmiast pojawia się w osi czasu kontaktu.
- [ ] Kliknięcie „Konwertuj” tworzy rekord w `crews` lub `auditors` i oznacza prospekt jako `CONVERTED`.
