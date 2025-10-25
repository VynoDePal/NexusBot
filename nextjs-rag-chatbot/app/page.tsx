import Chat from '@/components/chat'

export default function Home () {
	return (
		<div className='flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black'>
			<main className='flex min-h-screen w-full max-w-3xl flex-col items-start justify-start gap-10 py-16 px-6 sm:px-10 bg-white dark:bg-black'>
				<h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
					Chatbot RAG Next.js
				</h1>
				<p className='text-sm text-zinc-600 dark:text-zinc-400'>
					Entrez une question, la réponse sera enrichie par le contexte
					retrouvé (RAG).
				</p>
				<Chat />
			</main>
		</div>
	)
}
