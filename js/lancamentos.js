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

  const seta = entrada
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
  const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela ${entrada ? "entrada" : "saida"}">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${seta}</span>
      <span class="lancamento-caption">Novo lançamento</span>
      <h2>${entrada ? "Entrada" : "Saída"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo lancamento-campo-valor">
        <label for="lc-valor">Valor</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="lc-valor" placeholder="0,00" autocomplete="off">
        </div>
      </div>

      <div class="campo">
        <div class="campo-label">${icoTexto}<label for="lc-desc">Descrição</label></div>
        <input type="text" id="lc-desc" placeholder="${entrada ? "Ex: salário de agosto" : "Ex: compra do mês"}" autocomplete="off">
      </div>

      <div class="dois">
        <div class="campo lancamento-campo-data">
          <div class="campo-label">${icoData}<label for="lc-data">Data</label></div>
          <input type="date" id="lc-data" value="${_hojeLocal()}">
        </div>
        <div class="campo">
          <div class="campo-label">${icoEtiqueta}<label for="lc-cat">Categoria</label></div>
          <select id="lc-cat">
            ${cats.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}
            ${cats.length ? "" : `<option value="Outros">Outros</option>`}
          </select>
        </div>
      </div>
    </div>

    <button class="botao ${entrada ? "entrada" : "saida"}"
            onclick="salvarLancamento(this, '${tipo}', '${chave}')">
      ${seta}${entrada ? "Lançar entrada" : "Lançar saída"}
    </button>

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
