create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('sugerencia', 'problema', 'comentario')),
  mensaje text not null check (char_length(btrim(mensaje)) between 8 and 1000),
  created_at timestamptz not null default now()
);

alter table public.comentarios enable row level security;
revoke all on table public.comentarios from anon, authenticated;
grant select, insert, update, delete on table public.comentarios to service_role;