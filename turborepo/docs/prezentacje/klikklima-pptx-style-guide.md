# Klik Klima — Korporacyjny Style Guide do Prezentacji PPTX

> **Cel dokumentu:** to jest specyfikacja referencyjna przeznaczona do przekazywania innym agentom AI (np. przy poleceniu „wygeneruj prezentację PPTX w stylu Klik Klima”). Agent generujący prezentację powinien stosować się do wszystkich wartości liczbowych, kolorów i układów podanych poniżej bez ich modyfikowania, chyba że użytkownik jawnie poprosi o odstępstwo.

---

## 1. Tożsamość marki

| Pole | Wartość |
|---|---|
| Nazwa firmy | Klik Klima (Klik Klima Michał Sznurowski) |
| Branża | Klimatyzacja — sprzedaż, montaż, serwis urządzeń premium (HVAC) |
| Pozycjonowanie | Lokalna, ale systemowa/technologiczna firma instalacyjna; transparentność cenowa, brak ukrytych kosztów, szybkość (montaż w 1 dzień) |
| Ton głosu | Rzeczowy, konkretny, uspokajający, bez zbędnego marketingowego szumu. Krótkie zdania. Liczby i konkrety zamiast ogólników („montaż w 1 dzień”, „gwarancja 5 lat”, a nie „najlepsza jakość”) |
| Motto/claim | „Idealna temperatura przez cały rok” |
| Domena wizualna | Chłód / czystość / precyzja — stąd chłodna paleta niebieskiego + granatu, dużo światła (jasne tła), zaokrąglone, „miękkie” kształty geometryczne |

---

## 2. Paleta kolorów

Wartości pobrane bezpośrednio ze zmiennych CSS produktu (design system Klik Klima). Używać dokładnie tych HEX-ów — nie generować zbliżonych odcieni.

### Kolory podstawowe

| Rola | HEX | RGB | Zastosowanie w prezentacji |
|---|---|---|---|
| **Primary** (marka) | `#1750C8` | 23, 80, 200 | Nagłówki slajdów tytułowych/sekcji, kluczowe akcenty, paski, ramki wykresów, przyciski CTA |
| **Accent** (woda/chłód) | `#38B6E8` | 56, 182, 232 | Elementy drugorzędne, ikony, podkreślenia, gradient z Primary (np. w tle slajdu tytułowego) |
| **Foreground / tekst główny** | `#0D1B2E` | 13, 27, 46 | Cały tekst podstawowy na jasnym tle, nagłówki na jasnym tle |
| **Background** | `#F7F8FC` | 247, 248, 252 | Tło slajdów treściowych (zamiast czystej bieli) |
| **Card / białe pole** | `#FFFFFF` | 255, 255, 255 | Karty, boxy, tabele, pola pod treść |
| **Secondary (jasny niebieski)** | `#EEF2FB` | 238, 242, 251 | Tła sekcji/paneli pobocznych, tła ikon |
| **Muted (tło stonowane)** | `#E8ECF4` | 232, 236, 244 | Separatory, tła nieaktywnych elementów |
| **Muted foreground (tekst pomocniczy)** | `#5A6782` | 90, 103, 130 | Podpisy, daty, stopki, tekst drugorzędny |
| **Border** | `#0D1B2E` przy 9% opacity (`#0D1B2E17`) | — | Cienkie linie/obramowania kart |
| **Destructive / uwaga** | `#D4183D` | 212, 24, 61 | Wyłącznie do ostrzeżeń, błędów, „przed/po” w kontraście — używać oszczędnie |

### Paleta wykresów (chart palette) — do wykresów, KPI, diagramów

| # | HEX | Sugerowane użycie |
|---|---|---|
| Chart 1 | `#F05100` | Kategoria/seria 1 (kontrast wobec niebieskiego — ciepło vs. chłód) |
| Chart 2 | `#009588` | Kategoria/seria 2 |
| Chart 3 | `#104E64` | Kategoria/seria 3 (ciemny, do teł/etykiet) |
| Chart 4 | `#FCBB00` | Kategoria/seria 4 |
| Chart 5 | `#F99C00` | Kategoria/seria 5 |

Zasada: gdy wykres ma tylko 1–2 serie, używać **Primary (`#1750C8`)** + **Accent (`#38B6E8`)**. Powyższą paletę chart 1–5 stosować dopiero przy 3+ seriach/kategoriach.

### HEX bez „#” (do bibliotek typu python-pptx, `RGBColor`)

`1750C8` · `38B6E8` · `0D1B2E` · `F7F8FC` · `FFFFFF` · `EEF2FB` · `E8ECF4` · `5A6782` · `D4183D` · `F05100` · `009588` · `104E64` · `FCBB00` · `F99C00`

---

## 3. Typografia

| Poziom | Font | Waga | Rozmiar (16:9, slajd 13.33×7.5in) | Kolor domyślny |
|---|---|---|---|---|
| Font podstawowy marki | **Plus Jakarta Sans** (Google Fonts) | — | — | — |
| Fallback (gdy Plus Jakarta Sans niedostępny w silniku PPTX) | **Poppins** → w ostateczności **Segoe UI / Arial** | — | — | — |
| Tytuł slajdu tytułowego (H1) | Plus Jakarta Sans | ExtraBold (800) | 44–54 pt | Białytekst na tle Primary/gradiencie, lub `#0D1B2E` na jasnym tle |
| Nagłówek sekcji (H2) | Plus Jakarta Sans | Bold (700) | 32–36 pt | `#0D1B2E` |
| Podtytuł/lead | Plus Jakarta Sans | Medium (500) | 18–20 pt | `#5A6782` |
| Treść / body | Plus Jakarta Sans | Regular (400) | 16–18 pt | `#0D1B2E` |
| Etykieta/eyebrow (np. „NASZE STANDARDY”) | Plus Jakarta Sans | SemiBold (600), **CAPS**, letter-spacing zwiększony | 11–12 pt | Primary `#1750C8` lub Accent `#38B6E8` |
| Podpis/stopka | Plus Jakarta Sans | Regular (400) | 10–11 pt | `#5A6782` |

Zasada eyebrow: krótkie etykiety kategorii nad nagłówkiem sekcji piszemy WERSALIKAMI, w kolorze marki — to rozpoznawalny element identyfikacji Klik Klima (wzór ze strony: „NASZE STANDARDY”, „JAK DZIAŁAMY?”, „KATALOG URZĄDZEŃ”).

---

## 4. Logo

- Plik: `logo.png` (znak: litery „KK” w formie ptaszka/checka, ciemnogranatowy `#0D1B2E` + niebieski gradient `#1750C8→#38B6E8`, uzupełniony o fasetowaną „kroplę/kryształ lodu” w prawym górnym rogu; pod spodem wordmark „Klik Klima” w `#0D1B2E`, font zaokrąglony geometryczny).
- Warianty do przygotowania: pełne logo (znak + wordmark) na jasnym tle; sama ikona „KK+kropla” jako favicon/watermark na ciemnym/kolorowym tle.
- Minimalny margines wokół logo: równy wysokości litery „K” w znaku.
- **Nie wolno**: zmieniać proporcji, kolorować znaku na inny kolor niż navy/blue, umieszczać na tle o zbliżonej jasności (np. jasnoniebieskim) bez obwódki/karty.
- Umiejscowienie standardowe: lewy górny róg każdego slajdu treściowego (mała wersja, ok. 0.9–1.2 cm wysokości) + pełne logo na slajdzie tytułowym i końcowym.

---

## 5. Format i siatka slajdu

| Parametr | Wartość |
|---|---|
| Proporcje | 16:9 |
| Wymiary | 13.333 in × 7.5 in (33.87 cm × 19.05 cm) |
| Marginesy zewnętrzne (safe area) | 0.6 in (≈1.5 cm) z każdej strony |
| Strefa nagłówka slajdu treściowego | góra 0–1.1 in: eyebrow (opcjonalnie) + H2 |
| Strefa treści | 1.3–6.6 in |
| Strefa stopki | 6.9–7.5 in: nr slajdu (prawy dół), logo/mini-znak (lewy dół), nazwa sekcji (środek, opcjonalnie) |
| Promień zaokrągleń kart/boxów | **16px / 0.17 in / 1rem** — spójny z produktem (wszystkie karty, przyciski, obrazy w ramkach mają identyczny promień) |
| Cień kart | Delikatny, rozproszony: offset y ~4px, blur ~16px, kolor `#0D1B2E` przy 8–12% opacity — nigdy twardy/ostry cień |
| Odstępy (grid gutter) | Bazowa jednostka odstępu: 8px/0.083in — wszystkie marginesy i odstępy wielokrotnością tej jednostki (8, 16, 24, 32, 48px) |

---

## 6. Komponenty i elementy UI (do przenoszenia na slajdy)

- **Przycisk/CTA**: tło Primary `#1750C8` (lub przezroczyste z obramowaniem na ciemnym tle), tekst biały, promień 16px, padding ok. 0.12×0.28 in.
- **Badge/tag** (wzorowany na „Bestseller” ze strony): mały prostokąt z zaokrąglonymi rogami, tło Accent lub Primary przy 12–15% opacity, tekst w kolorze pełnym tej samej barwy, caps, 9–10pt.
- **Karta (card)**: tło białe `#FFFFFF`, cienka obwódka `#0D1B2E` @9% opacity, promień 16px, cień jak wyżej — używana jako kontener dla bloków treści, statystyk, kroków procesu.
- **Ikony**: liniowe, jednokolorowe (Primary lub Accent), umieszczone w okrągłym/zaokrąglonym kwadratowym tle Secondary `#EEF2FB`.
- **Numeracja kroków procesu**: duża cyfra (1, 2, 3…) w kole wypełnionym gradientem Primary→Accent lub samym Primary, tekst biały, obok krótki nagłówek + opis (wzór z sekcji „Twoja droga do komfortu”).
- **Linie/dividery**: 1px, kolor Border `#0D1B2E17`.

---

## 7. Szablony slajdów (layouty)

Każdy layout opisany jako: **cel**, **elementy**, **rozmieszczenie** (współrzędne w calach dla płótna 13.333×7.5in, punkt 0,0 = lewy górny róg).

### 7.1 Slajd tytułowy
- Cel: otwarcie prezentacji.
- Tło: pełny gradient diagonalny Primary → Accent (`#1750C8` → `#38B6E8`), lub granatowe tło pełne `#0D1B2E` z dużym akcentem Accent w rogu.
- Elementy: logo pełne (góra-lewo, 0.6/0.5, wys. ~0.6in), tytuł H1 biały wyśrodkowany pionowo (pozycja ok. y=2.8–4.2in), podtytuł/lead poniżej (18-20pt, biały przy 85% opacity), data/nazwa odbiorcy na dole (y=6.8in, 11pt).

### 7.2 Slajd sekcji / rozdział
- Cel: separator między częściami prezentacji.
- Tło: Primary pełny lub Secondary jasny.
- Elementy: eyebrow (np. „CZĘŚĆ 01”) + duży H2 (36-40pt) wyśrodkowany, cienka linia dekoracyjna Accent pod tekstem.

### 7.3 Agenda / spis treści
- Eyebrow „AGENDA” + H2, lista punktów (max 5-6) jako karty w jednej kolumnie lub siatce 2×3, każda karta: numer + tytuł punktu.

### 7.4 Treść z listą punktów (1 kolumna)
- Eyebrow + H2 (x=0.6, y=0.5), pod spodem 3–5 bulletów (x=0.6, y=1.6, szerokość 12.1in), każdy bullet: mała ikonka/kropka Accent + tekst body 16-18pt, odstęp między bulletami 0.25in.

### 7.5 Dwie kolumny / porównanie
- H2 na górze na całą szerokość. Dwie karty równej szerokości (5.9in każda, gap 0.3in) od y=1.5 do y=6.6, każda z własnym mini-nagłówkiem (kolor Primary dla lewej, neutralny/Muted dla prawej przy porównaniu „przed/po” lub „my/konkurencja”).

### 7.6 Zdjęcie/grafika + tekst
- Podział 50/50 lub 60/40: obraz w karcie z promieniem 16px po jednej stronie (pełna wysokość strefy treści), tekst (eyebrow + H2 + 2-3 bullet/akapit) po drugiej.

### 7.7 Dane / KPI / wykres
- H2 na górze. Do 4 kafelków KPI w rzędzie (szer. ~2.9in każdy) — duża liczba (Primary, 32-36pt bold) + etykieta pod spodem (Muted foreground, 12pt); LUB pojedynczy wykres na pełną szerokość strefy treści z paletą chart z sekcji 2. Legenda pod wykresem, 11pt.

### 7.8 Proces / kroki (numerowany)
- Wzorowany na sekcji „Twoja droga do komfortu”: 3–4 kroki w rzędzie poziomym, każdy: koło z numerem (Primary), nagłówek kroku (bold, 16pt), krótki opis (14pt, Muted foreground). Opcjonalnie cienka linia łącząca koła.

### 7.9 Cytat / opinia klienta
- Duży cudzysłów dekoracyjny w Accent, cytat wyśrodkowany (20-24pt, italic lub medium), pod spodem imię/nazwisko + rola (14pt, Muted foreground), całość na tle karty Secondary.

### 7.10 Tabela / cennik / porównanie ofert
- Nagłówek tabeli: tło Primary, tekst biały, bold. Wiersze naprzemiennie białe/`#F7F8FC`. Obramowania Border. Kolumna/wiersz wyróżniony (np. rekomendowany plan) — obramowanie Accent 2pt + badge „Polecane”.

### 7.11 Zespół / kontakt osób
- Siatka kart (2-4 kolumny), każda karta: zdjęcie/awatar w kole, imię i nazwisko (bold 16pt), rola (Muted foreground 13pt), opcjonalnie ikony kontaktu.

### 7.12 Podsumowanie / CTA
- Tło Primary lub gradient jak slajd tytułowy. Duży nagłówek (H2, biały), krótki opis, przycisk CTA (biały z tekstem Primary lub obrys biały). Dane kontaktowe na dole (telefon, e-mail, adres — wzorem stopki strony).

### 7.13 Slajd końcowy „Dziękujemy”
- Analogiczny do tytułowego: logo, „Dziękujemy” jako H1, dane kontaktowe (telefon, e-mail, www), stopka z NIP/nazwą pełną firmy jeśli wymagana formalnie.

---

## 8. Zasady redakcyjne treści

- Nagłówki krótkie, konkretne, bez ozdobników („Montaż w 1 dzień”, nie „Niesamowicie szybki montaż!”).
- Bullet pointy: maksymalnie 5-6 na slajd, każdy 1 linia lub maks. 2 linie tekstu.
- Liczby i konkrety zamiast przymiotników marketingowych (5 lat gwarancji, 2 minuty na wycenę, VAT 8%).
- Eyebrow/etykiety kategorii zawsze WERSALIKAMI, krótkie (2-4 słowa).
- Ton: transparentny, spokojny, techniczny, ale przystępny — zero agresywnego sprzedażowego języka.

---

## 9. Wskazówki techniczne dla agenta generującego plik PPTX

1. Domyślny rozmiar slajdu: `Inches(13.333) x Inches(7.5)` (16:9).
2. Kolory podawać jako `RGBColor` z wartości HEX z sekcji 2 (bez „#”).
3. Jeśli biblioteka nie ma dostępu do fontu „Plus Jakarta Sans”, ustawić „Poppins”, a w ostateczności „Segoe UI” — nigdy Times New Roman / Calibri domyślny.
4. Wszystkie prostokąty/karty/zdjęcia: ustawiać zaokrąglone rogi (16px / 0.17in) tam, gdzie silnik na to pozwala (np. `MSO_SHAPE.ROUNDED_RECTANGLE`).
5. Zachowywać marginesy 0.6in i jednostkę odstępu 8px/0.083in przy rozmieszczaniu elementów.
6. Numer slajdu zawsze w prawym dolnym rogu (10pt, Muted foreground), poza slajdem tytułowym i sekcyjnym.
7. Logo (mini-wersja) w lewym górnym rogu każdego slajdu treściowego, poza tytułowym/końcowym gdzie występuje pełna wersja wyśrodkowana.
8. Nie wprowadzać nowych kolorów/fontów spoza tego dokumentu bez wyraźnej prośby użytkownika.

---

## 10. Checklist końcowa przed eksportem

- [ ] Wszystkie kolory zgodne z paletą z sekcji 2 (brak „przybliżonych” odcieni).
- [ ] Font: Plus Jakarta Sans / Poppins we wszystkich polach tekstowych.
- [ ] Zaokrąglenia 16px konsekwentnie na kartach, przyciskach, obrazach.
- [ ] Logo obecne na slajdzie tytułowym, końcowym i w mini-wersji na slajdach treściowych.
- [ ] Numeracja slajdów widoczna od 2. slajdu.
- [ ] Maks. 5-6 bulletów na slajd, brak ścian tekstu.
- [ ] Dane kontaktowe na slajdzie końcowym zgodne z: +48 600 928 882 · kontakt@klikklima.pl · Zakładowa 7a/24, 50-231 Wrocław.

---

*Dokument źródłowy stylu: klikklima-system.vercel.app (design system produktu). Aktualizacja: 2026-09-17.*
