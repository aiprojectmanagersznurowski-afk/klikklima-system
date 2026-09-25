import { prisma } from '@repo/database';
import { ROLES } from '@klikklima/contracts';
import { createClient } from '../../utils/supabase/server';
import type { VerifyFieldActorResult, FieldActorRole } from './types';

/**
 * verifyFieldActor — Weryfikuje tożsamość i uprawnienia pracownika terenowego z nagłówka Authorization.
 * Zgodne z ADR-013 oraz kryteriami AC1 i AC2 wymagania FLD-API-LAYER:
 * - Pobiera token Bearer z nagłówka
 * - Waliduje token przez Supabase Auth
 * - Sprawdza rolę w tabeli AuthorizedUser
 * - Sprawdza status blokady (is_active / aktywny) dla audytora / ekipy (FLD-AUTH-BLOCKED)
 * - Odporny na próby podszywania się przez nagłówki lub treść żądania
 */
export async function verifyFieldActor(request: Request): Promise<VerifyFieldActorResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { success: false, status: 401, error: 'Brak nagłówka autoryzacyjnego' };
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return { success: false, status: 401, error: 'Nieprawidłowy lub wygasły token' };
  }

  const token = parts[1];

  let userEmail: string;
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || !user.email) {
      return { success: false, status: 401, error: 'Nieprawidłowy lub wygasły token' };
    }
    userEmail = user.email;
  } catch (err) {
    console.error('Błąd weryfikacji tokenu w verifyFieldActor:', err);
    return { success: false, status: 401, error: 'Błąd weryfikacji tożsamości' };
  }

  // Odpytanie bazy o uprawnienia użytkownika
  const authUser = await prisma.authorizedUser.findUnique({
    where: { email: userEmail },
  });

  if (!authUser) {
    return { success: false, status: 403, error: 'Konto użytkownika nie zostało autoryzowane' };
  }

  const role = authUser.role as FieldActorRole;
  if (!ROLES.includes(role)) {
    return { success: false, status: 403, error: 'Konto użytkownika nie zostało autoryzowane' };
  }

  let entityId = authUser.id;
  let isActive = true;

  if (role === 'audytor') {
    const matches = await prisma.audytorzy.findMany({
      where: { email: userEmail },
      take: 2,
    });
    if (matches.length !== 1) {
      return { success: false, status: 403, error: 'Niespójność profilu pracownika' };
    }
    const auditor = matches[0];
    if (auditor.is_active === false) {
      return { success: false, status: 403, error: 'Konto audytora zostało zablokowane' };
    }
    entityId = auditor.id;
    isActive = auditor.is_active ?? true;
  } else if (role === 'monter') {
    const matches = await prisma.zespoly_monterskie.findMany({
      where: { email: userEmail },
      take: 2,
    });
    if (matches.length !== 1) {
      return { success: false, status: 403, error: 'Niespójność profilu pracownika' };
    }
    const crew = matches[0];
    if (crew.aktywny === false) {
      return { success: false, status: 403, error: 'Zespół został zablokowany' };
    }
    entityId = crew.id;
    isActive = crew.aktywny ?? true;
  }

  return {
    success: true,
    actor: {
      email: userEmail,
      role,
      entityId,
      isActive,
    },
  };
}
