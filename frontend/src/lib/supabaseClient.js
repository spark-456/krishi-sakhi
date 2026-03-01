/**
 * Supabase Client Singleton
 * ─────────────────────────
 * Single source of truth for the Supabase client instance.
 * Import `supabase` from this file everywhere — never call createClient elsewhere.
 *
 * @see frontend-engineer.md §4
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. ' +
        'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in frontend/.env'
    )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
