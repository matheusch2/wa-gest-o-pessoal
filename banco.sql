-- MINHAS FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
--
-- Rode este arquivo inteiro no Supabase: Project → SQL Editor → New query →
-- cole tudo → Run. Cria as 3 tabelas que o script.js espera, com RLS ligado
-- (cada pessoa só enxerga e mexe nos próprios dados) e os índices únicos que
-- travam o lançamento duplicado por toque duplo.

create extension if not exists pgcrypto;

-- ═══ LANÇAMENTOS (entradas e saídas) ═══════════════════════════════════

create table if not exists lancamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tipo         text not null check (tipo in ('entrada', 'saida')),
  valor        numeric(12,2) not null check (valor > 0),
  data         date not null,
  categoria    text not null,
  descricao    text,
  chave_envio  text not null,
  created_at   timestamptz not null default now()
);

-- Uma chave nova é gerada no navegador toda vez que o formulário abre; se o
-- mesmo toque duplo mandar duas gravações, a segunda esbarra aqui (código
-- 23505) e o script.js trata isso como sucesso silencioso, não como erro.
create unique index if not exists lancamentos_chave_envio_key on lancamentos (chave_envio);
create index if not exists lancamentos_user_data_idx on lancamentos (user_id, data desc);

alter table lancamentos enable row level security;

create policy "cada um vê só os próprios lançamentos"
  on lancamentos for select using (auth.uid() = user_id);
create policy "cada um insere só para si"
  on lancamentos for insert with check (auth.uid() = user_id);
create policy "cada um atualiza só os próprios"
  on lancamentos for update using (auth.uid() = user_id);
create policy "cada um exclui só os próprios"
  on lancamentos for delete using (auth.uid() = user_id);

-- ═══ CONTAS A PAGAR ═════════════════════════════════════════════════════

create table if not exists contas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  nome         text not null,
  valor        numeric(12,2) not null check (valor > 0),
  vencimento   date not null,
  categoria    text,
  recorrente   boolean not null default false,
  pago         boolean not null default false,
  pago_em      date,
  chave_envio  text not null,
  created_at   timestamptz not null default now()
);

create unique index if not exists contas_chave_envio_key on contas (chave_envio);
create index if not exists contas_user_vencimento_idx on contas (user_id, vencimento);

alter table contas enable row level security;

create policy "cada um vê só as próprias contas"
  on contas for select using (auth.uid() = user_id);
create policy "cada um insere só para si"
  on contas for insert with check (auth.uid() = user_id);
create policy "cada um atualiza só as próprias"
  on contas for update using (auth.uid() = user_id);
create policy "cada um exclui só as próprias"
  on contas for delete using (auth.uid() = user_id);

-- ═══ CATEGORIAS ══════════════════════════════════════════════════════════

create table if not exists categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  tipo        text not null check (tipo in ('entrada', 'saida')),
  created_at  timestamptz not null default now()
);

-- Mesmo nome pode existir em "entrada" e em "saida", mas não duas vezes no
-- mesmo tipo para a mesma pessoa — é essa unicidade que vira a mensagem
-- "Essa categoria já existe." no script.js (código 23505).
create unique index if not exists categorias_user_nome_tipo_key on categorias (user_id, nome, tipo);

alter table categorias enable row level security;

create policy "cada um vê só as próprias categorias"
  on categorias for select using (auth.uid() = user_id);
create policy "cada um insere só para si"
  on categorias for insert with check (auth.uid() = user_id);
create policy "cada um exclui só as próprias"
  on categorias for delete using (auth.uid() = user_id);
