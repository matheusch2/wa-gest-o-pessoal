/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: contas a pagar.
 */

/* ═══ CONTAS A PAGAR ══════════════════════════════════════════════════ */

// Qual aba está aberta. Trocar de aba não empilha tela: é a mesma tela
// mostrando outro recorte, então o "Voltar" continua indo pro menu.
let _contasFiltro = "todos";

function abrirContas() { _contasFiltro = "todos"; abrirTela(desenharContas); }
function filtrarContas(f) { _contasFiltro = f; desenharContas(); }

function desenharContas() {
  destruirGrafico();
  const hoje = _hojeLocal();
  const abertas = contas.filter(c => !c.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = contas.filter(c => c.pago).sort((a, b) => b.vencimento.localeCompare(a.vencimento)).slice(0, 10);
  const total = abertas.reduce((s, c) => s + Number(c.valor), 0);

  const vencidas = abertas.filter(c => c.vencimento < hoje);
  // "Vencendo" é o que vence de hoje até 5 dias — a janela em que ainda dá
  // tempo de pagar sem juros.
  const vencendo = abertas.filter(c => {
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    return dias >= 0 && dias <= 5;
  });

  const abas = [
    { id: "todos", rotulo: "A pagar", itens: abertas, vazio: "Nenhuma conta em aberto. 🎉" },
    { id: "vencendo", rotulo: "Vencendo", itens: vencendo, vazio: "Nada vencendo nos próximos dias." },
    { id: "vencidos", rotulo: "Vencidos", itens: vencidas, vazio: "Nenhuma conta vencida. 🎉" },
    { id: "pagos", rotulo: "Pagos", itens: pagas, vazio: "Nenhuma conta paga ainda." },
  ];
  const abaAtual = abas.find(a => a.id === _contasFiltro) || abas[0];

  const linha = (c) => {
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    const estado = c.pago ? "paga" : dias < 0 ? "vencida" : dias <= 5 ? "vencendo" : "";
    const quando = c.pago ? "Paga em " + dataBR(c.pago_em || c.vencimento)
                 : dias < 0 ? `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`
                 : dias === 0 ? "Vence hoje"
                 : `Vence em ${dias} dia${dias > 1 ? "s" : ""}`;
    return `
      <div class="conta-item ${estado}" id="conta-${c.id}">
        <div class="conta-ico">${c.pago ? "✓" : c.recorrente ? "🔁" : "📄"}</div>
        <div class="conta-nome">${esc(c.nome)}</div>
        <div class="conta-valor">${moeda(c.valor)}</div>
        <div class="conta-prazo">
          <span class="conta-chip ${estado}">${quando}</span>
          ${c.categoria ? `<span class="conta-cat">${esc(c.categoria)}</span>` : ""}
        </div>
        <div class="conta-acao">
          ${c.pago
            ? `<button class="item-x" onclick="pedirExcluirConta('${c.id}')" aria-label="Excluir">×</button>`
            : `<button class="botao-pagar" onclick="pagarConta(this, '${c.id}')">Pagar</button>`}
        </div>
      </div>`;
  };

  const icoCalendario = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icoCalendario}</span>
        <span class="lancamento-caption">A pagar</span>
        <h2>Contas</h2>
      </div>
    </section>

    <div class="contas-total">
      <span>Total em aberto</span>
      <strong>${moeda(total)}</strong>
      <small>${abertas.length
        ? `${abertas.length} conta${abertas.length > 1 ? "s" : ""} em aberto`
        : "Nada em aberto"}${vencidas.length
        ? ` · <span class="alerta">${vencidas.length} vencida${vencidas.length > 1 ? "s" : ""}</span>` : ""}</small>
    </div>

    <button class="botao" onclick="abrirNovaConta()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Nova conta
    </button>

    <div class="contas-abas">
      ${abas.map(a => `
        <button class="contas-aba${a.id === abaAtual.id ? " ativa" : ""}"
                onclick="filtrarContas('${a.id}')">${a.rotulo}</button>`).join("")}
    </div>

    ${abaAtual.itens.length
      ? `<div class="lista">${abaAtual.itens.map(linha).join("")}</div>`
      : `<div class="bloco"><p class="vazio">${abaAtual.vazio}</p></div>`}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

function abrirNovaConta() {
  abrirTela(() => {
    destruirGrafico();
    const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const cats = categorias.filter(c => c.tipo === "saida");
    const icoConta = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
    const icoData = icoConta;
    const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icoConta}</span>
        <span class="lancamento-caption">Contas a pagar</span>
        <h2>Nova conta</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="ct-nome">Nome da conta</label></div>
          <input type="text" id="ct-nome" placeholder="Ex: Energia" autocomplete="off">
        </div>

        <div class="campo">
          <label for="ct-valor">Valor</label>
          <div class="lancamento-valor">
            <span>R$</span>
            <input type="text" inputmode="decimal" id="ct-valor" placeholder="0,00" autocomplete="off">
          </div>
        </div>

        <div class="dois">
          <div class="campo lancamento-campo-data">
            <div class="campo-label">${icoData}<label for="ct-venc">Vencimento</label></div>
            <input type="date" id="ct-venc" value="${_hojeLocal()}">
          </div>
          <div class="campo">
            <div class="campo-label">${icoEtiqueta}<label for="ct-cat">Categoria</label></div>
            <select id="ct-cat">
              ${cats.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}
              ${cats.length ? "" : `<option value="Outros">Outros</option>`}
            </select>
          </div>
        </div>

        <label class="conta-repete">
          <input type="checkbox" id="ct-rec">
          <span>🔁 Repete todo mês</span>
        </label>
      </div>

      <button class="botao" onclick="salvarConta(this, '${chave}')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar conta
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;
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
