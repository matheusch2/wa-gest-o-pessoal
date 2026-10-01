/* FECHAMENTO DO MÊS E ENTRADAS FIXAS.
 *
 * As duas pontas da previsão. Uma diz o que ainda vai ENTRAR; a outra
 * leva pro mês seguinte o que sobrou. Juntas elas respondem "quanto eu
 * posso gastar" — e erradas, fazem o mês começar no vermelho com o
 * salário inteiro cadastrado. */

const { suite } = require("./_apoio");

const BASE = `
  lancamentos = [
    { id:"e1", tipo:"entrada", valor:3000, data:"2026-08-05", categoria:"Salário", descricao:"Salário" },
    { id:"s1", tipo:"saida", valor:2743, data:"2026-08-10", categoria:"Mercado", descricao:"Feira" },
  ];
  cartoes = []; comprasCartao = []; contas = []; metas = [];
  pagamentosFatura = []; fechamentos = [];
  entradasFixas = [
    { id:"f1", nome:"Salário", valor:3000, dia:5, categoria:"Salário" },
    { id:"f2", nome:"Aluguel recebido", valor:800, dia:10, categoria:"Extra" },
  ];
  mesAtual = "2026-08";
`;

module.exports = () => suite("Fechamento e entradas fixas", async ({ p, ok, abrir, chamadas, texto, valor }) => {

  /* ─── O que ainda vai entrar ─────────────────────────────────────────
     O Resumo descontava tudo que ainda tinha que sair e não somava de
     volta o salário que ainda não tinha caído: quem tem R$ 6.700
     cadastrados via "faltam R$ 6.700" no dia 1º. A régua tem que ser a
     mesma dos dois lados. */
  const mesCorrente = `mesAtual = mesDe(_hojeLocal());`;
  await abrir(BASE + mesCorrente);
  const aReceber = await p.evaluate(() => aReceberDoMes(mesAtual));
  ok("soma as entradas fixas que ainda não caíram", aReceber.total === 3800);
  ok("uma linha por entrada", aReceber.linhas.length === 2);
  ok("em ordem de data", aReceber.linhas[0].dia <= aReceber.linhas[1].dia);

  /* Lançada a entrada, ela sai da previsão — o extrato é a verdade. É por
     isso que o que fica guardado é o COMBINADO, não o recebimento: se o
     salário atrasar ou vier menor, quem manda é o lançamento. */
  await abrir(BASE + mesCorrente + `
    lancamentos.push({ id:"r1", tipo:"entrada", valor:3000, data:_diaDoMes(5, mesAtual),
                       categoria:"Salário", descricao:"Salário" });`);
  const depois = await p.evaluate(() => aReceberDoMes(mesAtual));
  ok("recebida, ela sai do 'ainda vai entrar'", depois.total === 800);

  /* Mês que já acabou não recebe mais nada: o que não caiu em agosto não
     vai cair, e prometer aumentaria a sobra de um mês encerrado. */
  await abrir(BASE);
  ok("mês passado não promete entrada nenhuma",
    (await p.evaluate(() => aReceberDoMes("2026-08").total)) === 0);

  /* ─── O que sobrou ───────────────────────────────────────────────────
     Entradas menos saídas do mês — o dinheiro que de fato ficou na conta.
     NÃO é a soma do que sobrou das metas: quem economizou 200 no mercado
     e estourou 300 no carro não tem 200 pra levar. */
  await abrir(BASE);
  const sobra = await p.evaluate(() => _sobraDoMes("2026-08"));
  ok("sobra = entradas menos saídas", sobra.sobra === 257);
  ok("mês só fecha depois de acabar", (await p.evaluate(() => mesJaAcabou("2026-08"))) === true);
  ok("e o mês corrente não",
    (await p.evaluate(() => mesJaAcabou(mesDe(_hojeLocal())))) === false);

  /* ─── Fechar leva pro mês seguinte ───────────────────────────────────
     Os lançamentos nascem PRIMEIRO. Se algum falhar, o mês continua
     aberto; o contrário deixaria o mês marcado como fechado sem o saldo
     ter chegado no seguinte. */
  await abrir(BASE + `; abrirFechamento("2026-08");`);
  ok("a tela mostra entrou, saiu e sobrou",
    /R\$ 3\.000,00/.test(await texto(".fatura-resumo")) &&
    /R\$ 257,00/.test(await texto(".fatura-resumo")));

  await p.evaluate(() => fecharMes(document.querySelector(".botao.entrada"), "2026-08"));
  const c = await chamadas();
  ok("o lançamento do saldo nasce antes do fechamento",
    c[0].tabela === "lancamentos" && c[1].tabela === "fechamentos");
  ok("ele é uma ENTRADA no mês seguinte",
    c[0].dados.tipo === "entrada" && c[0].dados.data === "2026-09-01");
  ok("com o valor da sobra", c[0].dados.valor === 257);
  ok("e um nome que se explica", /Saldo de agosto/.test(c[0].dados.descricao));

  /* Levar menos que a sobra quer dizer que o resto saiu da conta — e isso
     vira uma saída "Guardado", não dinheiro que some. */
  await abrir(BASE + `; abrirFechamento("2026-08");
    document.getElementById("fc-levar").value = "200,00";`);
  await p.evaluate(() => fecharMes(document.querySelector(".botao.entrada"), "2026-08"));
  const c2 = (await chamadas()).filter(x => x.tabela === "lancamentos");
  ok("levar menos cria também o 'Guardado'", c2.length === 2);
  ok("ele é uma saída", c2[1].dados.tipo === "saida" && c2[1].dados.valor === 57);
  ok("no último dia do mês que fechou", c2[1].dados.data === "2026-08-31");

  /* Sobra negativa não se divide: a dívida inteira anda pro mês seguinte,
     em vez de sumir na virada. */
  await abrir(BASE + `; lancamentos[1].valor = 3500; abrirFechamento("2026-08");`);
  await p.evaluate(() => fecharMes(document.querySelector(".botao.saida"), "2026-08"));
  const c3 = (await chamadas()).filter(x => x.tabela === "lancamentos");
  ok("mês no vermelho leva a dívida junto",
    c3[0].dados.tipo === "saida" && c3[0].dados.valor === 500);

  /* ─── Reabrir desfaz tudo que o fechamento criou ─────────────────── */
  await abrir(BASE + `
    fechamentos = [{ id:"f", mes_ref:"2026-08", sobra:257, levado:257, guardado:0,
                     lancamento_levado_id:"lx", lancamento_guardado_id:null }];
    lancamentos.push({ id:"lx", tipo:"entrada", valor:257, data:"2026-09-01",
                       categoria:"Saldo", descricao:"Saldo de agosto" });
    abrirResumo(); pedirReabrirMes("2026-08");`);
  ok("reabrir pergunta antes", /Tem certeza/.test(await texto(".confirmar")));
  await p.evaluate(() => reabrirMes(document.querySelector(".confirmar .sim"), "2026-08"));
  const c4 = await chamadas();
  ok("apaga o fechamento", c4.some(x => x.tabela === "fechamentos" && x.op === "delete"));
  ok("e o saldo que ele jogou no mês seguinte",
    c4.some(x => x.tabela === "lancamentos" && x.op === "delete"));
});
