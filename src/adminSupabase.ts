
import { createClient } from '@supabase/supabase-js'

const env = (import.meta as any).env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase admin environment variables')
}

export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})