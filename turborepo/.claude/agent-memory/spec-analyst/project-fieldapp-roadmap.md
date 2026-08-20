---
name: project-fieldapp-roadmap
description: Siedmiofazowa mapa drogowa Field App (faza 0 = fundament kontraktowy) — czym uzasadniać zakres i co odsyłać do późniejszej fazy
metadata:
  type: project
---

Field App jest planowany fazami 0-6: **0** fundament kontraktowy (wymagania `FLD-*`, progi
geofencingu, rozdzielenie dostępności, model zgód RODO), **1** migracja dziesięciu tabel z ADR-012,
**2** kolejka powiadomień i integracje SMS/e-mail/push, **3** `apps/field-app` (React Native + Expo),
**4** silnik dostępności (`availability_rules`/`bookings`/`absences`) i Google Calendar,
**5** kalkulator, oferta trójwariantowa i PDF, **6** płatności i wypłaty.

**Why:** numeracja faz nie występuje w żadnym dokumencie w repo — `field_app_requirements.md`
i `docs/DECISIONS.md` mówią o wersjach v1/v2/v3 aplikacji, co jest inną osią podziału. Faza jest
jednostką planowania pracy, wersja jednostką zakresu produktu; mylenie ich prowadzi do WO
wciągających pracę z faz 3-6.

**How to apply:** planując cokolwiek z domeny Field App, najpierw ustal fazę i wypisz w sekcji
„Poza zakresem" to, co należy do późniejszych. Uzasadnienie „to faza N" jest w tym projekcie
akceptowanym powodem odmowy rozszerzenia zakresu. Stan na 2026-08-21: faza 0 zaplanowana
(`docs/workorders/FLD-FOUNDATION.md` + cztery WO), nic z niej jeszcze niezaimplementowane.

Powiązane: [[feedback-workorder-sizing]], [[repo-drift-traps]]
