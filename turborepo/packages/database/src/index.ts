import { createClient } from '@supabase/supabase-js';

// Poniższe zmienne środowiskowe muszą być dostarczone przez aplikację docelową (B2C/B2B)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Klient Supabase współdzielony w monorepo
export const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing in environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Z czasem pojawią się tu np. wygenerowane typy (database.types.ts) z Supabase CLI
// export * from './database.types';
