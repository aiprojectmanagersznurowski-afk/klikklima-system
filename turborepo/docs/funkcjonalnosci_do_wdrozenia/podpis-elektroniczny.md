# Moduł Podpisu Elektronicznego Umów i Protokołów Odbioru

> **Identyfikator zadania Trello:** `SIGN-ONLINE`  
> **Kategoria:** Field App (Aplikacja Terenowa) / B2C  
> **Status:** DO WDROŻENIA  
> **Szacowany czas prac:** 16–20 roboczogodzin  

---

## 1. Cel i Wymagania Prawne

Zapewnienie w 100% cyfrowego, bezpapierowego obiegu dokumentów w relacji z klientem indywidualnym (B2C) oraz podwykonawcami (B2B):
1. **Podpisanie umowy montażowej** (u audytora na tablecie podczas audytu LUB zdalnie z linku w wiadomości e-mail/SMS),
2. **Podpisanie protokołu zdawczo-odbiorczego** (na urządzeniu montera po zakończeniu montażu LUB zdalnie),
3. **Zgodność z Kodeksem Cywilnym i eIDAS:**
   - Zwykły podpis elektroniczny z kryptograficznym potwierdzeniem tożsamości (znacznik czasu, adres IP, User-Agent, e-mail/telefon),
   - Zabezpieczenie integralności dokumentu poprzez wyliczenie skrótu SHA-256 przed i po podpisaniu.

---

## 2. Dwa Tryby Składania Podpisu

### Tryb A: Bezpośredni na Urządzeniu Terenowym (In-Person / Tablet)
- Wykorzystywany przez audytora lub montera będącego na miejscu u klienta,
- Komponent `SignaturePad` (HTML5 Canvas z obsługą zdarzeń dotykowych i rysika):
  - Płynne rysowanie wektora podpisu (krzywe Beziera),
  - Możliwość wyczyszczenia i ponownego złożenia podpisu,
  - Eksport do formatu PNG z przezroczystym tłem (wysoka rozdzielczość 300 DPI do PDF).

### Tryb B: Zdalny przez Link (Remote Sign-Link)
- Dla klientów, którzy decydują się na zakup po wizycie audytora lub nie byli osobiście obecni przy montażu,
- Wysłanie unikalnego, jednorazowego linku akceptacyjnego (np. `https://klikklima.pl/podpisz/token_uuid`),
- Podpis na ekranie smartfona lub tabletu z podwójną autoryzacją kodem SMS (opcjonalnie).

---

## 3. Schemat Bazy Danych

```prisma
enum SignatureType {
  IN_PERSON_CANVAS   // Rysik / palec na tablecie pracownika
  REMOTE_WEB_LINK    // Zdalny podpis przez link w SMS/mailu
}

enum DocumentSignedType {
  INSTALLATION_CONTRACT    // Umowa montażu klimatyzacji
  HANDOVER_PROTOCOL        // Protokół zdawczo-odbiorczy
  MAINTENANCE_PROTOCOL     // Protokół przeglądu serwisowego
}

model DocumentSignature {
  id              String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  lead_id         String             @db.Uuid
  document_type   DocumentSignedType
  signature_type  SignatureType
  signer_name     String             @db.VarChar(255)
  signer_email    String?            @db.VarChar(255)
  signer_phone    String?            @db.VarChar(32)
  ip_address      String?            @db.VarChar(64)
  user_agent      String?            @db.Text
  document_hash   String             @db.VarChar(64) // SHA-256 z treści dokumentu PDF
  signature_image_url String          @db.Text        // Ścieżka do pliku PNG podpisu w Supabase Storage
  signed_at       DateTime           @default(now()) @db.Timestamptz(6)

  lead            Lead               @relation(fields: [lead_id], references: [id], onDelete: Restrict)

  @@index([lead_id])
  @@map("document_signatures")
}
```

---

## 4. Kryteria Akceptacji
- [ ] Komponent podpisu działa płynnie na urządzeniach mobilnych (iOS Safari, Android Chrome).
- [ ] Złożenie podpisu generuje plik graficzny PNG oraz rejestruje metadane (IP, User-Agent, SHA-256) w bazie.
- [ ] Generator dokumentów PDF automatycznie wkleja obraz podpisu w wyznaczonym polu „Podpis Klienta”.
- [ ] Złożenie podpisu pod protokołem odbioru wywołuje przejście do etapu `INSTALLATION_COMPLETED` i generuje powiadomienie N8.
