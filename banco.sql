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

-- ═══ CARTÕES DE CRÉDITO ═══════════════════════════════════════════════
-- Rode este trecho no SQL Editor pra habilitar a tela de Cartão.

create table if not exists cartoes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  nome           text not null,
  banco          text not null,              -- "nubank", "inter", "bb"... a cor vem daí
  dia_fechamento smallint not null check (dia_fechamento between 1 and 28),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  limite         numeric(12,2),
  created_at     timestamptz not null default now()
);

create index if not exists cartoes_user_idx on cartoes (user_id, nome);

alter table cartoes enable row level security;

create policy "cada um vê só os próprios cartões"
  on cartoes for select using (auth.uid() = user_id);
create policy "cada um cadastra só para si"
  on cartoes for insert with check (auth.uid() = user_id);
create policy "cada um atualiza só os próprios cartões"
  on cartoes for update using (auth.uid() = user_id);
create policy "cada um exclui só os próprios cartões"
  on cartoes for delete using (auth.uid() = user_id);

-- A compra é guardada UMA vez, com o número de parcelas. Em qual fatura
-- cada parcela cai é conta, não dado: gravar uma linha por parcela
-- obrigaria a mexer em N linhas pra corrigir uma compra, e bastaria uma
-- falhar no meio pra fatura ficar torta pra sempre.
create table if not exists compras_cartao (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cartao_id   uuid not null references cartoes(id) on delete cascade,
  descricao   text not null,
  valor       numeric(12,2) not null check (valor > 0),  -- valor TOTAL da compra
  parcelas    smallint not null default 1 check (parcelas between 1 and 36),
  data        date not null,                              -- data da compra
  categoria   text,
  chave_envio text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists compras_cartao_chave_envio_key on compras_cartao (chave_envio);
create index if not exists compras_cartao_cartao_idx on compras_cartao (cartao_id, data);

alter table compras_cartao enable row level security;

create policy "cada um vê só as próprias compras"
  on compras_cartao for select using (auth.uid() = user_id);
create policy "cada um lança só para si"
  on compras_cartao for insert with check (auth.uid() = user_id);
create policy "cada um atualiza só as próprias compras"
  on compras_cartao for update using (auth.uid() = user_id);
create policy "cada um exclui só as próprias compras"
  on compras_cartao for delete using (auth.uid() = user_id);

-- ═══ FATURAS PAGAS ════════════════════════════════════════════════════
-- Pagar a fatura é dinheiro saindo de verdade: vira um lançamento de saída
-- no extrato E um registro aqui, dizendo que aquele mês daquele cartão está
-- quitado. Sem este registro, a fatura paga voltaria a aparecer como aberta
-- toda vez que a tela recarregasse.

create table if not exists faturas_pagas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  cartao_id     uuid not null references cartoes(id) on delete cascade,
  mes_ref       text not null,                 -- "2026-09", o mês da fatura
  -- O valor fica GRAVADO, não é recalculado: se amanhã você corrigir uma
  -- compra daquele mês, o que você pagou no banco continua tendo sido este.
  valor         numeric(12,2) not null check (valor > 0),
  pago_em       date not null,
  -- Guarda qual saída foi criada, pra desfazer o pagamento apagar as duas
  -- coisas juntas. Se a saída for apagada pelo Histórico, aqui vira nulo e
  -- a fatura segue paga.
  lancamento_id uuid references lancamentos(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Uma fatura só pode ser paga uma vez: é esta trava que segura o toque duplo
-- e a aba aberta em dois lugares.
create unique index if not exists faturas_pagas_cartao_mes_key on faturas_pagas (cartao_id, mes_ref);

alter table faturas_pagas enable row level security;

create policy "cada um vê só as próprias faturas pagas"
  on faturas_pagas for select using (auth.uid() = user_id);
create policy "cada um paga só as próprias"
  on faturas_pagas for insert with check (auth.uid() = user_id);
create policy "cada um desfaz só as próprias"
  on faturas_pagas for delete using (auth.uid() = user_id);
