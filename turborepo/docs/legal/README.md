# Dokumenty prawne dla klienta

Katalog przechowuje **wzory dokumentów prawnych w formacie PDF**, które system doręcza klientowi albo daje
mu do podpisu. Powstał na podstawie decyzji **D5 z 2026-09-23** (jeden pakiet dokumentów do opracowania
przez prawnika) — patrz [FIELD-APP-I-PODPISY-ZAKRES.md](../workorders/FIELD-APP-I-PODPISY-ZAKRES.md).

> **Uwaga: dzisiaj wszystkie pliki to wypełniacze.** Mają poprawne tytuły, listę pól i szkielet sekcji,
> ale treść to lorem ipsum. Nie wolno ich użyć wobec klienta. Treść opracowuje prawnik, a pliki zostaną
> podmienione w całości.

## Zawartość pakietu

| Dokument | Plik | Kto podpisuje | Kiedy w przepływie |
|---|---|---|---|
| Umowa o wykonanie montażu | `umowa-montazu-v0.1-lorem.pdf` | klient | po akceptacji oferty, u klienta lub zdalnie |
| Pouczenie o prawie odstąpienia | `pouczenie-o-odstapieniu-v0.1-lorem.pdf` | — (doręczane) | razem z umową |
| Wzór formularza odstąpienia | `formularz-odstapienia-v0.1-lorem.pdf` | — (doręczane) | razem z umową |
| Oświadczenie o żądaniu montażu przed upływem terminu odstąpienia | `oswiadczenie-o-zadaniu-montazu-v0.1-lorem.pdf` | klient | gdy montaż ma się odbyć przed upływem terminu odstąpienia |
| Karta podpisu (ślad dowodowy) | `karta-podpisu-v0.1-lorem.pdf` | — (generowana) | dołączana do każdego podpisanego dokumentu |
| Klauzule informacyjne RODO | `klauzule-rodo-v0.1-lorem.pdf` | — (doręczane) | przy zakładaniu leada i przy umowie |
| Zgoda na doręczanie dokumentów mailem | `zgoda-na-doreczenie-email-v0.1-lorem.pdf` | klient | przed pierwszym doręczeniem dokumentu mailem |

## Nazewnictwo i wersjonowanie

- Nazwa pliku: `<slug>-v<wersja>.pdf`, slug po polsku, małymi literami, z myślnikami, bez znaków
  diakrytycznych (np. `pouczenie-o-odstapieniu-v1.0.pdf`).
- Przyrostek `-lorem` oznacza wypełniacz. **Wersja `1.0` to pierwsza treść od prawnika.**
- Wersje **nie są nadpisywane**: nowa treść to nowy plik z wyższym numerem. Stare pliki zostają, bo
  dokument podpisany przez klienta musi dać się odtworzyć dokładnie w tej wersji, którą widział
  (wymaganie `FLD-SIGN-DOC-FREEZE`).
- Historia zmian wynika z gita; w plikach nie prowadzimy własnych metryk zmian.

## Pola podstawiane przez system

Każdy wzór ma na pierwszej stronie listę pól w formacie `{{nazwa_pola}}`, po angielsku albo po polsku,
zawsze `snake_case`. Przy podmianie treści przez prawnika lista pól musi zostać zachowana albo zgłoszona
do zmiany — to one łączą dokument z danymi w bazie.

## Powiązanie z bazą

Wersje dokumentów prawnych pracowników rejestruje dziś tabela `legal_document_versions` (migracja
`20260821130000`). Dokumenty **klienta** z tego katalogu jeszcze nie mają swojego rejestru w bazie —
to otwarta decyzja: albo rozszerzenie `legal_document_versions` o dokumenty klienta, albo osobna tabela.
Rozstrzygnięcie należy do etapu rejestracji wymagań (`contract-steward`), nie do tego pliku.

Do czasu rozstrzygnięcia obowiązuje zasada: **plik w tym katalogu jest źródłem treści, a baza
przechowuje tylko wskazanie wersji i skrót SHA-256 podpisanego dokumentu.**

## Czego tu nie ma

- Dokumentów dla pracowników (regulaminy, zgody) — te obsługuje `legal_document_versions` i panel B2B.
- Faktur i protokołów odbioru — te generuje system z danych (`DOC-PDF-RENDER`), a nie ze wzoru w tym
  katalogu.
- Podpisanych egzemplarzy klientów — te trafiają do Storage, nigdy do repozytorium.
