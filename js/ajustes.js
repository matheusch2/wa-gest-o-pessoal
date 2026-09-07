/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: ajustes e categorias.
 */

/* ═══ AJUSTES E CATEGORIAS ════════════════════════════════════════════ */

function abrirAjustes() { abrirTela(desenharAjustes); }

/* ─── A TELA, NO DESENHO DO WA AQUA ──────────────────────────────────
   Lista de linhas, uma por assunto: ícone num quadradinho, o nome, o que
   tem lá dentro, e a seta. Cada linha abre a sua tela.

   O que estava aqui antes era um empilhado de blocos com botões soltos —
   três pílulas de tema, dois botões de categoria, um de sair. Funcionava,
   mas não dizia onde acaba um assunto e começa o outro, e cada assunto
   novo ia sendo pendurado no fim. */

const _ICO_PESSOA_AJ = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>`;
const _ICO_ESCUDO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>`;
const _ICO_LUA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10z"/></svg>`;
const _ICO_ETIQUETAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
const _ICO_SAIR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

function _linhaAjuste({ icone, titulo, apoio, acao, perigo }) {
  return `
    <button class="ajuste-linha${perigo ? " perigo" : ""}" onclick="${acao}">
      <span class="ajuste-icone">${icone}</span>
      <span class="ajuste-txt">
        <strong>${titulo}</strong>
        <small>${apoio}</small>
      </span>
      <span class="ajuste-seta" aria-hidden="true">&rsaquo;</span>
    </button>`;
}

function nomeDoUsuario() {
  return usuario?.user_metadata?.nome || usuario?.email?.split("@")[0] || "";
}

function _iniciaisDe(nome) {
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function desenharAjustes() {
  destruirGrafico();
  const nome = nomeDoUsuario();
  const tema = { claro: "Tema claro", escuro: "Tema escuro", auto: "Igual ao celular" }[temaEscolhido];

  document.getElementById("area").innerHTML = `
    <h2 class="titulo">Ajustes</h2>

    <div class="ajuste-perfil">
      <div class="ajuste-avatar">${esc(_iniciaisDe(nome))}</div>
      <div class="ajuste-perfil-txt">
        <strong>${esc(nome)}</strong>
        <small>${esc(usuario?.email || "")}</small>
      </div>
    </div>

    <div class="ajuste-lista">
      ${_linhaAjuste({ icone: _ICO_PESSOA_AJ, titulo: "Meus dados",
                       apoio: "Como você quer ser chamado", acao: "abrirMeusDados()" })}
      ${_linhaAjuste({ icone: _ICO_ESCUDO, titulo: "Segurança",
                       apoio: "Trocar a senha", acao: "abrirTrocarSenha()" })}
      ${_linhaAjuste({ icone: _ICO_LUA, titulo: "Aparência",
                       apoio: esc(tema), acao: "abrirAparencia()" })}
      ${_linhaAjuste({ icone: _ICO_ETIQUETAS, titulo: "Categorias de saída",
                       apoio: `${categorias.filter(c => c.tipo === "saida").length} cadastradas`,
                       acao: "abrirCategorias('saida')" })}
      ${_linhaAjuste({ icone: _ICO_ETIQUETAS, titulo: "Categorias de entrada",
                       apoio: `${categorias.filter(c => c.tipo === "entrada").length} cadastradas`,
                       acao: "abrirCategorias('entrada')" })}
      ${_linhaAjuste({ icone: _ICO_SAIR, titulo: "Sair da conta",
                       apoio: "Seus dados continuam guardados", acao: "sair()", perigo: true })}
    </div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ─── APARÊNCIA ──────────────────────────────────────────────────────── */

function abrirAparencia() {
  abrirTela(() => {
    destruirGrafico();
    const opcao = (modo, titulo, apoio) => `
      <label class="escolha-op">
        <input type="radio" name="tema" value="${modo}" ${temaEscolhido === modo ? "checked" : ""}
               onchange="trocarTema('${modo}')">
        <span><strong>${titulo}</strong><small>${apoio}</small></span>
      </label>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_LUA}</span>
        <span class="lancamento-caption">Ajustes</span>
        <h2>Aparência</h2>
      </div>

      <div class="lancamento-form">
        <div class="escolha">
          ${opcao("claro", "Claro", "Fundo branco, sempre.")}
          ${opcao("escuro", "Escuro", "Fundo escuro, sempre.")}
          ${opcao("auto", "Igual ao celular", "Acompanha o modo do aparelho, inclusive quando ele troca sozinho à noite.")}
        </div>
      </div>

      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;
  });
}

/* ─── MEUS DADOS ─────────────────────────────────────────────────────── */

function abrirMeusDados() {
  abrirTela(() => {
    destruirGrafico();
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_PESSOA_AJ}</span>
        <span class="lancamento-caption">Ajustes</span>
        <h2>Meus dados</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="md-nome">Como você quer ser chamado</label></div>
          <input type="text" id="md-nome" value="${esc(nomeDoUsuario())}" autocomplete="name">
        </div>
        <p class="cartao-dica">
          É este nome que aparece nas iniciais do cantinho e nas telas.
          O e-mail <b>${esc(usuario?.email || "")}</b> é o seu login e não
          muda por aqui.
        </p>
      </div>

      <button class="botao" onclick="salvarMeusDados(this)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;
  });
}

async function salvarMeusDados(botao) {
  if (botao?.disabled) return;
  const nome = (document.getElementById("md-nome").value || "").trim();
  if (!nome) { erro("Diga como quer ser chamado."); return; }

  const solta = travar(botao, "Salvando...");
  const { data, error } = await sb.auth.updateUser({ data: { nome } });
  if (error) { solta(); erro("Erro ao salvar: " + error.message); return; }

  usuario = data.user;
  // As iniciais do canto superior direito são escritas uma vez, na partida.
  // Mudando o nome aqui, elas precisam acompanhar na hora.
  const alvo = document.getElementById("iniciais");
  if (alvo) alvo.textContent = _iniciaisDe(nome);
  ok("Nome alterado!");
  voltarTela();
}

/* ─── SEGURANÇA ──────────────────────────────────────────────────────── */

function abrirTrocarSenha() {
  abrirTela(() => {
    destruirGrafico();
    const campo = (id, rotulo) => `
      <div class="campo">
        <label for="${id}">${rotulo}</label>
        <div class="campo-icone">
          ${ICO_CADEADO}
          <input type="password" id="${id}" class="tem-olho" placeholder="nova senha" autocomplete="new-password">
          <button type="button" class="olho-senha" onclick="alternarSenha('${id}', this)" aria-label="Mostrar senha">${ICO_OLHO_ABERTO}</button>
        </div>
      </div>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_ESCUDO}</span>
        <span class="lancamento-caption">Ajustes</span>
        <h2>Trocar a senha</h2>
      </div>

      <div class="lancamento-form">
        ${campo("sg-1", "Nova senha")}
        ${campo("sg-2", "Repita a nova senha")}
        <p class="cartao-dica">
          Pelo menos 6 caracteres. Trocando aqui, quem já estiver entrado em
          outro aparelho continua entrado — a senha nova vale do próximo
          login em diante.
        </p>
      </div>

      <button class="botao" onclick="salvarSenhaNova(this)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar senha
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;
  });
}

async function salvarSenhaNova(botao) {
  if (botao?.disabled) return;
  const a = document.getElementById("sg-1").value || "";
  const b = document.getElementById("sg-2").value || "";
  if (a.length < 6) { erro("A senha precisa ter pelo menos 6 caracteres."); return; }
  if (a !== b) { erro("As duas senhas não são iguais."); return; }

  const solta = travar(botao, "Salvando...");
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) { solta(); erro("Erro ao trocar: " + error.message); return; }

  ok("Senha alterada!");
  voltarTela();
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
      <p>Tem certeza que quer excluir a categoria "${esc(c.nome)}"?${usos ? ` Os ${usos} lançamentos guardados continuam como estão.` : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="abrirCategorias('${c.tipo}'); pilha.pop()">Cancelar</button>
        <button class="sim" onclick="excluirCategoria(this, '${id}', '${c.tipo}')">Sim, excluir</button>
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
