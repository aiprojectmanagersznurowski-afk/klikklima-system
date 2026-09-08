---
name: verify-source-notes-before-blocking
description: Notatki w polu `source` rejestru wymagań bywają nieaktualne — sprawdź kod, a przy zamykaniu wpisu USUŃ nieprawdziwe zdanie zamiast dopisywać obok
metadata:
  type: feedback
---

Notatka w polu `source` wpisu wymagania jest opisem stanu z DNIA JEJ NAPISANIA, nie faktem.
Przed użyciem jej jako powodu zablokowania albo odłożenia pracy — zweryfikuj kod samodzielnie.
Przy zamykaniu wpisu nieaktualne zdanie USUWA SIĘ (zastępując jawną adnotacją
„DEZAKTUALIZACJA: …, naprawione w commicie X, NIE w tej turze"), a nie dopisuje nową prawdę
obok starej.

**Why:** `CRM-DELETE-ADMIN-ONLY-SERVICES` leżał w TODO jako ostatni z rodziny z powodu notatki
o „martwej ścieżce `prisma.serwisy.delete`", która była nieaktualna od commita `784d8df`.
Notatkę powtórzono jeszcze w polu `source` wpisu `-INCIDENTS` — nieprawda skopiowała się
do drugiego miejsca, zanim ktokolwiek sprawdził kod.

**How to apply:** przy każdym oknie kontraktowym domykającym wpis: (1) przeczytaj ścieżkę kodu
wskazaną w `source` i potwierdź lub obal każde twierdzenie faktograficzne; (2) `grep` tej samej
frazy po całym `requirements.contract.mjs` — jeśli powtórzono ją w innych wpisach, dopisz tam
krótkie SPROSTOWANIE z datą; (3) w nowej notatce rozdziel, co zrobiła TA tura, a co było
wcześniejszym faktem, żeby nie przypisać sobie cudzej naprawy.
