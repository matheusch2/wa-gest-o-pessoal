/* O CARTÃO.
 *
 * Erro de fatura aparece como dinheiro no mês errado, e isso é difícil de
 * ver olhando a tela — por isso estas conferências existem. Três delas
 * travam defeitos que de fato aconteceram neste app. */

const { suite } = require("./_apoio");

// Cartão que fecha dia 1 e vence dia 10: a compra do dia 14 cai na fatura
// do mês seguinte. É a regra que a pessoa mais erra ao conferir de cabeça.
const CARTAO = `
  cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
  lancamentos = []; contas = []; metas = []; fechamentos = []; entradasFixas = [];
  pagamentosFatura = [];
  comprasCartao = [
    { id:"tv",  cartao_id:"k1", descricao:"TV", valor:1200, parcelas:6,
      data:"2026-05-20", categoria:"Casa", recorrente:false, fim:null },
    { id:"mer", cartao_id:"k1", descricao:"Mercado", valor:187.90, parcelas:1,
      data:"2026-09-20", categoria:"Mercado", recorrente:false, fim:null },
    { id:"net", cartao_id:"k1", descricao:"Netflix", valor:39.90, parcelas:1,
      data:"2026-06-14", categoria:"Lazer", recorrente:true, fim:null },
  ];
  mesAtual = "2026-10";
`;

module.exports = () => suite("Cartão e fatura", async ({ p, ok, abrir, chamadas, texto, valor }) => {

  /* ─── Em que fatura cada compra cai ──────────────────────────────── */
  await abrir(CARTAO);
  const cai = (data) => p.evaluate(d => _mesDaPrimeiraParcela(d, 1), data);
  ok("compra no dia do fechamento ainda entra na fatura do mês", (await cai("2026-09-01")) === "2026-09");
  ok("compra depois dele vai pra seguinte", (await cai("2026-09-02")) === "2026-10");

  const venc = (mes, fech, v) => p.evaluate(a => _vencimentoDaFatura(a[0], a[1], a[2]), [mes, fech, v]);
  ok("vence no mesmo mês quando o vencimento é depois do fechamento",
    (await venc("2026-09", 1, 10)) === "2026-09-10");
  // Fecha dia 28 e vence dia 5: esse dia 5 é o do mês que vem.
  ok("e no mês seguinte quando é antes", (await venc("2026-09", 28, 5)) === "2026-10-05");

  /* ─── A fatura que abre ao tocar no cartão ───────────────────────────
     A "aberta" é onde uma compra de hoje cairia — mas não é a que a
     pessoa veio ver. Fechando dia 1, no dia 8 a aberta já é a do mês que
     vem, que nem terminou de juntar compras. A que importa é a fechada
     mais recente que ainda deve. */
  await abrir(CARTAO);
  const aoAbrir = await p.evaluate(() => _faturaAoAbrir(cartoes[0]));
  const aberta = await p.evaluate(() => _mesFaturaAberta(cartoes[0]));
  ok("abre numa fatura que ainda deve, não na que está juntando compras",
    aoAbrir <= aberta && (await p.evaluate(m => _situacaoFatura(cartoes[0], m).restante, aoAbrir)) > 0);

  // E a LISTA tem que concordar com a tela de dentro. Elas já discordaram.
  await abrir(CARTAO + "; abrirCartoes();");
  const totalLista = valor(await texto(".contas-total strong"));
  const somaCartoes = await p.evaluate(() =>
    cartoes.reduce((s, c) => s + _situacaoFatura(c, _faturaAoAbrir(c)).restante, 0));
  ok("o total da lista é a soma das faturas que os cartões mostram",
    Math.round(totalLista * 100) === Math.round(somaCartoes * 100));

  /* ─── Sete cartões não podem virar sete telas de rolagem ────────────
     A pilha ficava cansativa, e a fatura que vence amanhã podia estar
     embaixo de três já pagas. */
  const SETE = `
    cartoes = ["bb","inter","neon","nubank","c6","picpay","itau"].map((b,i) =>
      ({ id:"k"+i, nome:"Cartão "+i, banco:b, dia_fechamento:1, dia_vencimento:10+i }));
    comprasCartao = cartoes.map((c,i) => ({ id:"c"+i, cartao_id:c.id, descricao:"Compras",
      valor:100*(i+1), parcelas:1, data:"2026-09-20", categoria:"Outros",
      recorrente:false, fim:null }));
    pagamentosFatura = [{ id:"p", cartao_id:"k0", mes_ref:"2026-10", tipo:"pago",
                          valor:100, pago_em:"2026-10-01", lancamento_id:"x" }];
    lancamentos = []; contas = []; metas = []; fechamentos = []; entradasFixas = [];
    mesAtual = "2026-10"; _cartoesEmLista = false;`;

  await abrir(SETE + "; abrirCartoes();");
  ok("os cartões entram num trilho que desliza", (await p.locator(".cartao-trilho").count()) === 1);
  ok("com um ponto por cartão", (await p.locator(".cartao-pontos span").count()) === 7);
  ok("o primeiro ponto nasce aceso", (await p.locator(".cartao-pontos span.ativo").count()) === 1);

  // O trilho rola por dentro. A PÁGINA não pode rolar pro lado — barra
  // horizontal na tela inteira é defeito, não recurso.
  const sobra = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("e a página não passa a rolar pro lado", sobra <= 0);

  /* ─── Quem ainda deve vem primeiro ───────────────────────────────── */
  await abrir(SETE + "; _cartoesEmLista = true; abrirCartoes();");
  ok("o botão troca pra lista", (await p.locator(".cartao-linha").count()) === 7);
  ok("e o trilho some", (await p.locator(".cartao-trilho").count()) === 0);

  const nomes = await p.locator(".cartao-linha-txt strong").allTextContents();
  const pagas = await p.locator(".cartao-linha-valor.quitada").count();
  ok("a fatura já paga desce pro fim", nomes[nomes.length - 1] === "Cartão 0");
  ok("e perde o vermelho — paga não é dívida", pagas === 1);

  const datas = (await p.locator(".cartao-linha-txt small").allTextContents())
    .filter(t => /vence/.test(t))
    .map(t => t.match(/(\d\d)\/(\d\d)\/(\d{4})/).slice(1).reverse().join(""));
  ok("entre as que devem, vence antes aparece antes",
    JSON.stringify(datas) === JSON.stringify([...datas].sort()));

  /* ─── Com dois cartões o botão não aparece ───────────────────────────
     Ele resolve uma lista longa; com dois não há o que resolver, e botão
     que não resolve nada é mais uma coisa pra ler. */
  await abrir(CARTAO + "; abrirCartoes();");
  ok("um cartão só não ganha o alternador", (await p.locator(".cartao-visao").count()) === 0);

  /* ─── Fechada não quer dizer paga ────────────────────────────────────
     O defeito: "faturas de antes" varria o mês corrente junto. Um cartão
     que fecha dia 1 fecha a fatura de outubro no dia 1º de outubro; no
     dia 8 ela está fechada, vence dia 10, e ninguém pagou. É A CONTA DO
     MÊS — oferecer quitá-la junto com as de junho marcava como paga uma
     conta que não foi paga. */
  await abrir(CARTAO);
  const antigas = await p.evaluate(() => _faturasAntigasEmAberto(cartoes[0]).map(x => x.mes));
  const mesCorrente = await p.evaluate(() => mesDe(_hojeLocal()));
  ok("nenhuma fatura 'de antes' é do mês corrente", !antigas.includes(mesCorrente));
  ok("e nenhuma é do futuro", antigas.every(m => m < mesCorrente));

  /* ─── Os três grupos da fatura ───────────────────────────────────── */
  await abrir(CARTAO + `; abrirCartao("k1"); _faturaMes = "2026-10"; desenharCartao("k1");`);
  const grupos = await p.locator(".compra-grupo h3").allTextContents();
  ok("parceladas, assinaturas e à vista, separadas",
    JSON.stringify(grupos) === JSON.stringify(["Parceladas", "Assinaturas", "À vista"]));

  const itens = await p.evaluate(() => _parcelasDaFatura(cartoes[0], "2026-10"));
  const total = await p.evaluate(() => _totalDaFatura(cartoes[0], "2026-10"));
  const somaItens = itens.reduce((s, i) => s + i.valor, 0);
  ok("o total da fatura é a soma do que está listado nela",
    Math.round(somaItens * 100) === Math.round(total * 100));
  // TV 1200/6 = 200, Netflix 39,90, Mercado 187,90.
  ok("a parcelada entra dividida", itens.find(i => i.compra.descricao === "TV").valor === 200);
  ok("a assinatura entra inteira", itens.find(i => i.compra.descricao === "Netflix").valor === 39.90);
  ok("e a à vista também", itens.find(i => i.compra.descricao === "Mercado").valor === 187.90);

  /* ─── Pagar ──────────────────────────────────────────────────────────
     O dinheiro do cartão só sai da conta quando a fatura é paga, e é aí
     que nasce a saída no extrato. Pagar em partes é a soma dos
     pagamentos contra o total — "quitada" é conta, não campo guardado. */
  await abrir(CARTAO + `; pagamentosFatura = [{ id:"p1", cartao_id:"k1", mes_ref:"2026-10",
     tipo:"pago", valor:100, pago_em:"2026-10-10", lancamento_id:"x" }];`);
  const s = await p.evaluate(() => _situacaoFatura(cartoes[0], "2026-10"));
  ok("pagar um pedaço deixa a fatura parcial", s.parcial === true && s.quitada === false);
  ok("e o que falta é o total menos o pago",
    Math.round(s.restante * 100) === Math.round((s.total - 100) * 100));

  await abrir(CARTAO + `; pagamentosFatura = [{ id:"p1", cartao_id:"k1", mes_ref:"2026-10",
     tipo:"pago", valor:_totalDaFatura(cartoes[0], "2026-10"), pago_em:"2026-10-10", lancamento_id:"x" }];`);
  ok("pagando tudo, ela fica quitada", (await p.evaluate(() => _situacaoFatura(cartoes[0], "2026-10").quitada)) === true);

  /* O pagamento nasce em DUAS tabelas, e a saída vem primeiro: se ela
     falhar, nada foi abatido e dá pra tentar de novo. O contrário abateria
     a fatura sem o dinheiro ter saído. */
  await abrir(CARTAO + `; abrirPagarFatura("k1", "2026-10");`);
  await p.evaluate(() => salvarPagamento(document.querySelector(".botao.entrada"), "k1", "2026-10", "ch"));
  const c = await chamadas();
  ok("pagar grava a saída no extrato primeiro",
    c[0] && c[0].tabela === "lancamentos" && c[0].op === "insert");
  ok("e só depois abate a fatura",
    c[1] && c[1].tabela === "pagamentos_fatura" && c[1].op === "insert");
  ok("a saída sai com a categoria Cartão", c[0].dados.categoria === "Cartão");

  /* ─── Quitar as faturas de antes NÃO lança saída ─────────────────────
     Quem cadastra hoje uma compra que já estava na quarta de dez vê três
     faturas antigas em aberto. Marcar como pagas não pode inventar saídas
     em meses que já acabaram — aquele dinheiro saiu antes do app existir. */
  await abrir(CARTAO + `; abrirCartao("k1");`);
  // Fora do cenário e com await: a gravação é assíncrona, e o abrir()
  // zera a lista de chamadas depois de montar a tela.
  await p.evaluate(() => quitarAntigas(document.createElement("button"), "k1"));
  const c2 = await chamadas();
  ok("ele tem o que quitar", c2.length > 0);
  ok("quitar as antigas não toca no extrato", !c2.some(x => x.tabela === "lancamentos"));
  ok("grava só o abatimento", c2.every(x => x.tabela === "pagamentos_fatura"));
  ok("e sem lançamento ligado a ele",
    [].concat(c2[0].dados).every(d => d.lancamento_id === null));
});
