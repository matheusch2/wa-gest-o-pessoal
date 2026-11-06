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
});
