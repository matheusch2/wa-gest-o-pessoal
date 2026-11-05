/* A CATEGORIA NÃO PODE MUDAR SOZINHA.
 *
 * Um <select> sem nenhuma opção marcada não fica vazio: o navegador
 * escolhe a primeira, calado. Era por isso que abrir um formulário de
 * edição cuja categoria guardada não estava na lista — apagada em
 * Ajustes, ou escondida por aquela tela — e salvar trocava a categoria do
 * registro sem ninguém pedir e sem nada avisando.
 *
 * O defeito não aparecia ao lançar. Aparecia ao abrir pra mexer em outra
 * coisa e salvar, o que é pior: não há nada no gesto que explique a
 * mudança. */

const { suite } = require("./_apoio");

const BASE = `
  categorias = [
    { id:"s1", nome:"Casa", tipo:"saida" },
    { id:"s2", nome:"Mercado", tipo:"saida" },
    { id:"s3", nome:"Transporte", tipo:"saida" },
    { id:"e1", nome:"Salário", tipo:"entrada" },
    { id:"e2", nome:"Vendas", tipo:"entrada" },
  ];
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  mesAtual = mesDe(_hojeLocal());
`;

module.exports = () => suite("Categoria que muda sozinha", async ({ p, ok, abrir, chamadas, falharProxima }) => {

  const valorDo = (id) => p.evaluate(x => document.getElementById(x).value, id);

  /* ─── Lançamento com categoria que não existe mais ───────────────────
     Ele foi lançado em "Lazer"; depois alguém apagou "Lazer" em Ajustes.
     Abrir pra corrigir o valor não pode levar o gasto pra "Casa". */
  await abrir(BASE + `
    lancamentos = [{ id:"l1", tipo:"saida", valor:90, data:"${"2026-10-05"}",
                     categoria:"Lazer", descricao:"Cinema" }];
    abrirEdicaoLancamento("l1", "resumo");`);
  ok("a categoria guardada aparece escolhida", (await valorDo("ed-cat")) === "Lazer");
  ok("mesmo não estando mais cadastrada",
    (await p.evaluate(() => categorias.some(c => c.nome === "Lazer"))) === false);

  // E salvar sem tocar no campo tem que gravar a MESMA categoria.
  await p.evaluate(() => salvarEdicaoLancamento("l1", "resumo", document.querySelector(".botao")));
  const c1 = (await chamadas()).find(x => x.tabela === "lancamentos");
  ok("salvar não troca a categoria do registro", c1.dados.categoria === "Lazer");

  /* ─── Entrada fixa, o mesmo caso ─────────────────────────────────── */
  await abrir(BASE + `
    entradasFixas = [{ id:"f1", nome:"Aluguel recebido", valor:800, dia:10,
                       categoria:"Aluguel", inicio:null, fim:null }];
    abrirEdicaoEntradaFixa("f1");`);
  ok("a entrada fixa mantém a categoria dela", (await valorDo("ef-cat")) === "Aluguel");
  await p.evaluate(() => salvarEntradaFixa(document.querySelector(".botao.entrada"), "f1"));
  const c2 = (await chamadas()).find(x => x.tabela === "entradas_fixas");
  ok("e salvar grava a mesma", c2.dados.categoria === "Aluguel");

  /* ─── Carnê, o mesmo caso ────────────────────────────────────────── */
  await abrir(BASE + `
    contas = [];
    for (let i = 1; i <= 4; i++) contas.push({ id:"m"+i, nome:"Moto ("+i+"/4)", valor:600,
      vencimento:_vencimentoDaParcela("2026-10-15", i-1), pago:false,
      categoria:"Veículo", recorrente:false });
    abrirEdicaoCarne("Moto");`);
  ok("o carnê mantém a categoria dele", (await valorDo("ec-cat")) === "Veículo");

  /* ─── Mas a tela continua podendo filtrar a ESCOLHA ──────────────────
     As Metas escondem categoria que já tem meta. Esconder da escolha é
     legítimo; esconder a que o registro já usa, não. */
  await abrir(BASE + `
    metas = [{ id:"m1", categoria:"Casa", valor:1000, reservar:true }];
    abrirNovaMeta();`);
  const opcoes = await p.evaluate(() =>
    [...document.getElementById("mt-cat").options].map(o => o.value));
  ok("categoria que já tem meta não aparece pra escolher", !opcoes.includes("Casa"));
  ok("e as outras aparecem", opcoes.includes("Mercado") && opcoes.includes("Transporte"));

  /* ─── Sem categoria nenhuma, o select não pode valer "__nova" ────────
     Ele ficava só com o "+ Nova categoria", que é valor de controle —
     e salvar gravava a palavra "__nova" como categoria do registro. */
  await abrir(BASE + `
    metas = categorias.filter(c => c.tipo === "saida").map((c,i) =>
      ({ id:"m"+i, categoria:c.nome, valor:100, reservar:true }));
    abrirNovaMeta();`);
  const vazio = await valorDo("mt-cat");
  ok("sem opção nenhuma, o campo vale vazio e não '__nova'", vazio === "");

  await p.evaluate(() => salvarMeta(document.querySelector(".botao"), null));
  ok("e salvar é recusado em vez de gravar o valor de controle",
    (await chamadas()).length === 0);

  /* ─── "+ Nova categoria" não pode deixar o valor de controle ──────── */
  await abrir(BASE + `abrirLancar("saida");`);
  await p.evaluate(() => {
    const sel = document.getElementById("lc-cat");
    sel.value = "Transporte";
    aoEscolherCategoria("lc-cat", "saida", null);
    sel.value = "__nova";
    aoEscolherCategoria("lc-cat", "saida", null);
  });
  ok("escolher '+ Nova' devolve a escolha anterior na hora",
    (await valorDo("lc-cat")) === "Transporte");
  ok("e abre o campo de criar", await p.locator("#lc-cat-nova").isVisible());

  /* ─── Nome que já existe: escolher, não só avisar ────────────────────
     A tela dizia "essa categoria já existe" e deixava o select no que
     estava. A pessoa lia como confirmação e salvava na categoria errada. */
  await abrir(BASE + `abrirLancar("saida");`);
  await p.evaluate(() => { document.getElementById("lc-cat-nome").value = "Mercado"; });
  // O banco recusa o nome repetido — é o 23505 de verdade que a tela vê.
  await falharProxima("23505");
  await p.evaluate(() => criarCategoriaNoCampo(
    document.querySelector(".cat-nova-criar"), "lc-cat", "saida", null));
  ok("o nome que já existe é ESCOLHIDO, não só avisado",
    (await valorDo("lc-cat")) === "Mercado");
  ok("e o campo de criar fecha", await p.locator("#lc-cat-nova").isHidden());

  /* Quando a tela escondeu a categoria de propósito — as Metas escondem
     as que já têm meta —, escolher por cima desfaria a regra da tela. Aí
     o certo é só avisar. */
  await abrir(BASE + `
    metas = [{ id:"m1", categoria:"Casa", valor:1000, reservar:true }];
    abrirNovaMeta();
    document.getElementById("mt-cat-nome").value = "Casa";`);
  const antes = await valorDo("mt-cat");
  await falharProxima("23505");
  await p.evaluate(() => criarCategoriaNoCampo(
    document.querySelector(".cat-nova-criar"), "mt-cat", "saida", "_previaGastoDaMeta"));
  ok("o que a tela escondeu continua escondido", (await valorDo("mt-cat")) === antes);
  ok("e a escolha não é mexida por baixo", antes !== "Casa");

  /* ─── Criar uma de verdade escolhe ela ───────────────────────────── */
  await abrir(BASE + `abrirLancar("saida");`);
  await p.evaluate(() => { document.getElementById("lc-cat-nome").value = "Pet"; });
  await p.evaluate(() => criarCategoriaNoCampo(
    document.querySelector(".cat-nova-criar"), "lc-cat", "saida", null));
  ok("categoria nova nasce já escolhida", (await valorDo("lc-cat")) === "Pet");
  ok("e com o tipo da tela",
    (await chamadas()).find(x => x.tabela === "categorias").dados.tipo === "saida");
});
