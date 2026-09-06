/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 *
 * Site de uma página só: nada aqui navega para outro arquivo. Cada tela é
 * desenhada dentro de #area, e o "Voltar" desmonta e volta ao menu.
 */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuario = null;
let lancamentos = [];
let contas = [];
let categorias = [];
let cartoes = [];
let comprasCartao = [];
let pagamentosFatura = [];
let mesAtual = "";   // "2026-08" — mês que o Resumo e o Histórico estão mostrando
let grafico = null;

/* ═══ NÚMEROS E DATAS ══════════════════════════════════════════════════
   Duas armadilhas que já custaram caro em sistema brasileiro:

   1. parseFloat("1.234,56") devolve 1.234 — engole o milhar e o centavo.
      Aqui a vírgula é SEMPRE decimal.
   2. new Date().toISOString() devolve a data em UTC. Depois das 21h no
      Brasil isso já é o DIA SEGUINTE, e o lançamento cai no dia errado.
      Por isso a data de hoje é montada à mão, no fuso do aparelho.
═══════════════════════════════════════════════════════════════════════ */

function parseMoedaBR(txt) {
  if (txt === null || txt === undefined) return null;
  let s = String(txt).trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!s) return null;
  if (s.includes(",")) {
    // Tem vírgula: ela é o decimal, e o ponto é separador de milhar.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    const pontos = (s.match(/\./g) || []).length;
    const depois = s.split(".")[1];
    // "1.234" e "1.234.567" são milhar. "250.75" é decimal — o teclado do
    // celular oferece ponto, e a pessoa quis centavos.
    if (pontos > 1 || (pontos === 1 && depois && depois.length === 3)) {
      s = s.replace(/\./g, "");
    }
  }
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function moeda(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _hojeLocal() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Meio-dia de propósito: às 00:00 o horário de verão pode empurrar a data
// para o dia anterior.
function _parseDataLocal(ymd) {
  const [a, m, d] = String(ymd).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12, 0, 0);
}

function dataBR(ymd) {
  if (!ymd) return "--";
  const [a, m, d] = String(ymd).split("-");
  return `${d}/${m}/${a}`;
}

function mesDe(ymd) { return String(ymd).slice(0, 7); }

function mesPorExtenso(ym) {
  const [a, m] = ym.split("-").map(Number);
  const nome = new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  return nome.charAt(0).toUpperCase() + nome.slice(1) + " de " + a;
}

function mesVizinho(ym, passo) {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(a, m - 1 + passo, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function esc(t) {
  return String(t === null || t === undefined ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ═══ AVISOS E TRAVA DE BOTÃO ═════════════════════════════════════════ */

function avisar(texto, tipo) {
  const caixa = document.getElementById("avisos");
  const div = document.createElement("div");
  div.className = "aviso" + (tipo ? " " + tipo : "");
  div.textContent = texto;
  caixa.appendChild(div);
  setTimeout(() => div.remove(), 3400);
}
const ok = (t) => avisar(t, "ok");
const erro = (t) => avisar(t, "erro");

// Trava o botão enquanto a gravação acontece e devolve a função que destrava.
// Sem isto, dois toques rápidos viram dois lançamentos.
function travar(botao, texto) {
  if (!botao) return () => {};
  const antes = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = texto || "Salvando...";
  return () => { botao.disabled = false; botao.innerHTML = antes; };
}

/* ═══ CARREGAR OS DADOS ═══════════════════════════════════════════════ */

const CATEGORIAS_INICIAIS = {
  saida: ["Mercado", "Casa", "Transporte", "Saúde", "Educação", "Lazer", "Outros"],
  entrada: ["Salário", "Vendas", "Extra", "Outros"],
};

async function carregarTudo() {
  const [rL, rC, rG, rCa, rCo, rFp] = await Promise.all([
    sb.from("lancamentos").select("*").order("data", { ascending: false }),
    sb.from("contas").select("*").order("vencimento", { ascending: true }),
    sb.from("categorias").select("*").order("nome", { ascending: true }),
    sb.from("cartoes").select("*").order("nome", { ascending: true }),
    sb.from("compras_cartao").select("*").order("data", { ascending: false }),
    sb.from("pagamentos_fatura").select("*").order("pago_em", { ascending: true }),
  ]);

  if (rL.error || rC.error || rG.error || rCa.error || rCo.error || rFp.error) {
    const e = rL.error || rC.error || rG.error || rCa.error || rCo.error || rFp.error;
    // Erro típico de quem ainda não rodou o banco.sql.
    if (/relation .* does not exist/i.test(e.message)) {
      erro("As tabelas ainda não existem. Rode o banco.sql no Supabase.");
    } else {
      erro("Erro ao carregar: " + e.message);
    }
    return false;
  }

  lancamentos = rL.data || [];
  contas = rC.data || [];
  categorias = rG.data || [];
  cartoes = rCa.data || [];
  comprasCartao = rCo.data || [];
  pagamentosFatura = rFp.data || [];

  // Primeira vez: semeia as categorias para a pessoa não começar do zero.
  if (!categorias.length) await semearCategorias();
  return true;
}

async function semearCategorias() {
  const novas = [];
  for (const tipo of ["saida", "entrada"]) {
    for (const nome of CATEGORIAS_INICIAIS[tipo]) novas.push({ user_id: usuario.id, nome, tipo });
  }
  const { data, error } = await sb.from("categorias").insert(novas).select();
  if (!error && data) categorias = data;
}

/* ═══ NAVEGAÇÃO ═══════════════════════════════════════════════════════ */

let pilha = [];

function abrirTela(desenhar) {
  document.getElementById("menu").style.display = "none";
  document.getElementById("btn-voltar").style.display = "flex";
  pilha.push(desenhar);
  desenhar();
  window.scrollTo(0, 0);
}

function voltarTela() {
  pilha.pop();
  if (!pilha.length) { voltarInicio(); return; }
  pilha[pilha.length - 1]();
  window.scrollTo(0, 0);
}

function voltarInicio() {
  pilha = [];
  destruirGrafico();
  document.getElementById("area").innerHTML = "";
  document.getElementById("menu").style.display = "grid";
  document.getElementById("btn-voltar").style.display = "none";
  window.scrollTo(0, 0);
}

// O botão "voltar" do celular fecha a tela em vez de sair do site.
window.addEventListener("popstate", () => {
  if (pilha.length) { voltarTela(); history.pushState({ f: 1 }, ""); }
});

function destruirGrafico() {
  if (grafico) { try { grafico.destroy(); } catch (e) {} grafico = null; }
}

/* ═══ DINHEIRO NA DIGITAÇÃO ═══════════════════════════════════════════
   Enquanto a pessoa digita, o campo vai pondo o ponto de milhar e
   guardando a vírgula pros centavos: "250000" aparece como "250.000".
   Sem isso, um valor de seis dígitos vira uma fileira de números que
   ninguém confere de olho — e é dinheiro.

   O ponto digitado vira vírgula. O teclado do celular quase sempre
   oferece ponto no lugar da vírgula, e quem digita "250.75" quer
   R$ 250,75. Se o ponto fosse tratado como milhar aqui, viraria
   R$ 25.075,00 — erro de 100x que passa por qualquer validação de
   "número positivo" e vai pro banco calado. */

function _formatarMoedaDigitando(input, evento) {
  const posicao = input.selectionStart;
  const tamanhoAntes = input.value.length;

  let v = input.value;

  // Só o ponto RECÉM-DIGITADO vira vírgula, e é por isso que o evento é
  // preciso aqui: os outros pontos do campo foram postos por esta função
  // como separador de milhar. Sem essa distinção, ao digitar o quinto
  // dígito de "2.500" o ponto do milhar virava vírgula e R$ 250.000
  // viravam R$ 2,50.
  if (evento?.data === "." && posicao > 0) {
    v = v.slice(0, posicao - 1) + "," + v.slice(posicao);
  }

  // A esta altura todo ponto restante é separador de milhar: sai pra
  // contagem ser refeita do zero logo abaixo.
  v = v.replace(/[^\d,]/g, "");

  const pedacos = v.split(",");
  if (pedacos.length > 2) v = pedacos[0] + "," + pedacos.slice(1).join("");

  let [inteiro, centavos] = v.split(",");
  if (centavos !== undefined) centavos = centavos.slice(0, 2); // dinheiro tem 2 casas
  const inteiroFmt = (inteiro || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  input.value = centavos !== undefined ? inteiroFmt + "," + centavos : inteiroFmt;

  // Devolve o cursor pro lugar: sem isto, cada ponto inserido joga o
  // cursor pro fim e a pessoa digita o resto do número fora de ordem.
  const diferenca = input.value.length - tamanhoAntes;
  try { input.setSelectionRange(posicao + diferenca, posicao + diferenca); } catch (e) {}
}

// Ao sair do campo, escreve por extenso com os centavos: "250" vira
// "250,00". A pessoa confere o valor final antes de salvar.
function formatarMoedaBlur(input) {
  const v = (input.value || "").trim();
  if (!v) return;
  const n = parseMoedaBR(v);
  if (n === null) { input.value = ""; return; }
  input.value = n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _ligarFormatacaoMoeda(input) {
  if (input._moedaLigada) return;
  input._moedaLigada = true;
  input.addEventListener("input", (e) => _formatarMoedaDigitando(input, e));
  input.addEventListener("blur", () => formatarMoedaBlur(input));
}

// As telas são desenhadas com innerHTML, então os campos nascem depois que
// a página carregou. O observador liga a formatação em cada campo de
// dinheiro que aparece — assim nenhuma tela nova precisa lembrar disso.
(function observarCamposDeMoeda() {
  const SELETOR = 'input[type="text"][inputmode="decimal"]';
  const observador = new MutationObserver(mudancas => {
    for (const m of mudancas) {
      for (const no of m.addedNodes) {
        if (no.nodeType !== 1) continue;
        if (no.matches?.(SELETOR)) _ligarFormatacaoMoeda(no);
        no.querySelectorAll?.(SELETOR).forEach(_ligarFormatacaoMoeda);
      }
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(SELETOR).forEach(_ligarFormatacaoMoeda);
    observador.observe(document.body, { childList: true, subtree: true });
  });
})();
