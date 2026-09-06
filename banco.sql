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

-- ═══ PAGAMENTOS DA FATURA ═════════════════════════════════════════════
-- Uma fatura recebe VÁRIOS pagamentos, não um só: paga R$ 100 hoje, mais
-- R$ 200 na semana que vem, e o que sobrar vai pra fatura do mês seguinte.
-- Por isso cada pagamento é uma linha, e "fatura quitada" é a soma delas
-- alcançando o total — não um sim/não guardado no banco.

-- Versão antiga, de pagamento único, que nunca chegou a ser usada.
drop table if exists faturas_pagas cascade;

create table if not exists pagamentos_fatura (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  cartao_id     uuid not null references cartoes(id) on delete cascade,
  mes_ref       text not null,                 -- "2026-09", o mês da fatura

  -- 'pago'  = dinheiro saiu do bolso  → vira lançamento de saída no extrato
  -- 'saldo' = o resto foi empurrado pra fatura seguinte → vira compra lá
  -- Os dois abatem a fatura; só o primeiro mexe no seu saldo.
  tipo          text not null default 'pago' check (tipo in ('pago', 'saldo')),

  -- O valor fica GRAVADO, não é recalculado: se amanhã você corrigir uma
  -- compra daquele mês, o que você pagou no banco continua tendo sido este.
  valor         numeric(12,2) not null check (valor > 0),
  pago_em       date not null,

  -- Guarda o que este pagamento criou lá fora, pra desfazer apagar as duas
  -- coisas juntas. Se o lançamento for apagado pelo Histórico, aqui vira
  -- nulo e o pagamento continua valendo.
  lancamento_id uuid references lancamentos(id) on delete set null,
  compra_id     uuid references compras_cartao(id) on delete set null,

  chave_envio   text not null,
  created_at    timestamptz not null default now()
);

-- Não dá pra travar por (cartão, mês) — agora são vários pagamentos no mesmo
-- mês de propósito. Quem segura o toque duplo é a chave gerada quando o
-- formulário abre, igual ao resto do app.
create unique index if not exists pagamentos_fatura_chave_envio_key on pagamentos_fatura (chave_envio);
create index if not exists pagamentos_fatura_cartao_mes_idx on pagamentos_fatura (cartao_id, mes_ref);

alter table pagamentos_fatura enable row level security;

create policy "cada um vê só os próprios pagamentos de fatura"
  on pagamentos_fatura for select using (auth.uid() = user_id);
create policy "cada um paga só as próprias faturas"
  on pagamentos_fatura for insert with check (auth.uid() = user_id);
create policy "cada um desfaz só os próprios pagamentos"
  on pagamentos_fatura for delete using (auth.uid() = user_id);

-- ═══ METAS DE GASTO ═══════════════════════════════════════════════════
-- Um teto por categoria, que vale todo mês. Guardar uma meta por mês daria
-- flexibilidade (dezembro é diferente de fevereiro) ao preço de a pessoa
-- ter que recadastrar tudo em janeiro — e meta que dá trabalho de manter
-- ninguém mantém.

create table if not exists metas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  categoria  text not null,
  valor      numeric(12,2) not null check (valor > 0),
  created_at timestamptz not null default now()
);

-- Uma meta por categoria: duas metas de mercado não querem dizer nada.
create unique index if not exists metas_user_categoria_key on metas (user_id, categoria);

alter table metas enable row level security;

create policy "cada um vê só as próprias metas"
  on metas for select using (auth.uid() = user_id);
create policy "cada um cria só as próprias metas"
  on metas for insert with check (auth.uid() = user_id);
create policy "cada um muda só as próprias metas"
  on metas for update using (auth.uid() = user_id);
create policy "cada um apaga só as próprias metas"
  on metas for delete using (auth.uid() = user_id);

-- A meta tem dois usos, e este campo diz qual. Desligado, ela é só um teto
-- que avisa quando você passa. Ligado, ela também é COMPROMISSO: o que
-- ainda falta pro previsto sai do saldo antes mesmo de ser pago, porque
-- vai ter que ser pago de todo jeito.
--
-- Mercado e internet querem isso ligado. Uma meta de lazer, não: reservar
-- dinheiro pra um gasto que talvez nem aconteça deixaria o saldo mais
-- pobre do que ele é.
alter table metas add column if not exists reservar boolean not null default true;

-- ═══ FECHAMENTO DO MÊS ════════════════════════════════════════════════
-- O que sobrou não some quando o mês vira: ou vai pro mês seguinte como
-- uma ENTRADA chamada "Saldo", ou sai da conta porque você guardou. E vai
-- rolando: o saldo de setembro entra em outubro, entra em novembro.
--
-- O que sobrou é o dinheiro que de fato ficou na conta — entradas menos
-- saídas do mês. Não é a soma do que sobrou das metas: se você economizou
-- R$ 200 no mercado mas estourou R$ 300 no carro, não sobrou nada, e
-- levar os R$ 200 seria carregar dinheiro que não existe.
--
-- A linha aqui guarda o que foi decidido e quais lançamentos nasceram
-- disso, pra desfazer levar as duas coisas juntas.

create table if not exists fechamentos (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  mes_ref                text not null,              -- "2026-09", o mês que fechou
  sobra                  numeric(12,2) not null,     -- pode ser negativo
  levado                 numeric(12,2) not null default 0,
  guardado               numeric(12,2) not null default 0,
  lancamento_levado_id   uuid references lancamentos(id) on delete set null,
  lancamento_guardado_id uuid references lancamentos(id) on delete set null,
  fechado_em             date not null,
  created_at             timestamptz not null default now()
);

-- Um mês fecha uma vez só. É esta trava que impede o saldo de setembro de
-- entrar duas vezes em outubro por causa de um toque repetido.
create unique index if not exists fechamentos_user_mes_key on fechamentos (user_id, mes_ref);

alter table fechamentos enable row level security;

create policy "cada um vê só os próprios fechamentos"
  on fechamentos for select using (auth.uid() = user_id);
create policy "cada um fecha só os próprios meses"
  on fechamentos for insert with check (auth.uid() = user_id);
create policy "cada um reabre só os próprios meses"
  on fechamentos for delete using (auth.uid() = user_id);

-- ═══ ENTRADAS FIXAS ═══════════════════════════════════════════════════
-- O salário e o que mais entra todo mês no mesmo dia. É o espelho do
-- gasto fixo, do outro lado.
--
-- Guarda o COMBINADO, não o recebimento: "meu salário é R$ 3.000 e cai
-- dia 5". O recebimento de cada mês continua sendo um lançamento de
-- entrada normal, criado com um toque a partir daqui. Assim o extrato
-- continua sendo a única fonte do que de fato entrou — se o salário
-- atrasar ou vier diferente, quem manda é o lançamento, não isto aqui.

create table if not exists entradas_fixas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,                -- "Salário", "Aluguel recebido"
  valor      numeric(12,2) not null check (valor > 0),
  dia        smallint not null check (dia between 1 and 31),
  categoria  text,
  created_at timestamptz not null default now()
);

-- Uma por nome: dois "Salário" com valores diferentes não querem dizer nada.
create unique index if not exists entradas_fixas_user_nome_key on entradas_fixas (user_id, nome);

alter table entradas_fixas enable row level security;

create policy "cada um vê só as próprias entradas fixas"
  on entradas_fixas for select using (auth.uid() = user_id);
create policy "cada um cadastra só as próprias entradas fixas"
  on entradas_fixas for insert with check (auth.uid() = user_id);
create policy "cada um muda só as próprias entradas fixas"
  on entradas_fixas for update using (auth.uid() = user_id);
create policy "cada um apaga só as próprias entradas fixas"
  on entradas_fixas for delete using (auth.uid() = user_id);
