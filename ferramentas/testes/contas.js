/* CONTAS, CARNÊ E ASSINATURA.
 *
 * Três coisas que o app guarda de jeitos diferentes porque elas SÃO
 * diferentes, e confundi-las dá erro caro:
 *
 *   conta fixa   repete pra sempre, uma linha por vez
 *   carnê        tem fim, e já nasce inteiro no banco
 *   assinatura   não tem fim, e vive dentro do cartão
 */

const { suite } = require("./_apoio");

const CARNE = `
  contas = [{ id:"luz", nome:"Energia", valor:180, vencimento:_hojeLocal(),
              pago:false, categoria:"Casa", recorrente:true }];
  for (let i = 1; i <= 26; i++) contas.push({
    id:"m"+i, nome:"Moto ("+i+"/26)", valor:600,
    vencimento:_vencimentoDaParcela("2026-09-15", i-1),
    pago: i === 1, pago_em: i === 1 ? "2026-09-15" : null,
    categoria:"Transporte", recorrente:false });
  lancamentos = []; cartoes = []; comprasCartao = []; metas = [];
  pagamentosFatura = []; fechamentos = []; entradasFixas = [];
`;

const ASSINATURA = `
  cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
  comprasCartao = [
    { id:"net", cartao_id:"k1", descricao:"Netflix", valor:39.90, parcelas:1,
      data:"2026-06-14", categoria:"Lazer", recorrente:true, fim:null },
  ];
  lancamentos = []; contas = []; metas = []; pagamentosFatura = [];
  fechamentos = []; entradasFixas = []; mesAtual = "2026-09";
`;

module.exports = () => suite("Contas, carnê e assinatura", async ({ p, ok, abrir, chamadas, texto, valor }) => {

  /* ─── A ABA "A PAGAR" É UM MÊS ───────────────────────────────────────
     Ela mostrava TUDO em aberto: num app com um carnê de 26 parcelas,
     41 linhas e R$ 18 mil de total — um número que mistura o que vence
     semana que vem com o que vence em 2029, e nenhum jeito de perguntar
     "quanto cai em dezembro".

     Agora a aba é um mês, com setas. O carnê deixa de ser agrupado aqui:
     dentro de um mês ele é uma parcela, com a pílula dizendo qual. */
  await abrir(CARNE + "; abrirContas();");
  ok("a aba abre no mês corrente",
    (await texto(".contas-mes-barra strong")).toLowerCase()
      .startsWith(await p.evaluate(() => soNomeDoMes(mesDe(_hojeLocal())))));

  const noMes = await texto(".lista");
  ok("27 contas viram as do mês", (await p.locator(".lista > .conta-item").count()) === 3);
  ok("a conta fixa do mês está lá", noMes.includes("Energia"));
  ok("a parcela que vence no mês também", /3\/26/.test(noMes));
  ok("e a que venceu e não foi paga vem junto, porque ainda é a pagar",
    /2\/26/.test(noMes));
  ok("a parcela já paga não volta", !/1\/26/.test(noMes));
  ok("nem as de 2027 em diante", !/5\/26/.test(noMes) && !/6\/26/.test(noMes));

  /* O TOTAL DA BARRA É O DO MÊS, e não o total em aberto lá de cima: são
     duas perguntas diferentes, e misturar as duas numa só era o problema
     de origem. */
  const totalBarra = valor(await texto(".contas-mes-total"));
  const totalTopo = valor(await texto(".contas-total strong"));
  ok("a barra soma só o que está na lista", totalBarra === 180 + 600 + 600);
  ok("e o cartão do alto continua somando tudo", totalTopo > totalBarra);
  ok("dizendo que o resto está em carnê",
    /em carnê, espalhado pelos próximos meses/.test(await texto(".contas-total")));

  /* ─── PASSAR DE MÊS ──────────────────────────────────────────────── */
  await p.evaluate(() => trocarMesDasContas(1));
  const proximo = await texto(".lista");
  ok("o mês seguinte mostra a parcela dele", /4\/26/.test(proximo));
  ok("sem repetir a do mês passado", !/3\/26/.test(proximo));
  ok("e sem arrastar a atrasada, que só aparece no mês corrente",
    !/2\/26/.test(proximo));
  ok("a energia do mês corrente também não vem junto", !proximo.includes("Energia"));

  /* EM MÊS FUTURO, A DATA; NO MÊS CORRENTE, OS DIAS. "Vence em 35 dias"
     é verdade e não serve: quem folheia dezembro quer o DIA de dezembro,
     não a distância até lá. */
  ok("no mês seguinte, o prazo vira data", /Vence \d\d\/\d\d\/\d{4}/.test(proximo));
  ok("sem contar dias de distância", !/Vence em \d+ dias/.test(proximo));

  await p.evaluate(() => trocarMesDasContas(-1));
  const voltou = await texto(".lista");
  ok("de volta no mês corrente, o prazo volta a ser em dias",
    /Vence em \d+ dias?/.test(voltou));
  ok("e o que venceu continua dizendo há quanto tempo",
    /Venceu há \d+ dias?/.test(voltou));

  /* A aba "Vencidos" não muda de régua por causa do mês que ficou
     escolhido na outra aba: lá o que importa é sempre há quanto tempo. */
  await p.evaluate(() => { trocarMesDasContas(1); filtrarContas("vencidos"); });
  ok("em Vencidos, o prazo é sempre há quantos dias",
    /Venceu há \d+ dias?/.test(await texto(".lista")));
  await p.evaluate(() => { filtrarContas("todos"); trocarMesDasContas(-1); });

  // 26 parcelas a partir de setembro de 2026 chegam até outubro de 2028;
  // 30 meses à frente de hoje passa do fim do carnê de propósito.
  await p.evaluate(() => trocarMesDasContas(30));
  ok("passando do fim do carnê, a lista fica vazia",
    (await p.locator(".lista > .conta-item").count()) === 0);
  ok("e a tela diz de qual mês está falando",
    (await texto(".vazio")).startsWith("Nada vence em"));

  /* Reabrir a tela volta pro mês corrente: quem entra em Contas quer
     saber o que paga agora, não onde parou de folhear. */
  await p.evaluate(() => { voltarInicio(); abrirContas(); });
  ok("reabrir volta pro mês de hoje",
    (await p.locator(".lista > .conta-item").count()) === 3);

  /* ─── CADA CONTA COM A CARA DELA ─────────────────────────────────────
     Eram dois desenhos pra lista inteira: 🔁 em toda conta fixa e 📄 no
     resto. Internet, aluguel, faculdade, água e energia ficavam
     idênticas, e achar uma exigia ler nome por nome. */
  await abrir(`
    const M = mesDe(_hojeLocal());
    lancamentos = []; cartoes = []; comprasCartao = []; metas = [];
    pagamentosFatura = []; fechamentos = []; entradasFixas = [];
    contas = [
      { id:"i",  nome:"Internet",  valor:150, vencimento:M+"-20", pago:false, categoria:"Internet", recorrente:true },
      { id:"al", nome:"Aluguel",   valor:352, vencimento:M+"-20", pago:false, categoria:"Aluguel",  recorrente:true },
      { id:"fa", nome:"Faculdade", valor:160, vencimento:M+"-20", pago:false, categoria:"Educação", recorrente:true },
      { id:"en", nome:"Energia",   valor:150, vencimento:M+"-20", pago:false, categoria:"Energia",  recorrente:true },
      { id:"ag", nome:"Água",      valor:50,  vencimento:M+"-20", pago:false, categoria:"Água",     recorrente:true },
      { id:"pg", nome:"Mercado",   valor:90,  vencimento:M+"-20", pago:true,  pago_em:M+"-19", categoria:"Mercado" },
      { id:"pc", nome:"Dentista",  valor:300, valor_pago:100, vencimento:M+"-20", pago:false, categoria:"Saúde" },
    ];
    for (let i = 1; i <= 3; i++) contas.push({ id:"mo"+i, nome:"Moto ("+i+"/3)", valor:600,
      vencimento:M+"-25", pago:false, categoria:"Transporte" });
    abrirContas();`);
  const ico = (nome) => p.evaluate(x => {
    const linha = [...document.querySelectorAll(".lista .conta-item")]
      .find(e => e.textContent.includes(x));
    return linha ? linha.querySelector(".conta-ico").textContent.trim() : null;
  }, nome);
  ok("internet ganha globo", (await ico("Internet")) === "🌐");
  ok("aluguel ganha casa", (await ico("Aluguel")) === "🏠");
  ok("faculdade ganha capelo", (await ico("Faculdade")) === "🎓");
  ok("energia ganha raio", (await ico("Energia")) === "⚡");
  ok("água ganha gota", (await ico("Água")) === "💧");
  ok("o carnê também — ele não é mais um 🧾 pra todo mundo",
    (await ico("Moto")) === "🚗");
  ok("nenhuma linha ficou com o 🔁 ou o 📄 genéricos",
    !(await texto(".lista")).includes("🔁") && !(await texto(".lista")).includes("📄"));

  /* PAGO E PAGO-PELA-METADE MANTÊM A MARCA DE ESTADO. Ali o que a pessoa
     procura é o estado, não a identidade da conta. */
  ok("a paga pela metade continua com a meia-lua", (await ico("Dentista")) === "◐");
  await p.evaluate(() => filtrarContas("pagos"));
  ok("e a paga continua com o visto", (await ico("Mercado")) === "✓");
  await p.evaluate(() => filtrarContas("todos"));


  /* A BARRA DE MÊS NÃO APARECE NAS OUTRAS ABAS. Elas não são sobre um
     mês — "Vencendo" é sobre cinco dias, "Vencidos" sobre tudo que
     passou, "Pagos" é histórico e "Fixos" é cadastro. */
  for (const aba of ["vencendo", "vencidos", "pagos", "fixos"]) {
    await p.evaluate(x => filtrarContas(x), aba);
    ok(`a aba ${aba} não tem barra de mês`,
      (await p.locator(".contas-mes-barra").count()) === 0);
  }
  await p.evaluate(() => filtrarContas("todos"));
  ok("e ela volta na aba A pagar",
    (await p.locator(".contas-mes-barra").count()) === 1);

  /* ─── Excluir o carnê não mexe no que já foi pago ─────────────────── */
  await abrir(CARNE + `; abrirCarne("Moto");`);
  await p.evaluate(() => excluirCarne(document.createElement("button"), "Moto"));
  const c = await chamadas();
  const apagou = c.find(x => x.tabela === "contas" && x.op === "delete");
  ok("excluir o carnê é um delete só", !!apagou);
  ok("e ele atinge 25 parcelas, não 26", apagou.dentro && apagou.dentro[1].length === 25);

  /* ─── Editar renumera só as abertas ──────────────────────────────── */
  await abrir(CARNE + `; abrirEdicaoCarne("Moto");
    document.getElementById("ec-valor").value = "700,00";`);
  await p.evaluate(() => salvarEdicaoCarne(document.querySelector(".botao"), "Moto"));
  const c2 = (await chamadas()).filter(x => x.tabela === "contas" && x.op === "update");
  ok("editar mexe só nas parcelas em aberto", c2.length === 25);
  ok("e o valor novo vai em todas", c2.every(x => x.dados.valor === 700));
  /* E a NUMERAÇÃO NÃO MUDA. Renumerar as abertas de 1 a 25 deixaria a
     parcela já paga como "1/26" ao lado de uma "1/25" — dois boletos com o
     mesmo número e uma conta que não fecha com o carnê que está na mão. */
  const nomes = c2.map(x => x.dados.nome);
  ok("a numeração original é preservada",
    nomes.includes("Moto (2/26)") && nomes.includes("Moto (26/26)"));
  ok("e nenhuma vira 1/25", !nomes.some(n => /\/25\)/.test(n)));

  /* ─── A assinatura entra em toda fatura, com o valor cheio ───────────
     É a diferença pra parcelada: a parcelada divide o total e acaba. */
  await abrir(ASSINATURA);
  for (const mes of ["2026-07", "2026-11", "2027-06", "2029-01"]) {
    const na = await p.evaluate(m =>
      _parcelasDaFatura(cartoes[0], m).some(i => i.compra.descricao === "Netflix"), mes);
    ok("entra na fatura de " + mes, na === true);
  }
  ok("mas não antes de começar", (await p.evaluate(() =>
    _parcelasDaFatura(cartoes[0], "2026-06").length)) === 0);

  // Sem teto, "quais faturas existem" entraria num laço que não para.
  const meses = await p.evaluate(() => _mesesComFatura(cartoes[0]));
  ok("a lista de faturas é finita", meses.length > 0 && meses.length < 60);

  /* ─── E é gasto TODO mês ─────────────────────────────────────────────
     Contada só no mês da contratação, a meta de Lazer pareceria folgada
     em todos os seguintes com os R$ 39,90 saindo do mesmo jeito. */
  const lazer = m => p.evaluate(x => _gastoDoMesPorCategoria(x).Lazer || 0, m);
  ok("conta no mês em que foi assinada", (await lazer("2026-06")) === 39.90);
  ok("e nos seguintes também", (await lazer("2026-12")) === 39.90);
  ok("mas não antes", (await lazer("2026-05")) === 0);

  /* ─── Cancelar NÃO apaga ─────────────────────────────────────────────
     Quem cancela a Netflix hoje não deixou de pagá-la nos meses
     anteriores, e algumas daquelas faturas já estão quitadas. Apagar
     reescreveria o histórico. */
  await abrir(ASSINATURA + `; abrirCartao("k1"); pedirExcluirCompra("net", "k1");`);
  // pedirExcluirCompra só desenha a pergunta — essa pode ficar no cenário.
  ok("a confirmação explica o que NÃO muda",
    /As faturas anteriores não mudam/.test(await texto(".confirmar")));

  await p.evaluate(() => cancelarAssinatura(document.querySelector(".confirmar .sim"), "net", "k1"));
  const c3 = await chamadas();
  ok("cancelar é um update, não um delete",
    c3.length === 1 && c3[0].op === "update" && c3[0].tabela === "compras_cartao");
  ok("ele grava o último mês cobrado", typeof c3[0].dados.fim === "string");
  ok("na linha certa", c3[0].eq.some(e => e[0] === "id" && e[1] === "net"));

  // Depois de cancelada ela para, e as faturas já fechadas não mudam.
  await abrir(ASSINATURA + `; comprasCartao[0].fim = "2026-08-01";`);
  ok("a cobrança de agosto continua valendo", (await lazer("2026-08")) === 39.90);
  ok("e a de setembro não acontece mais", (await lazer("2026-09")) === 0);

  /* ─── Tipo de conta: fixa x boleto ───────────────────────────────── */
  await abrir(`abrirContas(); abrirNovaConta();`);
  ok("nova conta nasce como conta fixa",
    (await p.evaluate(() => document.querySelector('input[name="ct-tipo"]:checked').value)) === "fixa");
  ok("e sem o campo de parcelas à mostra",
    await p.locator("#ct-caixa-parcelas").isHidden());

  await p.evaluate(() => { document.querySelector('input[value="boleto"]').click(); });
  ok("boleto abre o 'quantos boletos'", await p.locator("#ct-caixa-parcelas").isVisible());

  /* O carnê nasce com uma linha por parcela, cada uma com o seu
     vencimento — porque é assim que elas chegam pra pagar. E o valor
     digitado é o DE CADA BOLETO: dividir um total por 7 deixaria centavos
     órfãos que ninguém sabe de onde vieram. */
  await abrir(`abrirContas(); abrirNovaConta();
    document.querySelector('input[value="boleto"]').click();
    document.getElementById("ct-nome").value = "Geladeira";
    document.getElementById("ct-valor").value = "250,00";
    document.getElementById("ct-venc").value = "2026-10-10";
    document.getElementById("ct-parcelas").value = "6";`);
  await p.evaluate(() => salvarConta(document.querySelector(".botao"), "ch"));
  const gravadas = (await chamadas()).find(x => x.tabela === "contas" && x.op === "insert");
  ok("o carnê grava uma linha por parcela", Array.isArray(gravadas.dados) && gravadas.dados.length === 6);
  ok("cada uma com o valor do boleto, não o total",
    gravadas.dados.every(d => d.valor === 250));
  ok("numeradas no nome", gravadas.dados[0].nome === "Geladeira (1/6)");
  ok("um mês depois da outra", gravadas.dados[1].vencimento === "2026-11-10");
  ok("e nenhuma é recorrente — carnê acaba", gravadas.dados.every(d => d.recorrente === false));

  /* ─── PAGAR NEM SEMPRE É PAGAR O VALOR DA CONTA ──────────────────────
     O botão quitava pelo valor cadastrado, sempre — e não tinha
     conferência nenhuma, foi por isso que passou tanto tempo assim.
     Três casos que acontecem com boleto e não cabiam:

       ATRASADO   veio juros: a conta pedia 600, você pagou 640
       ADIANTADO  veio desconto: pagou 580
       NEGOCIADO  pagou parte, ficou devendo o resto

     Nos dois primeiros o EXTRATO ficava errado: o lançamento saía com o
     valor do boleto, não com o que de fato saiu da conta — e aí o Resumo
     deixava de bater com o banco, que é o defeito mais caro deste app. */
  const UMA = `
    lancamentos = []; cartoes = []; comprasCartao = []; pagamentosFatura = [];
    metas = []; fechamentos = []; entradasFixas = [];
    mesAtual = mesDe(_hojeLocal());
    contas = [{ id:"b1", nome:"Boleto da moto", valor:600, valor_pago:0,
                vencimento:mesDe(_hojeLocal()) + "-15", pago:false,
                categoria:"Transporte", recorrente:false }];
  `;

  await abrir(UMA + "; abrirContas(); abrirPagarConta('b1');");
  ok("o valor já vem preenchido com o que falta",
    valor(await p.inputValue("#pc-valor")) === 600);
  ok("e a tela mostra o que a conta pede",
    (await texto(".fatura-resumo")).includes("600,00"));

  /* PAGAMENTO CHEIO: quita e lança o valor inteiro. */
  await p.evaluate(() => salvarPagamentoDaConta(
    document.querySelector(".lancamento-tela > .botao"), "b1"));
  const cheio = await chamadas();
  ok("pagar o valor cheio quita a conta",
    cheio[0].tabela === "contas" && cheio[0].dados.pago === true &&
    cheio[0].dados.valor_pago === 600);
  ok("e lança a saída no extrato",
    cheio[1].tabela === "lancamentos" && cheio[1].dados.valor === 600 &&
    cheio[1].dados.tipo === "saida");

  /* COM JUROS: o extrato leva o que SAIU, não o que a conta pedia. */
  await abrir(UMA + "; abrirPagarConta('b1');");
  await p.evaluate(() => { document.getElementById("pc-valor").value = "640,00"; });
  await p.evaluate(() => salvarPagamentoDaConta(
    document.querySelector(".lancamento-tela > .botao"), "b1"));
  const juros = await chamadas();
  ok("pagando a mais, a conta quita", juros[0].dados.pago === true);
  ok("e o extrato leva os R$ 640 que saíram, não os R$ 600 do boleto",
    juros[1].dados.valor === 640);

  /* PAGOU A MAIS NÃO VIRA SALDO A RECEBER. Quem pagou R$ 640 num boleto
     de R$ 600 não tem R$ 40 a receber de ninguém — o que falta é zero, e
     sem o piso ele viraria −R$ 40 somando negativo na reserva do Resumo
     e no topo do carnê. */
  await abrir(UMA + `contas[0].valor_pago = 640; contas[0].pago = true; abrirContas();`);
  ok("conta paga com juros não fica devendo valor negativo",
    (await p.evaluate(() => faltaDaConta(contas[0]))) === 0);
  await abrir(UMA + `
    contas[0].valor_pago = 640;
    abrirResumo();`);
  ok("e nem tira valor negativo da reserva do Resumo",
    (await p.evaluate(x => aindaVaiSairDoMes(x).total, await p.evaluate(() => mesAtual))) === 0);

  /* COM DESCONTO: quitou pagando menos. O que falta não fica negativo —
     quem pagou R$ 580 num boleto de R$ 600 não tem R$ 20 a receber. */
  await abrir(UMA + "; abrirPagarConta('b1');");
  await p.evaluate(() => { document.getElementById("pc-valor").value = "580,00"; });
  await p.evaluate(() => salvarPagamentoDaConta(
    document.querySelector(".lancamento-tela > .botao"), "b1"));
  ok("pagando menos, a conta NÃO quita sozinha",
    (await chamadas())[0].dados.pago === false);

  /* PARCIAL: o pedido do dono do app. */
  await abrir(UMA + "; abrirPagarConta('b1');");
  await p.evaluate(() => { document.getElementById("pc-valor").value = "200,00"; });
  await p.evaluate(() => salvarPagamentoDaConta(
    document.querySelector(".lancamento-tela > .botao"), "b1"));
  const parcial = await chamadas();
  ok("pagar uma parte não quita", parcial[0].dados.pago === false);
  ok("guarda o que foi pago", parcial[0].dados.valor_pago === 200);
  ok("não marca data de pagamento numa conta que não quitou",
    parcial[0].dados.pago_em === null);
  ok("e o extrato leva só os R$ 200 que saíram", parcial[1].dados.valor === 200);

  /* ACUMULA: 200 hoje, 400 depois, quita. */
  await abrir(UMA + `
    contas[0].valor_pago = 200; abrirPagarConta("b1");`);
  ok("na volta, o campo vem com o que ainda falta",
    valor(await p.inputValue("#pc-valor")) === 400);
  await p.evaluate(() => salvarPagamentoDaConta(
    document.querySelector(".lancamento-tela > .botao"), "b1"));
  const fecha = await chamadas();
  ok("o segundo pagamento soma com o primeiro", fecha[0].dados.valor_pago === 600);
  ok("e aí sim a conta quita", fecha[0].dados.pago === true);

  await abrir(UMA + "; abrirPagarConta('b1');");
  await p.evaluate(() => { document.getElementById("pc-valor").value = "0,00"; });
  await p.evaluate(() => salvarPagamentoDaConta(
    document.querySelector(".lancamento-tela > .botao"), "b1"));
  ok("pagar zero não grava nada", (await chamadas()).length === 0);

  /* ─── O QUE FALTA, NAS OUTRAS TELAS ──────────────────────────────────
     O Resumo reserva o que ainda tem que sair. Reservar o valor CHEIO de
     uma conta já paga pela metade descontaria o mesmo dinheiro duas
     vezes: uma na saída que foi pro extrato, outra aqui. */
  await abrir(UMA + `
    contas[0].valor_pago = 200;
    abrirResumo();`);
  ok("o Resumo reserva só o que falta da conta",
    (await p.evaluate(x => aindaVaiSairDoMes(x).total, await p.evaluate(() => mesAtual))) === 400);
  ok("e a linha diz quanto já foi pago",
    (await texto(".resumo-secao")).includes("200,00"));

  await abrir(UMA + `
    contas[0].valor_pago = 200; abrirContas();`);
  ok("a lista mostra o que falta, não o valor cheio",
    (await texto(".conta-item .conta-valor")) === "R$ 400,00");
  ok("com o já pago do lado, pra não esconder o tamanho da conta",
    (await texto(".conta-item .conta-cat.parcial")).includes("200,00 de R$ 600,00"));
  ok("e o botão convida a pagar o resto",
    (await texto(".botao-pagar")) === "Pagar o resto");
  ok("a linha se distingue da vencida e da em dia",
    (await p.locator(".conta-item.parcial").count()) === 1);

  /* ─── O CARNÊ ────────────────────────────────────────────────────────
     O topo soma o que falta das parcelas abertas. Com uma paga pela
     metade, somar o valor cheio faria o topo não bater com as linhas. */
  await abrir(`
    lancamentos = []; cartoes = []; comprasCartao = []; pagamentosFatura = [];
    metas = []; fechamentos = []; entradasFixas = [];
    contas = [];
    for (let i = 1; i <= 3; i++) contas.push({ id:"m"+i, nome:"Moto ("+i+"/3)",
      valor:600, valor_pago: i === 1 ? 200 : 0, vencimento:"2027-0"+i+"-15",
      pago:false, categoria:"Transporte", recorrente:false });
    abrirCarne("Moto");`);
  ok("o topo do carnê desconta o que já foi pago",
    valor(await texto(".contas-total strong")) === 1600);
  const soma = await p.evaluate(() =>
    [...document.querySelectorAll(".conta-item .conta-valor")]
      .reduce((t, e) => t + Number(e.textContent.replace(/[^\d,]/g, "").replace(",", ".")), 0));
  ok("e bate com a soma das linhas", soma === 1600);


  /* ─── EXCLUIR UMA PARCELA NÃO TIRA A PESSOA DO CARNÊ ──────────────────
     DEFEITO REPORTADO: "abro o boleto, clico pra cancelar uma das
     parcelas, aí sai da tela e volta pra lista de todos os boletos; era
     pra permanecer lá".

     Era isso: tanto o "Cancelar" da confirmação quanto o excluir de
     verdade chamavam desenharContas() fixo, e não a tela onde a pessoa
     estava. Num carnê de 26, excluir três parcelas obrigava a achar o
     carnê de novo três vezes. */
  await abrir(CARNE + "; abrirContas(); abrirCarne('Moto');");
  ok("o carnê abriu", (await texto(".lancamento-cabecalho h2")) === "Moto");
  const quantas = await p.locator(".conta-item").count();

  await p.evaluate(() => pedirExcluirConta("m5"));
  ok("excluir pede confirmação dentro da própria linha",
    (await p.locator("#conta-m5 .confirmar").count()) === 1);

  await p.click("#conta-m5 .confirmar button:not(.sim)");
  ok("cancelar deixa a pessoa no carnê",
    (await texto(".lancamento-cabecalho h2")) === "Moto");
  ok("com todas as parcelas de volta", (await p.locator(".conta-item").count()) === quantas);

  await p.evaluate(() => pedirExcluirConta("m5"));
  await p.click("#conta-m5 .confirmar .sim");
  const ap = await chamadas();
  ok("confirmar apaga a parcela", ap.length === 1 && ap[0].tabela === "contas" && ap[0].op === "delete");
  ok("e a pessoa CONTINUA no carnê",
    (await texto(".lancamento-cabecalho h2")) === "Moto");
  ok("com uma parcela a menos", (await p.locator(".conta-item").count()) === quantas - 1);
  ok("e a que saiu não está mais lá", (await p.locator("#conta-m5").count()) === 0);

  /* Na lista de contas o comportamento é o mesmo de sempre: excluir
     redesenha a lista, porque a lista é onde a pessoa está. */
  await abrir(CARNE + "; abrirContas();");
  await p.evaluate(() => pedirExcluirConta("luz"));
  await p.click("#conta-luz .confirmar .sim");
  ok("na lista, excluir redesenha a lista",
    (await p.locator(".contas-abas").count()) === 1);
  ok("e a conta saiu de lá", (await p.locator("#conta-luz").count()) === 0);

  /* E REDESENHAR NÃO É ABRIR DE NOVO. Empilhando a mesma tela a cada
     exclusão, um carnê com três parcelas apagadas precisaria de quatro
     toques no "Voltar" pra sair — o tipo de coisa que ninguém reporta e
     todo mundo sente. */
  await abrir(CARNE + "; abrirContas(); abrirCarne('Moto');");
  const pilhaAntes = await p.evaluate(() => pilha.length);
  for (const id of ["m5", "m6", "m7"]) {
    await p.evaluate(x => pedirExcluirConta(x), id);
    await p.click(`#conta-${id} .confirmar .sim`);
  }
  ok("três exclusões seguidas não empilham tela nenhuma",
    (await p.evaluate(() => pilha.length)) === pilhaAntes);
  ok("e a pessoa continua no carnê o tempo todo",
    (await texto(".lancamento-cabecalho h2")) === "Moto");

  /* Excluída a ÚLTIMA parcela, o carnê deixa de existir — e aí o lugar
     certo é a lista de onde se entrou, não o menu lá do começo.

     O carnê tem DUAS parcelas de propósito: com uma só, "Moto (1/1)" não
     é carnê nenhum (_parteDoCarne exige n >= 2), abrirCarne falharia
     calado e as conferências abaixo passariam sem nunca ter entrado na
     tela que elas dizem testar. Foi o que aconteceu na primeira versão
     desta suíte, e só a quebra de propósito mostrou. */
  const DUAS = `
    contas = [
      { id:"u1", nome:"Moto (1/2)", valor:600, vencimento:"2026-12-10",
        pago:false, categoria:"Transporte", recorrente:false },
      { id:"u2", nome:"Moto (2/2)", valor:600, vencimento:"2027-01-10",
        pago:false, categoria:"Transporte", recorrente:false },
    ];
    lancamentos = []; cartoes = []; comprasCartao = []; metas = [];
    pagamentosFatura = []; fechamentos = []; entradasFixas = [];
  `;
  await abrir(DUAS + "; abrirContas(); abrirCarne('Moto');");
  ok("o carnê de duas parcelas abriu mesmo",
    (await texto(".lancamento-cabecalho h2")) === "Moto" &&
    (await p.locator(".conta-item").count()) === 2);

  await p.evaluate(() => pedirExcluirConta("u1"));
  await p.click("#conta-u1 .confirmar .sim");
  ok("com uma parcela ainda de pé, segue no carnê",
    (await texto(".lancamento-cabecalho h2")) === "Moto");

  await p.evaluate(() => pedirExcluirConta("u2"));
  await p.click("#conta-u2 .confirmar .sim");
  ok("sem parcela nenhuma, volta pra lista de contas",
    (await p.locator(".contas-abas").count()) === 1);
  ok("e não pro menu do começo",
    (await p.evaluate(() => document.getElementById("menu").style.display)) !== "grid");


  /* ─── EDITAR UM BOLETO SÓ ────────────────────────────────────────────
     "Editar o carnê" mexe em todos de uma vez. O caso mais comum é o
     contrário: UM boleto veio com outro valor, ou foi negociado pra outra
     data. Até aqui a tela mandava excluir o carnê inteiro e cadastrar de
     novo só pra mudar uma data. */
  await abrir(CARNE + "; abrirContas(); abrirCarne('Moto');");
  ok("cada boleto em aberto tem o botão de editar",
    (await p.locator(".conta-editar").count()) === 25);
  ok("o já pago não tem — ele não se edita",
    (await p.locator("#conta-m1 .conta-editar").count()) === 0);

  await p.click("#conta-m5 .conta-editar");
  ok("abre a tela daquele boleto",
    (await texto(".lancamento-cabecalho h2")).includes("5/26"));
  ok("com o valor dele no campo", (await p.inputValue("#eb-valor")) === "600,00");
  const vencAntes = await p.evaluate(() => contas.find(c => c.id === "m5").vencimento);
  ok("e o vencimento dele", (await p.inputValue("#eb-venc")) === vencAntes);

  await p.fill("#eb-valor", "640,00");
  await p.evaluate(() => { document.getElementById("eb-venc").value = "2027-03-20"; });
  await p.click(".lancamento-tela > .botao");
  const ed = await chamadas();
  ok("salvar manda UM update", ed.length === 1 && ed[0].op === "update");
  ok("só daquele boleto",
    ed[0].eq.some(e => e[0] === "id" && e[1] === "m5") &&
    ed[0].eq.some(e => e[0] === "user_id"));
  ok("com o valor novo", ed[0].dados.valor === 640);
  ok("e a data nova — que o editar do carnê não sabia mexer",
    ed[0].dados.vencimento === "2027-03-20");
  ok("as outras 25 parcelas não são tocadas",
    (await p.evaluate(() => contas.filter(c => Number(c.valor) === 600).length)) === 25);

  ok("e a tela volta pro carnê", (await texto(".lancamento-cabecalho h2")) === "Moto");
  ok("já mostrando o valor novo", (await texto("#conta-m5")).includes("640,00"));

  /* Boleto pago não entra aqui nem por caminho torto: o extrato já
     registrou o que saiu, e mudar a conta por baixo faria os dois
     números discordarem sem ninguém estar errado. */
  await abrir(CARNE + "; abrirContas(); abrirCarne('Moto');");
  await p.evaluate(() => abrirEditarConta("m1"));
  ok("boleto pago não abre pra editar", (await p.locator("#eb-valor").count()) === 0);
  ok("e a tela avisa por quê", (await texto("#avisos")).includes("já pago"));

  await abrir(CARNE + "; abrirContas(); abrirCarne('Moto'); abrirEditarConta('m5');");
  await p.fill("#eb-valor", "0");
  await p.click(".lancamento-tela > .botao");
  ok("valor zero não grava", (await chamadas()).length === 0);
  ok("e diz o que falta", (await texto("#avisos")).includes("maior que zero"));

  await abrir(CARNE + "; abrirContas(); abrirCarne('Moto'); abrirEditarConta('m5');");
  await p.evaluate(() => { document.getElementById("eb-venc").value = ""; });
  await p.click(".lancamento-tela > .botao");
  ok("sem data não grava", (await chamadas()).length === 0);
  ok("e diz por quê", (await texto("#avisos")).includes("vencimento"));

});
