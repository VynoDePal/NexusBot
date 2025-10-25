'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

type Role = 'user' | 'assistant'

interface Msg {
	role: Role
	content: string
}

export default function Chat () {
	const [messages, setMessages] = useState<Msg[]>([])
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)
	const endRef = useRef<HTMLDivElement | null>(null)

	const canSend = useMemo(() => input.trim().length > 0 && !loading, [
		input,
		loading,
	])

	const handleSubmit = useCallback(async () => {
		if (!canSend) return
		const userText = input.trim()
		setInput('')
		setMessages(prev => [...prev, { role: 'user', content: userText }])
		setLoading(true)
		try {
			const history = messages.slice(-6)
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message: userText, history }),
			})
			if (!res.body) throw new Error('Pas de flux de réponse')
			const reader = res.body.getReader()
			const decoder = new TextDecoder()
			let assistant = ''
			setMessages(prev => [...prev, { role: 'assistant', content: '' }])
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				assistant += decoder.decode(value)
				setMessages(prev => {
					const copy = [...prev]
					const last = copy[copy.length - 1]
					if (last && last.role === 'assistant') last.content = assistant
					return copy
				})
			}
		} catch (e) {
			setMessages(prev => [
				...prev,
				{
					role: 'assistant',
					content:
						"Une erreur s'est produite lors de l'appel du modèle. Réessayez.",
				},
			])
		} finally {
			setLoading(false)
			endRef.current?.scrollIntoView({ behavior: 'smooth' })
		}
	}, [canSend, input, messages])

	return (
		<div className='flex w-full max-w-3xl flex-col gap-6'>
			<div className='flex flex-col gap-4'>
				{messages.map((m, i) => (
					<div
						key={i}
						className={
							m.role === 'user'
								? 'self-end rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-50'
								: 'self-start rounded-2xl bg-zinc-100 px-4 py-2 text-zinc-900'
						}
					>
						<pre className='whitespace-pre-wrap break-words font-sans'>
							{m.content}
						</pre>
					</div>
				))}
				<div ref={endRef} />
			</div>

			<div className='flex items-center gap-2'>
				<input
					className='w-full rounded-full border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none ring-0 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50'
					placeholder='Posez votre question...'
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault()
							handleSubmit()
						}
					}}
				/>
				<button
					onClick={handleSubmit}
					disabled={!canSend}
					className='rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-50 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900'
				>
					{loading ? 'Envoi…' : 'Envoyer'}
				</button>
			</div>
		</div>
	)
}
