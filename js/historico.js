/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: histórico.
 */

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
