-- Enable pgvector extension in Supabase (schema extensions)
create extension if not exists vector with schema extensions;

-- Documents table to store chunks + embeddings
create table if not exists public.documents (
	id bigserial primary key,
	title text,
	content text not null,
	embedding vector(384) not null,
	source text,
	metadata jsonb,
	created_at timestamptz default now()
);

-- HNSW index for cosine distance
create index if not exists documents_embedding_hnsw
	on public.documents using hnsw (embedding vector_cosine_ops);

-- Similarity search function using cosine distance (<=>)
create or replace function public.match_documents (
	query_embedding vector(384),
	match_threshold float,
	match_count int
)
returns table (
	id bigint,
	document_id bigint,
	content text,
	similarity float
)
language sql
as $$
	select d.id as id,
	       d.id as document_id,
	       d.content as content,
	       1 - (d.embedding <=> query_embedding) as similarity
	from public.documents d
	where d.embedding <=> query_embedding < 1 - match_threshold
	order by d.embedding <=> query_embedding asc
	limit least(match_count, 200)
$$;
