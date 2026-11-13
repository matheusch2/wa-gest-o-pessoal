/* RESERVA: A TERCEIRA NATUREZA DE DINHEIRO.
 *
 * O app conhecia duas, entrada e saída. Reserva é dinheiro que SAIU DA
 * CONTA e CONTINUA SENDO SEU — e é por isso que ela tem dois lados: um
 * lançamento no extrato, porque o dinheiro saiu de verdade, e uma linha em
 * movimentos_reserva, que é quem sabe que aquele lançamento não é gasto.
 *
 * É esse par que esta suíte trava, porque é nele que o defeito cabe:
 *
 *   - guardar sem lançamento   → o Resumo mostra saldo que o banco não tem
 *   - guardar sem movimento    → o relatório chama poupança de gasto
 *   - saldo gravado em campo   → dois números pra mesma reserva
 *   - média calculada aqui     → Reservas e Relatórios discordando sobre
 *                                quanto custa um mês da mesma pessoa
 */

const { suite } = require("./_apoio");

/* Os meses são relativos a hoje, e isso já quebrou duas suítes deste
   projeto: cenário com mês fixo passa a falhar sozinho quando aquele mês
   vira passado, porque o app trata mês passado de outro jeito de
   propósito. Aqui importa pro gasto médio, que só olha mês FECHADO. */
const HOJE = new Date();
const M = (p) => {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + p, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

const BASE = `
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  reservas = []; movimentosReserva = [];
  mesAtual = "${M(0)}";
`;

// Três meses fechados gastando R$ 1.000 cada: a média é R$ 1.000, redonda
// de propósito pra conta de cobertura ser conferível de cabeça.
const TRES_MESES = `
  lancamentos = [
    { id:"e1", tipo:"entrada", valor:3000, data:"${M(-3)}-01", categoria:"Salário", descricao:"Salário" },
    { id:"s1", tipo:"saida",   valor:1000, data:"${M(-3)}-10", categoria:"Mercado", descricao:"Feira" },
    { id:"e2", tipo:"entrada", valor:3000, data:"${M(-2)}-01", categoria:"Salário", descricao:"Salário" },
    { id:"s2", tipo:"saida",   valor:1000, data:"${M(-2)}-10", categoria:"Mercado", descricao:"Feira" },
    { id:"e3", tipo:"entrada", valor:3000, data:"${M(-1)}-01", categoria:"Salário", descricao:"Salário" },
    { id:"s3", tipo:"saida",   valor:1000, data:"${M(-1)}-10", categoria:"Mercado", descricao:"Feira" },
  ];
`;

const UMA = `
  reservas = [{ id:"r1", nome:"Emergência", objetivo:6000, tipo:"emergencia" }];
  movimentosReserva = [
    { id:"mv1", reserva_id:"r1", tipo:"guardar", valor:2000, data:"${M(-2)}-05", lancamento_id:"g1" },
    { id:"mv2", reserva_id:"r1", tipo:"guardar", valor:600,  data:"${M(-1)}-05", lancamento_id:"g2" },
    { id:"mv3", reserva_id:"r1", tipo:"resgatar", valor:100, data:"${M(-1)}-20", lancamento_id:"g3" },
  ];
`;

module.exports = () => suite("Reservas e investimentos", async ({ p, ok, abrir, texto, valor, chamadas, falharProxima, menu }) => {

  /* ─── OS DOIS BOTÕES NOVOS ───────────────────────────────────────── */
  await abrir(BASE + "; voltarInicio();");
  const nomes = await menu();
  ok("a tela inicial tem dez caminhos", nomes.length === 10);
  ok("um deles é 'Reservas'", nomes.includes("Reservas"));
  ok("outro é 'Investimentos'", nomes.includes("Investimentos"));
  ok("e o resto continua lá",
    ["Resumo do mês", "Lançar", "Contas a pagar", "Histórico", "Cartão",
     "Metas de gastos", "Relatórios", "Balanço"].every(n => nomes.includes(n)));
  /* MEU NEGÓCIO SAIU DO MENU a pedido do dono do app. A tela continua
     existindo e tem suíte própria; o que não existe mais é o caminho até
     ela pelo menu. */
  ok("e 'Meu negócio' não está mais lá", !nomes.includes("Meu negócio"));

  await p.click("#menu .ini-btn-peq:has-text('Investimentos')");
  ok("Investimentos abre e se declara em construção",
    (await p.locator(".em-breve-selo").count()) === 1 &&
    (await texto("h2")).includes("Investimentos"));
  ok("e aponta pras Reservas, que já funcionam",
    (await texto(".em-breve-txt")).includes("Reservas"));


  /* ─── A TABELA QUE FALTA NÃO DERRUBA O APP ───────────────────────────
     Estrago de verdade, e grave: as Reservas trouxeram duas tabelas
     novas, e quem abriu o app antes de rodar o banco.sql no Supabase não
     viu a tela de Reservas quebrada — viu "Não deu pra carregar seus
     dados" e o app inteiro parado. Nove tabelas respondiam certo e as
     duas que faltavam levavam as nove junto.

     Estas conferências existem pra isso não poder se repetir com a
     PRÓXIMA tabela que este app ganhar. */
  await abrir(BASE + TRES_MESES + UMA + `
    window.TABELAS_SEM_BANCO = ["reservas", "movimentos_reserva"];`);
  const carregou = await p.evaluate(() => carregarTudo());
  ok("faltando as tabelas novas, o app ainda carrega", carregou === true);
  ok("e os lançamentos chegaram inteiros",
    (await p.evaluate(() => lancamentos.length)) === 6);
  ok("as listas que faltam ficam vazias, não quebradas",
    (await p.evaluate(() => reservas.length)) === 0 &&
    (await p.evaluate(() => movimentosReserva.length)) === 0);
  ok("e o app sabe DIZER quais faltaram",
    (await p.evaluate(() => faltaATabela("reservas"))) === true &&
    (await p.evaluate(() => faltaATabela("contas"))) === false);

  await p.evaluate(() => abrirReservas());
  const semBanco = await texto("#area");
  ok("a tela de Reservas explica que falta rodar o banco.sql",
    semBanco.includes("banco.sql") && semBanco.includes("SQL Editor"));
  ok("e não finge que a pessoa não tem reserva nenhuma",
    (await p.locator(".reserva-card").count()) === 0 &&
    !semBanco.includes("Nenhuma reserva ainda"));
  ok("nem mostra um total de R$ 0,00 como se fosse verdade",
    (await p.locator(".contas-total").count()) === 0);

  // O resto do app continua inteiro — é o ponto todo da mudança.
  await p.evaluate(() => voltarInicio());
  await p.evaluate(() => abrirResumo());
  ok("e o Resumo abre normalmente do lado", (await p.locator(".saldo").count()) === 1);

  /* SEM O LANÇAMENTO NÃO HÁ APP. Aí não é "falta uma parte", é instalação
     nova com o banco vazio — e a frase certa é a de sempre. */
  await abrir(BASE + `window.TABELAS_SEM_BANCO = ["lancamentos"];`);
  const semNada = await p.evaluate(() => carregarTudo());
  ok("sem a tabela de lançamentos, carregar falha mesmo", semNada === false);
  ok("dizendo pra rodar o banco.sql",
    (await texto(".aviso.erro")).includes("Rode o banco.sql"));

  // Erro que NÃO é tabela faltando continua fatal: mostrar dados pela
  // metade quando o servidor não respondeu seria pior do que não abrir.
  await abrir(BASE);
  await falharProxima("", "Failed to fetch");
  const semRede = await p.evaluate(() => carregarTudo());
  ok("sem conexão, carregar continua falhando", semRede === false);
  ok("com a mensagem de conexão, não a de tabela",
    (await texto(".aviso.erro")).includes("Sem conexão"));

  /* ─── O SALDO É A SOMA DOS MOVIMENTOS ────────────────────────────────
     Nunca um campo no banco. Saldo gravado é um número que pode discordar
     do histórico que o explica, e aí não há como saber qual mentiu. */
  await abrir(BASE + UMA + "; abrirReservas();");
  ok("o saldo é guardado menos resgatado",
    (await p.evaluate(() => _saldoDaReserva("r1"))) === 2500);
  ok("e o total guardado é a soma das reservas",
    (await p.evaluate(() => _totalGuardado())) === 2500);
  ok("o hero mostra esse total", valor(await texto(".contas-total strong")) === 2500);

  /* ─── QUANTOS MESES ISSO COBRE ───────────────────────────────────────
     O número que dá sentido ao saldo. R$ 2.500 é meio ano pra uma pessoa
     e três semanas pra outra; "cobre 2,5 meses" é a mesma informação com
     a régua dentro. */
  await abrir(BASE + TRES_MESES + UMA + "; abrirReservas();");
  const media = await p.evaluate(() => _gastoMedioMensal(6));
  ok("a média de gasto vem dos meses fechados", media === 1000);
  const frase = await texto(".contas-total small");
  ok("a tela diz quantos meses a reserva cobre", frase.includes("2,5 meses"));
  ok("e diz de qual dinheiro está falando", frase.includes("2.500,00"));
  /* A MÉDIA SAIU DA FRASE. Ela explicava a conta ("você gasta R$ 1.000 por
     mês, em média") e era o tipo de legenda que o dono do app mandou tirar
     da tela toda. O número que importa — quantos meses cobre — ficou. */
  ok("sem explicar a conta por extenso", !frase.includes("em média"));

  /* A COBERTURA SAI SÓ DA EMERGÊNCIA, e este é o defeito que o pedido do
     dono do app revelou por baixo. A tela somava TUDO: com R$ 2.500 de
     emergência e R$ 4.000 de viagem, ela dizia "cobre 6,5 meses". Mas o
     dinheiro da viagem tem destino — ele não cobre mês nenhum de
     desemprego. Era promessa de colchão que não existia, e no dia em que
     o colchão fosse preciso a conta não fecharia. */
  await abrir(BASE + TRES_MESES + UMA + `
    reservas.push({ id:"r2", nome:"Viagem", objetivo:4000, tipo:"objetivo" });
    movimentosReserva.push({ id:"mv9", reserva_id:"r2", tipo:"guardar",
                             valor:4000, data:"${M(-1)}-05", lancamento_id:"g9" });
    abrirReservas();`);
  ok("o total guardado soma tudo, porque é verdade",
    valor(await texto(".contas-total strong")) === 6500);
  const comViagem = await texto(".contas-total small");
  ok("mas a cobertura conta só a emergência", comViagem.includes("2,5 meses"));
  ok("e diz de qual dinheiro está falando", comViagem.includes("2.500,00"));
  ok("os 4.000 da viagem NÃO viram meses de colchão",
    !comViagem.includes("6,5 meses"));

  // Sem emergência nenhuma, a tela não inventa cobertura a partir dos
  // objetivos: ela diz o que está faltando.
  await abrir(BASE + TRES_MESES + `
    reservas = [{ id:"r2", nome:"Viagem", objetivo:4000, tipo:"objetivo" }];
    movimentosReserva = [{ id:"mv9", reserva_id:"r2", tipo:"guardar",
                           valor:4000, data:"${M(-1)}-05", lancamento_id:"g9" }];
    abrirReservas();`);
  /* SEM EMERGÊNCIA, SEM LINHA. A tela já avisou aqui que faltava a
     emergência; hoje ela cala, porque a linha debaixo do número só existe
     pra dar um número, e sem emergência não há cobertura pra dar. O que
     não pode, em hipótese nenhuma, é os R$ 4.000 da viagem virarem meses
     de colchão. */
  ok("só com objetivos, não há linha de cobertura",
    (await p.locator(".contas-total small").count()) === 0);
  const soObjetivo = await texto(".contas-total");
  ok("e não se promete número nenhum de meses",
    !/\d[\d.,]*\s*(mês|meses)/.test(soObjetivo));
  ok("o total guardado continua dito", soObjetivo.includes("4.000,00"));

  // Na tela de dentro, só a emergência ganha a frase dos meses.
  await abrir(BASE + TRES_MESES + UMA + "; abrirReserva('r1');");
  ok("a emergência diz quanto tempo ela sustenta",
    (await texto(".contas-total")).includes("Dá pra viver"));
  await abrir(BASE + TRES_MESES + `
    reservas = [{ id:"r2", nome:"Viagem", objetivo:4000, tipo:"objetivo" }];
    movimentosReserva = [{ id:"mv9", reserva_id:"r2", tipo:"guardar",
                           valor:4000, data:"${M(-1)}-05", lancamento_id:"g9" }];
    abrirReserva("r2");`);
  ok("a da viagem não, porque ali a pergunta é o preço da viagem",
    !(await texto(".contas-total")).includes("Dá pra viver"));

  /* O MÊS CORRIDO FICA DE FORA DA MÉDIA. No dia 3 ele tem três dias de
     gasto dentro; entrando na conta, ele a derruba, e a reserva passaria a
     prometer cobrir mais meses do que cobre — justo o número em que não se
     pode mentir, porque é o que a pessoa usa se perder o emprego. */
  await abrir(BASE + TRES_MESES + UMA + `
    lancamentos.push({ id:"hoje", tipo:"saida", valor:30, data:_hojeLocal(),
                       categoria:"Mercado", descricao:"Pão" });
    abrirReservas();`);
  ok("o mês corrido não entra na média",
    (await p.evaluate(() => _gastoMedioMensal(6))) === 1000);

  /* Sem mês fechado nenhum não há régua. A tela cala — o que ela não pode
     é inventar um "cobre 0 meses", que leria como reserva inútil. */
  await abrir(BASE + UMA + "; abrirReservas();");
  ok("sem histórico, não há linha de cobertura",
    (await p.locator(".contas-total small").count()) === 0);
  ok("e nenhum número de meses é prometido",
    !/\d[\d.,]*\s*(mês|meses)/.test(await texto(".contas-total")));

  /* O SELO SÓ APARECE QUANDO O NOME NÃO DIZ. "Emergência EMERGÊNCIA" é a
     mesma palavra duas vezes na mesma linha, comendo a largura do nome. */
  await abrir(BASE + UMA + "; abrirReservas();");
  ok("reserva chamada Emergência não repete o selo",
    (await p.locator(".reserva-selo").count()) === 0);
  ok("mas a borda dourada a distingue mesmo assim",
    (await p.locator(".reserva-card.emergencia").count()) === 1);

  await abrir(BASE + `
    reservas = [{ id:"rc", nome:"Colchão", objetivo:6000, tipo:"emergencia" }];
    abrirReservas();`);
  ok("com outro nome, o selo aparece pra dizer o que ela é",
    (await texto(".reserva-selo")) === "Emergência");

  // A emergência vem sempre primeiro: é a que não pode ficar pra depois.
  await abrir(BASE + `
    reservas = [{ id:"rz", nome:"Zebra", objetivo:100, tipo:"objetivo" },
                { id:"ra", nome:"Aflição", objetivo:6000, tipo:"emergencia" }];
    abrirReservas();`);
  ok("e ela encabeça a lista, venha o nome que vier",
    (await p.locator(".reserva-card").first().getAttribute("id")) === "reserva-ra");

  /* ─── A LISTA ────────────────────────────────────────────────────── */
  await abrir(BASE + UMA + "; abrirReservas();");
  ok("a reserva aparece como card", (await p.locator(".reserva-card").count()) === 1);
  ok("com a barra do objetivo", (await p.locator(".reserva-barra").count()) === 1);
  const baixo = await texto(".reserva-card-baixo");
  ok("dizendo quanto falta", baixo.includes("3.500,00"));
  ok("e a que porcentagem chegou", baixo.includes("42%"));

  await abrir(BASE + `
    reservas = [{ id:"r9", nome:"Viagem", objetivo:null, tipo:"objetivo" }];
    abrirReservas();`);
  ok("reserva sem objetivo não ganha barra de progresso",
    (await p.locator(".reserva-barra").count()) === 0 &&
    (await texto(".reserva-card-baixo")).includes("Sem objetivo"));

  await abrir(BASE + `
    reservas = [{ id:"r1", nome:"Emergência", objetivo:1000, tipo:"emergencia" }];
    movimentosReserva = [{ id:"m", reserva_id:"r1", tipo:"guardar", valor:1000,
                           data:"${M(-1)}-01", lancamento_id:"g" }];
    abrirReservas();`);
  ok("objetivo alcançado é dito com essas palavras",
    (await texto(".reserva-card-baixo")).includes("Objetivo alcançado") &&
    (await p.locator(".reserva-card.completa").count()) === 1);

  /* SEM RESERVA, A TELA NÃO EXPLICA NADA. Havia aqui um bloco ensinando o
     que é uma reserva. O zero em cima e o botão "Nova reserva" logo
     abaixo dizem a mesma coisa sem pedir leitura — e o dono do app pediu
     esse tipo de texto fora de todas as telas. */
  await abrir(BASE + "; abrirReservas();");
  ok("sem nenhuma reserva, não há cartão de reserva",
    (await p.locator(".reserva-card").count()) === 0);
  ok("nem caixa explicando o que é uma reserva",
    (await p.locator(".bloco").count()) === 0);
  const vazia = await texto("#area");
  ok("a tela fica no número, no botão e no voltar",
    vazia.includes("Você tem guardado") && vazia.includes("Nova reserva"));
  ok("sem aula sobre o que é guardar", !vazia.includes("continua sendo seu"));

  /* ─── GUARDAR: OS DOIS LADOS, NESTA ORDEM ────────────────────────────
     O lançamento nasce PRIMEIRO. Se o segundo passo falhar, o que sobra é
     um lançamento solto no extrato — visível e apagável pela pessoa. Na
     ordem inversa sobraria um movimento sem contrapartida, e aí o Resumo
     mostraria um saldo que o banco não mostra, calado. */
  await abrir(BASE + UMA + "; abrirReserva('r1');");
  await p.click(".reserva-botoes .botao:has-text('Guardar')");
  await p.evaluate(() => { document.getElementById("rv-valor").value = "500,00"; });
  await p.evaluate(() => salvarMovimentoReserva(
    document.querySelector(".lancamento-tela > .botao"), "r1", "guardar"));

  const g = await chamadas();
  ok("guardar grava o lançamento primeiro", g[0].tabela === "lancamentos" && g[0].op === "insert");
  ok("como SAÍDA, porque o dinheiro sai da conta",
    g[0].dados.tipo === "saida" && g[0].dados.valor === 500);
  ok("com a categoria que o relatório reconhece", g[0].dados.categoria === "Guardado");
  ok("e o nome da reserva na descrição", g[0].dados.descricao === "Guardado: Emergência");
  ok("o movimento vem depois", g[1].tabela === "movimentos_reserva" && g[1].op === "insert");
  ok("apontando pro lançamento que nasceu", !!g[1].dados.lancamento_id);
  ok("com o tipo e o valor certos",
    g[1].dados.tipo === "guardar" && g[1].dados.valor === 500 && g[1].dados.reserva_id === "r1");

  /* SE O MOVIMENTO FALHAR, O LANÇAMENTO É DESFEITO. Sem isso sobraria uma
     saída sem motivo no extrato, e isso é pior do que não ter gravado. */
  await abrir(BASE + UMA + "; abrirGuardar('r1');");
  await falharProxima("XX000", "deu ruim", 1);
  await p.evaluate(() => { document.getElementById("rv-valor").value = "500,00"; });
  await p.evaluate(() => salvarMovimentoReserva(
    document.querySelector(".lancamento-tela > .botao"), "r1", "guardar"));
  const f = await chamadas();
  ok("movimento que falha desfaz o lançamento",
    f.length === 3 && f[2].tabela === "lancamentos" && f[2].op === "delete");
  ok("e avisa o erro", (await p.locator(".aviso.erro").count()) === 1);

  /* ─── RESGATAR ───────────────────────────────────────────────────── */
  await abrir(BASE + UMA + "; abrirResgatar('r1');");
  await p.evaluate(() => { document.getElementById("rv-valor").value = "100,00"; });
  await p.evaluate(() => salvarMovimentoReserva(
    document.querySelector(".lancamento-tela > .botao"), "r1", "resgatar"));
  const rg = await chamadas();
  ok("resgatar vira ENTRADA no extrato",
    rg[0].dados.tipo === "entrada" && rg[0].dados.valor === 100);
  ok("com categoria própria, pra não virar renda", rg[0].dados.categoria === "Resgate");
  ok("e o movimento sabe que é resgate", rg[1].dados.tipo === "resgatar");

  // Resgatar mais do que tem não é erro de digitação inofensivo: seria
  // reserva com saldo negativo, que não existe.
  await abrir(BASE + UMA + "; abrirResgatar('r1');");
  await p.evaluate(() => { document.getElementById("rv-valor").value = "9.000,00"; });
  await p.evaluate(() => salvarMovimentoReserva(
    document.querySelector(".lancamento-tela > .botao"), "r1", "resgatar"));
  ok("resgatar mais do que tem é recusado", (await chamadas()).length === 0);
  ok("dizendo quanto tem",
    (await p.locator(".aviso.erro").count()) === 1 &&
    (await texto(".aviso.erro")).includes("2.500,00"));

  // O botão nem fica disponível com a reserva vazia.
  await abrir(BASE + `
    reservas = [{ id:"r0", nome:"Nova", objetivo:null, tipo:"objetivo" }];
    abrirReserva("r0");`);
  ok("reserva vazia não oferece resgatar",
    await p.locator(".reserva-botoes .botao.saida").isDisabled());

  /* ─── GUARDAR NÃO É GASTAR, RESGATAR NÃO É GANHAR ────────────────────
     O defeito que mais dói neste app é duas telas discordando. Aqui o
     risco é o relatório chamar poupança de gasto: o mês em que a pessoa
     mais guardou viraria o mês em que ela mais "gastou". */
  const COM_MOVIMENTO = BASE + `
    lancamentos = [
      { id:"e", tipo:"entrada", valor:3000, data:"${M(0)}-01", categoria:"Salário", descricao:"Salário" },
      { id:"s", tipo:"saida",   valor:800,  data:"${M(0)}-10", categoria:"Mercado", descricao:"Feira" },
      { id:"g", tipo:"saida",   valor:500,  data:"${M(0)}-11", categoria:"Guardado", descricao:"Guardado: Emergência" },
      { id:"v", tipo:"entrada", valor:200,  data:"${M(0)}-12", categoria:"Resgate", descricao:"Resgate: Viagem" },
    ];
    reservas = [{ id:"r1", nome:"Emergência", objetivo:6000, tipo:"emergencia" }];
    movimentosReserva = [
      { id:"m1", reserva_id:"r1", tipo:"guardar",  valor:500, data:"${M(0)}-11", lancamento_id:"g" },
      { id:"m2", reserva_id:"r1", tipo:"resgatar", valor:200, data:"${M(0)}-12", lancamento_id:"v" },
    ];
  `;
  await abrir(COM_MOVIMENTO + "; abrirRelatorios();");
  const r = await p.evaluate(x => _retratoDoMes(x), M(0));
  ok("o relatório não conta o que foi guardado como gasto", r.gastou === 800);
  ok("nem o resgate como renda", r.entrou === 3000);
  ok("mas guarda os dois valores pra poder dizer", r.guardado === 500 && r.resgatado === 200);
  const nota = await texto(".rel-nota");
  ok("e a tela diz os dois, com valor na frente",
    nota.includes("500,00") && nota.includes("200,00") && nota.includes("já era seu"));
  ok("nenhuma categoria 'Guardado' na lista de para onde foi o dinheiro",
    !(await texto(".rel-cats")).includes("Guardado"));

  /* O RESUMO, AO CONTRÁRIO, CONTA. Ele é o extrato: o dinheiro saiu da
     conta mesmo, e esconder isso faria o app discordar do banco — que é
     exatamente o defeito que esta regra existe pra evitar do outro lado. */
  await abrir(COM_MOVIMENTO + "; abrirResumo();");
  const saidas = await texto(".resumo-numero.saida strong");
  ok("o Resumo conta o guardado nas saídas, porque é extrato",
    valor(saidas) === 1300);
  ok("e o resgate nas entradas, pelo mesmo motivo",
    valor(await texto(".resumo-numero.entrada strong")) === 3200);

  /* ─── EMERGÊNCIA NÃO É A MESMA COISA QUE OBJETIVO ────────────────────
     O dono do app apontou: criando uma reserva de VIAGEM, o botão
     "6 meses" escrevia seis vezes a despesa mensal no campo de objetivo.
     Viagem tem preço; meses de despesa não respondem pergunta nenhuma
     ali. E a mesma confusão estava no topo da tela, maior. */
  await abrir(BASE + TRES_MESES + "; abrirNovaReserva();");
  ok("a primeira reserva pergunta pra que ela é",
    (await p.locator('input[name="rs-tipo"]').count()) === 2);
  ok("e já vem na emergência, que é por onde se começa",
    (await p.locator('input[name="rs-tipo"]:checked').inputValue()) === "emergencia");

  /* ─── O FORMULÁRIO NÃO DÁ AULA ───────────────────────────────────────
     Cada opção vinha com um parágrafo embaixo explicando o conceito, o
     campo de objetivo vinha com outro dizendo que dava pra deixar em
     branco, e os atalhos vinham com um terceiro contando quanto custa um
     mês da vida da pessoa. Três textos num formulário de dois campos. O
     dono do app mandou tirar, e tem razão: o rótulo "(opcional)" já diz o
     que a frase dizia, e as opções se explicam pelo nome. */
  const form = await texto("#area");
  ok("as opções são só o nome, sem explicação embaixo",
    (await p.locator(".escolha-op small").count()) === 0);
  ok("'Emergência' e 'Um objetivo' continuam lá",
    form.includes("Emergência") && form.includes("Um objetivo"));
  ok("sem o parágrafo do colchão", !form.includes("colchão"));
  ok("sem o parágrafo da viagem e da obra", !form.includes("troca do carro, a obra"));
  ok("sem o 'deixe em branco'", !form.includes("Deixe em branco"));
  ok("mas o rótulo continua dizendo que é opcional", form.includes("(opcional)"));
  ok("sem contar quanto custa um mês da vida da pessoa",
    !form.includes("custa") && !form.includes("pela média"));
  ok("e o formulário ficou sem nenhuma dica solta",
    (await p.locator(".cartao-dica").count()) === 0);
  ok("o rótulo dos atalhos fica, porque rotula um controle",
    form.includes("Quantos meses"));
  ok("na emergência, o objetivo em meses vira atalho",
    (await p.locator(".reserva-atalhos .pilula").count()) === 3);
  await p.click(".reserva-atalhos .pilula:has-text('6 meses')");
  ok("e o atalho de 6 meses põe seis vezes a média",
    valor(await p.inputValue("#rs-objetivo")) === 6000);

  // O PEDIDO, EM UMA LINHA: trocar pra objetivo apaga os atalhos.
  await p.click('input[name="rs-tipo"][value="objetivo"]');
  ok("trocando pra objetivo, os atalhos de meses somem",
    (await p.locator(".reserva-atalhos").count()) === 0);
  ok("e o que já foi digitado continua lá",
    valor(await p.inputValue("#rs-objetivo")) === 6000);

  // Com uma emergência já criada, a pergunta deixa de ser pergunta: a
  // próxima reserva só pode ser objetivo, e o formulário fica limpo.
  await abrir(BASE + TRES_MESES + UMA + "; abrirNovaReserva();");
  ok("com a emergência já criada, nem se pergunta o tipo",
    (await p.locator('input[name="rs-tipo"]').count()) === 0);
  ok("e a tela da Viagem não oferece meses de despesa",
    (await p.locator(".reserva-atalhos").count()) === 0);
  await p.evaluate(() => { document.getElementById("rs-nome").value = "Viagem"; });
  await p.evaluate(() => salvarReserva(document.querySelector(".lancamento-tela > .botao")));
  ok("e ela nasce como objetivo", (await chamadas())[0].dados.tipo === "objetivo");

  await abrir(BASE + "; abrirNovaReserva();");
  ok("sem média conhecida, não há atalho que escreva R$ 0,00",
    (await p.locator(".reserva-atalhos").count()) === 0);

  await abrir(BASE + "; abrirNovaReserva();");
  await p.evaluate(() => { document.getElementById("rs-nome").value = "Viagem"; });
  await p.evaluate(() => salvarReserva(document.querySelector(".lancamento-tela > .botao")));
  const nova = await chamadas();
  ok("reserva sem objetivo pode ser criada",
    nova.length === 1 && nova[0].dados.nome === "Viagem" && nova[0].dados.objetivo === null);

  // Editar não troca o tipo: mudaria o significado do dinheiro que já
  // está lá dentro, sem ninguém ter mexido nele.
  await abrir(BASE + UMA + "; abrirEdicaoReserva('r1');");
  ok("editando, o tipo não é oferecido",
    (await p.locator('input[name="rs-tipo"]').count()) === 0);
  await p.evaluate(() => salvarReserva(document.querySelector(".lancamento-tela > .botao"), "r1"));
  const ed = (await chamadas())[0];
  ok("e o update não mexe no tipo",
    ed.op === "update" && !("tipo" in ed.dados));

  // Segunda emergência é recusada pelo banco com o MESMO 23505 do nome
  // repetido. Frase errada sobre problema real é o jeito mais rápido de a
  // pessoa achar que o app quebrou.
  await abrir(BASE + "; abrirNovaReserva();");
  await falharProxima("23505", 'duplicate key value violates unique constraint "reservas_uma_emergencia_key"');
  await p.evaluate(() => { document.getElementById("rs-nome").value = "Outra emergência"; });
  await p.evaluate(() => salvarReserva(document.querySelector(".lancamento-tela > .botao")));
  ok("segunda emergência é explicada como tal",
    (await texto(".aviso.erro")).includes("já tem uma reserva de emergência"));

  await abrir(BASE + "; abrirNovaReserva();");
  await p.evaluate(() => salvarReserva(document.querySelector(".lancamento-tela > .botao")));
  ok("sem nome, nada é gravado", (await chamadas()).length === 0);

  // Nome repetido: o banco recusa com 23505, e a tela tem que dizer o que
  // aconteceu em vez de repetir a mensagem do Postgres.
  await abrir(BASE + "; abrirNovaReserva();");
  await falharProxima("23505");
  await p.evaluate(() => { document.getElementById("rs-nome").value = "Emergência"; });
  await p.evaluate(() => salvarReserva(document.querySelector(".lancamento-tela > .botao")));
  ok("nome repetido é explicado, não vazado",
    (await texto(".aviso.erro")).includes("já tem uma reserva com esse nome"));

  /* ─── DESFAZER UM MOVIMENTO ──────────────────────────────────────────
     Apaga os DOIS lados. Apagar só um deixaria a reserva com um saldo e o
     extrato com outro. */
  await abrir(BASE + UMA + "; abrirReserva('r1');");
  ok("os movimentos aparecem, do mais novo pro mais velho",
    (await p.locator(".lista .item").count()) === 3);
  await p.evaluate(() => pedirDesfazerMovimento("mv1"));
  ok("desfazer pede confirmação", (await p.locator(".confirmar").count()) === 1);
  await p.click(".confirmar .sim");
  const d = await chamadas();
  ok("desfazer apaga o movimento", d[0].tabela === "movimentos_reserva" && d[0].op === "delete");
  ok("e o lançamento que ele criou", d[1]?.tabela === "lancamentos" && d[1]?.op === "delete");

  /* ─── EXCLUIR A RESERVA ──────────────────────────────────────────────
     Não desfaz os lançamentos: o dinheiro saiu da conta de verdade, e
     apagar isso reescreveria o extrato. A tela tem que DIZER isso antes. */
  await abrir(BASE + UMA + "; abrirReserva('r1');");
  await p.evaluate(() => pedirExcluirReserva("r1"));
  const aviso = await texto("#reserva-confirma");
  ok("excluir avisa que o saldo deixa de ser acompanhado", aviso.includes("2.500,00"));
  ok("e que os lançamentos ficam", aviso.includes("continuam no seu histórico"));
  await p.click(".confirmar .sim");
  const ex = await chamadas();
  ok("e só a reserva é apagada",
    ex.length === 1 && ex[0].tabela === "reservas" && ex[0].op === "delete");
});
