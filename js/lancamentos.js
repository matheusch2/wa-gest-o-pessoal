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

/* ═══ EDITAR E EXCLUIR ════════════════════════════════════════════════
   Tanto o Resumo quanto o Histórico listam lançamentos, então o editar e
   o excluir moram aqui e recebem de qual tela vieram, pra redesenhar a
   certa no fim. Sem isso, apagar pelo Resumo jogaria a pessoa no
   Histórico.

   IMPORTANTE: tudo trabalha com o `id` do registro, nunca com a posição
   na lista. A lista aparece ordenada por data, e posição de lista
   ordenada não corresponde à posição no array — usar índice aqui edita o
   registro errado. Com id não existe essa classe de erro. */

function _voltarDeLancamento(volta) {
  if (volta === "historico") desenharHistorico();
  else desenharResumo();
}

function _acharLancamento(id) {
  return lancamentos.find(l => l.id === id) || null;
}

function abrirEdicaoLancamento(id, volta) {
  const l = _acharLancamento(id);
  if (!l) { erro("Lançamento não encontrado."); return; }

  const entrada = l.tipo === "entrada";
  const cats = categorias.filter(c => c.tipo === l.tipo);
  const seta = entrada
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
  const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;

  // O valor já vem escrito como o brasileiro escreve (vírgula no decimal),
  // porque é assim que ele volta a ser lido no parseMoedaBR ao salvar.
  const valorBR = Number(l.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela ${entrada ? "entrada" : "saida"}">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${seta}</span>
      <span class="lancamento-caption">Editar</span>
      <h2>${entrada ? "Entrada" : "Saída"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo lancamento-campo-valor">
        <label for="ed-valor">Valor</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="ed-valor" value="${esc(valorBR)}" autocomplete="off">
        </div>
      </div>

      <div class="campo">
        <div class="campo-label">${icoTexto}<label for="ed-desc">Descrição</label></div>
        <input type="text" id="ed-desc" value="${esc(l.descricao || "")}" autocomplete="off">
      </div>

      <div class="dois">
        <div class="campo lancamento-campo-data">
          <div class="campo-label">${icoData}<label for="ed-data">Data</label></div>
          <input type="date" id="ed-data" value="${esc(l.data)}">
        </div>
        <div class="campo">
          <div class="campo-label">${icoEtiqueta}<label for="ed-cat">Categoria</label></div>
          <select id="ed-cat">
            ${cats.map(c => `<option value="${esc(c.nome)}"${c.nome === l.categoria ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}
            ${cats.some(c => c.nome === l.categoria) ? "" : `<option value="${esc(l.categoria)}" selected>${esc(l.categoria)}</option>`}
          </select>
        </div>
      </div>
    </div>

    <button class="botao ${entrada ? "entrada" : "saida"}"
            onclick="salvarEdicaoLancamento('${l.id}', '${volta}', this)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      Salvar alterações
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="_voltarDeLancamento('${volta}')">Cancelar</button>
    </section>
  `;
}

async function salvarEdicaoLancamento(id, volta, botao) {
  if (botao?.disabled) return;                       // trava o duplo toque

  const l = _acharLancamento(id);
  if (!l) { erro("Lançamento não encontrado."); return; }

  const descricao = (document.getElementById("ed-desc").value || "").trim();
  const valor = parseMoedaBR(document.getElementById("ed-valor").value);
  const data = document.getElementById("ed-data").value;
  const categoria = document.getElementById("ed-cat").value;

  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!data) { erro("Escolha a data."); return; }

  const solta = travar(botao, "Salvando...");

  // UPDATE de verdade: apagar e inserir de novo perderia o lançamento se o
  // insert falhasse no meio. E o filtro por user_id anda junto do id em toda
  // escrita — cinto e suspensório, mesmo com o RLS ligado no banco.
  const { error } = await sb.from("lancamentos")
    .update({ descricao: descricao || null, valor, data, categoria })
    .eq("id", id)
    .eq("user_id", usuario.id);

  if (error) { solta(); erro("Erro ao salvar: " + error.message); return; }

  // Banco e memória mudam juntos, senão a tela mostra uma coisa e o banco
  // guarda outra até alguém recarregar o app.
  l.descricao = descricao || null;
  l.valor = valor;
  l.data = data;
  l.categoria = categoria;
  lancamentos.sort((a, b) => b.data.localeCompare(a.data));

  ok("Lançamento atualizado!");
  _voltarDeLancamento(volta);
}

function pedirExcluirLancamento(id, volta) {
  const linha = document.getElementById("lanc-" + id);
  if (!linha) return;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%">
      <p>Excluir este lançamento?</p>
      <div class="confirmar-acoes">
        <button onclick="_voltarDeLancamento('${volta}')">Cancelar</button>
        <button class="sim" onclick="excluirLancamento(this, '${id}', '${volta}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirLancamento(botao, id, volta) {
  if (botao?.disabled) return;
  const solta = travar(botao, "Excluindo...");

  const { error } = await sb.from("lancamentos")
    .delete()
    .eq("id", id)
    .eq("user_id", usuario.id);

  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  lancamentos = lancamentos.filter(l => l.id !== id);
  ok("Lançamento excluído.");
  _voltarDeLancamento(volta);
}
