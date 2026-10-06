/* AS ENTRADAS: ATÉ QUANDO, E SÓ NUM MÊS.
 *
 * Uma entrada tem dois marcos, início e fim, e os dois podem ser nulos.
 * Dessa dupla saem as três formas que a pessoa enxerga: a que repete pra
 * sempre, a que acaba num mês, e a que cai uma vez só.
 *
 * O que estas conferências protegem é a fronteira: o mês do fim AINDA
 * conta, o seguinte não. Errar isso por um mês é tirar um salário de um
 * mês em que ele ainda entra — ou prometer um que já acabou. */

const { suite } = require("./_apoio");

const BASE = `
  entradasFixas = [
    { id:"f1", nome:"Salário", valor:3000, dia:5, categoria:"Salário", inicio:null, fim:null },
    { id:"f2", nome:"Contrato", valor:1200, dia:10, categoria:"Extra", inicio:null, fim:"2026-12-01" },
    { id:"f3", nome:"13º", valor:2000, dia:20, categoria:"Extra", inicio:"2026-12-01", fim:"2026-12-01" },
  ];
  lancamentos = []; cartoes = []; comprasCartao = []; contas = [];
  metas = []; pagamentosFatura = []; fechamentos = [];
  mesAtual = mesDe(_hojeLocal());
`;

module.exports = () => suite("Entradas: prazo e extras", async ({ p, ok, abrir, chamadas, texto }) => {

  /* ─── A fronteira do fim ─────────────────────────────────────────────
     O mês do fim ainda conta; o seguinte não. Esta é a conferência que
     justifica a suíte: errar por um mês tira um salário de um mês em que
     ele ainda entra. */
  await abrir(BASE);
  const vale = (id, mes) => p.evaluate(a =>
    _entradaValeNoMes(entradasFixas.find(f => f.id === a[0]), a[1]), [id, mes]);

  ok("sem marco nenhum, vale em qualquer mês", (await vale("f1", "2030-07")) === true);
  ok("e também num mês antigo", (await vale("f1", "2020-01")) === true);

  ok("com fim, vale no mês anterior ao fim", (await vale("f2", "2026-11")) === true);
  ok("VALE NO PRÓPRIO MÊS DO FIM", (await vale("f2", "2026-12")) === true);
  ok("e não vale no mês seguinte", (await vale("f2", "2027-01")) === false);

  ok("o extra vale só no mês dele", (await vale("f3", "2026-12")) === true);
  ok("não vale no mês anterior", (await vale("f3", "2026-11")) === false);
  ok("nem no seguinte", (await vale("f3", "2027-01")) === false);

  ok("extra é início e fim no mesmo mês",
    (await p.evaluate(() => _ehExtra(entradasFixas[2]))) === true);
  ok("e a que só tem fim não é extra",
    (await p.evaluate(() => _ehExtra(entradasFixas[1]))) === false);

  /* ─── O total do mês respeita os dois marcos ─────────────────────── */
  const total = m => p.evaluate(x => aReceberDoMes(x).total, m);
  ok("novembro: o fixo e o contrato", (await total("2026-11")) === 4200);
  ok("dezembro: os três, com o 13º", (await total("2026-12")) === 6200);
  ok("janeiro: só o fixo, o contrato acabou", (await total("2027-01")) === 3000);

  /* ─── E o Resumo mostra esse mesmo número ────────────────────────────
     Se a previsão da tela discordar da função, uma das duas mente. */
  await abrir(BASE + `; mesAtual = "2026-12"; abrirResumo();`);
  const naTela = await texto(".resumo-total-entrada");
  ok("o bloco 'ainda vai entrar' bate com a conta", /R\$ 6\.200,00/.test(naTela));
  ok("e o 13º aparece na lista", /13º/.test(await texto(".resumo-secao")));

  /* ─── Recebida sai da previsão, mesmo sendo extra ─────────────────── */
  await abrir(BASE + `;
    lancamentos.push({ id:"r", tipo:"entrada", valor:2000, data:"2026-12-20",
                       categoria:"Extra", descricao:"13º" });`);
  ok("o extra já lançado sai do a receber", (await total("2026-12")) === 4200);

  /* ─── "Recebi todas" não lança o mês dos outros ──────────────────────
     O 13º de dezembro não pode ser lançado em outubro só porque alguém
     apertou o botão. */
  await abrir(BASE + `; abrirLancar("entrada");`);
  await p.evaluate(() => receberTodasAsFixas(document.querySelector(".fixas-todas")));
  const lancadas = (await chamadas()).find(x => x.tabela === "lancamentos");
  const nomes = [].concat(lancadas.dados).map(d => d.descricao);
  ok("lança só as que valem neste mês", !nomes.includes("13º"));
  ok("e lança as que valem", nomes.includes("Salário") && nomes.includes("Contrato"));

  /* ─── A tela mostra as de outros meses, sem somá-las ─────────────────
     Some do cálculo do mês, não da tela: sem aparecer em lugar nenhum, a
     pessoa não teria como corrigir o valor nem apagar o que errou. */
  await abrir(BASE + `; abrirLancar("entrada");`);
  ok("o 13º de dezembro aparece num bloco à parte",
    /Em outros meses/.test(await texto("#area")));
  ok("dizendo em que mês ele cai", /Só em dezembro de 2026/.test(await texto(".fixa-fora")));
  ok("e com o botão de editar", (await p.locator(".fixa-fora .botao-editar").count()) === 2);
  ok("mas fora do total do mês", !/R\$ 6\.200,00/.test(await texto(".fixas-bloco .bloco-topo")));

  /* ─── O formulário monta os marcos ──────────────────────────────────
     Três perguntas em cima, dois campos por baixo. */
  const gravado = async () => (await chamadas()).find(x => x.tabela === "entradas_fixas");

  await abrir(`abrirNovaEntradaFixa();
    document.getElementById("ef-nome").value = "Aluguel recebido";
    document.getElementById("ef-valor").value = "800,00";`);
  await p.evaluate(() => salvarEntradaFixa(document.querySelector(".botao.entrada"), null));
  let g = await gravado();
  ok("'pra sempre' não grava marco nenhum", g.dados.inicio === null && g.dados.fim === null);

  await abrir(`abrirNovaEntradaFixa();
    document.getElementById("ef-nome").value = "Contrato novo";
    document.getElementById("ef-valor").value = "1.500,00";
    document.querySelector('input[value="ate"]').click();
    document.getElementById("ef-mes").value = "2027-03";`);
  await p.evaluate(() => salvarEntradaFixa(document.querySelector(".botao.entrada"), null));
  g = await gravado();
  ok("'até um mês' grava só o fim", g.dados.inicio === null && g.dados.fim === "2027-03-01");

  await abrir(`abrirNovaEntradaFixa();
    document.getElementById("ef-nome").value = "Férias";
    document.getElementById("ef-valor").value = "3.000,00";
    document.querySelector('input[value="unica"]').click();
    document.getElementById("ef-mes").value = "2027-07";`);
  await p.evaluate(() => salvarEntradaFixa(document.querySelector(".botao.entrada"), null));
  g = await gravado();
  ok("'só num mês' grava os dois iguais",
    g.dados.inicio === "2027-07-01" && g.dados.fim === "2027-07-01");

  /* ─── O campo do mês só aparece quando faz sentido ───────────────── */
  await abrir(`abrirNovaEntradaFixa();`);
  ok("'pra sempre' esconde o seletor de mês",
    await p.locator("#ef-caixa-mes").isHidden());
  await p.evaluate(() => document.querySelector('input[value="ate"]').click());
  ok("'até um mês' mostra, pedindo o ÚLTIMO mês",
    (await p.locator("#ef-caixa-mes").isVisible()) &&
    (await p.textContent("#ef-mes-rotulo")) === "Último mês");
  await p.evaluate(() => document.querySelector('input[value="unica"]').click());
  ok("'só num mês' troca a pergunta",
    (await p.textContent("#ef-mes-rotulo")) === "Em qual mês");

  /* "Até março" é ambíguo em português — março entra ou não? A prévia
     responde antes de salvar. */
  await p.evaluate(() => {
    document.querySelector('input[value="ate"]').click();
    document.getElementById("ef-mes").value = "2027-03";
    _previaPrazoEntrada();
  });
  const previa = await texto("#ef-previa");
  ok("a prévia diz que o mês do fim ainda entra", /Março de 2027 é o último mês/.test(previa));
  ok("e a partir de quando ela some", /De abril de 2027 em diante/.test(previa));

  /* ─── Editar carrega o que estava lá ────────────────────────────── */
  await abrir(BASE + `; abrirEdicaoEntradaFixa("f2");`);
  ok("o nome vem preenchido", (await p.inputValue("#ef-nome")) === "Contrato");
  ok("o valor também", (await p.inputValue("#ef-valor")) === "1.200,00");
  ok("e o prazo vem marcado em 'até um mês'",
    (await p.evaluate(() => _prazoDaEntrada())) === "ate");
  ok("com o mês certo", (await p.inputValue("#ef-mes")) === "2026-12");

  await abrir(BASE + `; abrirEdicaoEntradaFixa("f3");`);
  ok("o extra abre marcado como 'só num mês'",
    (await p.evaluate(() => _prazoDaEntrada())) === "unica");

  /* Editar manda UPDATE na linha certa, e não cria outra. */
  await abrir(BASE + `; abrirEdicaoEntradaFixa("f2");
    document.getElementById("ef-valor").value = "1.400,00";`);
  await p.evaluate(() => salvarEntradaFixa(document.querySelector(".botao.entrada"), "f2"));
  const c = await chamadas();
  ok("editar é update, não insert",
    c.length === 1 && c[0].op === "update" && c[0].tabela === "entradas_fixas");
  ok("na linha certa", c[0].eq.some(e => e[0] === "id" && e[1] === "f2"));
  ok("com o valor novo", c[0].dados.valor === 1400);

  /* ─── Tirar o salário do futuro sem tirá-lo do mês ───────────────────
     É o caso de uso que pediu a funcionalidade: pôr fim no mês corrente
     e ver o mês corrente intacto e o seguinte sem ele. */
  const esteMes = await p.evaluate(() => mesDe(_hojeLocal()));
  const proximo = await p.evaluate(() => _somaMes(mesDe(_hojeLocal()), 1));
  await abrir(BASE + `;
    entradasFixas = [{ id:"s", nome:"Salário", valor:2000, dia:5, categoria:"Salário",
                       inicio:null, fim:"${esteMes}-01" }];`);
  ok("acabando neste mês, ele ainda conta neste mês", (await total(esteMes)) === 2000);
  ok("e some do mês seguinte", (await total(proximo)) === 0);
});
