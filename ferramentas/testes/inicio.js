/* A TELA INICIAL.
 *
 * Ela deixou de ser um bloco de HTML parado e passou a ser desenhada, e
 * isso traz um defeito que o menu antigo não podia ter: NÚMERO VELHO.
 * Pagar um boleto e voltar pra cá tem que mexer no painel; se não
 * mexer, a tela inicial e a tela das contas discordam sobre quanto
 * falta pagar — e dois números que não fecham é o pior defeito de um app
 * de dinheiro.
 *
 * É isso que esta suíte trava, em quatro frentes:
 *
 *   - a HIERARQUIA      três níveis, não dez botões iguais; e medida em
 *                       pixel e cor de verdade, não em nome de classe,
 *                       que continua passando depois que a regra some
 *   - o AVISO           o que está vencido manda no que está vencendo
 *   - o PAINEL          a sobra dele é a MESMA do Resumo, sempre
 *   - o REDESENHO       voltar pra cá recalcula tudo
 */

const { suite } = require("./_apoio");

const HOJE = new Date();
const D = (n) => {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
         "-" + String(d.getDate()).padStart(2, "0");
};
const M = D(0).slice(0, 7);

const BASE = `
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  conferencias = []; movimentosReserva = []; reservas = [];
  mesAtual = mesDe(_hojeLocal());
`;

// A cor do botão principal e a cor do alerta, lidas do próprio CSS: o
// teste não pode guardar "#c9992e" na mão, senão ele passa a conferir o
// que ele mesmo escreveu em vez do que a identidade do app diz.
const LER_COR = (nome) => `getComputedStyle(document.documentElement).getPropertyValue("${nome}").trim()`;

module.exports = () => suite("Tela inicial", async ({ p, ok, abrir, texto, valor, menu }) => {

  /* ═══ A HIERARQUIA ═══════════════════════════════════════════════ */

  await abrir(BASE + "; voltarInicio();");

  const nomes = await menu();
  ok("a tela inicial tem dez caminhos", nomes.length === 10);
  ok("'Lançar' vem primeiro e sozinho", nomes[0] === "Lançar");
  ok("depois vêm os quatro atalhos, o Resumo na frente",
    nomes.slice(1, 5).join("|") === "Resumo do mês|Balanço|Contas a pagar|Cartão");
  ok("e os cinco cadastros por último",
    nomes.slice(5).join("|") === "Histórico|Metas de gastos|Relatórios|Reservas|Investimentos");

  /* TRÊS NÍVEIS, MEDIDOS EM PIXEL. O botão do dia tem que ser
     visivelmente maior que o atalho, e o atalho que a pastilha. Conferir
     a classe não serviria: `.ini-principal` continua no HTML mesmo
     depois de alguém apagar a regra que a faz grande. */
  const caixa = (sel) => p.$eval(sel, e => {
    const r = e.getBoundingClientRect();
    return { alt: Math.round(r.height), area: Math.round(r.width * r.height) };
  });
  const principal = await caixa("#menu .ini-principal");
  const atalho = await caixa("#menu .ini-btn");
  const pastilha = await caixa("#menu .ini-btn-peq");
  ok("o botão do dia ocupa mais tela que um atalho", principal.area > atalho.area * 2);
  ok("e é mais alto também — já foi mais baixo", principal.alt > atalho.alt);
  ok("o atalho ocupa mais tela que uma pastilha", atalho.area > pastilha.area);
  ok("e é mais alto que ela", atalho.alt > pastilha.alt);

  /* O BOTÃO DO DIA É DOURADO, E O DOURADO NÃO É A COR DO ALERTA. É a
     razão de ele não ser âmbar: o botão mais importante da tela não pode
     ter a cor de "está vencendo". */
  const corBotao = await p.$eval("#menu .ini-principal", e => getComputedStyle(e).backgroundColor);
  const dourado = await p.evaluate(LER_COR("--dourado"));
  const aviso = await p.evaluate(LER_COR("--aviso"));
  const emRGB = (hex) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  ok("o botão do dia é o dourado da logo", corBotao === emRGB(dourado));
  ok("e o dourado não é o âmbar do 'vencendo'", dourado !== aviso);

  /* LETRA ESCURA EM CIMA DO DOURADO. Dourado com letra branca não se lê
     — e ninguém percebe isso olhando o código. */
  const claro = (cor) => {
    const [r, g, b] = cor.match(/\d+/g).map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };
  const corLetra = await p.$eval("#menu .ini-principal", e => getComputedStyle(e).color);
  ok("a letra em cima do dourado é escura", claro(corLetra) < 90);

  /* A PASTILHA ÍMPAR OCUPA A LINHA INTEIRA, de verdade. Meia pastilha
     com meio vazio do lado lê como falha de carregamento. */
  const larguras = await p.$$eval("#menu .ini-btn-peq",
    els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  ok("são cinco pastilhas", larguras.length === 5);
  ok("e a quinta ocupa a linha inteira", larguras[4] > larguras[0] * 1.9);

  /* NENHUM NOME QUEBRA EM DUAS LINHAS. "Resumo do mês" é o mais
     comprido da grade e já caiu pra duas linhas uma vez, esticando o
     cartão do lado junto. */
  const quebrados = await p.$$eval("#menu .ini-btn > span:last-child", els =>
    els.filter(s => {
      const f = document.createRange(); f.selectNodeContents(s);
      return f.getClientRects().length > 1;
    }).map(s => s.textContent.trim()));
  ok("nenhum nome de atalho quebra em duas linhas", quebrados.length === 0);

  /* MEU NEGÓCIO CONTINUA FORA, a pedido do dono do app. A tela existe e
     tem suíte própria; o que não existe é o caminho até ela. */
  ok("'Meu negócio' não voltou pro menu",
    (await p.locator("#menu button:has-text('Meu negócio')").count()) === 0);

  /* ═══ O AVISO DE CONTA ═══════════════════════════════════════════ */

  ok("sem conta nenhuma, não há aviso",
    (await p.locator("#menu .ini-boletos").count()) === 0);

  await abrir(BASE + `
    contas = [{ id:"c1", nome:"Água", valor:92.3, vencimento:"${D(5)}", pago:false }];
    voltarInicio();`);
  ok("conta que vence daqui a cinco dias ainda não avisa",
    (await p.locator("#menu .ini-boletos").count()) === 0);

  await abrir(BASE + `
    contas = [{ id:"c1", nome:"Água", valor:92.3, vencimento:"${D(0)}", pago:false }];
    voltarInicio();`);
  ok("a que vence hoje avisa", (await p.locator("#menu .ini-boletos").count()) === 1);
  ok("e diz 'hoje', não a data", (await texto(".ini-boletos-txt")).includes("vence hoje"));
  ok("em âmbar, não em vermelho",
    (await p.locator("#menu .ini-boletos-vencido").count()) === 0);

  await abrir(BASE + `
    contas = [{ id:"c1", nome:"Água", valor:92.3, vencimento:"${D(1)}", pago:false }];
    voltarInicio();`);
  ok("a de amanhã diz 'amanhã'", (await texto(".ini-boletos-txt")).includes("vence amanhã"));

  /* O VENCIDO MANDA NO VENCENDO. Ter os dois ao mesmo tempo é comum, e
     o atrasado é o que precisa de decisão hoje. Dois cartões empilhados
     diriam a mesma coisa duas vezes. */
  await abrir(BASE + `
    contas = [
      { id:"c1", nome:"Energia", valor:318.4, vencimento:"${D(-4)}", pago:false },
      { id:"c2", nome:"Internet", valor:129.9, vencimento:"${D(-2)}", pago:false },
      { id:"c3", nome:"Água", valor:92.3, vencimento:"${D(1)}", pago:false }];
    voltarInicio();`);
  ok("com vencida e vencendo juntas, só aparece um aviso",
    (await p.locator("#menu .ini-boletos").count()) === 1);
  ok("e é o da vencida", (await p.locator("#menu .ini-boletos-vencido").count()) === 1);
  const txtAviso = await texto(".ini-boletos-txt");
  ok("que conta as duas vencidas", txtAviso.includes("2 contas vencidas"));
  ok("soma só elas, não a que ainda vai vencer", txtAviso.includes("R$ 448,30"));
  ok("e diz quando venceu a mais antiga", txtAviso.includes(dataBR(`${D(-4)}`)));

  /* PAGO PELA METADE AINDA É CONTA. O aviso tem que somar o que FALTA,
     não o valor cheio do boleto — é a mesma régua da tela das contas. */
  await abrir(BASE + `
    contas = [{ id:"c1", nome:"Energia", valor:300, valor_pago:120, pago:false, vencimento:"${D(-3)}" }];
    voltarInicio();`);
  ok("conta paga pela metade avisa o que falta, não o valor cheio",
    (await texto(".ini-boletos-txt")).includes("R$ 180,00"));

  await abrir(BASE + `
    contas = [{ id:"c1", nome:"Energia", valor:300, pago:true, vencimento:"${D(-3)}" }];
    voltarInicio();`);
  ok("conta paga e vencida não avisa nada",
    (await p.locator("#menu .ini-boletos").count()) === 0);

  /* E A PAGA QUE AINDA NEM VENCEU TAMBÉM NÃO. São dois caminhos
     diferentes dentro do aviso — o do vencido e o do vencendo — e cada
     um tem o seu próprio "está pago?". Só o primeiro estava coberto:
     tirar o filtro do segundo não derrubava teste nenhum, porque nenhum
     cenário tinha boleto pago com data à frente. Quem paga adiantado
     ficaria sendo cobrado pela tela inicial. */
  await abrir(BASE + `
    contas = [{ id:"c1", nome:"Água", valor:92.3, pago:true, vencimento:"${D(1)}" }];
    voltarInicio();`);
  ok("conta paga adiantado também não avisa",
    (await p.locator("#menu .ini-boletos").count()) === 0);

  /* ═══ O PAINEL ═══════════════════════════════════════════════════ */

  const CENARIO = BASE + `
    lancamentos = [
      { id:"l1", tipo:"entrada", valor:4200, categoria:"Salário", descricao:"Salário", data:"${M}-05" },
      { id:"l2", tipo:"saida", valor:1250, categoria:"Casa", descricao:"Aluguel", data:"${M}-06" }];
    contas = [{ id:"c1", nome:"Energia", valor:318.4, vencimento:"${D(3)}", pago:false, categoria:"Casa" }];
    entradasFixas = [{ id:"e1", nome:"Aluguel recebido", valor:900, dia:25, categoria:"Aluguel recebido" }];
    conferencias = [{ id:"cf", data:"${D(0)}", saldo_informado:3000, created_at:"${D(0)}T08:00:00Z" }];
  `;

  await abrir(CENARIO + "; voltarInicio();");
  ok("o painel diz quanto entrou", (await texto(".ini-num-entrada")).includes("R$ 4.200,00"));
  ok("quanto saiu", (await texto(".ini-num-saida")).includes("R$ 1.250,00"));
  ok("e quanto ainda falta pagar",
    (await texto(".ini-nums .ini-num:last-child")).includes("R$ 318,40"));

  /* A SOBRA DO PAINEL É A SOBRA DO RESUMO. Este é o teste que importa:
     as duas telas respondem a mesma pergunta e têm que dar o mesmo
     número — não porque conferem hoje, mas porque fazem a mesma conta.

     4200 - 1250 + 900 (a receber) - 318,40 (a pagar) = 3531,60. */
  const sobraInicio = valor(await texto(".ini-heroi-bom b"));
  ok("a sobra do painel está certa", sobraInicio === 3531.6);

  await p.evaluate(() => abrirResumo());
  const sobraResumo = valor(await texto(".saldo-valor, .resumo-valor, .saldo strong"));
  ok("e é exatamente a mesma do Resumo", sobraResumo === sobraInicio);

  /* O SINAL NÃO SE ESCONDE NO NÚMERO. "Sobra do mês: -R$ 500" obriga a
     pessoa a ler o menos pra entender que é o contrário do que o rótulo
     diz. Quem muda é o rótulo. */
  await abrir(BASE + `
    lancamentos = [{ id:"l1", tipo:"saida", valor:500, categoria:"Casa", descricao:"x", data:"${M}-05" }];
    contas = [{ id:"c1", nome:"Energia", valor:300, vencimento:"${D(3)}", pago:false }];
    voltarInicio();`);
  const ruim = await texto(".ini-heroi-ruim");
  ok("mês no vermelho diz 'Falta no mês'", ruim.includes("Falta no mês"));
  ok("e o número não leva sinal de menos", !ruim.includes("-"));
  ok("vale R$ 800,00", valor(await texto(".ini-heroi-ruim b")) === 800);

  /* ZERO NÃO É NOTÍCIA BOA NEM RUIM. Quem acabou de criar a conta via
     três números vibrantes anunciando que não aconteceu nada. */
  await abrir(BASE + "; voltarInicio();");
  ok("conta nova: a sobra zerada não fica verde",
    (await p.locator("#menu .ini-heroi-bom").count()) === 0);
  ok("nem o 'entrou' zerado", (await p.locator("#menu .ini-num-entrada").count()) === 0);
  ok("nem o 'saiu' zerado", (await p.locator("#menu .ini-num-saida").count()) === 0);
  ok("e o rótulo é 'Saldo do mês', que é o que ele é sem previsão",
    (await texto(".ini-herois .ini-heroi:last-child small")) === "Saldo do mês");

  /* ═══ A LINHA DE BAIXO ═══════════════════════════════════════════ */

  ok("sem saldo informado, o painel diz que não sabe",
    (await texto(".ini-heroi-vazio b")) === "—");
  ok("e a linha de baixo manda informar",
    (await texto(".ini-painel-linha")).includes("Informe o saldo"));
  await p.click("#menu .ini-painel-linha");
  ok("e ela leva pro Balanço, que é onde se informa",
    (await texto("h2")).includes("Balanço"));

  await abrir(BASE + `
    conferencias = [{ id:"cf", data:"${D(-6)}", saldo_informado:3000, created_at:"${D(-6)}T08:00:00Z" }];
    voltarInicio();`);
  ok("saldo de dias atrás vira pedido de conferência",
    (await texto(".ini-painel-linha")).includes("confira se ainda bate"));
  ok("com a data de quando foi informado",
    (await texto(".ini-painel-linha")).includes(dataBR(`${D(-6)}`)));

  await abrir(BASE + `
    conferencias = [{ id:"cf", data:"${D(0)}", saldo_informado:3000, created_at:"${D(0)}T08:00:00Z" }];
    entradasFixas = [{ id:"e1", nome:"Salário", valor:2500, dia:28, categoria:"Salário" }];
    voltarInicio();`);
  ok("saldo de hoje com entrada prevista avisa o que ainda vai entrar",
    (await texto(".ini-painel-linha")).includes("R$ 2.500,00"));

  await abrir(BASE + `
    conferencias = [{ id:"cf", data:"${D(0)}", saldo_informado:3000, created_at:"${D(0)}T08:00:00Z" }];
    voltarInicio();`);
  ok("saldo de hoje e nada previsto: nenhuma linha sobra",
    (await p.locator("#menu .ini-painel-linha").count()) === 0);

  /* ═══ O REDESENHO ════════════════════════════════════════════════
     É a razão de a tela ser desenhada em vez de escrita no HTML. Pagar
     uma conta e voltar pra cá tem que mudar o painel E o aviso. */

  await abrir(CENARIO + `
    contas.push({ id:"c2", nome:"Internet", valor:100, vencimento:"${D(-1)}", pago:false });
    voltarInicio();`);
  ok("antes de pagar, o painel conta as duas",
    valor(await texto(".ini-nums .ini-num:last-child")) === 418.4);
  ok("e o aviso mostra a vencida",
    (await p.locator("#menu .ini-boletos-vencido").count()) === 1);

  await p.evaluate(() => {
    contas = contas.filter(c => c.id !== "c2");
    voltarInicio();
  });
  ok("pagou e voltou: o painel já não conta ela",
    valor(await texto(".ini-nums .ini-num:last-child")) === 318.4);
  ok("e o aviso de vencida sumiu",
    (await p.locator("#menu .ini-boletos-vencido").count()) === 0);

  /* O PAINEL É SEMPRE DO MÊS DE HOJE. Quem navegou até março no Resumo
     e voltou pra cá quer ver o mês corrente — se o painel seguisse o
     mesAtual, a tela inicial mudaria de assunto sozinha. */
  await abrir(CENARIO + `
    mesAtual = mesVizinho(mesDe(_hojeLocal()), 4);
    voltarInicio();`);
  ok("mesmo com o Resumo parado em outro mês, o painel é o de hoje",
    (await texto(".ini-num-entrada")).includes("R$ 4.200,00"));
  ok("e a data do topo é a de hoje",
    (await texto(".ini-painel-data")) === dataBR(`${D(0)}`));

  /* ═══ A NAVEGAÇÃO ════════════════════════════════════════════════ */

  await abrir(BASE + "; voltarInicio();");
  ok("a tela inicial aparece",
    await p.$eval("#menu", e => getComputedStyle(e).display !== "none"));

  await p.click("#menu .ini-principal");
  ok("tocar em 'Lançar' esconde a tela inicial",
    await p.$eval("#menu", e => getComputedStyle(e).display === "none"));
  ok("e empilha uma tela só", (await p.evaluate(() => pilha.length)) === 1);

  await p.evaluate(() => voltarInicio());
  ok("voltar devolve a tela inicial",
    await p.$eval("#menu", e => getComputedStyle(e).display !== "none"));
  ok("e esvazia a pilha", (await p.evaluate(() => pilha.length)) === 0);
});

// A mesma conta de data que o app faz, do lado de fora: o teste não pode
// chamar dataBR(), que mora dentro da página.
function dataBR(ymd) {
  const [a, m, d] = String(ymd).split("-");
  return `${d}/${m}/${a}`;
}
