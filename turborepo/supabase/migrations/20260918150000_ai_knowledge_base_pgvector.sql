-- TICKET: AI-CHAT-SUITE — Baza wiedzy i wyszukiwanie wektorowe pgvector
--
-- Tworzy tabelę bazy wiedzy `public.knowledge_base` z obsługą wektorów embeddingów
-- dla modelu Google (wymiarowość 768), indeks HNSW oraz funkcję dopasowania
-- kosinusowego `public.match_knowledge_base` z filtrowaniem poziomów dostępu.

-- 1. Rozszerzenie wektorowe
create extension if not exists vector;

-- 2. Tabela bazy wiedzy
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  access_level text not null check (access_level in ('public', 'field_tech', 'internal_dispatcher', 'internal_admin')),
  embedding vector(768),
  created_at timestamptz default now()
);

-- 3. Indeksy
create index if not exists knowledge_base_embedding_hnsw_idx
  on public.knowledge_base
  using hnsw (embedding vector_cosine_ops);

create index if not exists knowledge_base_access_level_idx
  on public.knowledge_base (access_level);

-- 4. Row Level Security (RLS)
alter table public.knowledge_base enable row level security;

drop policy if exists "Anon read public knowledge base" on public.knowledge_base;
create policy "Anon read public knowledge base"
  on public.knowledge_base
  for select
  to anon
  using (access_level = 'public');

drop policy if exists "Authenticated read knowledge base by access level" on public.knowledge_base;
create policy "Authenticated read knowledge base by access level"
  on public.knowledge_base
  for select
  to authenticated
  using (
    access_level in ('public', 'internal_dispatcher', 'internal_admin')
  );

-- 5. Funkcja RPC do dopasowywania wektorowego z uprawnieniami
create or replace function public.match_knowledge_base (
  query_embedding vector(768),
  match_threshold float default 0.3,
  match_count int default 5,
  allowed_levels text[] default array['public', 'field_tech', 'internal_dispatcher', 'internal_admin']
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$ 
begin   
  return query   
  select     
    kb.id,     
    kb.content,     
    kb.metadata,     
    (1 - (kb.embedding <=> query_embedding))::float as similarity   
  from public.knowledge_base kb   
  where kb.access_level = any(allowed_levels)     
    and (1 - (kb.embedding <=> query_embedding)) > match_threshold   
  order by kb.embedding <=> query_embedding   
  limit match_count; 
end; 
$$;
