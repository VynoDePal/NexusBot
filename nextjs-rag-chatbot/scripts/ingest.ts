import fs from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'
import { getSupabaseClient } from '../lib/supabase'
import { generateEmbedding } from '../lib/embeddings'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function readFileContent (filePath: string) {
	const ext = path.extname(filePath).toLowerCase()
	if (ext === '.pdf') {
		const buf = await fs.readFile(filePath)
		const mod: any = await import('pdf-parse')
		const pdfParse = mod.default || mod
		const out = await pdfParse(buf)
		return String(out.text || '')
	}
	return await fs.readFile(filePath, 'utf8')
}

function splitIntoChunks (
    text: string,
    chunkSize = 800,
    overlap = 100,
    max?: number,
) {
    const clean = text.replace(/\r\n/g, '\n').trim()
    const chunks: string[] = []
    let i = 0
    while (i < clean.length) {
        const end = Math.min(i + chunkSize, clean.length)
        const part = clean.slice(i, end)
        chunks.push(part)
        if (typeof max === 'number' && chunks.length >= Math.max(0, max)) break
        i = end - overlap
        if (i < 0) i = 0
        if (i >= clean.length) break
    }
    return chunks.filter(c => c.trim().length > 0)
}

async function main () {
	const fileArgIndex = process.argv.findIndex(a => a === '--file')
	if (fileArgIndex === -1 || !process.argv[fileArgIndex + 1]) {
		console.error('Usage: npm run ingest -- --file <path-to-md-txt-or-pdf> [--chunk-size 400] [--overlap 50] [--max-chunks 200]')
		process.exit(1)
	}
	const filePath = path.resolve(process.cwd(), process.argv[fileArgIndex + 1])
    let content = await readFileContent(filePath)
    const title = path.basename(filePath)

	const getArg = (name: string, fallback?: number) => {
		const i = process.argv.findIndex(a => a === `--${name}`)
		if (i !== -1 && process.argv[i + 1]) {
			const v = parseInt(process.argv[i + 1] || '', 10)
			if (!Number.isNaN(v)) return v
		}
		return fallback
	}

    const chunkSize = getArg('chunk-size', 800) as number
    const overlap = getArg('overlap', 100) as number
    const maxChunks = getArg('max-chunks')
    const maxChars = getArg('max-chars')

    if (typeof maxChars === 'number' && maxChars > 0) {
        content = content.slice(0, maxChars)
    }

    const chunks = splitIntoChunks(content, chunkSize, overlap, maxChunks)
    console.log(`Découpage: ${chunks.length} morceaux`) // eslint-disable-line no-console

	const supabase = getSupabaseClient()
	let success = 0
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk)
        const { error } = await supabase.from('documents').insert({
            title,
            content: chunk,
            embedding,
            source: filePath,
        })
        if (error) {
            console.error('Erreur insertion:', error.message) // eslint-disable-line no-console
            continue
        }
        success++
        if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
            try { (global as any).gc() } catch {}
        }
    }
	console.log(`Ingestion terminée: ${success}/${chunks.length}`) // eslint-disable-line no-console
}

main().catch(err => {
	console.error(err) // eslint-disable-line no-console
	process.exit(1)
})
