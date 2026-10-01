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
          // Devolve a linha como o banco devolveria: o que existia, com o
          // que foi mandado por cima. Sem isso, um update que a tela relê
          // em seguida enxergaria um objeto vazio.
          //
          // As globais do app são 'let' de script clássico: elas NÃO viram
          // propriedade de window, então são lidas pelo nome mesmo — e
          // dentro de um try, porque este código é definido antes de o
          // core.js rodar.
          let base = {};
          try {
            const alvo = q._eq.find(e => e[0] === "id");
            if (alvo) {
              for (const lista of [comprasCartao, contas, lancamentos, metas, cartoes]) {
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
  const texto = (sel) => p.textContent(sel).then(t => (t || "").replace(/\s+/g, " ").trim());
  // "R$ 1.234,56" vira 1234.56 — a mesma armadilha do parseMoedaBR, do
  // lado de fora: parseFloat engoliria o milhar.
  const valor = (t) => Number(String(t).replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", "."));

  console.log("\n── " + nome);
  try {
    await corpo({ p, ok, abrir, chamadas, texto, valor, temChart: TEM_CHART });
  } catch (e) {
    falhou++;
    console.log("FALHOU  a suíte quebrou: " + e.message);
  }

  ok("nenhum erro de JavaScript na página", erros.length === 0);
  await navegador.close();
  return { nome, total, falhou };
}

module.exports = { suite, RAIZ, TEM_CHART };
