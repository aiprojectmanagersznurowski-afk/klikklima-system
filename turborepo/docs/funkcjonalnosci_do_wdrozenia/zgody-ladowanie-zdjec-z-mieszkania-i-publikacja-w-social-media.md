# Zgody Marketingowe na Publikację Zdjęć z Realizacji w Social Media

> **Identyfikator zadania Trello:** `MKT-PHOTO-CONSENT`  
> **Kategoria:** Field App (Aplikacja Terenowa) / Security & Tech Debt  
> **Status:** DO WDROŻENIA  
> **Szacowany czas prac:** 10–12 roboczogodzin  

---

## 1. Cel Biznesowy i Kontekst Prawny

Wysokiej jakości zdjęcia gotowych realizacji klimatyzacji w eleganckich wnętrzach (mieszkania, domy, biura) są kluczowym narzędziem generowania leadów w mediach społecznościowych (Instagram, Facebook, TikTok) oraz budowy zaufania na stronie www (portfolio).

Jednocześnie wnętrze mieszkania stanowi strefę prywatną klienta objętą ochroną dóbr osobistych (art. 23 i 24 k.c.) oraz RODO. **Wymagana jest jednoznaczna, dobrowolna i zarejestrowana w systemie zgoda klienta.**

---

## 2. Wymagania Funkcjonalne

1. **Klauzula Zgody w Protokole Odbioru:**
   - Dodatkowy, opcjonalny checkbox przy podpisywaniu protokołu zdawczo-odbiorczego (lub osobny formularz w aplikacji montera):
     > *„Wyrażam zgodę na nieodpłatne wykonanie przez KlikKlima zdjęć zamontowanych jednostek klimatyzacji w moim lokalu oraz ich publikację w celach promocyjnych w serwisie internetowym klikklima.pl oraz profilach w mediach społecznościowych, z zastrzeżeniem anonimizacji (brak publikacji wizerunku osób, danych adresowych czy unikalnych elementów wyposażenia pozwalających na identyfikację).”*
2. **Rejestracja w Bazie Danych:**
   - Pole `social_media_consent: Boolean @default(false)` w modelu `Installation` / `Instalacja`,
   - Zapis stempla czasowego zgody i identyfikatora podpisu.
3. **Flaga w Aplikacji Terenowej (Field App):**
   - Monter podczas wykonywania dokumentacji zdjęciowej (lub audytor) ma możliwość oznaczenia gwiazdką konkretnego zdjęcia: *„Zdjęcie do portfolio (Instagram)”*,
   - Jeśli klient nie zaznaczył zgody, system blokuje oznaczenie zdjęcia jako marketingowego z komunikatem: *„Brak zgody klienta na publikację w social media”*.
4. **Widok w Panelu B2B (Marketing Hub):**
   - Zakładka w panelu CRM filtrująca wyłącznie zdjęcia z instalacji posiadających aktywną zgodę `social_media_consent = true`, gotowe do pobrania przez zespół marketingu w wysokiej rozdzielczości.

---

## 3. Kryteria Akceptacji
- [ ] Formularz protokołu odbioru zawiera opcjonalny checkbox zgody marketingowej.
- [ ] Stan zgody zapisuje się w bazie i jest widoczny w Karcie 360 klienta.
- [ ] Do galerii marketingowej w B2B trafiają wyłącznie zdjęcia z instalacji ze statusem `social_media_consent = true`.
- [ ] Klient ma możliwość wycofania zgody w dowolnym momencie przez kontakt z infolinią/mailem, co automatycznie odznacza zdjęcia w systemie.
