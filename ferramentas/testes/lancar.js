/* UM BOTÃO SÓ PRA LANÇAR.
 *
 * "Lançar saída" e "Lançar entrada" ocupavam dois dos oito lugares do
 * menu pra fazer a mesma coisa com o sinal trocado. Viraram um, e a
 * escolha do sinal virou a primeira tela.
 *
 * O que estas conferências protegem é o caminho curto: quem já sabe o
 * que vai lançar — o Resumo, as entradas fixas — continua entrando
 * direto, sem passar pela escolha. A tela de escolha é só pro menu. */

const { suite } = require("./_apoio");

const BASE = `
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  mesAtual = mesDe(_hojeLocal());
`;

module.exports = () => suite("Lançar: um botão só", async ({ p, ok, abrir, texto, menu }) => {

  /* ─── A tela inicial ─────────────────────────────────────────────── */
  await abrir(BASE + "; voltarInicio();");
  const nomes = await menu();
  ok("há um 'Lançar' no menu", nomes.includes("Lançar"));
  ok("e os dois antigos sumiram",
    !nomes.includes("Lançar saída") && !nomes.includes("Lançar entrada"));
  // A contagem é conferida na suíte das Reservas, que é quem mexeu nela
  // por último. Aqui o que importa é que o lugar economizado continua
  // economizado: um botão só, não dois.
  ok("o resto continua lá",
    ["Resumo do mês", "Contas a pagar", "Histórico", "Cartão",
     "Metas de gastos", "Relatórios"].every(n => nomes.includes(n)));

  /* ─── A escolha ──────────────────────────────────────────────────── */
  await p.evaluate(() => abrirLancarEscolha());
  ok("a tela oferece as duas", (await p.locator(".lancar-op").count()) === 2);
  // A saída vem primeiro porque é o que mais se lança: entrada são três
  // ou quatro no mês, saída são dezenas. O dedo cai no de cima.
  const ordem = await p.locator(".lancar-op strong").allTextContents();
  ok("com a saída primeiro", ordem[0] === "Saída" && ordem[1] === "Entrada");
  ok("cada uma na cor dela",
    (await p.locator(".lancar-op.saida").count()) === 1 &&
    (await p.locator(".lancar-op.entrada").count()) === 1);

  await p.click(".lancar-op.saida");
  ok("tocar na saída abre o formulário de saída",
    (await p.locator(".lancamento-tela.saida").count()) === 1 &&
    (await p.locator("#lc-valor").count()) === 1);

  // E o voltar devolve pra escolha, não pro menu: foi de lá que se veio.
  await p.evaluate(() => voltarTela());
  ok("e voltar devolve pra escolha", (await p.locator(".lancar-op").count()) === 2);

  await p.click(".lancar-op.entrada");
  ok("tocar na entrada abre o de entrada",
    (await p.locator(".lancamento-tela.entrada").count()) === 1);

  /* ─── O caminho curto continua curto ─────────────────────────────────
     Quem já sabe o tipo não passa pela escolha. Se passasse, cada toque
     no "Ainda vai entrar" do Resumo viraria dois. */
  await abrir(BASE + `
    entradasFixas = [{ id:"f", nome:"Salário", valor:3000, dia:5,
                       categoria:"Salário", inicio:null, fim:null }];
    abrirResumo();`);
  await p.click(".resumo-secao:has(h2:text-is('Ainda vai entrar')) .item-toque");
  ok("o Resumo manda direto pro formulário de entrada",
    (await p.locator("#lc-valor").count()) === 1 &&
    (await p.locator(".lancar-op").count()) === 0);

  /* ─── E lançar dali ainda funciona ───────────────────────────────── */
  await abrir(BASE + "; abrirLancarEscolha();");
  await p.click(".lancar-op.saida");
  await p.evaluate(() => {
    document.getElementById("lc-valor").value = "51,30";
    document.getElementById("lc-desc").value = "Compras";
  });
  await p.evaluate(() => salvarLancamento(document.querySelector(".botao.saida"), "saida", "ch"));
  const c = await p.evaluate(() => window.CHAMADAS);
  ok("a saída é gravada como saída",
    c[0].tabela === "lancamentos" && c[0].dados.tipo === "saida" && c[0].dados.valor === 51.30);
});
