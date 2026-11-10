/* DUAS TELAS, UM NÚMERO SÓ.
 *
 * É a suíte mais importante do app. Ela não testa uma tela: testa que as
 * telas CONCORDAM. Três vezes neste projeto o defeito foi dois números
 * para a mesma coisa em lugares diferentes, e as três vezes o usuário
 * descobriu antes do código.
 *
 * O que ela trava:
 *   - Metas e Resumo dizendo gastos diferentes pra mesma categoria
 *   - a fatura do cartão sumindo do "ainda vai sair"
 *   - a mesma despesa sendo reservada duas vezes
 *   - mês fechado continuando a prometer que algo "ainda vai sair"
 */

const { suite } = require("./_apoio");

// O mês daqui a N, calculado neste processo — o navegador roda no mesmo
// fuso, então os dois chegam no mesmo lugar.
const _diasNoMes = (ym) => {
  const [a, m] = ym.split("-").map(Number);
  return new Date(a, m, 0).getDate();
};

const _mesDaqui = (n) => {
  const h = new Date();
  const d = new Date(h.getFullYear(), h.getMonth() + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

/* OS MESES SÃO RELATIVOS A HOJE, e isso não é capricho: cenário com mês
   fixo passa a falhar sozinho quando aquele mês vira passado — e o app
   trata mês passado de outro jeito de propósito (ele não reserva nada).
   Aconteceu: esta suíte quebrou na virada do mês sem ninguém mexer no
   código. Escrito assim, ela vale em qualquer data.

   Mercado com meta de 1.000: R$ 300 já no cartão, R$ 200 no extrato. A
   fatura que vence no mês tem as compras do mês passado. */
const CENARIO = `
  const M = mesDe(_hojeLocal());
  const ANT = _somaMes(M, -1);
  cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
  comprasCartao = [
    { id:"c1", cartao_id:"k1", descricao:"Mercado", valor:300, parcelas:1,
      data:M + "-01", categoria:"Mercado", recorrente:false, fim:null },
  ];
  lancamentos = [
    { id:"e1", tipo:"entrada", valor:4000, data:M + "-01", categoria:"Salário", descricao:"Salário" },
    { id:"s1", tipo:"saida", valor:200, data:M + "-03", categoria:"Mercado", descricao:"Feira" },
  ];
  metas = [{ id:"m1", categoria:"Mercado", valor:1000, reservar:true }];
  contas = []; pagamentosFatura = []; fechamentos = []; entradasFixas = [];
  mesAtual = M;
`;

module.exports = () => suite("Metas, Resumo e o que ainda vai sair", async ({ p, ok, abrir, texto, valor }) => {

  // O mesmo mês que a página vai calcular: o navegador roda no mesmo
  // fuso deste processo, e pedir à página exigiria ela já estar aberta.
  const hoje = new Date();
  const M = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");

  /* ─── A MESMA FUNÇÃO, NÃO UMA CÓPIA ──────────────────────────────────
     O Resumo dizia "Mercado, ainda vai sair R$ 1.000" enquanto as Metas
     diziam "sobram R$ 683,61", porque um contava a compra no cartão e o
     outro não. Agora os dois chamam _gastoDoMesPorCategoria. */
  await abrir(CENARIO);
  const gasto = await p.evaluate(x => _gastoDoMesPorCategoria(x).Mercado, M);
  ok("gasto da categoria = extrato + cartão", gasto === 500);

  const reserva = await p.evaluate(x =>
    aindaVaiSairDoMes(x).linhas.find(l => l.tipo === "meta"), M);
  ok("a meta reserva só o que falta dela", reserva.falta === 500);
  ok("e mostra o mesmo gasto que as Metas mostram", reserva.gasto === gasto);

  // A tela de Metas, desenhada, tem que dizer o mesmo número.
  await abrir(CENARIO + "; abrirMetas();");
  const naTela = valor(await texto(".meta-item .meta-baixo strong"));
  ok("a tela de Metas mostra exatamente esse gasto", naTela === gasto);

  /* ─── A FATURA ENTRA NO QUE AINDA VAI SAIR ───────────────────────────
     O mês somava contas e metas e mostrava sobra com uma fatura caindo no
     dia 10 — a maior conta da casa, a única que o app sabia calcular e
     não reservava. */
  await abrir(CENARIO + `; comprasCartao.push({ id:"c0", cartao_id:"k1", descricao:"TV",
     valor:800, parcelas:1, data:ANT + "-15", categoria:"Casa", recorrente:false, fim:null });`);
  const r = await p.evaluate(x => aindaVaiSairDoMes(x), M);
  const fatura = r.linhas.find(l => l.tipo === "fatura");
  ok("a fatura aparece no 'ainda vai sair'", !!fatura);
  // A fatura de outubro junta a TV de setembro (800) e o mercado do dia 1º
  // (300) — o cartão fecha dia 1, então o dia 1º ainda entra nela.
  ok("pelo total do que falta nela", fatura.falta === 1100);
  ok("e pelo mês em que VENCE, não o da fatura", fatura.vencimento === M + "-10");

  /* ─── E NÃO CONTA EM DOBRO COM A META ────────────────────────────────
     Parece que sim, e não é: a compra no cartão já entrou como gasto, e
     gasto ABATE a reserva da meta em vez de somar. Meta de 1.000 com
     R$ 500 gastos reserva 500; a fatura reserva o que vence. */
  await abrir(CENARIO + `; comprasCartao[0].data = ANT + "-20";`);
  const r2 = await p.evaluate(x => aindaVaiSairDoMes(x), M);
  const meta2 = r2.linhas.find(l => l.tipo === "meta");
  const fat2 = r2.linhas.find(l => l.tipo === "fatura");
  // Setembro: 300 no cartão. Outubro: 200 no extrato → meta falta 800.
  // A fatura de outubro cobra os 300 de setembro.
  ok("a meta reserva o que falta dela no mês", meta2.falta === 800);
  ok("a fatura reserva o que vai sair da conta", fat2.falta === 300);
  ok("e o total é a soma, sem repetição", r2.total === 1100);

  /* ─── O total do bloco é a soma das linhas ───────────────────────── */
  await abrir(CENARIO + "; abrirResumo();");
  const linhas = await p.locator(".resumo-secao:has(h2:text-is('Ainda vai sair')) .item-valor").allTextContents();
  const soma = Math.round(linhas.reduce((s, v) => s + valor(v), 0) * 100) / 100;
  const cabecalho = valor(await texto(".resumo-total-saida"));
  ok("o total do bloco soma exatamente as linhas", soma === cabecalho);

  /* ─── Conta paga sai da reserva sozinha ──────────────────────────── */
  await abrir(CENARIO + `; contas = [{ id:"cz", nome:"Luz", valor:180,
     vencimento:M + "-20", pago:false, categoria:"Casa", recorrente:true }];`);
  const comConta = await p.evaluate(x => aindaVaiSairDoMes(x).total, M);
  await abrir(CENARIO + `; contas = [{ id:"cz", nome:"Luz", valor:180,
     vencimento:M + "-20", pago:true, pago_em:M + "-19", categoria:"Casa", recorrente:true }];`);
  const semConta = await p.evaluate(x => aindaVaiSairDoMes(x).total, M);
  ok("conta paga deixa de ser reservada", Math.round((comConta - semConta) * 100) === 18000);

  /* ─── Mês que já acabou não promete nada ─────────────────────────────
     Reservar é dizer "isto ainda vai sair", e num mês fechado nada mais
     sai dele. Sem esta regra, agosto mostrava "sobra −R$ 200" no topo e
     "sobraram R$ 257" no botão de fechar — na mesma tela. */
  await abrir(CENARIO);
  const passado = await p.evaluate(() => aindaVaiSairDoMes(mesVizinho(mesDe(_hojeLocal()), -1)));
  ok("mês passado não reserva nada", passado.total === 0 && passado.linhas.length === 0);

  /* ─── A CONTA FIXA DOS MESES QUE NÃO TÊM LINHA ───────────────────────
     DEFEITO REPORTADO POR QUEM ESTAVA CADASTRANDO AS CONTAS DO IRMÃO:
     "não aparece as contas fixas nos próximos meses; aparece no mês
     posterior, que é dezembro, mas no restante não".

     E era isso mesmo. Conta fixa não existe no banco em todo mês — existe
     uma linha por mês, e a do mês seguinte só nasce quando a atual é
     paga. Dezembro tinha linha; janeiro em diante não tinha linha
     nenhuma, e o Resumo mostrava a renda inteira livre.

     O pior é que o Relatório projetava e o Resumo não: a mesma pergunta
     com duas respostas, porque eram dois códigos. */
  const FIXAS = `
    const M = mesDe(_hojeLocal());
    const PROX = _somaMes(M, 1);
    lancamentos = []; cartoes = []; comprasCartao = []; pagamentosFatura = [];
    metas = []; fechamentos = []; entradasFixas = [];
    contas = [
      { id:"al", nome:"Aluguel", valor:1200, vencimento:PROX + "-05",
        pago:false, categoria:"Casa", recorrente:true },
      { id:"lz", nome:"Luz", valor:180, vencimento:PROX + "-20",
        pago:false, categoria:"Casa", recorrente:true },
    ];
    mesAtual = M;
  `;
  await abrir(FIXAS);
  const daqui = (n) => p.evaluate(x => aindaVaiSairDoMes(_somaMes(mesDe(_hojeLocal()), x)), n);

  const prox = await daqui(1);
  ok("o mês que tem linha no banco soma as duas contas", prox.total === 1380);
  ok("e nenhuma delas é projeção, porque existem de verdade",
    prox.linhas.every(l => !l.previsao));

  for (const n of [2, 3, 6]) {
    const m = await daqui(n);
    ok(`daqui a ${n} meses as fixas continuam lá`, m.total === 1380);
    ok(`e vêm marcadas como previsão`, m.linhas.length === 2 && m.linhas.every(l => l.previsao));
  }

  /* NUNCA ANTES DE A SÉRIE COMEÇAR, e este é o caso que a pessoa está
     olhando na hora de cadastrar: ela põe hoje o aluguel que começa no
     mês que vem, e o mês corrente não pode ganhar um aluguel que ninguém
     vai pagar. */
  const agora = await daqui(0);
  ok("o mês corrente não inventa a fixa que só começa no mês seguinte",
    agora.total === 0);

  /* O DIA SE MANTÉM, porque é por ele que o Resumo ordena e é ele que a
     pessoa reconhece. Dia 31 num mês de 30 cai no último dia, não vira
     o dia 1 do mês seguinte. */
  const daquiA2 = await daqui(2);
  ok("a projeção mantém o dia do vencimento",
    daquiA2.linhas.map(l => l.vencimento.slice(-2)).sort().join(",") === "05,20");

  await abrir(FIXAS + `;
    contas.push({ id:"al31", nome:"Cartão da loja", valor:90,
                  vencimento:_somaMes(mesDe(_hojeLocal()), 1) + "-31",
                  pago:false, categoria:"Casa", recorrente:true });`);
  const todosOsDias = await p.evaluate(() => {
    const meses = [2, 3, 4, 5, 6].map(n => _somaMes(mesDe(_hojeLocal()), n));
    return meses.map(m => (fixasProjetadasNoMes(m).find(f => f.nome === "Cartão da loja") || {}).vencimento);
  });
  ok("dia 31 nunca vaza pro mês seguinte",
    todosOsDias.every((v, i) => v && v.slice(0, 7) === _mesDaqui(i + 2)));
  /* E A DATA TEM QUE EXISTIR NO CALENDÁRIO. "2027-02-31" passaria no
     teste de cima — o mês está certo —, e seria uma data que não existe:
     ordenaria errado e viraria "Invalid Date" na hora de escrever o
     vencimento na tela. */
  ok("e é um dia que existe naquele mês",
    todosOsDias.every(v => Number(v.slice(-2)) <= _diasNoMes(v.slice(0, 7))));
  ok("caindo no último dia quando o mês é curto",
    todosOsDias.every(v => Number(v.slice(-2)) === _diasNoMes(v.slice(0, 7))));

  /* O VALOR PROJETADO É O DO ÚLTIMO MÊS CONHECIDO, não o do primeiro.
     Conta de luz muda todo mês; projetar o valor mais antigo da série
     faria o app prever para sempre o preço de quando ela foi cadastrada. */
  await abrir(`
    const M = mesDe(_hojeLocal());
    lancamentos = []; cartoes = []; comprasCartao = []; pagamentosFatura = [];
    metas = []; fechamentos = []; entradasFixas = []; mesAtual = M;
    contas = [
      { id:"l1", nome:"Luz", valor:180, vencimento:_somaMes(M, -2) + "-20",
        pago:true, pago_em:_somaMes(M, -2) + "-19", categoria:"Casa", recorrente:true },
      { id:"l2", nome:"Luz", valor:260, vencimento:_somaMes(M, -1) + "-20",
        pago:true, pago_em:_somaMes(M, -1) + "-19", categoria:"Casa", recorrente:true },
    ];
  `);
  const comHistorico = await daqui(2);
  ok("a projeção repete o valor do mês mais recente", comHistorico.total === 260);
  ok("e não o do mês mais antigo da série", comHistorico.total !== 180);

  /* PAGA NÃO PROJETA EM CIMA DELA MESMA. O mês que já tem a linha, paga
     ou não, está resolvido — projetar ali somaria o aluguel duas vezes. */
  await abrir(FIXAS + `; contas[0].pago = true; contas[0].pago_em = PROX + "-05";`);
  const comPaga = await daqui(1);
  ok("fixa já paga não volta como previsão", comPaga.total === 180);
  ok("e não aparece duas vezes", comPaga.linhas.length === 1);

  /* NÃO CONTA EM DOBRO COM A META. A fixa projetada entra como conta, e
     é isso que faz a meta da categoria descontá-la — a meta "Casa" de
     R$ 1.400 com R$ 1.380 de fixas previstas reserva só os R$ 20 que
     sobram, não os 1.400 inteiros por cima. */
  await abrir(FIXAS + `;
    metas = [{ id:"mc", categoria:"Casa", valor:1400, reservar:true }];`);
  const comMeta = await daqui(3);
  ok("a meta desconta as fixas previstas da mesma categoria",
    comMeta.total === 1400);
  ok("em vez de somar as duas coisas", comMeta.total !== 2780);

  /* O RELATÓRIO E O RESUMO USAM A MESMA FUNÇÃO. Era a divergência de
     origem: a projeção existia só no Relatório. */
  await abrir(FIXAS);
  const batem = await p.evaluate(() => {
    const M = mesDe(_hojeLocal());
    const linha = _comprometidoPorMes(M, 6).find(l => l.mes === _somaMes(M, 4));
    return { relatorio: linha.fixas, resumo: aindaVaiSairDoMes(_somaMes(M, 4)).total };
  });
  ok("Relatório e Resumo dão o mesmo número pro mesmo mês",
    batem.relatorio === batem.resumo && batem.relatorio === 1380);


  /* ─── METAS E RESUMO CONCORDAM SOBRE O QUE OCUPA UMA META ────────────
     DEFEITO ACHADO NA VARREDURA: boleto em aberto de uma categoria é
     gasto daquela categoria que já está prometido. O Resumo sempre
     soube — ele reservava R$ 848 pela meta "Casa" de R$ 1.400 e R$ 352
     pelo boleto do aluguel. A tela de Metas não sabia, e dizia "Casa,
     sobram R$ 1.200".

     O TOTAL DAS DUAS BATIA, e era isso que escondia o defeito: a soma
     fechava, e a frase da tela de Metas convidava a gastar R$ 352 que já
     tinham dono. */
  const META_COM_BOLETO = `
    const M = mesDe(_hojeLocal());
    mesAtual = M;
    cartoes = []; comprasCartao = []; pagamentosFatura = [];
    fechamentos = []; entradasFixas = [];
    lancamentos = [{ id:"s", tipo:"saida", valor:200, data:M+"-03",
                     categoria:"Casa", descricao:"Material" }];
    contas = [{ id:"a", nome:"Aluguel", valor:352, vencimento:M+"-25",
                pago:false, categoria:"Casa", recorrente:true }];
    metas = [{ id:"m", categoria:"Casa", valor:1400, reservar:true }];
  `;
  await abrir(META_COM_BOLETO + "; abrirMetas();");

  const _linhaDaMeta = () => p.evaluate(() => {
    const linha = [...document.querySelectorAll(".meta-item")]
      .find(e => e.textContent.includes("Casa"));
    return linha.textContent.replace(/\s+/g, " ").trim();
  });
  const casaNaTela = await _linhaDaMeta();
  ok("a meta desconta o boleto em aberto da categoria",
    casaNaTela.includes("Sobram R$ 848,00"));
  ok("e não convida mais a gastar os R$ 1.200", !casaNaTela.includes("1.200,00"));
  ok("dizendo quanto está preso em boleto", casaNaTela.includes("352,00 em boleto"));
  ok("sem esconder o que já saiu de verdade", casaNaTela.includes("200,00"));

  /* OS DOIS CHAMAM A MESMA FUNÇÃO. Dar no mesmo hoje, por caminhos
     diferentes, é exatamente como duas contas começam a divergir
     amanhã. */
  const bate = await p.evaluate(() => {
    const M = mesDe(_hojeLocal());
    const linhas = aindaVaiSairDoMes(M).linhas;
    return {
      doCore: contasAbertasDaCategoria("Casa", M),
      noResumo: linhas.filter(x => x.tipo === "conta" && x.categoria === "Casa")
                      .reduce((s, x) => s + x.falta, 0),
      metaNoResumo: (linhas.find(x => x.tipo === "meta" && x.categoria === "Casa") || {}).falta,
    };
  });
  ok("o core e o Resumo veem o mesmo boleto", bate.doCore === 352 && bate.noResumo === 352);
  ok("e a reserva da meta no Resumo é a mesma sobra da tela de Metas",
    bate.metaNoResumo === 848);

  /* A BARRA MOSTRA OS DOIS PEDAÇOS, lado a lado e não empilhados — sem o
     flex, o listrado caía embaixo e a barra dobrava de altura. */
  const barra = await p.evaluate(() => {
    const b = [...document.querySelectorAll(".meta-item")]
      .find(e => e.textContent.includes("Casa")).querySelector(".meta-barra");
    const cheio = b.querySelector("span").getBoundingClientRect();
    const listrado = b.querySelector("i").getBoundingClientRect();
    return {
      ladoALado: Math.abs(cheio.top - listrado.top) < 1 && listrado.left >= cheio.right - 1,
      altura: Math.round(b.getBoundingClientRect().height),
      listradoTemLargura: listrado.width > 1,
    };
  });
  ok("o pedaço preso fica ao lado do gasto", barra.ladoALado);
  ok("e a barra não dobra de altura", barra.altura === 8);
  ok("o pedaço preso aparece", barra.listradoTemLargura);

  /* O PERCENTUAL CONTA OS DOIS. 200 gastos de 1.400 é 14%; com os R$ 352
     do aluguel já prometidos, a categoria está em 39% do teto. Mostrar
     14% ali é dizer que há folga onde não há — é o mesmo erro da frase,
     só que em número grande. */
  const pct = await p.evaluate(() => {
    const linha = [...document.querySelectorAll(".meta-item")]
      .find(e => e.textContent.includes("Casa"));
    const b = linha.querySelector(".meta-barra");
    return {
      texto: linha.querySelector(".meta-pct").textContent.trim(),
      larguraCheio: b.querySelector("span").getBoundingClientRect().width,
      larguraPresa: b.querySelector("i").getBoundingClientRect().width,
      larguraTotal: b.getBoundingClientRect().width,
    };
  });
  ok("o percentual conta o gasto e o que está preso", pct.texto === "39%");
  ok("e não só o gasto", pct.texto !== "14%");
  /* E A BARRA DESENHA ESSA MESMA PROPORÇÃO: o cheio é o gasto, o
     listrado é o preso, e juntos ocupam os 39%. */
  ok("o pedaço cheio é o gasto (200 de 1.400)",
    Math.abs(pct.larguraCheio / pct.larguraTotal - 200 / 1400) < 0.02);
  ok("o listrado é o preso (352 de 1.400)",
    Math.abs(pct.larguraPresa / pct.larguraTotal - 352 / 1400) < 0.02);

  /* O NÚMERO DO TOPO TAMBÉM. "Ainda pode gastar" é a soma das sobras, e
     se cada sobra desconta o boleto, o topo tem que descontar junto —
     senão a tela se contradiz consigo mesma, com o total dizendo uma
     coisa e as linhas embaixo dizendo outra. */
  const topo = await texto(".contas-total");
  ok("o topo desconta o boleto também", topo.includes("848,00"));
  ok("e diz quanto do teto já está ocupado", topo.includes("552,00 de R$ 1.400,00"));
  ok("sem anunciar a folga antiga", !topo.includes("1.200,00"));

  /* FIXA AINDA SEM LINHA NO MÊS TAMBÉM OCUPA. Ela vai sair, e o Resumo
     já a reserva como conta desde que passou a projetar. */
  await abrir(META_COM_BOLETO + `;
    contas[0].vencimento = _somaMes(M, -1) + "-25";
    contas[0].pago = true; contas[0].pago_em = _somaMes(M, -1) + "-25";
    abrirMetas();`);
  const comPrevista = await _linhaDaMeta();
  ok("a fixa projetada no mês também ocupa a meta",
    comPrevista.includes("352,00 em boleto"));
  ok("e a sobra desconta ela igual", comPrevista.includes("Sobram R$ 848,00"));

  /* SEM BOLETO NENHUM, nada muda do que era antes. */
  await abrir(META_COM_BOLETO + "; contas = []; abrirMetas();");
  const semBoleto = await p.evaluate(() => {
    const linha = [...document.querySelectorAll(".meta-item")]
      .find(e => e.textContent.includes("Casa"));
    return {
      texto: linha.textContent.replace(/\s+/g, " ").trim(),
      listrado: linha.querySelectorAll(".meta-barra i").length,
    };
  });
  ok("sem boleto, a sobra é o teto menos o gasto", semBoleto.texto.includes("Sobram R$ 1.200,00"));
  ok("e não há pedaço listrado na barra", semBoleto.listrado === 0);


  /* ─── O pagamento da fatura não é gasto de novo ──────────────────────
     Ele é a mesma despesa chegando pela segunda vez: as compras já foram
     contadas uma a uma, cada uma na sua categoria. */
  await abrir(CENARIO + `;
    lancamentos.push({ id:"fat", tipo:"saida", valor:900, data:M + "-10",
                       categoria:"Cartão", descricao:"Fatura Nubank" });
    pagamentosFatura.push({ id:"pf", cartao_id:"k1", mes_ref:M, tipo:"pago",
                            valor:900, pago_em:M + "-10", lancamento_id:"fat" });`);
  const porCat = await p.evaluate(x => _gastoDoMesPorCategoria(x), M);
  ok("pagar a fatura não vira gasto novo", !porCat.Cartão);
  ok("e o mercado continua o mesmo", porCat.Mercado === 500);
});
