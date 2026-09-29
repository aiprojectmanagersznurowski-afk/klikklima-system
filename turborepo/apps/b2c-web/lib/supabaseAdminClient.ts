import 'server-only';
import { createClient } from '@supabase/supabase-js';

// B2C-RLS-PUBLIC (AC5, migracja 20260929100000_b2c_rls_public_catalog.sql): klient
// serwisowy DEDYKOWANY odczytom, które nie są objęte polityką anon SELECT — dziś wyłącznie
// `cennik_uslug` (D-R1: cennik usług montażowych to NIE jest publiczny katalog produktowy;
// polityka "Public catalog read" została świadomie cofnięta na żywej bazie).
//
// Używają go WYŁĄCZNIE Server Actions, które inaczej czytałyby cennik_uslug przez
// współdzielony `lib/supabaseClient.ts` (ten po AC5 ma tylko klucz anonimowy i dostałby
// pusty zbiór — patrz komentarz w migracji). Pozostałe zapytania w tych samych plikach
// (indoor_units, outdoor_units, available_combinations) nadal mają publiczną politykę
// anon SELECT i mogą bez zmian zostać na `supabase` z lib/supabaseClient.ts.
//
// Nie importuj tego klienta do niczego, co czyta tylko katalog publiczny — to celowe
// pominięcie RLS, ograniczone do przypadku, który go faktycznie wymaga.
// Leniwe tworzenie klienta (dopiero przy pierwszym wywołaniu w Server Action) — zgodnie ze
// wzorcem app/actions/leads.ts i app/actions/getFomoSlots.ts; unika awarii przy imporcie
// modułu w środowiskach, gdzie SUPABASE_SERVICE_ROLE_KEY nie jest jeszcze ustawiony.
export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}
