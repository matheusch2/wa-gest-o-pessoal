/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: ajustes e categorias.
 */

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
