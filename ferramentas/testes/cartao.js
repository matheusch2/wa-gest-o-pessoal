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

  /* ─── O baralho ──────────────────────────────────────────────────────
     Sete cartões em tamanho inteiro são sete telas de rolagem, e a fatura
     que vence amanhã podia estar embaixo de três já pagas. */
  const SETE = `
    cartoes = ["bb","inter","neon","nubank","c6","picpay","itau"].map((b,i) =>
      ({ id:"k"+i, nome:"Cartão "+i, banco:b, dia_fechamento:1, dia_vencimento:10+i }));
    comprasCartao = cartoes.map((c,i) => ({ id:"c"+i, cartao_id:c.id, descricao:"Compras",
      valor:100*(i+1), parcelas:1, data:"2026-09-20", categoria:"Outros",
      recorrente:false, fim:null }));
    pagamentosFatura = [{ id:"p", cartao_id:"k0", mes_ref:"2026-10", tipo:"pago",
                          valor:100, pago_em:"2026-10-01", lancamento_id:"x" }];
    lancamentos = []; contas = []; metas = []; fechamentos = []; entradasFixas = [];
    mesAtual = "2026-10"; _cartaoPrincipal = null;`;

  await abrir(SETE + "; abrirCartoes();");
  ok("os sete cartões estão todos na tela", (await p.locator(".cartao-baralho .cartao-card").count()) === 7);
  ok("só um está aberto", (await p.locator(".cartao-card.aberto").count()) === 1);

  // Empilhados, os sete cabem numa tela. Em tamanho inteiro não caberiam.
  const alturaBaralho = (await p.locator(".cartao-baralho").boundingBox()).height;
  ok("e o baralho cabe numa tela de celular", alturaBaralho < 700);

  /* Quem ainda deve vem primeiro, e entre eles quem vence antes — quem
     abre esta tela quer saber o que pagar, e a ordem de cadastro não
     responde isso. */
  const ordem = await p.locator(".cartao-baralho .cartao-card").evaluateAll(
    ns => ns.map(n => n.id));
  ok("o mais urgente nasce aberto",
    (await p.locator(".cartao-card.aberto").getAttribute("id")) === ordem[0]);
  ok("e a fatura já paga desce pro fim", ordem[ordem.length - 1] === "cartao-k0");

  /* ─── Um toque traz à frente; o segundo abre a fatura ─────────────────
     Dois gestos no mesmo lugar, e eles não se atrapalham porque o primeiro
     toque sempre tem um alvo diferente do segundo. */
  await p.click("#cartao-k3");
  ok("tocar num cartão o traz pra frente",
    (await p.locator(".cartao-card.aberto").getAttribute("id")) === "cartao-k3");
  ok("e fecha o que estava aberto", (await p.locator(".cartao-card.aberto").count()) === 1);

  // Trocar de cartão NÃO redesenha a tela: com innerHTML os elementos
  // nasceriam de novo e a abertura não teria como animar.
  ok("o cabeçalho continua o da lista de cartões",
    /Cartões/.test(await texto(".lancamento-cabecalho h2")));

  await p.click("#cartao-k3");
  ok("tocar de novo abre a fatura dele",
    (await p.locator(".cartao-capa").count()) === 1);

  /* ─── O cartão da frente não pode se perder ──────────────────────────
     Ele some quando é excluído, e aí a tela precisa escolher outro em vez
     de ficar sem nenhum aberto. */
  await abrir(SETE + `; _cartaoPrincipal = "fantasma"; abrirCartoes();`);
  ok("id que não existe mais cai no mais urgente",
    (await p.locator(".cartao-card.aberto").count()) === 1);

  /* ─── Um cartão só não ganha dica de baralho ─────────────────────── */
  await abrir(CARTAO + "; abrirCartoes();");
  ok("com um cartão não há o que empilhar",
    (await p.locator(".cartao-baralho-dica").count()) === 0);
  ok("e ele nasce aberto", (await p.locator(".cartao-card.aberto").count()) === 1);

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

  /* ─── O BARALHO INTEIRO NUM MÊS SÓ ───────────────────────────────────
     A tela mostrava, de cada cartão, a fatura DELE — e cada cartão fecha
     num dia diferente, então vários cartões podiam estar mostrando meses
     diferentes ao mesmo tempo. Dava pra saber quanto cada um deve; não
     dava pra responder "quanto eu pago em março?", que é a pergunta que
     faz alguém com nove cartões abrir esta tela. */
  const mesDeHoje = await p.evaluate(() => mesDe(_hojeLocal()));

  const DOIS = `
    lancamentos = []; contas = []; metas = []; fechamentos = [];
    cartoes = [
      { id:"ka", nome:"Cedo", banco:"nubank", dia_fechamento:3, dia_vencimento:10 },
      { id:"kb", nome:"Tarde", banco:"inter", dia_fechamento:25, dia_vencimento:5 },
    ];
    comprasCartao = [
      { id:"ca", cartao_id:"ka", descricao:"TV", valor:1200, parcelas:6,
        data:"2026-09-05", categoria:"Casa", recorrente:false, fim:null },
      { id:"cb", cartao_id:"kb", descricao:"Sofá", valor:900, parcelas:8,
        data:"2026-09-05", categoria:"Casa", recorrente:false, fim:null },
      // À vista, e só em dezembro: é ela que faz dezembro ter um total
      // diferente de todos os outros meses.
      { id:"cv", cartao_id:"ka", descricao:"Presente", valor:777, parcelas:1,
        data:"2026-12-02", categoria:"Lazer", recorrente:false, fim:null },
    ];
    pagamentosFatura = []; _cartaoPrincipal = null;
  `;

  await abrir(DOIS + "; abrirCartoes();");
  ok("a tela de cartões ganhou o navegador de mês",
    (await p.locator(".bloco .pilula").count()) === 2);

  // Os dois cartões aparecem no MESMO mês, cada um com a fatura dele
  // naquele mês. É isso que permite comparar.
  const fila = await p.evaluate(() => _filaDeCartoes("2027-01").map(x => ({
    nome: x.c.nome, mes: x.mes, total: x.s.total, semFatura: x.semFatura })));
  ok("num mês dado, todo cartão responde por aquele mês",
    fila.every(x => x.mes === "2027-01"));
  ok("e cada um com o valor da parcela dele naquele mês",
    fila.find(x => x.nome === "Cedo").total === 200 &&
    fila.find(x => x.nome === "Tarde").total === 112.5);

  /* O TOTAL DO TOPO SOMA O QUE ESTÁ NA TELA. Dois números que não fecham
     na mesma tela é o pior defeito de um app de dinheiro, e aqui ele
     cabia: bastaria o topo continuar somando "tudo em aberto" enquanto os
     cartões mostram um mês só. */
  await abrir(DOIS + "; abrirCartoes(); trocarMesDoBaralho(2);");
  const topo = valor(await texto(".contas-total strong"));
  const naTela = await p.evaluate(() =>
    [...document.querySelectorAll(".cartao-card-baixo > div:first-child strong")]
      .map(e => Number(e.textContent.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")))
      .filter(n => !isNaN(n)));
  const soma = naTela.reduce((a, b) => a + b, 0);
  ok("o total do topo é a soma dos cartões mostrados",
    Math.round(topo * 100) === Math.round(soma * 100));
  // E o mês tem que ser um em que esse número NÃO coincide com o total
  // em aberto de cada cartão — senão a conferência acima passaria mesmo
  // com o topo somando a coisa errada.
  const emAberto = await p.evaluate(() =>
    cartoes.reduce((t, c) => t + _situacaoFatura(c, _faturaAoAbrir(c)).restante, 0));
  ok("num mês que não coincide com o total em aberto, pra conferência valer",
    Math.round(topo * 100) !== Math.round(emAberto * 100));

  /* FATURA PAGA PELA METADE MOSTRA O QUE FALTA, não o total. O cartão
     que já recebeu R$ 100 de uma fatura de R$ 312,50 deve R$ 212,50 — e
     é esse número que tem que estar no card E dentro do total do topo.
     Mostrar o total cheio ali faria o topo (que soma o restante) deixar
     de bater com os cartões, que é o defeito que mais dói neste app. */
  await abrir(DOIS + `
    abrirCartoes(); trocarMesDoBaralho(2);
    pagamentosFatura = [{ id:"pg", cartao_id:"ka", mes_ref:_mesDoBaralho,
                          tipo:"pago", valor:100, pago_em:"2026-12-20",
                          lancamento_id:null, compra_id:null }];
    desenharCartoes();`);
  const parcial = await p.evaluate(() =>
    [...document.querySelectorAll(".cartao-card-baixo > div:first-child strong")]
      .map(e => e.textContent.trim()));
  ok("o cartão pago pela metade mostra o que FALTA",
    parcial.some(t => t.includes("877,00")));
  ok("e não o total da fatura", !parcial.some(t => t.includes("977,00")));
  const topoParcial = valor(await texto(".contas-total strong"));
  const somaParcial = parcial
    .map(t => Number(t.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")))
    .filter(n => !isNaN(n)).reduce((a, b) => a + b, 0);
  ok("e o topo continua batendo com os cartões",
    Math.round(topoParcial * 100) === Math.round(somaParcial * 100));

  /* UM CARTÃO SEM FATURA NAQUELE MÊS não some da tela nem mostra R$ 0,00
     como se fosse uma fatura zerada: ele diz que não tem fatura. */
  await abrir(DOIS + "; abrirCartoes(); trocarMesDoBaralho(24);");
  ok("mês sem fatura nenhuma é dito com essas palavras",
    (await texto(".contas-total small")).includes("Nenhuma fatura"));
  ok("e os cartões continuam na tela, dizendo que não têm fatura",
    (await p.locator(".cartao-card").count()) === 2 &&
    (await texto(".cartao-baralho")).includes("Sem fatura neste mês"));

  /* MÊS FUTURO NÃO TEM "EM ABERTO". Nada foi pago porque nada venceu —
     "2 de 2 faturas em aberto" num mês que não chegou soa como duas
     contas atrasadas, e não é isso. */
  await abrir(DOIS + "; abrirCartoes(); trocarMesDoBaralho(2);");
  const futuro = await texto(".contas-total small");
  ok("mês futuro conta faturas, não faturas em aberto",
    !futuro.includes("em aberto") && /2 faturas/.test(futuro));
  ok("e o mês mostrado é mesmo futuro",
    (await p.evaluate(() => _mesDoBaralho)) > mesDeHoje);
  ok("e o rótulo do topo diz de que mês ele está falando",
    (await texto(".contas-total span")).toLowerCase().includes("total de"));

  /* O QUE VENCEU E NÃO FOI PAGO NÃO PODE SUMIR ao mudar de mês. O topo
     soma só o mês da tela — tem que somar — mas uma fatura vencida
     continua existindo, e esconder isso é pior do que nunca ter
     mostrado. */
  await abrir(`
    lancamentos = []; contas = []; metas = []; fechamentos = [];
    cartoes = [{ id:"k", nome:"Velho", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
    comprasCartao = [{ id:"c", cartao_id:"k", descricao:"Antiga", valor:500, parcelas:1,
                       data:"2026-01-05", categoria:"Casa", recorrente:false, fim:null }];
    pagamentosFatura = []; _cartaoPrincipal = null;
    abrirCartoes(); trocarMesDoBaralho(6);`);
  ok("fatura vencida de outro mês aparece em linha à parte",
    (await texto(".contas-total .alerta")).includes("vencidos em meses anteriores"));
  ok("com o valor dela", valor(await texto(".contas-total .alerta")) === 500);

  /* TOCAR NUM CARTÃO ABRE A FATURA DAQUELE MÊS. Tocar num cartão que diz
     "fatura de março, R$ 400" e cair em novembro seria a tela se
     contradizendo no mesmo toque. */
  await abrir(DOIS + "; abrirCartoes(); trocarMesDoBaralho(2);");
  const mesNaTela = await p.evaluate(() => _mesDoBaralho);
  await p.evaluate(() => abrirCartao("ka"));
  ok("tocar no cartão abre a fatura do mês que estava na tela",
    (await p.evaluate(() => _faturaMes)) === mesNaTela);

  /* O MÊS É RECALCULADO A CADA ABERTURA. Sem isto, quem foi ver março,
     voltou pro menu e entrou de novo cairia em março — e no mês seguinte
     cairia num março que já passou, sem ter pedido nada disso. */
  await abrir(DOIS + "; abrirCartoes(); trocarMesDoBaralho(5);");
  await p.evaluate(() => { voltarInicio(); abrirCartoes(); });
  ok("sair e voltar devolve o baralho pro mês de hoje",
    (await p.evaluate(() => _mesDoBaralho)) === await p.evaluate(() => _mesInicialDoBaralho()));

  /* E ELE ABRE NO QUE ESTÁ VENCIDO, não no calendário: quem tem conta
     atrasada quer ver a atrasada. É a mesma regra que cada cartão usava
     sozinho, subida um nível. */
  await abrir(`
    lancamentos = []; contas = []; metas = []; fechamentos = [];
    cartoes = [{ id:"k", nome:"Velho", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
    comprasCartao = [{ id:"c", cartao_id:"k", descricao:"Antiga", valor:500, parcelas:1,
                       data:"2026-01-05", categoria:"Casa", recorrente:false, fim:null }];
    pagamentosFatura = []; _cartaoPrincipal = null; abrirCartoes();`);
  ok("o baralho abre na fatura mais antiga que ainda está em aberto",
    (await p.evaluate(() => _mesDoBaralho)) ===
    (await p.evaluate(() => _mesVisivelDaFatura(cartoes[0], _faturaAoAbrir(cartoes[0])))));
  ok("que é a do mês seguinte à compra, porque o cartão fecha antes dela",
    (await p.evaluate(() => _mesDoBaralho)) === "2026-02");


  /* ─── O QUE DÁ PRA CANCELAR ──────────────────────────────────────────
     As assinaturas entram em TODA fatura futura, e isso está certo: elas
     vão cair se ninguém cancelar. Mas elas não são parcela — parcela já
     foi contratada, assinatura para quando você quiser —, e tratar as
     duas igual escondia a única pergunta acionável de um mês futuro:
     "quanto disso eu consigo desligar hoje?" */
  const ASSINA = `
    lancamentos = []; contas = []; metas = []; fechamentos = [];
    cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 },
               { id:"k2", nome:"Inter",  banco:"inter",  dia_fechamento:5, dia_vencimento:15 }];
    comprasCartao = [
      { id:"n", cartao_id:"k1", descricao:"Netflix", valor:50, parcelas:1,
        data:"2026-05-14", categoria:"Lazer", recorrente:true, fim:null },
      { id:"a", cartao_id:"k2", descricao:"Zumba", valor:120, parcelas:1,
        data:"2026-08-10", categoria:"Saúde", recorrente:true, fim:null },
      { id:"t", cartao_id:"k1", descricao:"Tênis", valor:1200, parcelas:6,
        data:"2026-10-05", categoria:"Lazer", recorrente:false, fim:null }];
    pagamentosFatura = []; _cartaoPrincipal = null;
  `;

  await abrir(ASSINA + "; abrirAssinaturas();");
  ok("a tela lista só as assinaturas, não as parcelas",
    (await p.locator(".assina-item").count()) === 2 &&
    !(await texto(".lista")).includes("Tênis"));

  /* O NÚMERO GRANDE É O DO ANO. R$ 170 por mês não faz ninguém abrir a
     lista; R$ 2.040 por ano faz. É o mesmo dinheiro, dito do jeito que
     provoca a decisão. */
  ok("o número grande é o custo anual",
    valor(await texto(".contas-total strong")) === 2040);
  ok("com o mensal e a contagem embaixo",
    (await texto(".contas-total small")).includes("170,00") &&
    (await texto(".contas-total small")).includes("2 assinaturas"));

  // A ordem INTEIRA, e com a mais cara sendo a ÚLTIMA do alfabeto: do
  // contrário a conferência passaria com o código ordenando por nome.
  ok("a mais cara vem primeiro, que é por onde se começa a cortar",
    JSON.stringify(await p.evaluate(() =>
      [...document.querySelectorAll(".assina-item .item-txt strong")].map(e => e.textContent.trim())))
    === JSON.stringify(["Zumba", "Netflix"]));

  /* QUANTO ELA JÁ CUSTOU é o número que faz cancelar: a mensalidade
     parece pequena até somar os meses que correram. */
  ok("cada uma mostra quanto já custou até aqui",
    (await texto(".assina-valores")).includes("até aqui"));

  // Assinatura cancelada não é assinatura ativa — o 'fim' é o último mês
  // cobrado, e passado ele ela sai da conta.
  await abrir(ASSINA + `
    comprasCartao = comprasCartao.map(c =>
      c.id === "a" ? Object.assign({}, c, { fim: "2026-09-01" }) : c);
    abrirAssinaturas();`);
  ok("assinatura já cancelada não entra na conta",
    (await p.locator(".assina-item").count()) === 1 &&
    valor(await texto(".contas-total strong")) === 600);

  await abrir(`
    lancamentos=[]; contas=[]; metas=[]; fechamentos=[];
    cartoes=[]; comprasCartao=[]; pagamentosFatura=[];
    abrirAssinaturas();`);
  ok("sem assinatura nenhuma, a tela ensina como criar uma",
    (await p.locator(".assina-item").count()) === 0 &&
    (await texto("#area")).includes("Assinatura"));

  /* ─── O ATALHO NO BARALHO ────────────────────────────────────────────
     Num mês futuro, a única coisa acionável da tela é saber quanto
     daquele número dá pra desligar. */
  await abrir(ASSINA + "; abrirCartoes(); trocarMesDoBaralho(2);");
  const atalho = await texto(".contas-total-link");
  ok("o baralho diz quanto do mês é assinatura", atalho.includes("assinaturas"));
  ok("com o valor somado dos dois cartões", valor(atalho) === 170);

  // E ele bate com o que a tela de assinaturas diz por mês: dois números
  // pra mesma coisa em telas diferentes é o defeito de sempre.
  await p.evaluate(() => abrirAssinaturas());
  // O helper valor() limpa tudo que não é dígito: em "R$ 170,00 por mês ·
  // 2 assinaturas" ele levava o 2 junto. Aqui só a primeira moeda serve.
  const mensal = (await texto(".contas-total small")).match(/R\$\s*[\d.]+,\d{2}/)[0];
  ok("e esse valor bate com o mensal da tela de assinaturas", valor(mensal) === 170);

  // Mês sem assinatura nenhuma não ganha o atalho: botão que aparece
  // sempre é botão que ninguém lê.
  await abrir(`
    lancamentos=[]; contas=[]; metas=[]; fechamentos=[];
    cartoes=[{ id:"k", nome:"Só parcela", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
    comprasCartao=[{ id:"t", cartao_id:"k", descricao:"TV", valor:600, parcelas:6,
                     data:"2026-10-05", categoria:"Casa", recorrente:false, fim:null }];
    pagamentosFatura=[]; _cartaoPrincipal=null; abrirCartoes();`);
  ok("mês sem assinatura não ganha o atalho",
    (await p.locator(".contas-total-link").count()) === 0);

});
