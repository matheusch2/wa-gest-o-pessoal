/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: contas a pagar.
 */

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
