---
name: fld-quote-basket-select-refused-dead-helpers
description: FLD-QUOTE-BASKET-SELECT — odmowa domknięcia 2026-09-16 (martwe helpery), domknięte na DONE tego samego dnia za drugim podejściem; został wąski dług asercji value={basket.id}
metadata:
  type: project
---

`FLD-QUOTE-BASKET-SELECT` jest od 2026-09-16 na `DONE` (okno `FLD-QUOTE-BASKET-CLOSE`,
gałąź `feat/crm-suite-complete`). Domknięcie nastąpiło za DRUGIM podejściem — pierwsza tura
skończyła się ODMOWĄ, bo dwa z trzech eksportów `basket-select.ts` miały zero konsumentów
w `apps/*/src`: testy dowodziły funkcji, których żaden ekran nie wołał.

Co zamknęło obie dziury (sprawdzone greppem po `apps/*/src`, nie z opisu zlecającego):
`buildCreateBookingPayload` wołane wewnątrz `createBookingAction(...)` w `onSubmit`
dialogu, `findBasketById` wołane w NOWYM `leads/[id]/lead-bookings-list.tsx`, a `page.tsx`
dociąga `prisma.booking.findMany({ where: { leadId } })` i przekazuje ten SAM wariant
`baskets` (komplet z `findMany()` bez `where`) do obu komponentów — dlatego koszyk wycofany
fizycznie dociera do wyszukiwania. 5 plików, 49 przypadków, uruchomione samodzielnie.

**Why:** odmowa zadziałała dokładnie tak, jak miała — wymusiła powstanie konsumenta zamiast
domknięcia na atrapie. Wzorzec z [[feedback_mock_cannot_prove_db_constraint]] w wariancie UI:
podmiotem kryterium „ekran pokazuje" jest EKRAN, nie funkcja pomocnicza.

**How to apply:** przy powrocie do tego obszaru pamiętaj o JEDNYM świadomym długu zapisanym
w `note`: żaden test nie asertuje `value={basket.id}` na `<option>`, więc podmiana na
`basket.code` przechodzi cały zestaw — `buildCreateBookingPayload` jest przepustem (identity),
a obie walidacje Zod to `z.string().min(1)`, nie `.uuid()`. Skutek byłby GŁOŚNY
(`BASKET_NOT_FOUND` przy każdej rezerwacji, FK `onDelete: Restrict` chroni dane), dlatego
nie blokował domknięcia. Zamknięcie to jedna asercja statyczna — zadanie test-authora, patrz
[[project_steward_cannot_write_tests]] i [[feedback_closing_requirement_with_residual_debt]].
Uwaga na pułapkę oceny: „wpięcie helpera" NIE jest tożsame z „dowiedzeniem identyfikatora",
bo helper tylko przepuszcza wartość z formularza.
Aktor i zakres: [[project_fld_quote_basket_select_actor_decided]].
