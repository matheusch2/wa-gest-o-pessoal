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
let metas = [];
let fechamentos = [];
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

// Só o nome do mês, minúsculo: "outubro". Cabe onde "Outubro de 2026"
// não cabe — no meio de uma frase, num botão, numa linha de lista.
function soNomeDoMes(ym) {
  const [a, m] = String(ym).split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
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

// Rede de celular não avisa que caiu: ela simplesmente para de responder, e
// a promessa fica pendurada pra sempre. Sem este prazo, "não carregou" vira
// uma tela girando sem fim, sem nem um botão pra tentar de novo.
const _PRAZO_CARGA = 20000;

function _comPrazo(promessa) {
  return Promise.race([
    promessa,
    new Promise(resolve => setTimeout(
      () => resolve({ data: null, error: { message: "A conexão demorou demais.", _prazo: true } }),
      _PRAZO_CARGA)),
  ]);
}

/* ═══ QUANDO O SERVIDOR RECUSA O CRACHÁ ═══════════════════════════════
   "JWT issued at future" quer dizer: o crachá da sessão diz ter sido
   emitido num horário que, pro servidor, ainda não chegou. Ninguém
   entende isso lendo, e a pessoa acha que o app quebrou.

   Duas causas, e o app trata as duas. A primeira é o crachá velho ou
   torto guardado no aparelho: pedir um novo resolve, e resolve calado.
   A segunda é o relógio do próprio aparelho estar fora da hora — aí não
   tem crachá que sirva, e o que ajuda é DIZER isso, com o tamanho do
   atraso medido, em vez de repetir a frase em inglês. */

let ultimoErroCarga = null;

function ehErroDeCracha(msg) {
  return /issued at future|bad_?jwt|invalid (jwt|claim)|token is expired|JWT expired/i.test(msg || "");
}

function mensagemDoErro(e) {
  const m = e?.message || "";
  if (e?._prazo) return m;
  if (/relation .* does not exist/i.test(m)) return "As tabelas ainda não existem. Rode o banco.sql no Supabase.";
  if (/issued at future/i.test(m)) return "O relógio deste aparelho está fora da hora.";
  if (/expired/i.test(m)) return "Sua sessão expirou. Entre de novo.";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Sem conexão com o servidor.";
  return "Erro ao carregar: " + m;
}

// Compara o relógio do aparelho com o do servidor. O horário vem no
// cabeçalho "Date" de qualquer resposta — e metade da ida-e-volta é
// descontada, senão uma internet lenta apareceria como relógio errado.
// Positivo = o aparelho está ADIANTADO.
async function medirRelogio() {
  try {
    const antes = Date.now();
    const r = await fetch(SUPABASE_URL + "/auth/v1/health", {
      headers: { apikey: SUPABASE_KEY }, cache: "no-store",
    });
    const cabecalho = r.headers.get("date");
    if (!cabecalho) return null;
    const meio = antes + (Date.now() - antes) / 2;
    return Math.round((meio - new Date(cabecalho).getTime()) / 1000);
  } catch (e) { return null; }
}

async function carregarTudo(jaPediuCrachaNovo) {
  const [rL, rC, rG, rCa, rCo, rFp, rMe, rFe] = (await Promise.all([
    sb.from("lancamentos").select("*").order("data", { ascending: false }),
    sb.from("contas").select("*").order("vencimento", { ascending: true }),
    sb.from("categorias").select("*").order("nome", { ascending: true }),
    sb.from("cartoes").select("*").order("nome", { ascending: true }),
    sb.from("compras_cartao").select("*").order("data", { ascending: false }),
    sb.from("pagamentos_fatura").select("*").order("pago_em", { ascending: true }),
    sb.from("metas").select("*").order("categoria", { ascending: true }),
    sb.from("fechamentos").select("*").order("mes_ref", { ascending: true }),
  ].map(_comPrazo)));

  const respostas = [rL, rC, rG, rCa, rCo, rFp, rMe, rFe];
  if (respostas.some(r => r.error)) {
    const e = respostas.find(r => r.error).error;
    ultimoErroCarga = e;

    // Crachá recusado: pede um novo e tenta mais UMA vez. Quando o
    // problema é o token guardado, isso conserta sem a pessoa ver nada.
    // A trava do "jaPediu" existe pra não virar laço infinito quando o
    // problema for o relógio — aí nenhum crachá novo vai servir.
    if (!jaPediuCrachaNovo && ehErroDeCracha(e.message)) {
      const { error: erroTroca } = await sb.auth.refreshSession();
      if (!erroTroca) return carregarTudo(true);
    }

    erro(mensagemDoErro(e));
    return false;
  }

  ultimoErroCarga = null;

  lancamentos = rL.data || [];
  contas = rC.data || [];
  categorias = rG.data || [];
  cartoes = rCa.data || [];
  comprasCartao = rCo.data || [];
  pagamentosFatura = rFp.data || [];
  metas = rMe.data || [];
  fechamentos = rFe.data || [];

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

/* ═══ O GRÁFICO CHEGA DEPOIS ══════════════════════════════════════════
   A biblioteca do gráfico pesa mais que o app inteiro e serve a UMA rosca,
   numa tela só. Carregada no <head>, todo mundo esperava por ela pra ver a
   tela de login. Agora ela só é buscada quando o Resumo abre, e a rosca
   aparece um instante depois do resto — que é a ordem certa: o número já
   está na tela, o desenho dele é o extra. */

let _promessaChart = null;

function carregarChart() {
  if (typeof Chart !== "undefined") return Promise.resolve(true);
  if (_promessaChart) return _promessaChart;
  _promessaChart = new Promise(resolve => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    s.onload = () => resolve(true);
    // Falhou o download? A tela continua inteira: só a rosca não aparece.
    s.onerror = () => { _promessaChart = null; resolve(false); };
    document.head.appendChild(s);
  });
  return _promessaChart;
}

/* ═══ O QUE AINDA VAI SAIR ════════════════════════════════════════════
   O saldo do mês, sozinho, mente por otimismo: dia 5 ele mostra dinheiro
   que já tem dono — a internet que vence dia 20, o mercado que ainda
   falta fazer. Quem olha esse número e acha que pode gastar, gasta o
   dinheiro da conta de luz.

   Então o Resumo reserva o que ainda tem que sair. Vem de dois lugares:

   1. Contas a pagar não pagas com vencimento no mês. É dívida com nome,
      data e valor — reserva o valor inteiro.

   2. Metas marcadas com "reservar". Aí o que se reserva é o que FALTA
      pro previsto, não o previsto todo: gastou R$ 640 dos R$ 800 de
      mercado, só R$ 160 ainda vão sair. Os 640 já estão nas saídas, e
      contar de novo seria descontar duas vezes o mesmo dinheiro.

   E a mesma internet não pode ser reservada duas vezes por estar na
   conta a pagar E dentro da meta da categoria dela — por isso a reserva
   da meta desconta também as contas em aberto daquela categoria.

   Depois de pago, nada disso sobra: pagar uma conta a marca como paga E
   vira saída no extrato, e a saída derruba o que faltava da meta. */

function reservasDoMes(mesRef) {
  // Mês que já acabou não reserva nada. Reservar é dizer "isto ainda vai
  // sair", e num mês fechado nada mais vai sair dele: as contas ou foram
  // pagas ou estão vencidas, e vencida aparece no alerta de vencidas, não
  // aqui. Sem esta linha, agosto mostrava "sobra −R$ 200" no topo e
  // "sobraram R$ 257" no botão de fechar — dois números pra mesma palavra,
  // na mesma tela.
  if (mesRef < mesDe(_hojeLocal())) return { linhas: [], total: 0 };

  const linhas = [];

  for (const c of contas) {
    if (c.pago || mesDe(c.vencimento) !== mesRef) continue;
    linhas.push({
      tipo: "conta", nome: c.nome, categoria: c.categoria || "",
      previsto: Number(c.valor), gasto: 0, falta: Number(c.valor),
      vencimento: c.vencimento,
    });
  }

  // Só o que JÁ SAIU DA CONTA conta aqui. Compra no cartão não entrou
  // nesta soma de propósito: ela ainda não tocou o extrato, e o saldo que
  // estamos corrigindo é o do extrato.
  const jaSaiu = {};
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || mesDe(l.data) !== mesRef) continue;
    jaSaiu[l.categoria] = (jaSaiu[l.categoria] || 0) + Number(l.valor);
  }

  for (const m of metas) {
    if (!m.reservar) continue;
    const previsto = Number(m.valor);
    const gasto = jaSaiu[m.categoria] || 0;
    const emContas = linhas
      .filter(x => x.tipo === "conta" && x.categoria === m.categoria)
      .reduce((s, x) => s + x.falta, 0);
    const falta = Math.round(Math.max(0, previsto - gasto - emContas) * 100) / 100;
    if (falta < 0.005) continue;
    linhas.push({ tipo: "meta", nome: m.categoria, categoria: m.categoria, previsto, gasto, falta });
  }

  linhas.sort((a, b) => b.falta - a.falta);
  return { linhas, total: Math.round(linhas.reduce((s, x) => s + x.falta, 0) * 100) / 100 };
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
