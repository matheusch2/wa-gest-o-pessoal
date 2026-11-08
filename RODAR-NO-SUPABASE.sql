-- WA FINANÇAS — atualização do banco.
-- Cole TUDO isto no Supabase: Project → SQL Editor → New query → Run.
-- Tudo aqui é "if not exists": rodar duas vezes não estraga nada.

-- Pagamento parcial de conta (esta linha é nova):
alter table contas add column if not exists valor_pago numeric(12,2) not null default 0 check (valor_pago >= 0);
update contas set valor_pago = valor where pago = true and valor_pago = 0;

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

-- ─── EMERGÊNCIA OU OBJETIVO ───────────────────────────────────────────
-- São duas coisas diferentes com o mesmo nome. A de EMERGÊNCIA responde
-- "quantos meses eu aguento sem receber nada", e por isso o objetivo dela
-- se mede em meses de despesa: três, seis, doze. A de OBJETIVO é a
-- viagem, a troca do carro, a obra — tem PREÇO, não tem meses.
--
-- Oferecer "6 meses de despesa" como atalho pra uma viagem era escrever
-- um número que não quer dizer nada ali. E somar as duas pra dizer
-- "cobre 4,9 meses" era pior: o dinheiro da viagem tem destino, ele não
-- cobre mês nenhum de desemprego.
alter table reservas
  add column if not exists tipo text not null default 'objetivo'
  check (tipo in ('emergencia', 'objetivo'));

-- UMA emergência por pessoa. Duas tornariam ambígua a única pergunta que
-- ela existe pra responder: com R$ 3.000 numa e R$ 2.000 noutra, quantos
-- meses você aguenta? A resposta teria que somar as duas — e aí elas já
-- eram uma só. Índice parcial: a trava só vale pra linha de emergência,
-- e as de objetivo continuam quantas a pessoa quiser.
create unique index if not exists reservas_uma_emergencia_key
  on reservas (user_id) where tipo = 'emergencia';

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

-- ═══ MEU NEGÓCIO ══════════════════════════════════════════════════════
-- O NEGÓCIO É OUTRO BOLSO. O que ele fatura não é renda de quem o toca:
-- renda dela é a RETIRADA, o que sai do negócio e cai na conta pessoal.
--
-- Isto não é um sistema de gestão do negócio — é a interface dele com o
-- seu dinheiro. Viveiro, agendamento, estoque e nota fiscal não entram
-- aqui: aqui entram os quatro números que todo negócio pequeno tem, do
-- barbeiro ao produtor rural.
--
-- 'tipo' escolhe o modelo do ramo. Ele só semeia as categorias e troca as
-- palavras da tela — a estrutura é a mesma pra todos, e é isso que faz
-- um cliente novo não custar uma linha de código.
--
-- 'unidade' é opcional e é o que destrava o ticket médio: "serviço",
-- "galão", "corte", "kg". Sem ela o negócio funciona igual.
create table if not exists negocios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  tipo       text not null default 'servico',
  unidade    text,
  created_at timestamptz not null default now()
);

create unique index if not exists negocios_user_nome_key on negocios (user_id, nome);

alter table negocios enable row level security;

create policy "cada um vê só os próprios negócios"
  on negocios for select using (auth.uid() = user_id);
create policy "cada um cria só os próprios negócios"
  on negocios for insert with check (auth.uid() = user_id);
create policy "cada um muda só os próprios negócios"
  on negocios for update using (auth.uid() = user_id);
create policy "cada um apaga só os próprios negócios"
  on negocios for delete using (auth.uid() = user_id);

-- ═══ MOVIMENTOS DO NEGÓCIO ════════════════════════════════════════════
-- Os três movimentos que qualquer negócio tem:
--
--   faturamento  o que o negócio recebeu       NÃO toca o extrato pessoal
--   custo        o que ele gastou pra receber  NÃO toca o extrato pessoal
--   retirada     o que saiu dele pra você      VIRA ENTRADA no extrato
--
-- Os dois primeiros ficam dentro do negócio de propósito. Se virassem
-- lançamento pessoal, a sobra do Resumo seria inflada por dinheiro que
-- não é de gastar — e o relatório diria que a pessoa ganhou o que a
-- empresa faturou. Quem fatura R$ 20.000 e tem R$ 14.000 de custo não
-- ganhou R$ 20.000; ganhou o que tirou.
--
-- A retirada é o contrário: ela É renda pessoal, e por isso cria o
-- lançamento e conta normalmente no Resumo e nos Relatórios, sem
-- nenhuma exceção. É a única porta entre os dois bolsos, e ela tem que
-- ser estreita e visível.
create table if not exists movimentos_negocio (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  negocio_id    uuid not null references negocios(id) on delete cascade,
  tipo          text not null check (tipo in ('faturamento', 'custo', 'retirada')),
  valor         numeric(12,2) not null check (valor > 0),
  data          date not null,
  categoria     text,
  descricao     text,

  -- Quantas unidades esta linha representa: 8 serviços, 40 galões, 12
  -- cortes. Opcional, e é ela que permite dizer o ticket médio.
  quantidade    numeric(12,2) check (quantidade > 0),

  -- Preenchido SÓ na retirada, que é a única que nasce com um lançamento
  -- do lado de fora. Apagado pelo Histórico, aqui vira nulo e a retirada
  -- continua valendo: ela saiu do negócio de qualquer jeito.
  lancamento_id uuid references lancamentos(id) on delete set null,

  chave_envio   text not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists movimentos_negocio_chave_envio_key
  on movimentos_negocio (chave_envio);
create index if not exists movimentos_negocio_negocio_data_idx
  on movimentos_negocio (negocio_id, data);

alter table movimentos_negocio enable row level security;

create policy "cada um vê só os próprios movimentos de negócio"
  on movimentos_negocio for select using (auth.uid() = user_id);
create policy "cada um lança só nos próprios negócios"
  on movimentos_negocio for insert with check (auth.uid() = user_id);
create policy "cada um muda só os próprios movimentos de negócio"
  on movimentos_negocio for update using (auth.uid() = user_id);
create policy "cada um apaga só os próprios movimentos de negócio"
  on movimentos_negocio for delete using (auth.uid() = user_id);
