import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './env';

let supabaseClient: SupabaseClient | null = null;

if (ENV.SUPABASE_URL && (ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY)) {
  const key = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY;
  supabaseClient = createClient(ENV.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  console.log('[Budigo] Supabase client initialized.');
} else {
  if (ENV.NODE_ENV === 'production') {
    throw new Error('[Budigo] Supabase credentials missing in production. Refusing to run in mock mode.');
  }
  console.log('[Budigo] Supabase credentials not found in env. Running in resilient mock/local mode (Dev/Test only).');
}

export const getSupabase = (): SupabaseClient | null => supabaseClient;

