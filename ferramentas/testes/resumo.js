/* O RESUMO É O EXTRATO. OS RELATÓRIOS SÃO O COMPORTAMENTO.
 *
 * São duas contas diferentes de propósito, e elas só podem conviver sob
 * duas condições — as duas já estão escritas no topo do relatorios.js:
 *
 *   1. RÓTULOS DIFERENTES. Palavra igual pra número diferente é o
 *      defeito que já custou caro neste app várias vezes.
 *   2. A DIFERENÇA APARECE, em vez de a pessoa ter que descobrir.
 *
 * A condição 1 foi quebrada e ninguém viu: os dois tinham um bloco
 * chamado "Para onde foi o dinheiro", e eles discordavam. Esta suíte
 * existe pra isso não voltar.
 */

const { suite } = require("./_apoio");

const HOJE = new Date();
const M = (p) => {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + p, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

/* Um mês com as três naturezas de dinheiro dentro: gasto de verdade,
   dinheiro guardado (saiu da conta e continua seu) e saldo rolado do mês
   anterior (entrou na conta e já era seu). */
const CENARIO = `
  mesAtual = "${M(0)}";
  contas = []; cartoes = []; comprasCartao = []; pagamentosFatura = [];
  metas = []; entradasFixas = []; negocios = []; movimentosNegocio = [];
  fechamentos = [{ id:"f", mes_ref:"${M(-1)}", sobra:300, levado:300, guardado:0,
                   lancamento_levado_id:"SAL", lancamento_guardado_id:null }];
  lancamentos = [
    { id:"SAL", tipo:"entrada", valor:300,  data:"${M(0)}-01", categoria:"Saldo",    descricao:"Saldo do mês passado" },
    { id:"e1",  tipo:"entrada", valor:3000, data:"${M(0)}-05", categoria:"Salário",  descricao:"Salário" },
    { id:"s1",  tipo:"saida",   valor:800,  data:"${M(0)}-07", categoria:"Mercado",  descricao:"Feira" },
    { id:"grd", tipo:"saida",   valor:500,  data:"${M(0)}-08", categoria:"Guardado", descricao:"Guardado: Emergência" },
  ];
  reservas = [{ id:"r1", nome:"Emergência", objetivo:9000, tipo:"emergencia" }];
  movimentosReserva = [{ id:"m1", reserva_id:"r1", tipo:"guardar", valor:500,
                         data:"${M(0)}-08", lancamento_id:"grd" }];
`;

module.exports = () => suite("Resumo: extrato, e só", async ({ p, ok, abrir, texto, valor }) => {

  /* ─── OS DOIS BLOCOS NÃO PODEM TER O MESMO NOME ──────────────────────
     O Resumo tinha "Para onde foi o dinheiro" com R$ 1.300 e o
     Relatórios tinha "Para onde foi o dinheiro" com R$ 800. Os dois
     números estavam certos: um é extrato, outro é comportamento. O
     errado era chamar os dois pela mesma pergunta. */
  await abrir(CENARIO + "; abrirResumo();");
  const tituloResumo = await p.evaluate(() =>
    [...document.querySelectorAll(".resumo-secao h2")].map(e => e.textContent.trim()));
  await abrir(CENARIO + "; abrirRelatorios();");
  const tituloRel = await p.evaluate(() =>
    [...document.querySelectorAll(".bloco h2")].map(e => e.textContent.trim()));
  ok("o Resumo e os Relatórios não repetem o mesmo título",
    !tituloResumo.some(t => tituloRel.includes(t)));
  ok("o Resumo fala de conta", tituloResumo.includes("O que saiu da conta"));
  ok("e os Relatórios, de gasto", tituloRel.includes("Para onde foi o dinheiro"));

  /* ─── A ROSCA DO RESUMO FECHA COM AS SAÍDAS ──────────────────────────
     Aqui é extrato: o guardado saiu da conta de verdade. Tirar ele da
     rosca faria o número do meio não bater com o card acima — dois
     números que não fecham na mesma tela, que é o pior defeito deste
     app. Então ele fica, e a tela DIZ o que ele é. */
  await abrir(CENARIO + "; abrirResumo();");
  ok("as saídas do card somam tudo que saiu da conta",
    valor(await texto(".resumo-numero.saida strong")) === 1300);
  ok("e o meio da rosca mostra o mesmo número",
    valor(await texto(".resumo-grafico-total strong")) === 1300);
  ok("com o rótulo dizendo que é conta, não gasto",
    (await texto(".resumo-grafico-total small")) === "Saiu da conta");
  ok("o guardado continua na rosca, porque saiu da conta mesmo",
    (await p.locator(".resumo-ranking").count()) === 1 &&
    (await texto(".resumo-ranking")).includes("Guardado"));

  /* A SOMA DAS FATIAS TEM QUE DAR O NÚMERO DO MEIO. É a regra de ouro
     desta tela, e a única maneira de "esconder o guardado da rosca"
     passar despercebido seria ninguém somar. */
  const fatias = await p.evaluate(() =>
    Object.values([...document.querySelectorAll(".lista .item-valor.saida")]).length);
  const porCategoria = await p.evaluate(x => {
    const naoEhGasto = idsQueNaoSaoGasto();
    return lancamentos.filter(l => l.tipo === "saida" && mesDe(l.data) === x)
      .reduce((t, l) => t + Number(l.valor), 0);
  }, M(0));
  ok("a rosca soma exatamente as saídas do mês",
    porCategoria === valor(await texto(".resumo-grafico-total strong")));

  /* ─── E A TELA DIZ O QUE DALI NÃO FOI GASTO ───────────────────────── */
  const temNota = (await p.locator(".resumo-nao-gasto").count()) === 1;
  ok("a tela avisa que parte daquilo foi guardado", temNota);
  const nota = temNota ? await texto(".resumo-nao-gasto") : "";
  ok("com o valor exato", nota.includes("500,00"));
  ok("dizendo que continua sendo seu", nota.includes("continua sendo seu"));
  ok("e apontando pra outra tela, que conta diferente", nota.includes("Relatórios"));

  // Mês sem nada guardado não ganha nota nenhuma: aviso que aparece
  // sempre é aviso que ninguém lê.
  await abrir(CENARIO + `
    lancamentos = lancamentos.filter(l => l.id !== "grd");
    movimentosReserva = []; abrirResumo();`);
  ok("sem nada guardado, nenhuma nota aparece",
    (await p.locator(".resumo-nao-gasto").count()) === 0);

  /* ─── OS DOIS NÚMEROS, LADO A LADO ───────────────────────────────────
     É a conferência que prova que as duas telas discordam DE PROPÓSITO e
     pela diferença exata do que mudou de lugar. */
  await abrir(CENARIO + "; abrirResumo();");
  const saiuDaConta = valor(await texto(".resumo-numero.saida strong"));
  const custou = await p.evaluate(x => _retratoDoMes(x).gastou, M(0));
  ok("o extrato é maior que o gasto, exatamente pelo que foi guardado",
    saiuDaConta - custou === 500);

  const entrouNaConta = valor(await texto(".resumo-numero.entrada strong"));
  const renda = await p.evaluate(x => _retratoDoMes(x).entrou, M(0));
  ok("e as entradas são maiores que a renda, pelo saldo que veio do mês passado",
    entrouNaConta - renda === 300);

  /* ─── A REGRA MORA NUM LUGAR SÓ ──────────────────────────────────────
     O defeito nasceu porque "isto não é gasto" estava escrito só no
     relatorios.js. Uma regra em dois lugares é uma regra que diverge. */
  await abrir(CENARIO);
  ok("o core sabe quais lançamentos não são gasto",
    (await p.evaluate(() => [...idsQueNaoSaoGasto()].sort().join(","))) === "SAL,grd");
  ok("e os Relatórios usam exatamente a mesma função",
    (await p.evaluate(() => _idsDeFechamento === idsDeFechamento)) === true &&
    (await p.evaluate(() => _idsDeReserva === idsDeReserva)) === true);

  /* ─── O QUE NÃO MUDOU, E NÃO PODIA MUDAR ─────────────────────────────
     A retirada do negócio É renda pessoal: ela não entra nessa lista, e
     conta normalmente nas duas telas. Diferente do resgate de reserva,
     que é dinheiro que já era seu voltando. */
  await abrir(CENARIO + `
    negocios = [{ id:"n1", nome:"WA Aqua", tipo:"servico", unidade:"serviço" }];
    lancamentos.push({ id:"ret", tipo:"entrada", valor:1500, data:"${M(0)}-06",
                       categoria:"Retirada", descricao:"Retirada · WA Aqua" });
    movimentosNegocio = [{ id:"mn", negocio_id:"n1", tipo:"retirada", valor:1500,
                           data:"${M(0)}-06", lancamento_id:"ret" }];
    abrirResumo();`);
  ok("a retirada do negócio entra nas entradas do Resumo",
    valor(await texto(".resumo-numero.entrada strong")) === 4800);
  ok("e também conta como renda nos Relatórios",
    (await p.evaluate(x => _retratoDoMes(x).entrou, M(0))) === 4500);
  ok("ela não é 'dinheiro mudando de lugar'",
    (await p.evaluate(() => idsQueNaoSaoGasto().has("ret"))) === false);


  /* ─── A FIXA PREVISTA DIZ QUE É PREVISÃO ─────────────────────────────
     No mês que ainda não tem linha no banco, o aluguel aparece no "ainda
     vai sair" — senão o mês mostraria a renda inteira livre. Mas ele não
     pode dizer "vence 05/01" como se houvesse um boleto: quem tocasse na
     linha iria pra Contas a pagar procurar uma conta que não existe. */
  await abrir(CENARIO + `;
    contas = [{ id:"al", nome:"Aluguel", valor:1200, vencimento:"${M(1)}-05",
                pago:false, categoria:"Casa", recorrente:true }];
    mesAtual = "${M(1)}"; abrirResumo();`);
  const noProximo = await texto(".resumo-secao .lista");
  ok("no mês que tem linha, a conta diz quando vence",
    noProximo.includes("Vence 05/"));
  ok("sem falar em previsão", !noProximo.includes("Prevista"));

  await abrir(CENARIO + `;
    contas = [{ id:"al", nome:"Aluguel", valor:1200, vencimento:"${M(1)}-05",
                pago:false, categoria:"Casa", recorrente:true }];
    mesAtual = "${M(3)}"; abrirResumo();`);
  const laNaFrente = await texto(".resumo-secao .lista");
  ok("três meses à frente o aluguel continua aparecendo",
    laNaFrente.includes("Aluguel") && laNaFrente.includes("1.200,00"));
  ok("mas dito como previsão", laNaFrente.includes("Prevista para"));
  ok("sem prometer um boleto que não existe", !laNaFrente.includes("Vence"));


  /* ─── A ORDEM E A CARA DO "AINDA VAI SAIR" ───────────────────────────
     Pedido depois de olhar o mês de verdade: três faturas, aluguel, duas
     faculdades, transporte, um carnê e duas renegociações. Dez linhas
     iguais, com o mesmo papelzinho cinza, ordenadas só por valor — as
     faturas espalhadas entre o aluguel e a faculdade. */
  const MES_CHEIO = `
    const M = mesDe(_hojeLocal());
    mesAtual = M;
    lancamentos = []; metas = []; fechamentos = []; entradasFixas = [];
    reservas = []; movimentosReserva = []; negocios = []; movimentosNegocio = [];
    cartoes = [
      { id:"k1", nome:"Nayara",  banco:"outro",  dia_fechamento:1, dia_vencimento:10 },
      { id:"k3", nome:"Nubank",  banco:"nubank", dia_fechamento:1, dia_vencimento:6 },
    ];
    comprasCartao = [
      { id:"c1", cartao_id:"k1", descricao:"Compras", valor:740.88, parcelas:1, data:_somaMes(M,-1)+"-15", categoria:"Casa" },
      { id:"c3", cartao_id:"k3", descricao:"Compras", valor:121,    parcelas:1, data:_somaMes(M,-1)+"-15", categoria:"Casa" },
    ];
    pagamentosFatura = [];
    contas = [
      { id:"a",  nome:"Aluguel",      valor:500, vencimento:M+"-10", pago:false, categoria:"Casa", recorrente:true },
      { id:"f1", nome:"Faculdade 1",  valor:486, vencimento:M+"-10", pago:false, categoria:"Educação", recorrente:true },
      { id:"t",  nome:"Transporte",   valor:310, vencimento:M+"-10", pago:false, categoria:"Transporte", recorrente:true },
      { id:"cm", nome:"Cama (2/12)",  valor:266, vencimento:M+"-09", pago:false, categoria:"Casa" },
      { id:"r1", nome:"Renegociação de dívidas (3/12)", valor:81.11, vencimento:M+"-10", pago:false, categoria:"Outros" },
    ];
  `;
  await abrir(MES_CHEIO + "; abrirResumo();");
  const itens = p.locator(".resumo-secao .lista .item");
  const nomes = (await itens.allTextContents()).map(t => t.replace(/\s+/g, " ").trim());

  /* AS FATURAS EM CIMA. Elas são de outra natureza e, na prática, as
     maiores — misturadas por valor, achar "quanto eu devo de cartão este
     mês" virava garimpo. */
  ok("as duas faturas abrem a lista",
    nomes[0].includes("Fatura") && nomes[1].includes("Fatura"));
  ok("e nenhuma fatura aparece depois das contas",
    nomes.slice(2).every(n => !n.includes("Fatura")));
  ok("entre elas, a maior primeiro",
    nomes[0].includes("740,88") && nomes[1].includes("121,00"));
  ok("e as contas continuam da maior pra menor",
    nomes[2].includes("500,00") && nomes[3].includes("486,00") &&
    nomes[nomes.length - 1].includes("81,11"));

  /* A META VAI PRO FIM, porque é a única sem boleto: previsão de gasto,
     não cobrança com data. */
  await abrir(MES_CHEIO + `;
    metas = [{ id:"mm", categoria:"Mercado", valor:900, reservar:true }];
    abrirResumo();`);
  const comMeta = (await p.locator(".resumo-secao .lista .item").allTextContents())
    .map(t => t.replace(/\s+/g, " ").trim());
  ok("a meta fecha a lista, atrás de todas as contas",
    comMeta[comMeta.length - 1].includes("Mercado"));
  ok("mesmo sendo maior que várias delas",
    comMeta[comMeta.length - 1].includes("900,00"));

  /* CADA CONTA COM O ÍCONE DA SUA CATEGORIA. Era 📄 pra todas: dez
     linhas iguais, e a pessoa lia cada nome pra achar o aluguel. */
  await abrir(MES_CHEIO + "; abrirResumo();");
  const icone = (nome) => p.evaluate(x => {
    const linha = [...document.querySelectorAll(".resumo-secao .lista .item")]
      .find(e => e.textContent.includes(x));
    return linha ? linha.querySelector(".item-icone").textContent.trim() : null;
  }, nome);
  ok("aluguel ganha casa", (await icone("Aluguel")) === "🏠");
  ok("faculdade ganha capelo", (await icone("Faculdade")) === "🎓");
  ok("transporte ganha carro", (await icone("Transporte")) === "🚗");
  ok("renegociação de dívidas ganha banco", (await icone("Renegociação")) === "🏦");
  ok("e a fatura continua sendo cartão", (await icone("Fatura Nubank")) === "💳");
  ok("nenhuma conta ficou com o papelzinho genérico",
    !(await p.locator(".resumo-secao .lista").textContent()).includes("📄"));

  /* É A MESMA FUNÇÃO DO EXTRATO LOGO ABAIXO, e isso importa: o aluguel
     tem que ter a mesma cara nas duas listas da mesma tela. */
  ok("o ícone vem da função que desenha o extrato também",
    (await p.evaluate(() => iconeDoLancamento({ tipo: "saida", categoria: "Casa", descricao: "Aluguel" }))) === "🏠");

  /* O "(2/12)" FORA DO NOME. Dentro dele, era a primeira coisa que as
     reticências comiam — e aí a linha não dizia nem o nome inteiro nem a
     parcela. */
  const carne = await texto(".resumo-secao .lista .item:has(.carne-pilula)");
  ok("o carnê mostra o nome sem o (2/12) grudado", carne.includes("Cama"));
  ok("e a parcela vira pílula", carne.includes("2/12"));
  ok("com o nome e a pílula em caixas separadas",
    (await p.locator(".resumo-secao .lista strong.com-pilula > span").count()) >= 1);

  /* O NOME LONGO ENCOLHE E A PÍLULA NÃO. É o caso real que gerou isto:
     "Renegociação de dívidas (3/12)" não cabia, e quem sumia era a
     parcela. */
  const larguras = await p.evaluate(() => {
    const linha = [...document.querySelectorAll(".resumo-secao .lista .item")]
      .find(e => e.textContent.includes("Renegociação"));
    const pilula = linha.querySelector(".carne-pilula");
    const caixa = linha.querySelector("strong.com-pilula");
    return {
      pilulaVisivel: pilula.getBoundingClientRect().width > 0,
      pilulaDentro: pilula.getBoundingClientRect().right <= caixa.getBoundingClientRect().right + 1,
      texto: pilula.textContent.trim(),
    };
  });
  ok("a pílula do nome longo continua na tela", larguras.pilulaVisivel);
  ok("sem transbordar da linha", larguras.pilulaDentro);
  ok("e ainda diz qual parcela é", larguras.texto === "3/12");

  /* Conta que NÃO é carnê não ganha pílula nenhuma. */
  ok("só o carnê tem pílula",
    (await p.locator(".resumo-secao .lista .carne-pilula").count()) === 2);
});
