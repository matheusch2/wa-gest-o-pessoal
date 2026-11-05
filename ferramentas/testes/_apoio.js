/* O que toda suíte de teste do WA Finanças precisa, num lugar só.
 *
 * As telas do app são desenhadas por innerHTML e os dados moram em
 * variáveis globais. Isso faz o teste ser simples de um jeito raro: abre
 * a página montada, troca as globais pelo cenário, chama a função que
 * desenha, e lê o que apareceu. Sem servidor, sem build, sem mock de
 * framework.
 *
 * O SUPABASE DE MENTIRA grava o que foi pedido em vez de mandar pra rede.
 * É assim que se confere que "cancelar assinatura" faz um UPDATE e não um
 * DELETE — a diferença entre respeitar as faturas pagas e reescrevê-las
 * não aparece na tela, só na chamada ao banco.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RAIZ = path.resolve(__dirname, "..", "..");
const COMO_ABRIR = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};

// A biblioteca do gráfico vem de um CDN em produção. Nos testes ela entra
// por um arquivo local — e o teste de que a tela sobrevive SEM ela é
// justamente não injetar nada. Sem a biblioteca instalada, as conferências
// que dependem dela se declaram puladas em vez de reprovarem à toa.
//
// O caminho é achado de lado porque o chart.js tranca os subcaminhos no
// "exports" do package.json: pedir "chart.js/dist/chart.umd.js", ou até
// "chart.js/package.json", dá ERR_PACKAGE_PATH_NOT_EXPORTED. O que passa é
// o nome puro — ele cai no dist/, e o UMD é o vizinho dele. E é o UMD que
// a gente quer: é o mesmo build que o app baixa do CDN.
let CHART = null;
try {
  CHART = path.join(path.dirname(require.resolve("chart.js")), "chart.umd.js");
  if (!fs.existsSync(CHART)) CHART = null;
} catch (e) { CHART = null; }
const TEM_CHART = !!CHART;

/* A página montada, com o Supabase trocado por um que anota as chamadas. */
function montarPaginaComBanco() {
  const origem = path.join(RAIZ, "_audit.html");
  if (!fs.existsSync(origem)) {
    throw new Error("Rode antes: node ferramentas/montar-pagina-de-teste.js");
  }
  const html = fs.readFileSync(origem, "utf8").replace(
    "const supabase = { createClient: () => ({ from: () => ({}) }) };", `
    window.CHAMADAS = [];
    const supabase = { createClient: () => ({
      from(t) {
        const q = { _t: t, _op: null, _dados: null, _eq: [], _in: null };
        q.insert = (d) => { q._op = "insert"; q._dados = d; return q; };
        q.update = (d) => { q._op = "update"; q._dados = d; return q; };
        q.delete = () => { q._op = "delete"; return q; };
        q.select = () => q; q.order = () => q;
        q.eq = (c, v) => { q._eq.push([c, v]); return q; };
        q.in = (c, v) => { q._in = [c, v]; return q; };
        q.single = () => q.then();
        q.then = (fn) => {
          window.CHAMADAS.push({ tabela: q._t, op: q._op, dados: q._dados, eq: q._eq, dentro: q._in });

          /* O BANCO TAMBÉM PRECISA SABER DIZER NÃO. Metade do cuidado
             deste app está no que acontece quando a gravação falha —
             nome repetido, lançamento em dobro, fatura já quitada. Sem
             um jeito de forçar o erro, o teste do caminho ruim passava
             pelo caminho bom e dizia que estava tudo certo.

             Foi assim que uma conferência daqui passou com o código
             quebrado de propósito: ela nunca chegava no erro. */
          /* TABELA QUE NÃO EXISTE NO BANCO DAQUELE USUÁRIO. É o estrago
             que as Reservas causaram de verdade: duas tabelas novas, e
             quem não tinha rodado o banco.sql viu o app INTEIRO recusar
             carregar. Aqui a tabela some só pra quem for nomeada, que é
             exatamente o que acontece lá fora. */
          if ((window.TABELAS_SEM_BANCO || []).includes(q._t)) {
            const r = { data: null, error: {
              code: "PGRST205",
              message: "Could not find the table 'public." + q._t + "' in the schema cache",
            } };
            return fn ? Promise.resolve(r).then(fn) : Promise.resolve(r);
          }

          if (window.PROXIMO_ERRO) {
            // '_pular' deixa o erro cair na SEGUNDA (ou terceira) gravação,
            // não na primeira. É o que permite conferir o desfazer: guardar
            // na reserva grava um lançamento e depois o movimento, e o que
            // tem que ser testado é o lançamento sendo apagado quando o
            // movimento falha. Sem isto, o erro só chegava no primeiro
            // passo, onde não há nada pra desfazer.
            if (window.PROXIMO_ERRO._pular > 0) {
              window.PROXIMO_ERRO._pular--;
            } else {
              const e = window.PROXIMO_ERRO;
              window.PROXIMO_ERRO = null;
              const r = { data: null, error: e };
              return fn ? Promise.resolve(r).then(fn) : Promise.resolve(r);
            }
          }
          // Devolve a linha como o banco devolveria: o que existia, com o
          // que foi mandado por cima. Sem isso, um update que a tela relê
          // em seguida enxergaria um objeto vazio.
          //
          // As globais do app são 'let' de script clássico: elas NÃO viram
          // propriedade de window, então são lidas pelo nome mesmo — e
          // dentro de um try, porque este código é definido antes de o
          // core.js rodar.
          /* LEITURA PURA devolve LISTA. Sem insert, update nem delete, o
             que o app está fazendo é carregar — e carregar devolve linhas,
             não um objeto. Devolver a própria global daquela tabela faz o
             carregarTudo() dar uma volta de verdade no teste, com o
             cenário intacto do outro lado. */
          if (q._op === null) {
            const globais = {
              lancamentos: () => lancamentos, contas: () => contas,
              categorias: () => categorias, cartoes: () => cartoes,
              compras_cartao: () => comprasCartao,
              pagamentos_fatura: () => pagamentosFatura,
              metas: () => metas, fechamentos: () => fechamentos,
              entradas_fixas: () => entradasFixas,
              reservas: () => reservas,
              movimentos_reserva: () => movimentosReserva,
            };
            let linhas = [];
            try { linhas = (globais[q._t] ? globais[q._t]() : []) || []; } catch (e) {}
            const r = { data: linhas, error: null };
            return fn ? Promise.resolve(r).then(fn) : Promise.resolve(r);
          }

          let base = {};
          try {
            const alvo = q._eq.find(e => e[0] === "id");
            if (alvo) {
              for (const lista of [comprasCartao, contas, lancamentos, metas,
                                   cartoes, reservas, movimentosReserva]) {
                const achou = (lista || []).find(x => x.id === alvo[1]);
                if (achou) { base = achou; break; }
              }
            }
          } catch (e) {}
          const um = (d, i) => Object.assign({ id: "novo-" + i }, base, d);
          const r = { data: Array.isArray(q._dados) ? q._dados.map(um) : um(q._dados || {}, 0), error: null };
          return fn ? Promise.resolve(r).then(fn) : Promise.resolve(r);
        };
        return q;
      }
    }) };`);

  const destino = path.join(RAIZ, "_teste.html");
  fs.writeFileSync(destino, html);
  return destino;
}

/* Um teste: nome, e uma função que recebe as ferramentas e escreve. */
async function suite(nome, corpo) {
  const pagina = montarPaginaComBanco();
  const navegador = await chromium.launch(COMO_ABRIR);
  const p = await navegador.newPage({ viewport: { width: 390, height: 2400 } });

  // Os dois erros que a página de teste sempre dá (não há sessão nem CDN)
  // ficam de fora; qualquer outro é defeito e tem que aparecer.
  const erros = [];
  p.on("pageerror", e => {
    if (/onAuthStateChange|getSession/.test(e.message)) return;
    erros.push(e.message);
    console.log("  ERRO JS:", e.message);
  });

  let falhou = 0, total = 0;
  const ok = (texto, condicao) => {
    total++;
    if (!condicao) falhou++;
    console.log((condicao ? "  ok  " : "FALHOU") + "  " + texto);
  };

  /* Abre a tela do zero com um cenário. Do zero SEMPRE: teste que herda o
     estado do anterior passa por motivo errado e falha por motivo errado.

     `cenario` é texto, não função, porque ele roda DENTRO da página, onde
     as globais do app existem. */
  const abrir = async (cenario, opcoes = {}) => {
    await p.goto("file://" + pagina);
    await p.waitForFunction("window.__pronto === true");
    if (opcoes.grafico && TEM_CHART) await p.addScriptTag({ path: CHART });
    if (cenario) await p.evaluate(cenario);
    await p.evaluate(() => { window.CHAMADAS = []; });
    if (opcoes.grafico && TEM_CHART) await p.waitForTimeout(400);
  };

  const chamadas = () => p.evaluate(() => window.CHAMADAS);
  // A próxima gravação falha com este erro. Use o code de verdade do
  // Postgres: 23505 é índice único violado.
  // 'pular' adia o erro: falharProxima("x", "y", 1) deixa a primeira
  // gravação passar e derruba a segunda.
  const falharProxima = (code, message, pular) =>
    p.evaluate(e => { window.PROXIMO_ERRO = e; },
      { code, message: message || "duplicate key", _pular: pular || 0 });
  const texto = (sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
  // "R$ 1.234,56" vira 1234.56 — a mesma armadilha do parseMoedaBR, do
  // lado de fora: parseFloat engoliria o milhar.
  const valor = (t) => Number(String(t).replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", "."));

  console.log("\n── " + nome);
  try {
    await corpo({ p, ok, abrir, chamadas, texto, valor, falharProxima, temChart: TEM_CHART });
  } catch (e) {
    falhou++;
    console.log("FALHOU  a suíte quebrou: " + e.message);
  }

  ok("nenhum erro de JavaScript na página", erros.length === 0);
  await navegador.close();
  return { nome, total, falhou };
}

module.exports = { suite, RAIZ, TEM_CHART };
