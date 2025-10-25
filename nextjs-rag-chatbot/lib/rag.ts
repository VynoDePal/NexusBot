import { getSupabaseClient } from './supabase'
import { generateEmbedding } from './embeddings'

export interface RagSource {
	id: number
	documentId: number
	content: string
	similarity?: number
}

export async function getRagContext (query: string) {
	const provider = (process.env.EMBEDDINGS_PROVIDER || 'supabase').toLowerCase()
	const hasOpenAI = !!process.env.OPENAI_API_KEY
	const hasSupabase = !!(
		process.env.NEXT_PUBLIC_SUPABASE_URL &&
		(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY)
	)

	if (!hasSupabase) {
		return { context: '', sources: [] as RagSource[] }
	}
	if (provider === 'openai' && !hasOpenAI) {
		return { context: '', sources: [] as RagSource[] }
	}

	let embedding: number[] | null = null
	try {
		embedding = await generateEmbedding(query)
	} catch {
		return { context: '', sources: [] as RagSource[] }
	}

	let supabase
	try {
		supabase = getSupabaseClient()
	} catch {
		return { context: '', sources: [] as RagSource[] }
	}

	const threshold = parseFloat(
		process.env.RAG_MATCH_THRESHOLD || '0.78',
	)
	const matchCount = parseInt(process.env.RAG_MATCH_COUNT || '8', 10)

	// Appelle la fonction SQL match_documents si disponible
	const { data, error } = await supabase.rpc('match_documents', {
		query_embedding: embedding,
		match_threshold: threshold,
		match_count: matchCount,
	})

	if (error) {
		// Retourne un contexte vide si la fonction n'existe pas encore
		return { context: '', sources: [] as RagSource[] }
	}

	const sources = (data || []).map((row: any) => ({
		id: row.id as number,
		documentId: (row.document_id || row.documentId) as number,
		content: row.content as string,
		similarity: row.similarity as number | undefined,
	})) as RagSource[]

	const context = sources
		.map(s => `- ${s.content}`)
		.join('\n')

	return { context, sources }
}

export function buildRagPrompt (
	query: string,
	sources: RagSource[],
	history: { role: 'user' | 'assistant'; content: string }[] = [],
) {
	const context = sources.map(s => `- ${s.content}`).join('\n')
	const sys = [
		'Vous êtes un assistant utile et concis.',
		'Utilisez EXCLUSIVEMENT le contexte ci-dessous pour répondre.',
		"Si l'information n'est pas présente, dites que vous ne savez pas.",
		'Répondez en français.',
	].join(' ')

	const messages = [
		{ role: 'system', content: sys },
		{
			role: 'user',
			content: `Contexte:\n${context}\n\nQuestion: ${query}`,
		},
		...history,
	]

	return messages
}
