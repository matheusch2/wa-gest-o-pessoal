/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: lançamentos de entrada e saída.
 */

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
    <section class="lancamento-tela ${entrada ? "entrada" : "saida"}">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone" aria-hidden="true">${entrada ? "↑" : "↓"}</span>
      <div>
        <h2>${entrada ? "Nova entrada" : "Nova saída"}</h2>
        <p>${entrada ? "Registre um recebimento" : "Registre um gasto"}</p>
      </div>
    </div>

    <div class="bloco lancamento-form">
      <div class="campo lancamento-campo-valor">
        <label>Valor</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="lc-valor" placeholder="0,00" autocomplete="off">
        </div>
      </div>

      <div class="campo">
        <label>Descrição</label>
        <input type="text" id="lc-desc" placeholder="${entrada ? "Ex: salário de agosto" : "Ex: compra do mês"}" autocomplete="off">
      </div>

      <div class="campo">
        <label>Categoria</label>
        <select id="lc-cat">
          ${cats.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}
          ${cats.length ? "" : `<option value="Outros">Outros</option>`}
        </select>
      </div>

      <div class="campo lancamento-campo-data">
        <label>Data</label>
        <input type="date" id="lc-data" value="${_hojeLocal()}">
      </div>

      <button class="botao ${entrada ? "entrada" : "saida"}"
              onclick="salvarLancamento(this, '${tipo}', '${chave}')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        ${entrada ? "Lançar entrada" : "Lançar saída"}
      </button>
    </div>

    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>
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
