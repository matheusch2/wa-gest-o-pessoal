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

/* ═══ ENTRADA (login) ═════════════════════════════════════════════════ */

const ICO_EMAIL = `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;
const ICO_CADEADO = `<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const ICO_PESSOA = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>`;
const ICO_OLHO_ABERTO = `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICO_OLHO_FECHADO = `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.4 20.4 0 0 1 4.22-5.06M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a20.4 20.4 0 0 1-2.16 2.94M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ICO_ENTRAR = `<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
const ICO_PESSOA_MAIS = `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>`;

function alternarSenha(id, botao) {
  const input = document.getElementById(id);
  if (!input) return;
  const vaiMostrar = input.type === "password";
  input.type = vaiMostrar ? "text" : "password";
  botao.innerHTML = vaiMostrar ? ICO_OLHO_FECHADO : ICO_OLHO_ABERTO;
  botao.setAttribute("aria-label", vaiMostrar ? "Esconder senha" : "Mostrar senha");
}

function telaLogin(modo) {
  document.getElementById("topo").style.display = "none";
  document.getElementById("menu").style.display = "none";
  document.getElementById("area").innerHTML = "";
  const area = document.getElementById("area-login");
  area.style.display = "block";

  const titulos = { entrar: "ENTRAR", criar: "CRIAR CONTA", esqueci: "RECUPERAR", nova: "NOVA SENHA" };
  const subtitulos = {
    entrar: "Bem-vindo de volta!",
    criar: "Leva menos de um minuto",
    esqueci: "Enviamos um link para o seu e-mail",
    nova: "Escolha uma senha nova",
  };

  const campoSenha = (id, rotulo) => `
    <div class="campo">
      <label>${rotulo}</label>
      <div class="campo-icone">
        ${ICO_CADEADO}
        <input type="password" id="${id}" class="tem-olho" placeholder="Mínimo de 6 caracteres" autocomplete="current-password">
        <button type="button" class="olho-senha" onclick="alternarSenha('${id}', this)" aria-label="Mostrar senha">${ICO_OLHO_ABERTO}</button>
      </div>
    </div>`;

  const campoEmail = () => `
    <div class="campo">
      <label>E-mail</label>
      <div class="campo-icone">
        ${ICO_EMAIL}
        <input type="email" id="email" placeholder="seu e-mail" autocomplete="email">
      </div>
    </div>`;

  let corpo = "";
  if (modo === "nova") {
    corpo = `
      ${campoSenha("senha1", "Nova senha")}
      ${campoSenha("senha2", "Repita a nova senha")}
      <button class="botao" onclick="salvarNovaSenha(this)">${ICO_ENTRAR}Salvar senha</button>`;
  } else if (modo === "esqueci") {
    corpo = `
      ${campoEmail()}
      <button class="botao" onclick="recuperar(this)">${ICO_ENTRAR}Enviar link</button>
      <div class="login-troca">Lembrou? <button onclick="telaLogin('entrar')">Entrar</button></div>`;
  } else {
    corpo = `
      ${modo === "criar" ? `
      <div class="campo">
        <label>Seu nome</label>
        <div class="campo-icone">
          ${ICO_PESSOA}
          <input type="text" id="nome" placeholder="Como quer ser chamado" autocomplete="name">
        </div>
      </div>` : ""}
      ${campoEmail()}
      ${campoSenha("senha", "Senha")}
      <button class="botao" onclick="${modo === "criar" ? "criarConta(this)" : "entrar(this)"}">
        ${ICO_ENTRAR}${modo === "criar" ? "Criar minha conta" : "Entrar"}
      </button>
      ${modo === "entrar" ? `<button class="link-esqueci" onclick="telaLogin('esqueci')">Esqueci minha senha</button>` : ""}
      ${modo === "criar"
        ? `<div class="login-troca">Já tem conta? <button onclick="telaLogin('entrar')">Entrar</button></div>`
        : `<div class="login-divisor">Não tem uma conta?</div>
           <button class="botao-fraco" onclick="telaLogin('criar')">${ICO_PESSOA_MAIS}Criar conta</button>`}`;
  }

  area.innerHTML = `
    <div class="login-tela">
      <div class="login-logo"><img src="assets/logo.webp" alt="WA Finanças"></div>
      <h2 class="login-titulo">${titulos[modo]}</h2>
      <p class="login-subtitulo">${subtitulos[modo]}</p>
      <div class="login">
        <div class="login-msg" id="login-msg"></div>
        ${corpo}
      </div>
    </div>`;

  // Enter envia o formulário — no celular é o botão "ir" do teclado.
  area.querySelectorAll("input").forEach(i => {
    i.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); area.querySelector(".botao")?.click(); }
    });
  });
}

function msgLogin(texto, tipo) {
  const el = document.getElementById("login-msg");
  if (!el) return;
  el.textContent = texto;
  el.style.display = "block";
  el.style.color = tipo === "ok" ? "#059669" : "#dc2626";
}

async function entrar(botao) {
  if (botao?.disabled) return;
  const email = (document.getElementById("email")?.value || "").trim();
  const senha = document.getElementById("senha")?.value || "";
  if (!email || !senha) { msgLogin("Preencha e-mail e senha."); return; }

  const solta = travar(botao, "Entrando...");
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    solta();
    // A mensagem do Supabase vem em inglês; traduz as duas mais comuns.
    msgLogin(/invalid login/i.test(error.message) ? "E-mail ou senha incorretos."
           : /email not confirmed/i.test(error.message) ? "Confirme seu e-mail antes de entrar."
           : error.message);
    return;
  }
  await iniciarSessao();
}

async function criarConta(botao) {
  if (botao?.disabled) return;
  const nome = (document.getElementById("nome")?.value || "").trim();
  const email = (document.getElementById("email")?.value || "").trim();
  const senha = document.getElementById("senha")?.value || "";
  if (!nome) { msgLogin("Diga como quer ser chamado."); return; }
  if (!email) { msgLogin("Informe seu e-mail."); return; }
  if (senha.length < 6) { msgLogin("A senha precisa ter pelo menos 6 caracteres."); return; }

  const solta = travar(botao, "Criando...");
  const { data, error } = await sb.auth.signUp({
    email, password: senha, options: { data: { nome } },
  });
  if (error) { solta(); msgLogin(error.message); return; }

  // Com "Confirm email" ligado no Supabase, a sessão vem vazia e a pessoa
  // precisa clicar no link do e-mail. Sem ele, já entra direto.
  if (!data.session) {
    solta();
    msgLogin("Conta criada! Confirme pelo link que enviamos ao seu e-mail.", "ok");
    return;
  }
  await iniciarSessao();
}

async function recuperar(botao) {
  if (botao?.disabled) return;
  const email = (document.getElementById("email")?.value || "").trim();
  if (!email) { msgLogin("Informe seu e-mail."); return; }
  const solta = travar(botao, "Enviando...");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split("#")[0] });
  solta();
  if (error) { msgLogin(error.message); return; }
  msgLogin("Link enviado. Confira sua caixa de entrada.", "ok");
}

async function salvarNovaSenha(botao) {
  if (botao?.disabled) return;
  const a = document.getElementById("senha1")?.value || "";
  const b = document.getElementById("senha2")?.value || "";
  if (a.length < 6) { msgLogin("A senha precisa ter pelo menos 6 caracteres."); return; }
  if (a !== b) { msgLogin("As duas senhas não são iguais."); return; }
  const solta = travar(botao, "Salvando...");
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) { solta(); msgLogin(error.message); return; }
  // Limpa o token da barra de endereço antes de seguir.
  history.replaceState(null, "", window.location.pathname);
  await iniciarSessao();
}

async function sair() {
  await sb.auth.signOut();
  usuario = null; lancamentos = []; contas = []; categorias = [];
  telaLogin("entrar");
}

/* ═══ CARREGAR OS DADOS ═══════════════════════════════════════════════ */

const CATEGORIAS_INICIAIS = {
  saida: ["Mercado", "Casa", "Transporte", "Saúde", "Educação", "Lazer", "Outros"],
  entrada: ["Salário", "Vendas", "Extra", "Outros"],
};

async function carregarTudo() {
  const [rL, rC, rG] = await Promise.all([
    sb.from("lancamentos").select("*").order("data", { ascending: false }),
    sb.from("contas").select("*").order("vencimento", { ascending: true }),
    sb.from("categorias").select("*").order("nome", { ascending: true }),
  ]);

  if (rL.error || rC.error || rG.error) {
    const e = rL.error || rC.error || rG.error;
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

/* ═══ RESUMO DO MÊS ═══════════════════════════════════════════════════ */

function abrirResumo() { abrirTela(desenharResumo); }

function desenharResumo() {
  destruirGrafico();
  const area = document.getElementById("area");
  const doMes = lancamentos.filter(l => mesDe(l.data) === mesAtual);
  const entradas = doMes.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
  const saidas = doMes.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
  const saldo = entradas - saidas;

  // Contas em aberto olham o mês inteiro, não só até hoje.
  const aPagar = contas.filter(c => !c.pago && mesDe(c.vencimento) === mesAtual);
  const totalAPagar = aPagar.reduce((s, c) => s + Number(c.valor), 0);
  const vencidas = contas.filter(c => !c.pago && c.vencimento < _hojeLocal());

  // Gastos por categoria, do maior para o menor — é a pergunta que a
  // pessoa realmente faz: "para onde foi meu dinheiro?"
  const porCat = {};
  doMes.filter(l => l.tipo === "saida").forEach(l => {
    porCat[l.categoria] = (porCat[l.categoria] || 0) + Number(l.valor);
  });
  const ranking = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

  area.innerHTML = `
    <h2 class="titulo">Resumo</h2>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarMes(-1)">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mesAtual)}</strong>
        <button class="pilula" onclick="trocarMes(1)">›</button>
      </div>
    </div>

    <div class="saldo">
      <span>Saldo do mês</span>
      <strong>${moeda(saldo)}</strong>
      <small>${saldo >= 0 ? "Você fechou no positivo" : "As saídas passaram as entradas"}</small>
    </div>

    <div class="numeros">
      <div class="numero entrada"><span>Entrou</span><strong>${moeda(entradas)}</strong></div>
      <div class="numero saida"><span>Saiu</span><strong>${moeda(saidas)}</strong></div>
    </div>

    ${vencidas.length ? `
      <div class="item vencida" onclick="abrirContas()" style="margin-bottom:12px;cursor:pointer">
        <div class="item-icone">⚠️</div>
        <div class="item-txt">
          <strong>${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}</strong>
          <small>${esc(vencidas.map(c => c.nome).join(", "))}</small>
        </div>
        <span class="item-x">›</span>
      </div>` : ""}

    ${aPagar.length ? `
      <div class="bloco">
        <div class="bloco-topo">
          <h2>Ainda a pagar neste mês</h2>
          <strong style="color:var(--saida)">${moeda(totalAPagar)}</strong>
        </div>
        <div class="lista">
          ${aPagar.slice(0, 4).map(c => `
            <div class="item" onclick="abrirContas()" style="cursor:pointer">
              <div class="item-icone">📄</div>
              <div class="item-txt"><strong>${esc(c.nome)}</strong><small>vence ${dataBR(c.vencimento)}</small></div>
              <span class="item-valor saida">${moeda(c.valor)}</span>
            </div>`).join("")}
        </div>
        ${aPagar.length > 4 ? `<button class="botao-fraco" onclick="abrirContas()">Ver todas as ${aPagar.length}</button>` : ""}
      </div>` : ""}

    <div class="bloco">
      <div class="bloco-topo"><h2>Para onde foi o dinheiro</h2></div>
      ${ranking.length ? `
        <div class="grafico"><canvas id="canvas-cat"></canvas></div>
        <div class="lista" style="margin-top:14px">
          ${ranking.slice(0, 6).map(([cat, v]) => `
            <div class="item">
              <div class="item-icone">${saidas > 0 ? Math.round(v / saidas * 100) + "%" : "--"}</div>
              <div class="item-txt"><strong>${esc(cat)}</strong></div>
              <span class="item-valor saida">${moeda(v)}</span>
            </div>`).join("")}
        </div>` : `<p class="vazio">Nenhuma saída lançada neste mês.</p>`}
    </div>

    <div class="bloco">
      <div class="bloco-topo"><h2>Últimos lançamentos</h2></div>
      ${doMes.length ? `<div class="lista">${doMes.slice(0, 5).map(linhaLancamento).join("")}</div>
        <button class="botao-fraco" onclick="abrirHistorico()">Ver o histórico completo</button>`
        : `<p class="vazio">Nada lançado neste mês ainda.</p>`}
    </div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;

  if (ranking.length) setTimeout(() => desenharGraficoCategorias(ranking), 0);
}

function trocarMes(passo) {
  mesAtual = mesVizinho(mesAtual, passo);
  desenharResumo();
}

function desenharGraficoCategorias(ranking) {
  const cv = document.getElementById("canvas-cat");
  if (!cv || typeof Chart === "undefined") return;
  destruirGrafico();
  // A primeira fatia é a maior, então ela ganha o verde-petróleo da marca. As
  // seguintes se afastam no tom para não virar um borrão só.
  const cores = ["#0f3b5c", "#c9992e", "#0ea5e9", "#db2777", "#8b5cf6", "#14b8a6", "#64748b"];
  const top = ranking.slice(0, 6);
  const resto = ranking.slice(6).reduce((s, r) => s + r[1], 0);
  const nomes = top.map(r => r[0]).concat(resto > 0 ? ["Outros"] : []);
  const vals = top.map(r => r[1]).concat(resto > 0 ? [resto] : []);

  grafico = new Chart(cv.getContext("2d"), {
    type: "doughnut",
    data: { labels: nomes, datasets: [{ data: vals, backgroundColor: cores, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: (c) => c.label + ": " + moeda(c.parsed) } },
      },
    },
  });
}

function linhaLancamento(l) {
  const entrada = l.tipo === "entrada";
  return `
    <div class="item">
      <div class="item-icone">${entrada ? "↑" : "↓"}</div>
      <div class="item-txt">
        <strong>${esc(l.descricao || l.categoria)}</strong>
        <small>${esc(l.categoria)} · ${dataBR(l.data)}</small>
      </div>
      <span class="item-valor ${entrada ? "entrada" : "saida"}">${entrada ? "+" : "−"} ${moeda(l.valor)}</span>
    </div>`;
}

/* ═══ LANÇAR ══════════════════════════════════════════════════════════ */

function abrirLancar(tipo) { abrirTela(() => desenharLancar(tipo)); }

function desenharLancar(tipo) {
  destruirGrafico();
  const entrada = tipo === "entrada";
  const cats = categorias.filter(c => c.tipo === tipo);
  // Uma chave nova por abertura do formulário. É ela que impede o toque duplo
  // de virar dois lançamentos: a segunda gravação bate no índice único.
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  document.getElementById("area").innerHTML = `
    <h2 class="titulo">${entrada ? "Nova entrada" : "Nova saída"}</h2>

    <div class="bloco">
      <div class="campo">
        <label>Valor</label>
        <input type="text" inputmode="decimal" id="lc-valor" placeholder="0,00" autocomplete="off">
      </div>

      <div class="campo">
        <label>Descrição</label>
        <input type="text" id="lc-desc" placeholder="${entrada ? "Ex: salário de agosto" : "Ex: compra do mês"}" autocomplete="off">
      </div>

      <div class="dois">
        <div class="campo">
          <label>Data</label>
          <input type="date" id="lc-data" value="${_hojeLocal()}">
        </div>
        <div class="campo">
          <label>Categoria</label>
          <select id="lc-cat">
            ${cats.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}
            ${cats.length ? "" : `<option value="Outros">Outros</option>`}
          </select>
        </div>
      </div>

      <button class="botao ${entrada ? "entrada" : "saida"}"
              onclick="salvarLancamento(this, '${tipo}', '${chave}')">
        ${entrada ? "Lançar entrada" : "Lançar saída"}
      </button>
    </div>

    <button class="botao-fraco" onclick="voltarTela()">Voltar</button>
  `;

  document.getElementById("lc-valor").focus();
}

async function salvarLancamento(botao, tipo, chave) {
  if (botao?.disabled) return;

  const valor = parseMoedaBR(document.getElementById("lc-valor").value);
  const descricao = (document.getElementById("lc-desc").value || "").trim();
  const data = document.getElementById("lc-data").value;
  const categoria = document.getElementById("lc-cat").value;

  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!data) { erro("Escolha a data."); return; }

  const solta = travar(botao, "Salvando...");
  const { data: novo, error } = await sb.from("lancamentos").insert({
    user_id: usuario.id, tipo, valor, data, categoria,
    descricao: descricao || null, chave_envio: chave,
  }).select().single();

  if (error) {
    solta();
    // 23505 = índice único. Aqui só acontece por toque duplo, e o primeiro
    // lançamento já entrou — então não é erro para o usuário.
    if (error.code === "23505") { ok("Lançamento já registrado."); voltarInicio(); return; }
    erro("Erro ao salvar: " + error.message);
    return;
  }

  lancamentos.unshift(novo);
  lancamentos.sort((a, b) => b.data.localeCompare(a.data));
  mesAtual = mesDe(data);
  ok(tipo === "entrada" ? "Entrada lançada!" : "Saída lançada!");
  voltarInicio();
}

/* ═══ CONTAS A PAGAR ══════════════════════════════════════════════════ */

function abrirContas() { abrirTela(desenharContas); }

function desenharContas() {
  destruirGrafico();
  const hoje = _hojeLocal();
  const abertas = contas.filter(c => !c.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = contas.filter(c => c.pago).sort((a, b) => b.vencimento.localeCompare(a.vencimento)).slice(0, 10);
  const total = abertas.reduce((s, c) => s + Number(c.valor), 0);

  const linha = (c) => {
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    const estado = c.pago ? "paga" : dias < 0 ? "vencida" : dias <= 5 ? "vencendo" : "";
    const quando = c.pago ? "paga em " + dataBR(c.pago_em || c.vencimento)
                 : dias < 0 ? `venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`
                 : dias === 0 ? "vence hoje"
                 : `vence em ${dias} dia${dias > 1 ? "s" : ""}`;
    return `
      <div class="item ${estado}" id="conta-${c.id}">
        <div class="item-icone">${c.pago ? "✓" : c.recorrente ? "🔁" : "📄"}</div>
        <div class="item-txt">
          <strong>${esc(c.nome)}</strong>
          <small>${quando}${c.categoria ? " · " + esc(c.categoria) : ""}</small>
        </div>
        <span class="item-valor ${c.pago ? "" : "saida"}">${moeda(c.valor)}</span>
        ${c.pago
          ? `<button class="item-x" onclick="pedirExcluirConta('${c.id}')" aria-label="Excluir">×</button>`
          : `<button class="pilula" onclick="pagarConta(this, '${c.id}')">Pagar</button>`}
      </div>`;
  };

  document.getElementById("area").innerHTML = `
    <h2 class="titulo">Contas a pagar</h2>

    <div class="bloco">
      <div class="bloco-topo">
        <h2>Em aberto</h2>
        <strong style="color:var(--saida)">${moeda(total)}</strong>
      </div>
      ${abertas.length ? `<div class="lista">${abertas.map(linha).join("")}</div>`
                       : `<p class="vazio">Nenhuma conta em aberto. 🎉</p>`}
      <button class="botao-fraco" onclick="abrirNovaConta()">+ Nova conta</button>
    </div>

    ${pagas.length ? `
      <div class="bloco">
        <div class="bloco-topo"><h2>Pagas recentemente</h2></div>
        <div class="lista">${pagas.map(linha).join("")}</div>
      </div>` : ""}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

function abrirNovaConta() {
  abrirTela(() => {
    destruirGrafico();
    const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const cats = categorias.filter(c => c.tipo === "saida");
    document.getElementById("area").innerHTML = `
      <h2 class="titulo">Nova conta</h2>
      <div class="bloco">
        <div class="campo">
          <label>Nome da conta</label>
          <input type="text" id="ct-nome" placeholder="Ex: Energia" autocomplete="off">
        </div>
        <div class="dois">
          <div class="campo">
            <label>Valor</label>
            <input type="text" inputmode="decimal" id="ct-valor" placeholder="0,00" autocomplete="off">
          </div>
          <div class="campo">
            <label>Vencimento</label>
            <input type="date" id="ct-venc" value="${_hojeLocal()}">
          </div>
        </div>
        <div class="campo">
          <label>Categoria</label>
          <select id="ct-cat">
            ${cats.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}
            ${cats.length ? "" : `<option value="Outros">Outros</option>`}
          </select>
        </div>
        <div class="campo">
          <label style="display:flex;align-items:center;gap:9px;font-size:14px;color:var(--texto)">
            <input type="checkbox" id="ct-rec" style="width:auto;margin:0">
            Repete todo mês
          </label>
        </div>
        <button class="botao" onclick="salvarConta(this, '${chave}')">Salvar conta</button>
      </div>
      <button class="botao-fraco" onclick="voltarTela()">Voltar</button>`;
    document.getElementById("ct-nome").focus();
  });
}

async function salvarConta(botao, chave) {
  if (botao?.disabled) return;
  const nome = (document.getElementById("ct-nome").value || "").trim();
  const valor = parseMoedaBR(document.getElementById("ct-valor").value);
  const vencimento = document.getElementById("ct-venc").value;
  const categoria = document.getElementById("ct-cat").value;
  const recorrente = document.getElementById("ct-rec").checked;

  if (!nome) { erro("Dê um nome à conta."); return; }
  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!vencimento) { erro("Escolha o vencimento."); return; }

  const solta = travar(botao, "Salvando...");
  const { data, error } = await sb.from("contas").insert({
    user_id: usuario.id, nome, valor, vencimento, categoria, recorrente, chave_envio: chave,
  }).select().single();

  if (error) {
    solta();
    if (error.code === "23505") { ok("Conta já registrada."); voltarTela(); return; }
    erro("Erro ao salvar: " + error.message);
    return;
  }

  contas.push(data);
  ok("Conta cadastrada!");
  voltarTela();
}

async function pagarConta(botao, id) {
  if (botao?.disabled) return;
  const c = contas.find(x => x.id === id);
  if (!c) return;

  const solta = travar(botao, "...");
  const hoje = _hojeLocal();
  const { error } = await sb.from("contas").update({ pago: true, pago_em: hoje }).eq("id", id);
  if (error) { solta(); erro("Erro: " + error.message); return; }

  c.pago = true; c.pago_em = hoje;

  // Pagar uma conta é dinheiro saindo. Sem isto o Resumo mostraria um saldo
  // que não existe — as contas ficariam num mundo à parte do extrato.
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const { data: lanc } = await sb.from("lancamentos").insert({
    user_id: usuario.id, tipo: "saida", valor: c.valor, data: hoje,
    categoria: c.categoria || "Contas", descricao: c.nome, chave_envio: chave,
  }).select().single();
  if (lanc) { lancamentos.unshift(lanc); lancamentos.sort((a, b) => b.data.localeCompare(a.data)); }

  // Conta que repete: já deixa a do mês que vem cadastrada.
  if (c.recorrente) {
    const prox = proximoMesMesmoDia(c.vencimento);
    const { data: nova } = await sb.from("contas").insert({
      user_id: usuario.id, nome: c.nome, valor: c.valor, vencimento: prox,
      categoria: c.categoria, recorrente: true,
      chave_envio: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    }).select().single();
    if (nova) contas.push(nova);
  }

  ok("Conta paga e lançada como saída!");
  desenharContas();
}

// Dia 31 em mês de 30 vira o último dia do mês, e não dia 1º do seguinte.
function proximoMesMesmoDia(ymd) {
  const [a, m, d] = ymd.split("-").map(Number);
  const ultimoDoProximo = new Date(a, m + 1, 0).getDate();
  const dia = Math.min(d, ultimoDoProximo);
  const alvo = new Date(a, m, dia);
  return alvo.getFullYear() + "-" + String(alvo.getMonth() + 1).padStart(2, "0") + "-" + String(alvo.getDate()).padStart(2, "0");
}

function pedirExcluirConta(id) {
  const linha = document.getElementById("conta-" + id);
  if (!linha) return;
  const antes = linha.innerHTML;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%">
      <p>Excluir esta conta? O lançamento de saída continua no histórico.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharContas()">Cancelar</button>
        <button class="sim" onclick="excluirConta(this, '${id}')">Excluir</button>
      </div>
    </div>`;
}

async function excluirConta(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "...");
  const { error } = await sb.from("contas").delete().eq("id", id);
  if (error) { solta(); erro("Erro: " + error.message); return; }
  contas = contas.filter(c => c.id !== id);
  ok("Conta excluída.");
  desenharContas();
}

/* ═══ HISTÓRICO ═══════════════════════════════════════════════════════ */

let filtroTipo = "todos";

function abrirHistorico() { abrirTela(desenharHistorico); }

function desenharHistorico() {
  destruirGrafico();
  let itens = lancamentos.filter(l => mesDe(l.data) === mesAtual);
  if (filtroTipo !== "todos") itens = itens.filter(l => l.tipo === filtroTipo);

  const total = itens.reduce((s, l) => s + (l.tipo === "entrada" ? 1 : -1) * Number(l.valor), 0);

  document.getElementById("area").innerHTML = `
    <h2 class="titulo">Histórico</h2>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarMesHistorico(-1)">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mesAtual)}</strong>
        <button class="pilula" onclick="trocarMesHistorico(1)">›</button>
      </div>
    </div>

    <div class="bloco">
      <div class="pilulas" style="margin-bottom:13px">
        <button class="pilula ${filtroTipo === "todos" ? "ativa" : ""}" onclick="filtrar('todos')">Tudo</button>
        <button class="pilula ${filtroTipo === "entrada" ? "ativa" : ""}" onclick="filtrar('entrada')">Entradas</button>
        <button class="pilula ${filtroTipo === "saida" ? "ativa" : ""}" onclick="filtrar('saida')">Saídas</button>
      </div>

      ${itens.length ? `
        <div class="bloco-topo">
          <h2>${itens.length} lançamento${itens.length > 1 ? "s" : ""}</h2>
          <strong>${moeda(total)}</strong>
        </div>
        <div class="lista">
          ${itens.map(l => `
            <div class="item" id="lanc-${l.id}">
              <div class="item-icone">${l.tipo === "entrada" ? "↑" : "↓"}</div>
              <div class="item-txt">
                <strong>${esc(l.descricao || l.categoria)}</strong>
                <small>${esc(l.categoria)} · ${dataBR(l.data)}</small>
              </div>
              <span class="item-valor ${l.tipo}">${l.tipo === "entrada" ? "+" : "−"} ${moeda(l.valor)}</span>
              <button class="item-x" onclick="pedirExcluirLancamento('${l.id}')" aria-label="Excluir">×</button>
            </div>`).join("")}
        </div>`
      : `<p class="vazio">Nada lançado neste mês${filtroTipo !== "todos" ? " com esse filtro" : ""}.</p>`}
    </div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

function filtrar(t) { filtroTipo = t; desenharHistorico(); }
function trocarMesHistorico(p) { mesAtual = mesVizinho(mesAtual, p); desenharHistorico(); }

function pedirExcluirLancamento(id) {
  const linha = document.getElementById("lanc-" + id);
  if (!linha) return;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%">
      <p>Excluir este lançamento?</p>
      <div class="confirmar-acoes">
        <button onclick="desenharHistorico()">Cancelar</button>
        <button class="sim" onclick="excluirLancamento(this, '${id}')">Excluir</button>
      </div>
    </div>`;
}

async function excluirLancamento(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "...");
  const { error } = await sb.from("lancamentos").delete().eq("id", id);
  if (error) { solta(); erro("Erro: " + error.message); return; }
  lancamentos = lancamentos.filter(l => l.id !== id);
  ok("Lançamento excluído.");
  desenharHistorico();
}

/* ═══ AJUSTES E CATEGORIAS ════════════════════════════════════════════ */

function abrirAjustes() { abrirTela(desenharAjustes); }

function desenharAjustes() {
  destruirGrafico();
  const nome = usuario?.user_metadata?.nome || usuario?.email?.split("@")[0] || "";
  const escuro = document.body.classList.contains("escuro");

  document.getElementById("area").innerHTML = `
    <h2 class="titulo">Ajustes</h2>

    <div class="bloco">
      <div class="item" style="border:none;padding:0">
        <div class="item-icone">${esc((nome[0] || "?").toUpperCase())}</div>
        <div class="item-txt">
          <strong>${esc(nome)}</strong>
          <small>${esc(usuario?.email || "")}</small>
        </div>
      </div>
    </div>

    <div class="bloco">
      <div class="bloco-topo"><h2>Aparência</h2></div>
      <div class="pilulas">
        <button class="pilula ${escuro ? "" : "ativa"}" onclick="trocarTema('claro')">Claro</button>
        <button class="pilula ${escuro ? "ativa" : ""}" onclick="trocarTema('escuro')">Escuro</button>
        <button class="pilula" onclick="trocarTema('auto')">Igual ao celular</button>
      </div>
    </div>

    <div class="bloco">
      <div class="bloco-topo"><h2>Categorias</h2></div>
      <button class="botao-fraco" style="margin:0" onclick="abrirCategorias('saida')">Categorias de saída</button>
      <button class="botao-fraco" onclick="abrirCategorias('entrada')">Categorias de entrada</button>
    </div>

    <div class="bloco">
      <div class="bloco-topo"><h2>Conta</h2></div>
      <button class="botao-fraco" style="margin:0;color:var(--saida);border-color:var(--saida)" onclick="sair()">Sair da conta</button>
    </div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

// O modo escolhido vive aqui, e o localStorage é só onde ele é GUARDADO para
// a próxima visita. Se o navegador bloquear o armazenamento — aba anônima,
// navegador dentro do Instagram, aparelho com dados de site desligados — o
// botão de tema ainda funciona; só não lembra na próxima vez. Amarrar o modo
// ao localStorage fazia o botão não responder a nada nesses aparelhos.
let temaEscolhido = "auto";

function trocarTema(modo) {
  temaEscolhido = modo;
  try { localStorage.setItem("financas-tema", modo); } catch (e) { /* segue sem lembrar */ }
  aplicarTema();
  desenharAjustes();
}

function aplicarTema() {
  const doSistema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const escuro = temaEscolhido === "escuro" || (temaEscolhido === "auto" && doSistema);
  document.body.classList.toggle("escuro", escuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0a2740" : "#0f3b5c");
}

function lembrarTema() {
  try { temaEscolhido = localStorage.getItem("financas-tema") || "auto"; } catch (e) { temaEscolhido = "auto"; }
}

function abrirCategorias(tipo) {
  abrirTela(() => {
    destruirGrafico();
    const cats = categorias.filter(c => c.tipo === tipo);
    document.getElementById("area").innerHTML = `
      <h2 class="titulo">Categorias de ${tipo === "saida" ? "saída" : "entrada"}</h2>
      <div class="bloco">
        <div class="campo" style="margin-bottom:9px">
          <label>Nova categoria</label>
          <input type="text" id="cat-nome" placeholder="Ex: Farmácia" autocomplete="off">
        </div>
        <button class="botao" onclick="salvarCategoria(this, '${tipo}')">Adicionar</button>
      </div>
      <div class="bloco">
        ${cats.length ? `
          <div class="lista">
            ${cats.map(c => `
              <div class="item" id="cat-${c.id}">
                <div class="item-txt"><strong>${esc(c.nome)}</strong>
                  <small>${contarUsos(c.nome, tipo)} lançamento(s)</small></div>
                <button class="item-x" onclick="pedirExcluirCategoria('${c.id}')" aria-label="Excluir">×</button>
              </div>`).join("")}
          </div>` : `<p class="vazio">Nenhuma categoria ainda.</p>`}
      </div>
      <button class="botao-fraco" onclick="voltarTela()">Voltar</button>`;
  });
}

function contarUsos(nome, tipo) {
  return lancamentos.filter(l => l.tipo === tipo && l.categoria === nome).length;
}

async function salvarCategoria(botao, tipo) {
  if (botao?.disabled) return;
  const nome = (document.getElementById("cat-nome").value || "").trim();
  if (!nome) { erro("Escreva o nome da categoria."); return; }

  const solta = travar(botao, "Salvando...");
  const { data, error } = await sb.from("categorias")
    .insert({ user_id: usuario.id, nome, tipo }).select().single();
  if (error) {
    solta();
    if (error.code === "23505") { erro("Essa categoria já existe."); return; }
    erro("Erro: " + error.message);
    return;
  }
  categorias.push(data);
  categorias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  ok("Categoria adicionada!");
  abrirCategorias(tipo);
  pilha.pop(); // não empilha a mesma tela duas vezes
}

function pedirExcluirCategoria(id) {
  const linha = document.getElementById("cat-" + id);
  const c = categorias.find(x => x.id === id);
  if (!linha || !c) return;
  const usos = contarUsos(c.nome, c.tipo);
  linha.innerHTML = `
    <div class="confirmar" style="width:100%">
      <p>Excluir "${esc(c.nome)}"?${usos ? ` Os ${usos} lançamentos guardados continuam como estão.` : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="abrirCategorias('${c.tipo}'); pilha.pop()">Cancelar</button>
        <button class="sim" onclick="excluirCategoria(this, '${id}', '${c.tipo}')">Excluir</button>
      </div>
    </div>`;
}

async function excluirCategoria(botao, id, tipo) {
  if (botao?.disabled) return;
  const solta = travar(botao, "...");
  const { error } = await sb.from("categorias").delete().eq("id", id);
  if (error) { solta(); erro("Erro: " + error.message); return; }
  categorias = categorias.filter(c => c.id !== id);
  ok("Categoria excluída.");
  abrirCategorias(tipo);
  pilha.pop();
}

/* ═══ PARTIDA ═════════════════════════════════════════════════════════ */

// Descobre se a chave colada é a SECRETA. Não dá para adivinhar pelo tamanho
// nem pelo começo: a chave nova secreta começa com "sb_secret_", e as antigas
// são JWT, onde o papel ("role") está escrito no meio, em base64. Então o jeito
// certo é abrir o crachá e ler.
function ehChaveSecreta(chave) {
  const k = String(chave || "");
  if (k.startsWith("sb_secret_")) return true;
  const partes = k.split(".");
  if (partes.length !== 3) return false;
  try {
    const corpo = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    return corpo.role === "service_role";
  } catch (e) { return false; }
}

async function iniciarSessao() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { telaLogin("entrar"); return; }
  usuario = user;

  document.getElementById("area-login").style.display = "none";
  document.getElementById("area-login").innerHTML = "";
  document.getElementById("topo").style.display = "block";

  const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "?";
  document.getElementById("iniciais").textContent =
    nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  mesAtual = mesDe(_hojeLocal());
  const carregou = await carregarTudo();
  voltarInicio();
  if (carregou) history.pushState({ f: 1 }, "");
}

document.addEventListener("DOMContentLoaded", async () => {
  lembrarTema();
  aplicarTema();
  // Quem escolheu "igual ao celular" acompanha a troca sem recarregar.
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", aplicarTema);

  // A chave secreta ignora o RLS: quem a tiver lê e apaga os dados de todo
  // mundo. Colar a errada é um engano de dois segundos com estrago permanente,
  // e não dá nenhum sinal — o app funcionaria igualzinho. Por isso ele para.
  if (ehChaveSecreta(SUPABASE_KEY)) {
    document.getElementById("area-login").innerHTML = `
      <div class="login">
        <div class="login-topo"><div class="moeda">🛑</div><h2 style="color:#dc2626">Chave errada</h2></div>
        <p style="font-size:13.5px;color:var(--fraco)">
          A chave no <b>index.html</b> é a <b>secreta</b> (service_role). Ela ignora
          toda a proteção do banco — publicada num site, dá acesso aos seus dados
          a qualquer pessoa.<br><br>
          Troque pela chave <b>publicável</b> (ou "anon public"), em
          Project Settings → API. E, se essa chave secreta já esteve na internet,
          gere uma nova no Supabase.
        </p>
      </div>`;
    return;
  }

  if (SUPABASE_URL.includes("SEUPROJETO") || SUPABASE_KEY.includes("COLE_AQUI")) {
    document.getElementById("area-login").innerHTML = `
      <div class="login">
        <div class="login-topo"><div class="moeda">⚙️</div><h2>Falta configurar</h2></div>
        <p style="font-size:13.5px;color:var(--fraco)">
          Abra o <b>index.html</b> e troque as duas linhas marcadas com
          "TROQUE AQUI" pela URL e pela chave publicável do seu projeto no
          Supabase. Depois rode o <b>banco.sql</b> no SQL Editor.
        </p>
      </div>`;
    return;
  }

  // O link de "esqueci minha senha" chega com o token depois do "#".
  sb.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") telaLogin("nova");
  });

  const { data: { session } } = await sb.auth.getSession();
  if ((window.location.hash || "").includes("type=recovery")) { telaLogin("nova"); return; }
  if (session) await iniciarSessao();
  else telaLogin("entrar");
});
