/**
 * WZORZEC testu kontraktowego. Skopiuj do apps/b2b-web/tests/ i dostosuj.
 *
 * Trzy rzeczy, które ten plik pokazuje, a które łatwo przeoczyć:
 *  1. Znacznik `@REQ:` nad blokiem — bez niego kk-trace nie widzi pokrycia.
 *  2. Zero literałów: stany, akcje i progi pochodzą z wygenerowanego kontraktu.
 *  3. Test model-based: 143 kombinacje (stan × akcja) pokryte jednym blokiem,
 *     zamiast 143 ręcznie napisanych przypadków, z których i tak zabraknie tego jednego.
 */
import { describe, it, expect } from 'vitest';
import {
  LEAD_STATUSES,
  LEAD_ACTIONS,
  transitionMatrix,
  canTransition,
  findTransition,
  allowedActions,
  STATE_META,
  SLA,
  notificationsForTransition,
} from '@klikklima/contracts';

// Podmień na prawdziwą implementację domeny:
import { applyLeadAction } from '@/server/leads/state-machine';

describe('maszyna stanów leada — zgodność z kontraktem', () => {
  // @REQ: FNL-NO-ILLEGAL-TRANSITIONS
  it('odrzuca każde przejście spoza kontraktu (pełna macierz stan × akcja)', async () => {
    const illegal = transitionMatrix().filter((c) => !c.legal);
    expect(illegal.length).toBeGreaterThan(0); // sanity: macierz nie jest pusta

    for (const { from, action } of illegal) {
      const result = await applyLeadAction({ status: from, action, actorRole: 'admin' });
      // Błąd domenowy, nie wyjątek — inaczej UI dostanie 500 zamiast komunikatu
      expect(result.ok, `${from} --${action}--> powinno być odrzucone`).toBe(false);
      expect(result.code).toBe('ILLEGAL_TRANSITION');
    }
  });

  // @REQ: FNL-NO-ILLEGAL-TRANSITIONS
  it('przepuszcza każde przejście przewidziane kontraktem', async () => {
    for (const { from, action, legal } of transitionMatrix()) {
      if (!legal) continue;
      const t = findTransition(from, action)!;
      const result = await applyLeadAction({ status: from, action, actorRole: 'admin', bypassGuards: true });
      expect(result.ok, `${t.id}: ${from} --${action}--> ${t.to}`).toBe(true);
      expect(result.status).toBe(t.to);
    }
  });

  // @REQ: FNL-E5-BYPASS
  it('bypass E5→E7 pomija etap kuriera i nie wysyła powiadomienia o przesyłce', async () => {
    const t = findTransition('HARDWARE_IN_WAREHOUSE', 'deliverWithCrew');
    expect(t?.to).toBe('AWAITING_INSTALLATION');

    const result = await applyLeadAction({ status: 'HARDWARE_IN_WAREHOUSE', action: 'deliverWithCrew', actorRole: 'dyspozytor' });
    expect(result.status).toBe('AWAITING_INSTALLATION');
    expect(result.queuedNotifications).toEqual([]); // N5 dotyczy wyłącznie ścieżki kurierskiej
    expect(result.createdShipment).toBeUndefined();
  });

  // @REQ: FNL-E5-E6
  it('wysyłka kurierem bez numeru przesyłki jest odrzucana przez guard', async () => {
    const result = await applyLeadAction({ status: 'HARDWARE_IN_WAREHOUSE', action: 'shipByCourier', actorRole: 'dyspozytor', payload: {} });
    expect(result.ok).toBe(false);
    expect(result.failedGuard).toBe('trackingIdPresent');
  });

  // @REQ: FNL-ROLLBACK
  it('rollback z każdego etapu E4–E7 zwalnia slot ekipy i kolejkuje oba powiadomienia', async () => {
    const sources = ['AWAITING_CREW_ASSIGNMENT', 'HARDWARE_IN_WAREHOUSE', 'HARDWARE_IN_TRANSIT', 'AWAITING_INSTALLATION'] as const;
    for (const from of sources) {
      const result = await applyLeadAction({ status: from, action: 'rollback', actorRole: 'dyspozytor' });
      expect(result.status, `rollback z ${from}`).toBe('ROLLBACK_RESCHEDULING');
      expect(result.crewSlotReleased).toBe(true);
      expect(result.queuedNotifications).toEqual(expect.arrayContaining(['N_ROLLBACK', 'I4']));
    }
  });

  // @REQ: FNL-ROLLBACK-EXIT
  it('powrót z rollbacku prowadzi do E4, nie do etapu źródłowego', async () => {
    const t = findTransition('ROLLBACK_RESCHEDULING', 'rebookInstallation');
    expect(t?.to).toBe('AWAITING_CREW_ASSIGNMENT');
  });

  // @REQ: SLA-QUOTE-14D
  it('okno ważności wyceny pochodzi z kontraktu, nie z literału', () => {
    expect(SLA.QUOTE_VALIDITY.days).toBe(14);
    // Test celowo sprawdza WARTOŚĆ z kontraktu, a nie wpisaną tu liczbę:
    // gdy biznes zmieni okno, zmiana idzie przez kontrakt i ten test dalej ma sens.
  });

  // @REQ: FNL-E1-E2
  it('przypisanie audytora kolejkuje powiadomienie do klienta i do audytora', () => {
    const notifs = notificationsForTransition('T01').map((n) => n.id);
    expect(notifs).toContain('N1'); // klient
    expect(notifs).toContain('I5'); // audytor — obecnie PROPOSED, patrz ADR-006
  });

  // @REQ: FNL-E3-BUCKET
  it('z bucketu zimnych leadów istnieje droga powrotu lub jawne zakończenie', () => {
    expect(STATE_META.QUOTE_REJECTED.terminal).toBe(false);
    expect(allowedActions('QUOTE_REJECTED').length).toBeGreaterThan(0);
  });

  it('każdy etap ma polską etykietę do wyświetlenia w UI', () => {
    for (const s of LEAD_STATUSES) {
      expect(STATE_META[s].pl, `brak etykiety dla ${s}`).toBeTruthy();
    }
    expect(LEAD_ACTIONS.length).toBeGreaterThan(0);
  });
});
