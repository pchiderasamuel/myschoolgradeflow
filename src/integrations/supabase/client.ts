// Environment-validated Supabase client
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ENV from '@/utils/env';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Use generic SupabaseClient to allow access to all tables
// This provides flexibility while the generated types are incomplete
export const supabase: SupabaseClient = createClient(
  ENV.VITE_SUPABASE_URL,
  ENV.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);