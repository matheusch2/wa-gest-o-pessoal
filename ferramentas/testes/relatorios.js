/* RELATÓRIOS E PROJEÇÕES.
 *
 * A tela faz uma conta DIFERENTE do Resumo de propósito: lá é o extrato
 * ("o que saiu da conta"), aqui é o comportamento ("o que eu gastei").
 * Duas contas diferentes só podem conviver com rótulos diferentes e com a
 * diferença à mostra — e é isso que esta suíte trava. */

const { suite } = require("./_apoio");

const CENARIO = `
  lancamentos = [
    { id:"e1", tipo:"entrada", valor:2000, data:"2026-09-01", categoria:"Salário", descricao:"Salário" },
    { id:"s1", tipo:"saida", valor:640, data:"2026-09-03", categoria:"Mercado", descricao:"Feira" },
    { id:"s2", tipo:"saida", valor:1200, data:"2026-09-05", categoria:"Casa", descricao:"Aluguel" },
    { id:"a1", tipo:"entrada", valor:2000, data:"2026-08-01", categoria:"Salário", descricao:"Salário" },
    { id:"a2", tipo:"saida", valor:543, data:"2026-08-10", categoria:"Mercado", descricao:"Feira" },
  ];
  cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
  comprasCartao = [
    { id:"p1", cartao_id:"k1", descricao:"Tênis", valor:1200, parcelas:6,
      data:"2026-09-14", categoria:"Lazer", recorrente:false, fim:null },
    { id:"p2", cartao_id:"k1", descricao:"Mercado", valor:187.90, parcelas:1,
      data:"2026-09-20", categoria:"Mercado", recorrente:false, fim:null },
  ];
  contas = []; metas = []; pagamentosFatura = []; fechamentos = []; entradasFixas = [];
  mesAtual = "2026-09";
`;

module.exports = () => suite("Relatórios", async ({ p, ok, abrir, texto, valor, temChart }) => {
  // Duas caixas: Entrou e Sobrou. O "gastou" é o número grande lá em cima
  // — e por isso ele é lido de lá, não de uma terceira caixa repetida.
  const caixa = async i =>
    valor(await p.locator(".fatura-resumo > div").nth(i).locator("strong").textContent());
  const gastouGrande = async () => valor(await p.textContent(".rel-topo > strong"));

  /* ─── A conta base ───────────────────────────────────────────────────
     Setembro: entrou 2.000. Gastou 640 de mercado + 1.200 de aluguel no
     extrato, mais 1.200 de tênis e 187,90 de mercado no cartão. */
  await abrir(CENARIO + "; abrirRelatorios();");
  ok("entrou = só as entradas do extrato", (await caixa(0)) === 2000);
  ok("gastou = extrato + compras do cartão", (await gastouGrande()) === 3227.90);
  ok("e a segunda caixa é a diferença", (await caixa(1)) === 1227.90);
  ok("que neste mês é FALTOU, não SOBROU",
    /Faltou/.test(await texto(".fatura-resumo > div:last-child")));

  /* ─── "Sobrou" não promete o que esta conta não entrega ──────────────
     A caixa é entrou menos gastou. Ela não desconta a conta que vence dia
     20 nem a fatura do cartão — e num mês correndo, "sobrou" faz ler como
     dinheiro livre. O número do "quanto posso gastar" é o do Resumo. */
  await abrir(CENARIO + `; mesAtual = mesDe(_hojeLocal()); abrirRelatorios();`);
  ok("mês correndo diz o que o número É: o que resta da renda",
    /Resta da renda/.test(await texto(".fatura-resumo")));
  ok("e não promete que sobrou", !/Sobrou|Faltou/.test(await texto(".fatura-resumo")));
  // "Até agora" dizia QUANDO e não dizia O QUÊ — o dono do app olhou a
  // tela e perguntou qual era o indicador. Rótulo que não se explica
  // sozinho não serve numa tela de dinheiro.
  ok("e não volta pro rótulo que não explicava nada",
    !/Até agora/.test(await texto(".fatura-resumo")));

  // Gastando mais do que entrou, a PALAVRA carrega o sinal e o valor vai
  // positivo: "Passou da renda R$ 500" se lê de primeira.
  await abrir(`
    lancamentos = [{ id:"s", tipo:"saida", valor:500, data:_hojeLocal(),
                     categoria:"Mercado", descricao:"Feira" }];
    comprasCartao = []; cartoes = []; contas = []; metas = [];
    pagamentosFatura = []; fechamentos = []; entradasFixas = [];
    mesAtual = mesDe(_hojeLocal()); abrirRelatorios();`);
  ok("estourar a renda é dito com palavra, não com sinal de menos",
    /Passou da renda/.test(await texto(".fatura-resumo")));
  ok("e o valor vai positivo, porque a palavra já diz o sentido",
    /R\$ 500,00/.test(await texto(".fatura-resumo")) &&
    !/−/.test(await texto(".fatura-resumo")));
  ok("e a caixa fica vermelha",
    (await p.locator(".fatura-resumo .destaque-ruim").count()) === 1);

  // Mês fechado sobrou ou faltou de verdade, e aí a palavra está certa.
  await abrir(CENARIO + `; abrirRelatorios();`);
  ok("mês que já acabou volta a dizer Sobrou ou Faltou",
    /Sobrou|Faltou/.test(await texto(".fatura-resumo")));

  /* O mesmo número não pode aparecer duas vezes na mesma olhada: o gastou
     é o número grande, e a caixa do meio que o repetia saiu. */
  ok("são duas caixas, não três", (await p.locator(".fatura-resumo > div").count()) === 2);
  ok("e o gastou não se repete embaixo do próprio número",
    !/Gastou/.test(await texto(".fatura-resumo")));
  // A aritmética continua conferível de olho: entrou − gastou = a caixa.
  ok("entrou menos gastou dá a caixa da direita",
    Math.round(((await caixa(0)) - (await gastouGrande())) * 100) === -Math.round((await caixa(1)) * 100));

  /* ─── O número grande diz de onde vem cada pedaço ────────────────────
     "Você gastou R$ 3.227,90" com o cartão dentro é verdade e parece
     erro: quem olha diz "eu não paguei isso". Não pagou — sai quando a
     fatura for paga. A tela responde antes da pergunta. */
  ok("a tela separa o que saiu da conta do que está no cartão",
    /já saíram da conta/.test(await texto(".rel-topo")) &&
    /saem quando você pagar a fatura/.test(await texto(".rel-topo")));

  /* E o rótulo não pode prometer que o dinheiro saiu: o número inclui o
     cartão, e quem soma as saídas da lista acha menos. */
  ok("o rótulo não diz 'você gastou'", !/Você gastou/i.test(await texto(".rel-topo")));
  ok("ele diz o que o número é", /O mês custou/i.test(await texto(".rel-topo")));
  const divisao = await texto(".rel-topo-divisao");
  // Extrato: 640 + 1200 = 1840. Cartão: 1200 + 187,90 = 1387,90.
  ok("com o valor do extrato", /R\$ 1\.840,00/.test(divisao));
  ok("e o valor do cartão", /R\$ 1\.387,90/.test(divisao));
  const r = await p.evaluate(() => _retratoDoMes("2026-09"));
  ok("e os dois somam exatamente o número grande",
    Math.round((r.noExtrato + r.noCartao) * 100) === Math.round(r.gastou * 100));

  // Mês sem cartão nenhum não ganha a linha: ela não teria o que dizer.
  await abrir(CENARIO + `; comprasCartao = []; abrirRelatorios();`);
  ok("sem compra no cartão, a linha não aparece",
    (await p.locator(".rel-topo-divisao").count()) === 0);
  await abrir(CENARIO + "; abrirRelatorios();");

  /* ─── As fatias somam o total ────────────────────────────────────────
     Se as categorias não somarem o número grande, é o defeito clássico
     deste app na mesma tela. */
  const cats = await p.locator(".rel-cat").evaluateAll(ns => ns.map(n => ({
    nome: n.querySelector(".rel-cat-nome").textContent.trim(),
    valor: n.querySelector(".rel-cat-valor").textContent,
  })));
  const soma = Math.round(cats.reduce((s, c) => s + Number(
    c.valor.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")), 0) * 100) / 100;
  ok("as categorias somam exatamente o total", soma === 3227.90);
  ok("a maior vem primeiro",
    cats.length > 1 && valor(cats[0].valor) >= valor(cats[1].valor));
  // 640 do extrato + 187,90 do cartão: a compra no crédito cai na
  // categoria dela, e não num balaio chamado "Cartão".
  ok("a compra do cartão entra na categoria dela",
    valor(cats.find(c => /Mercado/.test(c.nome)).valor) === 827.90);

  /* ─── O mesmo número das Metas ───────────────────────────────────── */
  const daMeta = await p.evaluate(() => _gastoDoMesPorCategoria("2026-09").Mercado);
  ok("e bate com o que as Metas mostram", daMeta === 827.90);

  /* ─── Saldo trazido não é renda; guardado não é gasto ────────────────
     Fechar agosto joga a sobra em setembro como entrada. É dinheiro que
     já era seu — contá-lo como renda faria parecer que entrou duas vezes.
     E sair da conta pra poupar não é gastar. */
  await abrir(CENARIO + `;
    lancamentos.push({ id:"sal", tipo:"entrada", valor:257, data:"2026-09-01",
                       categoria:"Saldo", descricao:"Saldo de agosto" });
    fechamentos = [{ id:"f8", mes_ref:"2026-08", sobra:357, levado:257, guardado:100,
                     lancamento_levado_id:"sal", lancamento_guardado_id:"grd" }];
    abrirRelatorios();`);
  ok("o saldo trazido não entra no 'entrou'", (await caixa(0)) === 2000);
  ok("e a tela DIZ que ele ficou de fora, com o valor",
    /Não entram aqui R\$ 257,00 de saldo trazido/.test(await texto(".rel-nota")));

  await abrir(CENARIO + `;
    lancamentos.push({ id:"grd", tipo:"saida", valor:100, data:"2026-08-31",
                       categoria:"Guardado", descricao:"Guardado de agosto" });
    fechamentos = [{ id:"f8", mes_ref:"2026-08", sobra:357, levado:257, guardado:100,
                     lancamento_levado_id:"sal", lancamento_guardado_id:"grd" }];
    mesAtual = "2026-08"; abrirRelatorios();`);
  ok("o que você guardou não vira gasto", (await gastouGrande()) === 543);
  ok("e nenhuma categoria 'Guardado' aparece", !/Guardado/.test(await texto(".rel-cats")));

  /* ─── Mês vazio não quebra e não elogia ──────────────────────────────
     Verde é "você está dentro"; elogiar um mês em que nada aconteceu é
     dizer o que não é verdade. */
  await abrir(CENARIO + `; mesAtual = "2026-12"; abrirRelatorios();`);
  ok("mês sem nada não quebra", (await gastouGrande()) === 0);
  ok("sem divisão por zero", !/NaN|Infinity/.test(await texto("#area")));
  ok("e sem pintar de verde o que não aconteceu",
    (await p.locator(".rel-topo.dentro").count()) === 0);

  /* ─── O bloco de frases saiu da tela ─────────────────────────────────
     Eram seis avisos em cima do relatório, e o dono do app mandou tirar
     pra abrir espaço pros indicadores que ele quer de verdade. Esta
     conferência existe pra ele não voltar sozinho num merge distraído:
     as funções foram apagadas, não escondidas, e o git guarda as frases
     se alguma for pedida de volta. */
  await abrir(CENARIO + "; abrirRelatorios();");
  ok("nenhuma caixa de aviso na tela", (await p.locator(".rel-aviso").count()) === 0);
  ok("nem o bloco que as segurava", (await p.locator(".rel-avisos").count()) === 0);
  ok("nem o título dele", !/O que os números dizem/.test(await texto("#area")));
  ok("e o código não guarda mais as funções delas",
    (await p.evaluate(() => typeof _avisosDoMes)) === "undefined");

  /* ─── A projeção separa o que dá pra desfazer do que não dá ──────── */
  await abrir(CENARIO + `;
    comprasCartao.push({ id:"net", cartao_id:"k1", descricao:"Netflix", valor:40,
      parcelas:1, data:"2026-05-14", categoria:"Lazer", recorrente:true, fim:null });
    contas = [{ id:"alu", nome:"Aluguel", valor:1200, vencimento:"2026-09-05",
                pago:false, categoria:"Casa", recorrente:true }];
    abrirRelatorios();`);
  const proj = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("a projeção começa no mês seguinte", proj[0].mes === "2026-10");
  ok("a parcela do tênis entra como parcela", proj[0].parcelas === 200);
  ok("a assinatura entra separada", proj[0].assinaturas === 40);
  ok("a conta fixa é projetada pros meses que ainda não têm linha", proj[1].fixas === 1200);
  ok("e o total é a soma das três", proj[0].total === 1440);

  // A parcela ACABA; a assinatura não. É a diferença que a tela existe
  // pra mostrar.
  const longe = await p.evaluate(() => _comprometidoPorMes("2026-09", 12));
  ok("passada a última parcela, ela some", longe[8].parcelas === 0);
  ok("mas a assinatura continua", longe[8].assinaturas === 40);

  // Projetar a conta fixa onde JÁ existe linha a contaria duas vezes.
  await abrir(CENARIO + `;
    contas = [{ id:"a1", nome:"Aluguel", valor:1200, vencimento:"2026-09-05",
                pago:false, categoria:"Casa", recorrente:true },
              { id:"a2", nome:"Aluguel", valor:1300, vencimento:"2026-10-05",
                pago:false, categoria:"Casa", recorrente:true }];`);
  const proj2 = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("mês com a conta já criada usa o valor dela, uma vez só", proj2[0].fixas === 1300);

  /* ─── O DIA A DIA ────────────────────────────────────────────────────
     O buraco que o dono do app achou: a projeção mostrava parcela,
     assinatura e conta fixa, e deixava de fora mercado e gasolina — que
     saem todo mês e são a parte que mais pesa em muita casa.

     A fonte é a META OBRIGATÓRIA, não uma média do que foi gasto. Média é
     chute sobre o passado, e esta seção promete que não é chute. A meta
     obrigatória é um número que a própria pessoa escreveu dizendo "isto
     vai sair de todo jeito" — do mesmo jeito que o Resumo já a trata. */
  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Mercado", valor:900, reservar:true }];
    contas = []; comprasCartao = [];
    abrirRelatorios();`);
  const comMeta = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("a meta obrigatória vira dia a dia em todo mês projetado",
    comMeta.every(x => x.diaADia === 900));
  ok("e entra no total do mês", comMeta[0].total === 900);

  // Meta opcional NÃO entra: ela não promete que o dinheiro vai sair, só
  // avisa quando passa. É a mesma regra do Resumo.
  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Lazer", valor:300, reservar:false }];
    contas = []; comprasCartao = [];
    abrirRelatorios();`);
  ok("meta opcional não vira compromisso",
    (await p.evaluate(() => _comprometidoPorMes("2026-09", 6)))[0].diaADia === 0);

  /* NÃO CONTAR O MESMO DINHEIRO DUAS VEZES. Uma meta "Casa" de R$ 1.400
     com o aluguel de R$ 1.200 já dentro da barra como conta fixa não pode
     somar R$ 1.400 por cima: o mês apareceria pedindo R$ 1.200 a mais do
     que pede. É a mesma regra que o Resumo usa. */
  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Casa", valor:1400, reservar:true }];
    contas = [{ id:"alu", nome:"Aluguel", valor:1200, vencimento:"2026-09-05",
                pago:false, categoria:"Casa", recorrente:true }];
    comprasCartao = [];
    abrirRelatorios();`);
  const comAluguel = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("a conta fixa abate a meta da mesma categoria", comAluguel[0].diaADia === 200);
  ok("e o aluguel continua inteiro na faixa dele", comAluguel[0].fixas === 1200);
  ok("então o mês pede 1.400, não 2.600", comAluguel[0].total === 1400);

  // Conta fixa MAIOR que a meta não vira dia a dia negativo: o que
  // excede já está na barra como conta fixa.
  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Casa", valor:500, reservar:true }];
    contas = [{ id:"alu", nome:"Aluguel", valor:1200, vencimento:"2026-09-05",
                pago:false, categoria:"Casa", recorrente:true }];
    comprasCartao = [];
    abrirRelatorios();`);
  const estourou = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("conta fixa maior que a meta não gera dia a dia negativo",
    estourou[0].diaADia === 0 && estourou[0].total === 1200);

  /* A ASSINATURA ABATE, A PARCELA NÃO, e os dois lados têm motivo.
     _compraNoMes() conta a assinatura em TODO mês em que ela corre, então
     ela já ocupa a meta da categoria todo mês. A compra parcelada ela
     conta só no mês da COMPRA — a escolha de gastar aconteceu lá atrás,
     e a parcela que cai em março não consome a meta de março. */
  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Casa", valor:500, reservar:true }];
    contas = [];
    cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
    comprasCartao = [{ id:"net", cartao_id:"k1", descricao:"Internet", valor:120,
                       parcelas:1, data:"2026-05-14", categoria:"Casa",
                       recorrente:true, fim:null }];
    abrirRelatorios();`);
  const comAssinatura = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("a assinatura abate a meta da categoria dela", comAssinatura[0].diaADia === 380);
  ok("e continua inteira na faixa das assinaturas", comAssinatura[0].assinaturas === 120);
  ok("o mês pede os 500 da meta, não 620", comAssinatura[0].total === 500);

  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Lazer", valor:500, reservar:true }];
    contas = [];
    cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
    comprasCartao = [{ id:"ten", cartao_id:"k1", descricao:"Tênis", valor:1200,
                       parcelas:6, data:"2026-09-05", categoria:"Lazer",
                       recorrente:false, fim:null }];
    abrirRelatorios();`);
  const comParcela = await p.evaluate(() => _comprometidoPorMes("2026-09", 6));
  ok("a parcela NÃO abate a meta, porque não ocupa o mês em que cai",
    comParcela[0].diaADia === 500);
  ok("e a parcela segue na faixa dela", comParcela[0].parcelas === 200);

  // Enquanto não houver meta obrigatória, a tela responde a pergunta que
  // ela mesma provoca — e a linha some sozinha quando a primeira nascer.
  await abrir(CENARIO + `;
    metas = []; contas = [{ id:"alu", nome:"Aluguel", valor:1200,
      vencimento:"2026-09-05", pago:false, categoria:"Casa", recorrente:true }];
    abrirRelatorios();`);
  ok("sem meta obrigatória, a tela diz por que o mercado não está lá",
    (await p.locator(".rel-falta").count()) === 1);
  await abrir(CENARIO + `;
    metas = [{ id:"m1", categoria:"Mercado", valor:900, reservar:true }];
    abrirRelatorios();`);
  ok("e a linha some quando a primeira meta existe",
    (await p.locator(".rel-falta").count()) === 0);

  /* ─── Sem o Chart.js, nenhum número some ─────────────────────────────
     A biblioteca vem de um CDN. O desenho é o extra; a frase é o
     conteúdo. */
  await abrir(CENARIO + `;
    contas = [{ id:"alu", nome:"Aluguel", valor:1200, vencimento:"2026-09-05",
                pago:false, categoria:"Casa", recorrente:true }];
    abrirRelatorios();`);
  const semGrafico = await texto("#area");
  // O parágrafo "dos próximos 6 meses..." saiu da tela a pedido do dono
  // do app. O que ele garantia continua garantido pela legenda, que
  // carrega os três valores por escrito — e pelo total no cabeçalho.
  ok("o total comprometido está escrito, não só desenhado",
    /Parcelas/.test(semGrafico) && /Assinaturas/.test(semGrafico) &&
    /Contas fixas/.test(semGrafico));
  ok("a média mensal também", /por mês, em média/.test(semGrafico));
  ok("as categorias continuam com valor", (await p.locator(".rel-cat-valor").count()) > 0);
  ok("e nenhum gráfico foi criado", (await p.evaluate(() => graficos.length)) === 0);

  /* A LEGENDA PRECISA DE MARCADOR VISÍVEL. Os quadradinhos existiam no
     HTML e nasciam com zero por zero: o tamanho morava numa regra presa
     ao '.rel-cat', e na legenda o elemento vive noutro pai. Resultado:
     três nomes e três valores sem ligação nenhuma com as três faixas da
     barra, e a pessoa tendo que adivinhar qual cor era qual. */
  const naProjecao = (sel) => p.evaluate((s) => {
    const bloco = document.getElementById("rel-canvas-proj")?.closest(".bloco");
    return [...(bloco ? bloco.querySelectorAll(s) : [])]
      .map(e => ({ cor: getComputedStyle(e).backgroundColor,
                   l: e.getBoundingClientRect().width,
                   a: e.getBoundingClientRect().height }));
  }, sel);

  const selos = await naProjecao(".rel-legenda-item .rel-cat-ponto");
  ok("cada faixa da projeção tem um marcador na legenda", selos.length === 4);
  ok("e ele tem tamanho de verdade na tela",
    selos.every(s => s.l >= 8 && s.a >= 8));
  ok("quadrado, porque representa uma faixa da barra",
    selos.every(s => Math.abs(s.l - s.a) < 1.5));

  // Cada faixa tem a SUA cor. Três marcadores iguais seriam pior do que
  // marcador nenhum: a legenda deixaria de ligar nome a faixa.
  ok("e cada um com a cor da faixa dele",
    new Set(selos.map(s => s.cor)).size === 4);

  // O parágrafo saiu a pedido do dono do app: o gráfico fala por si, e a
  // legenda logo acima já carrega os três valores.
  ok("o parágrafo embaixo da projeção saiu",
    !/já têm dono/.test(await texto("#area")) &&
    !/não é chute/.test(await texto("#area")));

  if (!temChart) {
    console.log("  --    (chart.js não instalado: os desenhos não foram conferidos)");
    return;
  }

  /* ─── Com ele, os três nascem e dizem o mesmo que o texto ────────── */
  await abrir(CENARIO + `;
    contas = [{ id:"alu", nome:"Aluguel", valor:1200, vencimento:"2026-09-05",
                pago:false, categoria:"Casa", recorrente:true }];
    abrirRelatorios();`, { grafico: true });
  ok("três gráficos na tela", (await p.evaluate(() => graficos.length)) === 3);
  ok("rosca, barras e barras",
    JSON.stringify(await p.evaluate(() => graficos.map(g => g.config.type)))
      === JSON.stringify(["doughnut", "bar", "bar"]));

  const somaBarras = await p.evaluate(() =>
    graficos[2].data.datasets.reduce((s, d) => s + d.data.reduce((a, b) => a + b, 0), 0));
  const escrito = await p.evaluate(() =>
    _comprometidoPorMes("2026-09", 6).reduce((s, x) => s + x.total, 0));
  ok("a soma das barras bate com o total escrito",
    Math.round(somaBarras * 100) === Math.round(escrito * 100));

  /* Sair da tela destrói todos: o innerHTML seguinte joga os canvas fora,
     e o Chart.js não percebe sozinho. */
  await p.evaluate(() => voltarInicio());
  ok("sair da tela limpa os gráficos", (await p.evaluate(() => graficos.length)) === 0);
});
