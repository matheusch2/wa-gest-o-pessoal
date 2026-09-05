/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: autenticação.
 */

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
        <input type="password" id="${id}" class="tem-olho" placeholder="sua senha" autocomplete="current-password">
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
