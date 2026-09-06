/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: metas de gasto por categoria.
 */

/* ═══ O QUE CONTA PRA META ════════════════════════════════════════════
   Gasto do mês numa categoria = as saídas do extrato MAIS as compras
   feitas no cartão naquele mês. Comprar no crédito não deixa de ser
   gasto, e uma meta que só olha o extrato dá "tudo certo" no mês em que
   a pessoa passou o cartão em tudo.

   A compra parcelada conta INTEIRA no mês da compra, não parcela por
   parcela. É a decisão que responde "quanto comprometi este mês" — e é
   nesse mês que a escolha de gastar foi feita.

   O pagamento da fatura fica DE FORA: ele é a mesma despesa chegando
   pela segunda vez. As compras dele já foram contadas uma a uma, cada
   uma na sua categoria, no mês em que aconteceram. Somar a fatura
   também contaria o mesmo dinheiro duas vezes. */

// Os lançamentos que nasceram de um pagamento de fatura, por id — é o
// jeito exato de reconhecê-los. Ler a descrição procurando "Fatura"
// pegaria junto qualquer saída que a pessoa tenha escrito assim à mão.
function _idsDeFatura() {
  return new Set(pagamentosFatura.map(p => p.lancamento_id).filter(Boolean));
}

function _gastoDoMesPorCategoria(mesRef) {
  const daFatura = _idsDeFatura();
  const porCat = {};
  const somar = (cat, v) => { porCat[cat || "Outros"] = (porCat[cat || "Outros"] || 0) + Number(v); };

  for (const l of lancamentos) {
    if (l.tipo !== "saida" || mesDe(l.data) !== mesRef) continue;
    if (daFatura.has(l.id)) continue;
    somar(l.categoria, l.valor);
  }
  for (const c of comprasCartao) {
    if (mesDe(c.data) !== mesRef) continue;
    somar(c.categoria, c.valor);
  }
  return porCat;
}

// Verde até 80%, âmbar de 80% a 100%, vermelho depois. O aviso vem ANTES
// de estourar: depois de estourado o dinheiro já saiu.
function _corDaMeta(usado) {
  if (usado >= 1) return { classe: "estourou", cor: "var(--saida)" };
  if (usado >= 0.8) return { classe: "perto", cor: "var(--aviso)" };
  return { classe: "dentro", cor: "var(--entrada)" };
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

const _ICO_META = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`;

// A tela das metas acompanha o mês do Resumo: trocar de mês num lugar e
// voltar no outro mostrando outro mês confundiria mais do que ajuda.
function abrirMetas() { abrirTela(desenharMetas); }

function trocarMesMetas(passo) {
  mesAtual = mesVizinho(mesAtual, passo);
  desenharMetas();
}

function desenharMetas() {
  destruirGrafico();

  const gastos = _gastoDoMesPorCategoria(mesAtual);

  // Quem está mais perto de estourar aparece primeiro. A tela existe pra
  // avisar; ordem alfabética esconderia o alerta no meio da lista.
  const comMeta = metas.slice().sort((a, b) => {
    const ua = (gastos[a.categoria] || 0) / Number(a.valor);
    const ub = (gastos[b.categoria] || 0) / Number(b.valor);
    return ub - ua || a.categoria.localeCompare(b.categoria, "pt-BR");
  });

  const totalMetas = comMeta.reduce((s, m) => s + Number(m.valor), 0);
  const totalGasto = comMeta.reduce((s, m) => s + (gastos[m.categoria] || 0), 0);
  const sobra = totalMetas - totalGasto;
  const usadoGeral = totalMetas > 0 ? totalGasto / totalMetas : 0;

  const umaMeta = m => {
    const gasto = gastos[m.categoria] || 0;
    const teto = Number(m.valor);
    const usado = teto > 0 ? gasto / teto : 0;
    const { classe } = _corDaMeta(usado);
    const falta = teto - gasto;
    return `
      <div class="meta-item ${classe}" id="meta-${m.id}">
        <div class="meta-topo">
          <span class="meta-nome">${iconeDoLancamento({ tipo: "saida", categoria: m.categoria })} ${esc(m.categoria)}</span>
          <span class="meta-pct">${Math.round(usado * 100)}%</span>
        </div>
        <div class="meta-barra"><span style="width:${Math.min(100, usado * 100)}%"></span></div>
        <div class="meta-baixo">
          <span><strong>${moeda(gasto)}</strong> de ${moeda(teto)}</span>
          <span class="meta-falta">${falta >= 0 ? "Sobram " + moeda(falta) : "Passou " + moeda(-falta)}</span>
        </div>
        <div class="meta-acoes">
          <button class="botao-editar" onclick="abrirEdicaoMeta('${m.id}')" aria-label="Editar">✏️</button>
          <button class="botao-editar botao-excluir" onclick="pedirExcluirMeta('${m.id}')" aria-label="Excluir">🗑️</button>
        </div>
      </div>`;
  };

  // Aluguel, mercado, energia, internet, água vão sair de todo jeito. Azeite
  // e lazer, não. São dois assuntos diferentes na mesma tela, e separá-los
  // responde de relance a pergunta que importa: quanto do mês já está
  // comprometido antes de qualquer escolha minha?
  const obrigatorias = comMeta.filter(m => m.reservar);
  const opcionais = comMeta.filter(m => !m.reservar);
  const separar = obrigatorias.length && opcionais.length;

  const grupo = (titulo, lista, aviso) => !lista.length ? "" : `
    ${separar ? `
      <div class="meta-grupo">
        <h3>${titulo}</h3>
        <span>${moeda(lista.reduce((s, m) => s + Number(m.valor), 0))} previstos</span>
      </div>
      <p class="meta-grupo-nota">${aviso}</p>` : ""}
    ${lista.map(umaMeta).join("")}`;

  const linhas =
    grupo("Obrigatórios", obrigatorias, "Saem da sobra do Resumo antes mesmo de serem pagos.") +
    grupo("Opcionais", opcionais, "Só avisam quando você passa. Não mexem na sobra.");

  // Onde o dinheiro está indo sem ninguém ter posto um teto. É a lista de
  // onde a próxima meta provavelmente deveria estar.
  const semMeta = Object.entries(gastos)
    .filter(([cat]) => !metas.some(m => m.categoria === cat))
    .sort((a, b) => b[1] - a[1]);

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_META}</span>
        <span class="lancamento-caption">Controle</span>
        <h2>Metas de gastos</h2>
      </div>
    </section>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarMesMetas(-1)" aria-label="Mês anterior">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mesAtual)}</strong>
        <button class="pilula" onclick="trocarMesMetas(1)" aria-label="Próximo mês">›</button>
      </div>
    </div>

    ${comMeta.length ? `
      <div class="contas-total">
        <span>${sobra >= 0 ? "Ainda pode gastar" : "Passou das metas"}</span>
        <strong>${moeda(Math.abs(sobra))}</strong>
        <small>${moeda(totalGasto)} de ${moeda(totalMetas)} · ${Math.round(usadoGeral * 100)}% das metas</small>
      </div>` : ""}

    <button class="botao" onclick="abrirNovaMeta()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Nova meta
    </button>

    ${comMeta.length
      ? `<div class="meta-lista">${linhas}</div>`
      : `<div class="bloco" style="margin-top:14px"><p class="vazio">Nenhuma meta ainda. Ponha um teto nas categorias que costumam fugir do controle.</p></div>`}

    ${semMeta.length ? `
      <div class="bloco" style="margin-top:14px">
        <div class="bloco-topo"><h2>Sem meta neste mês</h2></div>
        <div class="lista">
          ${semMeta.slice(0, 6).map(([cat, v]) => `
            <div class="meta-sem">
              <span class="meta-sem-nome">${iconeDoLancamento({ tipo: "saida", categoria: cat })} ${esc(cat)}</span>
              <strong>${moeda(v)}</strong>
              <button class="botao-pagar" onclick="abrirNovaMeta('${esc(cat)}')">Pôr meta</button>
            </div>`).join("")}
        </div>
      </div>` : ""}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ═══ CRIAR E EDITAR ══════════════════════════════════════════════════ */

function abrirNovaMeta(categoria) {
  abrirTela(() => _desenharFormMeta(null, categoria));
}

function abrirEdicaoMeta(id) {
  const m = metas.find(x => x.id === id);
  if (!m) { erro("Meta não encontrada."); return; }
  abrirTela(() => _desenharFormMeta(m));
}

function _desenharFormMeta(meta, categoriaSugerida) {
  destruirGrafico();

  // Editando, a categoria não muda: mudar categoria é apagar uma meta e
  // criar outra, e o campo travado deixa isso claro sem precisar explicar.
  const editando = !!meta;
  const escolhidas = metas.filter(m => !meta || m.id !== meta.id).map(m => m.categoria);
  const disponiveis = categorias
    .filter(c => c.tipo === "saida")
    .map(c => c.nome)
    .filter(nome => !escolhidas.includes(nome));

  // A categoria pode ter nascido numa compra de cartão e não estar
  // cadastrada — ela continua valendo como meta.
  if (categoriaSugerida && !disponiveis.includes(categoriaSugerida)) disponiveis.unshift(categoriaSugerida);

  const alvo = editando ? meta.categoria : (categoriaSugerida || disponiveis[0]);
  const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
  const icoTipo = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;

  // Meta nova nasce obrigatória: é o caso comum. Quem estipula um gasto
  // quase sempre está falando de conta que vai chegar.
  const obrigatorio = !meta || meta.reservar;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_META}</span>
      <span class="lancamento-caption">Controle</span>
      <h2>${editando ? "Editar meta" : "Nova meta"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <div class="campo-label">${icoEtiqueta}<label for="mt-cat">Categoria</label></div>
        ${editando || !disponiveis.length
          ? `<input type="text" id="mt-cat" value="${esc(alvo || "")}" disabled>`
          : `<select id="mt-cat" onchange="_previaGastoDaMeta()">
               ${disponiveis.map(n => `<option value="${esc(n)}"${n === alvo ? " selected" : ""}>${esc(n)}</option>`).join("")}
             </select>`}
        <p class="cartao-dica" id="mt-gasto" style="margin-top:7px"></p>
      </div>

      <div class="campo" style="margin-bottom:0">
        <label for="mt-valor">Teto por mês</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="mt-valor" placeholder="0,00" autocomplete="off"
                 value="${meta ? Number(meta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}">
        </div>
      </div>

      <p class="cartao-dica">Vale todo mês. Conta as saídas do extrato e as compras do cartão nessa categoria.</p>

      <div class="campo" style="margin:16px 0 0">
        <div class="campo-label">${icoTipo}<label>Tipo de gasto</label></div>
        <div class="escolha">
          <label class="escolha-op">
            <input type="radio" name="mt-tipo" value="obrigatorio" ${obrigatorio ? "checked" : ""}>
            <span>
              <strong>Obrigatório</strong>
              <small>Vai sair de todo jeito — aluguel, mercado, energia, internet.
                     O que ainda falta sai da sobra do Resumo antes de ser pago.</small>
            </span>
          </label>
          <label class="escolha-op">
            <input type="radio" name="mt-tipo" value="opcional" ${obrigatorio ? "" : "checked"}>
            <span>
              <strong>Opcional</strong>
              <small>Você escolhe se gasta — lazer, delivery. Só avisa quando
                     passa do teto, sem mexer na sobra.</small>
            </span>
          </label>
        </div>
      </div>
    </div>

    ${!editando && !disponiveis.length
      ? `<p class="cartao-dica" style="margin-bottom:12px">Todas as suas categorias de saída já têm meta.</p>`
      : `<button class="botao" onclick="salvarMeta(this, ${meta ? `'${meta.id}'` : "null"})">
           <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
           ${editando ? "Salvar alteração" : "Criar meta"}
         </button>`}
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;

  _previaGastoDaMeta();
  document.getElementById("mt-valor").focus();
}

// Teto escolhido no escuro é teto que já nasce estourado. Mostra quanto a
// categoria já consumiu no mês pra pessoa ter um número de referência.
function _previaGastoDaMeta() {
  const alvo = document.getElementById("mt-gasto");
  const cat = document.getElementById("mt-cat")?.value;
  if (!alvo || !cat) return;
  const gasto = _gastoDoMesPorCategoria(mesAtual)[cat] || 0;
  alvo.textContent = gasto > 0
    ? `Em ${mesPorExtenso(mesAtual).toLowerCase()} você já gastou ${moeda(gasto)} nessa categoria.`
    : `Nada gasto nessa categoria em ${mesPorExtenso(mesAtual).toLowerCase()}.`;
}

async function salvarMeta(botao, id) {
  if (botao?.disabled) return;

  const campoCat = document.getElementById("mt-cat");
  const categoria = (campoCat?.value || "").trim();
  const valor = parseMoedaBR(document.getElementById("mt-valor").value);
  const reservar = document.querySelector('input[name="mt-tipo"]:checked')?.value !== "opcional";

  if (!categoria) { erro("Escolha a categoria."); return; }
  if (valor === null || valor <= 0) { erro("Informe um teto maior que zero."); return; }

  const solta = travar(botao, "Salvando...");

  if (id) {
    const { data, error } = await sb.from("metas")
      .update({ valor, reservar })
      .eq("id", id).eq("user_id", usuario.id)
      .select().single();
    if (error) { solta(); erro("Erro ao salvar: " + error.message); return; }
    metas = metas.map(m => (m.id === id ? data : m));
    ok("Meta alterada!");
  } else {
    const { data, error } = await sb.from("metas")
      .insert({ user_id: usuario.id, categoria, valor, reservar })
      .select().single();
    if (error) {
      solta();
      erro(error.code === "23505" ? "Já existe uma meta para essa categoria." : "Erro ao salvar: " + error.message);
      return;
    }
    metas.push(data);
    ok("Meta criada!");
  }

  voltarTela();
}

/* ═══ EXCLUIR ═════════════════════════════════════════════════════════ */

function pedirExcluirMeta(id) {
  const linha = document.getElementById("meta-" + id);
  const m = metas.find(x => x.id === id);
  if (!linha || !m) return;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%;border:none;padding:0">
      <p>Tirar a meta de ${esc(m.categoria)}? Os gastos continuam registrados.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharMetas()">Cancelar</button>
        <button class="sim" onclick="excluirMeta(this, '${id}')">Sim, tirar</button>
      </div>
    </div>`;
}

async function excluirMeta(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "Tirando...");

  const { error } = await sb.from("metas")
    .delete().eq("id", id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  metas = metas.filter(m => m.id !== id);
  ok("Meta removida.");
  desenharMetas();
}
