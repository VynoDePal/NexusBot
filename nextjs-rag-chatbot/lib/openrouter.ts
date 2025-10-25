export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

function toByteStringSafe (value: string) {
    return value.replace(/[^\x00-\xFF]/g, '')
}

export function getOpenRouterHeaders () {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY manquante')

    const refererRaw = process.env.OPENROUTER_HTTP_REFERRER || ''
    let referer = ''
    if (refererRaw) {
        try {
            referer = toByteStringSafe(encodeURI(refererRaw))
        } catch {
            referer = toByteStringSafe(refererRaw)
        }
    }

    const titleRaw = process.env.OPENROUTER_X_TITLE || 'Next.js RAG Chatbot'
    const title = toByteStringSafe(titleRaw) || 'Next.js RAG Chatbot'

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': title,
    }
    if (referer) headers['HTTP-Referer'] = referer
    return headers
}
