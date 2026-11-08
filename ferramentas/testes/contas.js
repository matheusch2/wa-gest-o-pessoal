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

  /* ─── O carnê vira uma linha só ──────────────────────────────────────
     27 contas numa lista é uma lista que ninguém lê. Ela colapsa igual ao
     cartão, mostrando a PRÓXIMA parcela não paga. */
  await abrir(CARNE + "; abrirContas();");
  ok("27 contas viram 2 linhas", (await p.locator(".lista > .conta-item").count()) === 2);
  ok("uma delas é o carnê agrupado", (await p.locator(".conta-item.carne").count()) === 1);
  ok("e a conta fixa do mês continua visível", /Energia/.test(await texto(".lista")));

  const linha = await texto(".conta-item.carne");
  ok("o carnê mostra a próxima parcela, não a primeira",
    /2\/26/.test(linha) && !/1\/26/.test(linha));
  // Sem este aviso o total diz 15 mil e a lista soma mil — dois números
  // que não fecham na mesma tela.
  ok("o cabeçalho avisa o que está agrupado",
    /em carnê, agrupado nas linhas/.test(await texto(".contas-total")));

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

});
