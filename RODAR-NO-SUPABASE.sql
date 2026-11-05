-- WA FINANÇAS — atualização do banco para as Reservas.
-- Cole TUDO isto no Supabase: Project → SQL Editor → New query → Run.
-- Tudo aqui é "if not exists": rodar duas vezes não estraga nada.
-- ═══ RESERVAS ═════════════════════════════════════════════════════════
-- Dinheiro que saiu da conta corrente mas CONTINUA SENDO SEU. É a única
-- categoria de dinheiro do app que não é nem entrada nem gasto, e é por
-- isso que ela precisou de tabela própria em vez de virar mais uma
-- categoria de lançamento.
--
-- Quantas a pessoa quiser: reserva de emergência, viagem, a troca do
-- carro. Separadas de propósito — "tenho R$ 8.000 guardados" não responde
-- "posso usar?" quando R$ 6.000 deles são a emergência.
--
-- 'objetivo' é quanto se quer ter ali, e é OPCIONAL: quem ainda não sabe
-- o número não devia ser impedido de começar a guardar. Nulo quer dizer
-- "sem meta", e a tela mostra o saldo sem barra de progresso.

create table if not exists reservas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,                      -- "Emergência", "Viagem"
  objetivo   numeric(12,2) check (objetivo > 0),  -- nulo = sem meta
  created_at timestamptz not null default now()
);

-- Uma por nome: duas "Emergência" com saldos diferentes não querem dizer
-- nada, e a pessoa não saberia em qual guardou.
create unique index if not exists reservas_user_nome_key on reservas (user_id, nome);

alter table reservas enable row level security;

create policy "cada um vê só as próprias reservas"
  on reservas for select using (auth.uid() = user_id);
create policy "cada um cria só as próprias reservas"
  on reservas for insert with check (auth.uid() = user_id);
create policy "cada um muda só as próprias reservas"
  on reservas for update using (auth.uid() = user_id);
create policy "cada um apaga só as próprias reservas"
  on reservas for delete using (auth.uid() = user_id);

-- ═══ MOVIMENTOS DA RESERVA ════════════════════════════════════════════
-- O SALDO DE UMA RESERVA NÃO É GUARDADO EM CAMPO NENHUM: ele é a soma
-- destes movimentos. Mesma decisão da fatura do cartão, e pelo mesmo
-- motivo — saldo gravado é um número que pode discordar do histórico que
-- o explica, e aí não há como saber qual dos dois está certo.
--
-- Cada movimento tem um lançamento do outro lado, porque guardar é
-- dinheiro SAINDO da conta corrente e resgatar é dinheiro VOLTANDO. Sem
-- isso o Resumo mostraria um saldo que o aplicativo do banco não mostra,
-- que é o defeito mais caro que este app já teve.
--
-- O lançamento é reconhecido como "nem renda nem gasto" pelo id guardado
-- aqui — nunca pela categoria escrita nele. Quem criar uma categoria
-- chamada "Guardado" à mão não pode ver os próprios gastos sumirem do
-- relatório.

create table if not exists movimentos_reserva (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  reserva_id    uuid not null references reservas(id) on delete cascade,

  -- 'guardar'  = dinheiro entrou na reserva   → saída no extrato
  -- 'resgatar' = dinheiro saiu da reserva     → entrada no extrato
  tipo          text not null check (tipo in ('guardar', 'resgatar')),

  valor         numeric(12,2) not null check (valor > 0),
  data          date not null,

  -- Guarda o lançamento que este movimento criou, pra desfazer apagar os
  -- dois juntos. Apagado pelo Histórico, aqui vira nulo e o movimento
  -- continua valendo: o dinheiro está na reserva de qualquer jeito.
  lancamento_id uuid references lancamentos(id) on delete set null,

  chave_envio   text not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists movimentos_reserva_chave_envio_key
  on movimentos_reserva (chave_envio);
create index if not exists movimentos_reserva_reserva_idx
  on movimentos_reserva (reserva_id, data);

alter table movimentos_reserva enable row level security;

create policy "cada um vê só os próprios movimentos de reserva"
  on movimentos_reserva for select using (auth.uid() = user_id);
create policy "cada um guarda só nas próprias reservas"
  on movimentos_reserva for insert with check (auth.uid() = user_id);
create policy "cada um desfaz só os próprios movimentos de reserva"
  on movimentos_reserva for delete using (auth.uid() = user_id);
