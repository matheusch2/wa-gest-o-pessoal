/* O NEGÓCIO É OUTRO BOLSO.
 *
 * Esta suíte trava uma regra só, mas é a que sustenta a tela inteira:
 *
 *   faturamento e custo  ficam DENTRO do negócio
 *   retirada             vira ENTRADA no extrato pessoal
 *
 * Quem fatura R$ 20.000 e tem R$ 14.000 de custo não ganhou R$ 20.000 —
 * ganhou o que tirou. Se o faturamento virasse lançamento, a sobra do
 * Resumo ficaria inflada por dinheiro que não é de gastar, e o relatório
 * diria que a pessoa ganhou o que a empresa faturou. É a mesma família de
 * defeito que já apareceu cinco vezes neste app: dois números pra mesma
 * coisa, agora entre dois bolsos.
 *
 * E trava o que faz isto virar produto: o ramo muda PALAVRA e CATEGORIA,
 * nunca a conta. É isso que permite um cliente novo sem código novo.
 */

const { suite } = require("./_apoio");

const HOJE = new Date();
const M = (p) => {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + p, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

const BASE = `
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  reservas = []; movimentosReserva = [];
  negocios = []; movimentosNegocio = [];
  mesAtual = "${M(0)}";
`;

const UM = `
  negocios = [{ id:"n1", nome:"WA Aqua", tipo:"servico", unidade:"serviço" }];
  movimentosNegocio = [
    { id:"a", negocio_id:"n1", tipo:"faturamento", valor:4000, data:"${M(0)}-08",
      categoria:"Mensalidade", descricao:"Mensalidades", quantidade:8 },
    { id:"b", negocio_id:"n1", tipo:"custo", valor:1000, data:"${M(0)}-09",
      categoria:"Ferramentas e sistemas", descricao:"Hospedagem" },
    { id:"c", negocio_id:"n1", tipo:"retirada", valor:2000, data:"${M(0)}-10",
      descricao:"Pró-labore", lancamento_id:"L1" },
  ];
  lancamentos = [{ id:"L1", tipo:"entrada", valor:2000, data:"${M(0)}-10",
                   categoria:"Retirada", descricao:"Pró-labore" }];
`;

module.exports = () => suite("Meu negócio", async ({ p, ok, abrir, texto, valor, chamadas, falharProxima }) => {

  /* ─── A TELA EXISTE, O BOTÃO NÃO ─────────────────────────────────────
     O dono do app tirou "Meu negócio" do menu: o jeito de modelar um
     negócio dentro de um app de finanças pessoais ainda não fechou. A
     tela e os dados ficaram inteiros, e esta suíte continua guardando
     eles — é ela que garante que voltar a pôr o botão é só pôr o botão.

     O que ela ainda trava do jeito antigo: embreve.js carrega DEPOIS e
     sobrescreve quem vier antes. Com abrirMeuNegocio() lá dentro, o
     módulo de verdade seria carregado e ignorado. */
  await abrir(BASE + UM + "; voltarInicio();");
  ok("a tela inicial não tem mais o botão",
    (await p.locator("#menu button:has-text('Meu negócio')").count()) === 0);

  await p.evaluate(() => abrirMeuNegocio());
  ok("mas a tela abre de verdade, não a de 'em construção'",
    (await p.locator(".em-breve-selo").count()) === 0 &&
    (await p.locator(".negocio-botoes").count()) === 1);

  /* ─── OS QUATRO NÚMEROS ──────────────────────────────────────────── */
  await abrir(BASE + UM + "; abrirMeuNegocio();");
  const r = await p.evaluate(x => _retratoDoNegocio("n1", x), M(0));
  ok("entrou é o faturamento", r.entrou === 4000);
  ok("custou é o custo", r.custou === 1000);
  ok("sobrou é a diferença, não o que ficou", r.sobrou === 3000);
  ok("retirado é o que atravessou", r.retirado === 2000);
  ok("e ficou é o que restou no negócio", r.ficou === 1000);
  ok("a margem sai do faturamento", Math.round(r.margem * 100) === 75);

  ok("o número grande é o que SOBROU, não o que entrou",
    valor(await texto(".contas-total strong")) === 3000);
  const topo = await texto(".contas-total small");
  ok("com entrou e custou escritos embaixo, pra conta fechar",
    topo.includes("4.000,00") && topo.includes("1.000,00"));

  /* A FRASE DA RETIRADA FECHA A CONTA. "Sobrou R$ 3.000" com "Retirei
     R$ 2.000" logo abaixo faz qualquer um perguntar se tem três ou um mil
     no negócio — é o defeito que mais dói neste app, e ele cabia aqui. */
  const frase = await texto(".negocio-retirada .cartao-dica");
  ok("a tela diz o que sobrou, o que saiu e o que ficou",
    frase.includes("3.000,00") && frase.includes("2.000,00") && frase.includes("1.000,00"));

  /* ─── A REGRA QUE SUSTENTA TUDO ──────────────────────────────────────
     Faturamento e custo NÃO criam lançamento. Retirada cria. */
  await abrir(BASE + UM + "; abrirMovimentoNegocio('faturamento');");
  await p.evaluate(() => { document.getElementById("mn-valor").value = "900,00"; });
  await p.evaluate(() => salvarMovimentoNegocio(
    document.querySelector(".lancamento-tela > .botao"), "n1", "faturamento"));
  const f = await chamadas();
  ok("faturamento grava UMA linha só", f.length === 1);
  ok("e ela é do negócio, não do extrato", f[0].tabela === "movimentos_negocio");
  ok("sem lançamento pendurado nela", f[0].dados.lancamento_id === null);

  await abrir(BASE + UM + "; abrirMovimentoNegocio('custo');");
  await p.evaluate(() => { document.getElementById("mn-valor").value = "300,00"; });
  await p.evaluate(() => salvarMovimentoNegocio(
    document.querySelector(".lancamento-tela > .botao"), "n1", "custo"));
  const c = await chamadas();
  ok("custo também não toca o extrato pessoal",
    c.length === 1 && c[0].tabela === "movimentos_negocio" && c[0].dados.tipo === "custo");

  await abrir(BASE + UM + "; abrirMovimentoNegocio('retirada');");
  await p.evaluate(() => { document.getElementById("mn-valor").value = "1.500,00"; });
  await p.evaluate(() => salvarMovimentoNegocio(
    document.querySelector(".lancamento-tela > .botao"), "n1", "retirada"));
  const rt = await chamadas();
  ok("retirada grava o lançamento primeiro", rt[0].tabela === "lancamentos");
  ok("como ENTRADA, porque o dinheiro cai na sua conta",
    rt[0].dados.tipo === "entrada" && rt[0].dados.valor === 1500);
  ok("com categoria própria, pra dar pra reconhecer depois",
    rt[0].dados.categoria === "Retirada");
  ok("e o movimento vem depois, apontando pra ele",
    rt[1].tabela === "movimentos_negocio" && !!rt[1].dados.lancamento_id);

  // Se o movimento falhar, o lançamento é desfeito: sobrar uma entrada
  // sem motivo no extrato é pior do que não ter gravado nada.
  await abrir(BASE + UM + "; abrirMovimentoNegocio('retirada');");
  await falharProxima("XX000", "deu ruim", 1);
  await p.evaluate(() => { document.getElementById("mn-valor").value = "1.500,00"; });
  await p.evaluate(() => salvarMovimentoNegocio(
    document.querySelector(".lancamento-tela > .botao"), "n1", "retirada"));
  const des = await chamadas();
  ok("movimento que falha desfaz o lançamento",
    des.length === 3 && des[2].tabela === "lancamentos" && des[2].op === "delete");

  /* ─── O QUE O RESUMO E O RELATÓRIO ENXERGAM ──────────────────────────
     Só a retirada. Este é o par de conferências que impede o defeito de
     voltar pela porta dos fundos. */
  await abrir(BASE + UM + "; abrirResumo();");
  ok("o Resumo conta SÓ a retirada como entrada",
    valor(await texto(".resumo-numero.entrada strong")) === 2000);
  ok("os R$ 4.000 faturados não entram no seu bolso",
    valor(await texto(".resumo-numero.entrada strong")) !== 4000);
  ok("e o custo do negócio não vira saída sua",
    valor(await texto(".resumo-numero.saida strong")) === 0);

  /* A RETIRADA NÃO PRECISA DE EXCEÇÃO NENHUMA no relatório, e isso é de
     propósito: ela É renda pessoal. Diferente do resgate de reserva, que
     é dinheiro que já era seu voltando, aqui o dinheiro é novo. */
  await abrir(BASE + UM + "; abrirRelatorios();");
  const rel = await p.evaluate(x => _retratoDoMes(x), M(0));
  ok("o relatório conta a retirada como renda", rel.entrou === 2000);
  ok("e não inventa gasto nenhum com o custo do negócio", rel.gastou === 0);

  /* ─── O CAIXA É DE TODOS OS MESES ────────────────────────────────────
     "Quanto tem lá dentro?" não pode depender de qual mês está na tela. */
  await abrir(BASE + UM + `
    movimentosNegocio.push({ id:"d", negocio_id:"n1", tipo:"faturamento",
                             valor:5000, data:"${M(-1)}-08" });
    abrirMeuNegocio();`);
  ok("o caixa soma todos os meses",
    (await p.evaluate(() => _caixaDoNegocio("n1"))) === 6000);
  ok("mas o mês na tela continua só o dele",
    (await p.evaluate(x => _retratoDoNegocio("n1", x).entrou, M(0))) === 4000);

  /* ─── TICKET MÉDIO ───────────────────────────────────────────────── */
  await abrir(BASE + UM + "; abrirMeuNegocio();");
  ok("o ticket médio sai do faturamento pela quantidade",
    (await p.evaluate(x => _retratoDoNegocio("n1", x).ticket, M(0))) === 500);
  ok("e a tela nomeia a unidade do ramo",
    (await texto(".fatura-resumo")).includes("CADA SERVIÇO") ||
    (await texto(".fatura-resumo")).toLowerCase().includes("cada serviço"));

  // Sem quantidade não há ticket, e a tela não inventa um.
  await abrir(BASE + `
    negocios = [{ id:"n1", nome:"Loja", tipo:"comercio", unidade:null }];
    movimentosNegocio = [{ id:"a", negocio_id:"n1", tipo:"faturamento",
                           valor:4000, data:"${M(0)}-08" }];
    abrirMeuNegocio();`);
  ok("sem quantidade, nenhum ticket é inventado",
    (await p.evaluate(x => _retratoDoNegocio("n1", x).ticket, M(0))) === null &&
    (await p.locator(".fatura-resumo > div").count()) === 1);

  // "6 serviço" é descuido que faz app de dinheiro parecer amador.
  await abrir(BASE + UM + "; abrirMeuNegocio();");
  ok("a unidade vai pro plural quando é mais de uma",
    (await texto(".lista")).includes("8 serviços"));

  /* ─── O RAMO MUDA PALAVRA E CATEGORIA, NUNCA A CONTA ─────────────────
     É isto que faz um cliente novo não custar uma linha de código. */
  await abrir(BASE + `
    negocios = [{ id:"n1", nome:"Barbearia", tipo:"beleza", unidade:"atendimento" }];
    abrirMovimentoNegocio("custo");`);
  const catsBeleza = await p.locator("#mn-cat option").allTextContents();
  ok("a barbearia vê as categorias dela", catsBeleza.includes("Produtos"));
  ok("e não as da prestação de serviço", !catsBeleza.includes("Ferramentas e sistemas"));

  await abrir(BASE + UM + "; abrirMovimentoNegocio('custo');");
  const catsServico = await p.locator("#mn-cat option").allTextContents();
  ok("a prestação de serviço vê as dela", catsServico.includes("Ferramentas e sistemas"));

  // A retirada não tem categoria: ela não é despesa do negócio, é
  // distribuição do lucro.
  await abrir(BASE + UM + "; abrirMovimentoNegocio('retirada');");
  ok("retirada não pede categoria", (await p.locator("#mn-cat").count()) === 0);

  /* ─── CADASTRAR ──────────────────────────────────────────────────── */
  await abrir(BASE + "; abrirMeuNegocio();");
  ok("sem negócio, a tela explica o que é antes de pedir cadastro",
    (await texto("#area")).includes("retirada") &&
    (await p.locator(".negocio-botoes").count()) === 0);

  await abrir(BASE + "; abrirNovoNegocio();");
  ok("o ramo é uma lista, não texto livre",
    (await p.locator("#ng-tipo option").count()) === 7);
  await p.selectOption("#ng-tipo", "entrega");
  ok("trocar o ramo sugere a unidade dele",
    (await p.inputValue("#ng-unidade")) === "entrega");

  await p.evaluate(() => { document.getElementById("ng-nome").value = "Água em casa"; });
  await p.evaluate(() => salvarNegocio(document.querySelector(".lancamento-tela > .botao")));
  const novo = await chamadas();
  ok("o negócio nasce com nome, ramo e unidade",
    novo[0].dados.nome === "Água em casa" &&
    novo[0].dados.tipo === "entrega" &&
    novo[0].dados.unidade === "entrega");

  await abrir(BASE + "; abrirNovoNegocio();");
  await p.evaluate(() => salvarNegocio(document.querySelector(".lancamento-tela > .botao")));
  ok("sem nome, nada é gravado", (await chamadas()).length === 0);

  // Unidade escrita à mão não é sobrescrita ao trocar o ramo: "ajuda" que
  // apaga o que a pessoa acabou de digitar não é ajuda.
  await abrir(BASE + "; abrirNovoNegocio();");
  await p.evaluate(() => { document.getElementById("ng-unidade").value = "botijão"; });
  await p.selectOption("#ng-tipo", "beleza");
  ok("unidade escrita à mão sobrevive à troca de ramo",
    (await p.inputValue("#ng-unidade")) === "botijão");

  /* ─── EXCLUIR ────────────────────────────────────────────────────── */
  await abrir(BASE + UM + "; abrirMeuNegocio();");
  await p.evaluate(() => pedirExcluirMovimentoNegocio("c"));
  ok("excluir a retirada avisa que o lançamento sai junto",
    (await texto(".confirmar")).includes("extrato"));
  await p.click(".confirmar .sim");
  const ex = await chamadas();
  ok("e apaga os dois lados",
    ex[0]?.tabela === "movimentos_negocio" && ex[0]?.op === "delete" &&
    ex[1]?.tabela === "lancamentos" && ex[1]?.op === "delete");

  await abrir(BASE + UM + "; abrirMeuNegocio();");
  await p.evaluate(() => pedirExcluirMovimentoNegocio("a"));
  await p.click(".confirmar .sim");
  ok("faturamento, que não tem lançamento, apaga só o dele",
    (await chamadas()).length === 1);

  /* ─── TABELA QUE FALTA ───────────────────────────────────────────────
     Mesma regra das Reservas: quem não rodou o banco.sql vê a explicação,
     não o app inteiro parado. */
  await abrir(BASE + UM + `window.TABELAS_SEM_BANCO = ["negocios", "movimentos_negocio"];`);
  const carregou = await p.evaluate(() => carregarTudo());
  ok("faltando as tabelas, o app ainda carrega", carregou === true);
  await p.evaluate(() => abrirMeuNegocio());
  ok("e a tela diz o que rodar", (await texto("#area")).includes("banco.sql"));

  /* ─── MÊS NO VERMELHO ────────────────────────────────────────────── */
  await abrir(BASE + `
    negocios = [{ id:"n1", nome:"WA Aqua", tipo:"servico", unidade:"serviço" }];
    movimentosNegocio = [
      { id:"a", negocio_id:"n1", tipo:"faturamento", valor:500, data:"${M(0)}-08" },
      { id:"b", negocio_id:"n1", tipo:"custo", valor:1200, data:"${M(0)}-09" },
    ];
    abrirMeuNegocio();`);
  ok("mês em que o negócio deu prejuízo é dito com essas palavras",
    (await texto(".contas-total span")).includes("negativo"));
  ok("e veste a cor do prejuízo", (await p.locator(".contas-total.ruim").count()) === 1);
  ok("com o valor em positivo, porque a palavra já diz o sinal",
    valor(await texto(".contas-total strong")) === 700);
  // Margem negativa é ruído: a linha de cima já disse que ficou negativo,
  // e margem só quer dizer alguma coisa quando sobra alguma coisa.
  ok("e não escreve margem negativa por cima disso",
    !(await texto(".contas-total small")).includes("margem"));
  // "R$ -700,00" com hífen de teclado parece erro de digitação numa tela
  // de dinheiro. O app usa o sinal de menos tipográfico em todo lugar.
  ok("o caixa negativo usa o sinal de menos, não o hífen",
    (await texto(".fatura-resumo")).includes("−R$") &&
    !(await texto(".fatura-resumo")).includes("-R$"));
});
