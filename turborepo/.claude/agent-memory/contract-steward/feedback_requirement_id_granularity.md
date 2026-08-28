---
name: requirement-id-granularity
description: Michal woli mniej ID wymagań o szerszym zakresie (jedno ID na encję, obejmujące create i update) zamiast osobnego ID na każdą operację — pod warunkiem że acceptance wymienia każdy tryb jawnie
metadata:
  type: feedback
---

Gdy Work Order proponuje rozbicie na osobne ID per operacja (`*-CREATE`, `*-UPDATE`), domyślnie
scal je w **jedno ID na encję**, jeżeli operacje dzielą implementację. Podziel po ENCJI, nie po
operacji. Tak zarejestrowano `CRM-AUDYT-KARTOTEKA` i `CRM-ZESP-KARTOTEKA` (2026-08-28) mimo
czterech ID proponowanych w WO — decyzja Michala, nie moja propozycja.

**Why:** tworzenie i edycja w tym repo współdzielą modal, schemat Zod, mapowanie
`FormData → Prisma` i ścieżkę uploadu. Cztery ID rozbiłyby jedno pokrycie na cztery częściowe
i zmusiły do pisania tego samego mapowania dwa razy. Encje natomiast **realnie różnią się polami**
(audytor: adres z autouzupełnianiem, `preferowane_marki`; zespół: `liczba_brygad` NOT NULL
`@default(1)`, `posiada_wiertnice`) — tam scalanie byłoby fałszywe.

**How to apply:** przy scalaniu ID `acceptance` **musi wymieniać każdy tryb jawnie** (osobne
kryteria na tworzenie i na edycję), inaczej `kk-trace` policzy pokrycie, którego nie ma —
dopasowuje samo ID w komentarzu testu, nie kryteria. Nie kopiuj też kryteriów między encjami
„dla symetrii": pole, którego druga tabela nie ma, jest kryterium niewykonalnym.
Powiązane: [[requirement-status-drift]].
