import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AuthSession } from '../types';

let supabaseInstance: SupabaseClient | null = null;
let currentSession: AuthSession | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fake-supabase-url.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'fake-anon-key';
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export function getCurrentSession(): AuthSession | null {
  return currentSession;
}

export function setCurrentSession(session: AuthSession | null): void {
  currentSession = session;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
  currentSession = null;
}
