import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getRagContext, buildRagPrompt } from '@/lib/rag'
import { OPENROUTER_BASE, getOpenRouterHeaders } from '@/lib/openrouter'

export const dynamic = 'force-dynamic'

const schema = z.object({
	message: z.string().min(1),
	history: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string(),
			}),
		)
		.optional()
		.default([]),
})

export async function POST (req: NextRequest) {
	try {
		const body = await req.json()
		const { message, history } = schema.parse(body)

		const { sources } = await getRagContext(message)
		const messages = buildRagPrompt(message, sources, history)
		const model =
			process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

		const orRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
			method: 'POST',
			headers: getOpenRouterHeaders(),
			body: JSON.stringify({
				model,
				messages,
				stream: true,
			}),
		})

		if (!orRes.ok || !orRes.body) {
			const text = await orRes.text().catch(() => '')
			return new Response(`Erreur OpenRouter: ${text}`, {
				status: 500,
			})
		}

		const encoder = new TextEncoder()
		const decoder = new TextDecoder()
		const stream = new ReadableStream<Uint8Array>({
			start (controller) {
				let buffer = ''
				const reader = orRes.body!.getReader()
				const pump = () => {
					reader.read().then(({ done, value }) => {
						if (done) {
							controller.close()
							return
						}
						buffer += decoder.decode(value, { stream: true })
						const lines = buffer.split('\n')
						buffer = lines.pop() || ''
						for (const line of lines) {
							const trimmed = line.trim()
							if (!trimmed.startsWith('data:')) continue
							const data = trimmed.replace(/^data:\s*/, '')
							if (data === '[DONE]') {
								controller.close()
								return
							}
							try {
								const json = JSON.parse(data)
								const delta =
									json?.choices?.[0]?.delta?.content || ''
								if (delta) controller.enqueue(encoder.encode(delta))
							} catch (err) {
								// ignore malformed SSE chunk but continue streaming
							}
						}
						pump()
					})
				}
				pump()
			},
		})

		return new Response(stream, {
			headers: {
				'content-type': 'text/plain; charset=utf-8',
			},
		})
	} catch (e: any) {
		return new Response(`Erreur: ${e?.message || 'inconnue'}`, {
			status: 400,
		})
	}
}
