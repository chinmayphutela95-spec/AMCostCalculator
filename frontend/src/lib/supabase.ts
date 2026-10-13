import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Supabase is used for sign-in only — all data goes through the backend API.
 * null when not configured: the local desktop setup, where there is no sign-in.
 */
export const supabase = url && key ? createClient(url, key) : null
