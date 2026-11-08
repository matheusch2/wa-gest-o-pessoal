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

-- QUANTO FOI PAGO, que nem sempre é quanto a conta pedia.
--
-- Três situações, e as três caem aqui:
--   pagou atrasado   → com juros, R$ 640 num boleto de R$ 600
--   pagou adiantado  → com desconto
--   negociou e pagou parte → fica devendo o resto
--
-- É acumulado: pagar R$ 200 hoje e R$ 400 na semana que vem soma 600 e
-- quita. Cada pagamento vira um lançamento no extrato, porque cada um
-- tirou dinheiro da conta no dia em que aconteceu.
--
-- 'pago' continua sendo a verdade sobre "esta conta está quitada?" — o
-- app inteiro já pergunta isso a ele. O que muda é quem o liga: agora
-- ele só é verdadeiro quando o pago alcança o valor.
alter table contas
  add column if not exists valor_pago numeric(12,2) not null default 0
  check (valor_pago >= 0);

-- As contas já quitadas antes desta coluna existir foram pagas pelo valor
-- cheio: é o que 'pago = true' significava até aqui.
update contas set valor_pago = valor where pago = true and valor_pago = 0;

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

-- ─── ASSINATURA ───────────────────────────────────────────────────────
-- Netflix, Spotify, academia, nuvem. Não é compra à vista nem parcelada:
-- a parcelada ACABA, a assinatura não. Ela entra em todas as faturas,
-- todo mês, com o mesmo valor, até alguém cancelar.
--
-- Por isso o 'valor' dela é o valor POR MÊS, e não o total — total de uma
-- coisa sem fim não existe. E por isso 'parcelas' não quer dizer nada
-- aqui: fica 1 e ninguém olha.
--
-- 'fim' é o ÚLTIMO MÊS COBRADO, guardado como o dia 1º desse mês. Nulo
-- quer dizer que ela ainda está correndo. Cancelar preenche este campo em
-- vez de apagar a linha — apagar rescreveria faturas que já foram pagas,
-- e aquele dinheiro saiu de verdade. Quem cancela a Netflix hoje não
-- deixou de pagá-la nos seis meses anteriores.
alter table compras_cartao add column if not exists recorrente boolean not null default false;
alter table compras_cartao add column if not exists fim date;

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
--
-- E a regra vale ALÉM da arrumação: o recebimento do mês é reconhecido
-- pela descrição do lançamento ser igual a este nome. Dois com o mesmo
-- nome fariam um toque em "Recebi" marcar os dois como recebidos.
create unique index if not exists entradas_fixas_user_nome_key on entradas_fixas (user_id, nome);

-- ─── DE QUANDO ATÉ QUANDO ─────────────────────────────────────────────
-- Nulo dos dois lados é o caso de sempre: entra todo mês, pra sempre.
--
-- 'fim' é o ÚLTIMO MÊS em que ela entra, guardado como o dia 1º desse mês.
-- Serve pro contrato que acaba em março: o salário continua contando em
-- janeiro, fevereiro e março, e some das projeções de abril em diante. Não
-- apaga nada do passado — o que já foi recebido virou lançamento e vive no
-- extrato, longe daqui.
--
-- 'inicio' é o primeiro. Com os dois no mesmo mês, a entrada vira EXTRA:
-- o 13º de dezembro, as férias de julho, o freela que você já sabe que
-- vem. Não precisou de campo novo pra isso — extra é uma fixa que começa
-- e acaba no mesmo mês, e uma regra só é mais fácil de acertar do que
-- duas que fazem quase a mesma coisa.
alter table entradas_fixas add column if not exists inicio date;
alter table entradas_fixas add column if not exists fim date;

alter table entradas_fixas enable row level security;

create policy "cada um vê só as próprias entradas fixas"
  on entradas_fixas for select using (auth.uid() = user_id);
create policy "cada um cadastra só as próprias entradas fixas"
  on entradas_fixas for insert with check (auth.uid() = user_id);
create policy "cada um muda só as próprias entradas fixas"
  on entradas_fixas for update using (auth.uid() = user_id);
create policy "cada um apaga só as próprias entradas fixas"
  on entradas_fixas for delete using (auth.uid() = user_id);

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


-- ═══ CONFERÊNCIA DE SALDO ═════════════════════════════════════════════
-- A ÂNCORA QUE FALTAVA.
--
-- O app somava lançamentos a partir do zero: o "saldo do mês" era
-- entradas menos saídas DAQUELE mês. Quem já tinha R$ 3.000 na conta
-- quando começou a usar nunca viu esses R$ 3.000 em lugar nenhum.
--
-- Aqui a pessoa diz: "no dia 8 de novembro eu tinha R$ 3.240 na conta".
-- Isso é um FATO, e é a única coisa guardada. A partir dele o app sabe
-- quanto ela tem hoje — o saldo informado mais o que se moveu desde
-- então — e sabe comparar: na conferência seguinte, a diferença entre o
-- que o app esperava e o que o banco mostra é o que ficou sem lançar.
--
-- A DIFERENÇA NÃO É GUARDADA, de propósito. Ela é recalculada sempre, e
-- isso é o que faz ela SUMIR quando a pessoa encontra o lançamento
-- esquecido e o cadastra. Diferença gravada ficaria apontando um erro
-- que já foi corrigido.
create table if not exists conferencias (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  data            date not null,
  saldo_informado numeric(12,2) not null,
  observacao      text,
  created_at      timestamptz not null default now()
);

-- Uma conferência por dia. Duas no mesmo dia com valores diferentes
-- tornariam ambígua a pergunta "quanto eu tinha naquele dia?", e é essa
-- pergunta que ancora todo o resto.
create unique index if not exists conferencias_user_data_key
  on conferencias (user_id, data);

alter table conferencias enable row level security;

create policy "cada um vê só as próprias conferências"
  on conferencias for select using (auth.uid() = user_id);
create policy "cada um confere só o próprio saldo"
  on conferencias for insert with check (auth.uid() = user_id);
create policy "cada um corrige só as próprias conferências"
  on conferencias for update using (auth.uid() = user_id);
create policy "cada um apaga só as próprias conferências"
  on conferencias for delete using (auth.uid() = user_id);
