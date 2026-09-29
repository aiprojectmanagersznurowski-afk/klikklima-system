import { createClient } from '@supabase/supabase-js';

// B2C-RLS-PUBLIC (AC5): wyłącznie klucz anonimowy — RLS aktywne. Brak zmiennej to błąd
// konfiguracji, nie cichy powrót do innego klucza (kiedyś klucz serwisowy omijał RLS na
// całym katalogu B2C). Odczyty wymagające pominięcia RLS mają własny, dedykowany klient
// w Server Action (np. app/actions/leads.ts, app/actions/getFomoSlots.ts), nie ten plik.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Brak konfiguracji: NEXT_PUBLIC_SUPABASE_URL nie jest ustawione.');
}

if (!supabaseAnonKey) {
  throw new Error('Brak konfiguracji: NEXT_PUBLIC_SUPABASE_ANON_KEY nie jest ustawione.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
