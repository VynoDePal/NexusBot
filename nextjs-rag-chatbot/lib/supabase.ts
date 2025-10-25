import { createClient } from '@supabase/supabase-js'

export function getSupabaseClient () {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const serviceRole = process.env.SUPABASE_SERVICE_ROLE
	const anon = process.env.SUPABASE_ANON_KEY
	const key = serviceRole || anon
	if (!url || !key) {
		throw new Error('Supabase env vars manquantes: NEXT_PUBLIC_SUPABASE_URL et clé')
	}
	return createClient(url, key, {
		auth: { persistSession: false },
	})
}
