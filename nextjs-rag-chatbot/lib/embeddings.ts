import type OpenAI from 'openai'

let supabasePipePromise: Promise<any> | null = null
async function getSupabasePipe () {
    if (!supabasePipePromise) {
        supabasePipePromise = (async () => {
            const { pipeline } = await import('@xenova/transformers')
            const modelId =
                process.env.SUPABASE_EMBEDDING_MODEL || 'Supabase/gte-small'
            const pipe = await pipeline('feature-extraction', modelId)
            return pipe
        })()
    }
    return supabasePipePromise
}

export async function generateEmbedding (text: string) {
	const provider =
		(process.env.EMBEDDINGS_PROVIDER || 'supabase').toLowerCase()
	const input = text.replace(/\s+/g, ' ').trim()

	if (provider === 'openai') {
		const apiKey = process.env.OPENAI_API_KEY
		if (!apiKey) throw new Error('OPENAI_API_KEY manquante')
		const model =
			process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
		const { default: OpenAIImpl }: { default: typeof OpenAI } = await import(
			'openai'
		)
		const client = new OpenAIImpl({ apiKey })
		const res = await client.embeddings.create({ model, input })
		const vector = res.data[0]?.embedding
		if (!vector) throw new Error('Embedding non généré')
		return vector
	}

	// provider: 'supabase' via Transformers.js (Supabase/gte-small)
    const pipe = await getSupabasePipe()
    const output = await pipe(input, { pooling: 'mean', normalize: true })
    const vector = Array.from(output.data as Float32Array)
    return vector
}
