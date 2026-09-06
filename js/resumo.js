/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: resumo mensal.
 */

/* ═══ RESUMO DO MÊS ═══════════════════════════════════════════════════ */

/* ═══ FILTRO DE ENTRADA / SAÍDA ═══════════════════════════════════════
   Tocar em "Entradas" ou "Saídas" não abre outra tela: é a MESMA tela,
   mostrando só um lado. E cada nível some com um "voltar" — do filtro
   pro Resumo inteiro, do Resumo pro menu.

   Quem guarda essa ordem é a pilha de telas do app, não um estado à
   parte: entrar no filtro empilha um jeito de desenhar, e voltar
   desempilha. Por isso trocar de Saídas pra Entradas TROCA o topo da
   pilha em vez de empilhar de novo — senão, depois de bisbilhotar os
   dois lados, o voltar teria que ser apertado uma vez por espiada. */

let _filtroResumo = null;

function abrirResumo() { abrirTela(() => desenharResumo(null)); }

function abrirResumoFiltrado(tipo) {
  // Tocar de novo no card que já está ativo é o mesmo que voltar.
  if (_filtroResumo === tipo) { voltarTela(); return; }

  if (_filtroResumo) {
    pilha[pilha.length - 1] = () => desenharResumo(tipo);
    desenharResumo(tipo);
    window.scrollTo(0, 0);
    return;
  }
  abrirTela(() => desenharResumo(tipo));
}

function desenharResumo(filtro) {
  destruirGrafico();
  _filtroResumo = filtro || null;

  const area = document.getElementById("area");
  const doMes = lancamentos.filter(l => mesDe(l.data) === mesAtual);
  const entradas = doMes.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
  const saidas = doMes.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
  const saldo = entradas - saidas;

  if (_filtroResumo) { desenharResumoFiltrado(doMes, entradas, saidas); return; }

  // Contas em aberto olham o mês inteiro, não só até hoje.
  const aPagar = contas.filter(c => !c.pago && mesDe(c.vencimento) === mesAtual);
  const totalAPagar = aPagar.reduce((s, c) => s + Number(c.valor), 0);
  const vencidas = contas.filter(c => !c.pago && c.vencimento < _hojeLocal());

  // Gastos por categoria, do maior para o menor — é a pergunta que a
  // pessoa realmente faz: "para onde foi meu dinheiro?"
  const porCat = {};
  doMes.filter(l => l.tipo === "saida").forEach(l => {
    porCat[l.categoria] = (porCat[l.categoria] || 0) + Number(l.valor);
  });
  const ranking = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

  area.innerHTML = `
    <section class="resumo-tela">
      <div class="resumo-cabecalho">
        <div>
          <h2>Resumo do mês</h2>
          <p>Visão geral das suas finanças</p>
        </div>
        <div class="resumo-mes" aria-label="Selecionar mês">
          <button onclick="trocarMes(-1)" aria-label="Mês anterior">‹</button>
          <strong>${mesPorExtenso(mesAtual)}</strong>
          <button onclick="trocarMes(1)" aria-label="Próximo mês">›</button>
        </div>
      </div>

      <div class="saldo resumo-saldo">
        <span class="resumo-saldo-rotulo">Saldo do mês</span>
        <strong>${moeda(saldo)}</strong>
        <small class="resumo-saldo-status">
          <b aria-hidden="true">${saldo >= 0 ? "↗" : "↘"}</b>
          ${saldo >= 0 ? "Resultado positivo neste mês" : "As saídas passaram as entradas"}
        </small>
      </div>

      ${_cardsDeNumero(entradas, saidas)}

      ${vencidas.length ? `
        <div class="item vencida resumo-alerta" onclick="abrirContas()" style="cursor:pointer">
          <div class="item-icone">⚠️</div>
          <div class="item-txt">
            <strong>${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}</strong>
            <small>${esc(vencidas.map(c => c.nome).join(", "))}</small>
          </div>
          <span class="item-x">›</span>
        </div>` : ""}

      ${aPagar.length ? `
        <div class="bloco resumo-secao">
          <div class="bloco-topo">
            <h2>Ainda a pagar</h2>
            <strong class="resumo-total-saida">${moeda(totalAPagar)}</strong>
          </div>
          <div class="lista">
            ${aPagar.slice(0, 4).map(c => `
              <div class="item" onclick="abrirContas()" style="cursor:pointer">
                <div class="item-icone">📄</div>
                <div class="item-txt"><strong>${esc(c.nome)}</strong><small>Vence ${dataBR(c.vencimento)}</small></div>
                <span class="item-valor saida">${moeda(c.valor)}</span>
              </div>`).join("")}
          </div>
          ${aPagar.length > 4 ? `<button class="resumo-link resumo-link-final" onclick="abrirContas()">Ver todas as ${aPagar.length}</button>` : ""}
        </div>` : ""}

      <div class="bloco resumo-secao">
        <div class="bloco-topo"><h2>Para onde foi o dinheiro</h2></div>
        ${ranking.length ? `
          <div class="resumo-grafico-layout">
            <div class="grafico resumo-grafico">
              <canvas id="canvas-cat"></canvas>
              <div class="resumo-grafico-total"><small>Total gasto</small><strong>${moeda(saidas)}</strong></div>
            </div>
            <div class="resumo-ranking">
              ${ranking.slice(0, 6).map(([cat, v]) => `
                <div class="resumo-ranking-linha">
                  <span class="resumo-ranking-ponto"></span>
                  <span>${esc(cat)}</span>
                  <strong>${saidas > 0 ? Math.round(v / saidas * 100) + "%" : "--"}</strong>
                </div>`).join("")}
            </div>
          </div>` : `<p class="vazio">Nenhuma saída lançada neste mês.</p>`}
      </div>

      <div class="bloco resumo-secao">
        <div class="bloco-topo">
          <h2>Últimos lançamentos</h2>
          ${doMes.length ? `<button class="resumo-link" onclick="abrirHistorico()">Ver todos</button>` : ""}
        </div>
        ${doMes.length ? `<div class="lista">${doMes.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5).map(linhaLancamento).join("")}</div>`
          : `<p class="vazio">Nada lançado neste mês ainda.</p>`}
      </div>

      <button class="botao-fraco resumo-voltar" onclick="voltarInicio()">Voltar ao início</button>
    </section>
  `;

  if (ranking.length) setTimeout(() => desenharGraficoCategorias(ranking), 0);
}

function trocarMes(passo) {
  mesAtual = mesVizinho(mesAtual, passo);
  desenharResumo(_filtroResumo);   // trocar de mês não desfaz o filtro
}

// Os dois cards, iguais nas duas telas: são eles o botão de entrar no
// filtro e o de sair dele.
function _cardsDeNumero(entradas, saidas) {
  const card = (tipo, rotulo, seta, valor) => `
    <button class="numero ${tipo} resumo-numero${_filtroResumo === tipo ? " ativo" : ""}"
            onclick="abrirResumoFiltrado('${tipo}')"
            aria-pressed="${_filtroResumo === tipo}">
      <span><b aria-hidden="true">${seta}</b> ${rotulo}</span>
      <strong>${moeda(valor)}</strong>
      <i class="resumo-numero-seta" aria-hidden="true">${_filtroResumo === tipo ? "✕" : "›"}</i>
    </button>`;
  return `
    <div class="numeros resumo-numeros">
      ${card("entrada", "Entradas", "↙", entradas)}
      ${card("saida", "Saídas", "↗", saidas)}
    </div>`;
}

/* ─── A mesma tela, com um lado só ──────────────────────────────────── */

function desenharResumoFiltrado(doMes, entradas, saidas) {
  const ehEntrada = _filtroResumo === "entrada";
  const lista = doMes
    .filter(l => l.tipo === _filtroResumo)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const total = ehEntrada ? entradas : saidas;

  const porCat = {};
  lista.forEach(l => { porCat[l.categoria] = (porCat[l.categoria] || 0) + Number(l.valor); });
  const ranking = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

  document.getElementById("area").innerHTML = `
    <section class="resumo-tela">
      <div class="resumo-cabecalho">
        <div>
          <h2>${ehEntrada ? "Entradas" : "Saídas"}</h2>
          <p>${ehEntrada ? "Só o que entrou" : "Só o que saiu"} neste mês</p>
        </div>
        <div class="resumo-mes" aria-label="Selecionar mês">
          <button onclick="trocarMes(-1)" aria-label="Mês anterior">‹</button>
          <strong>${mesPorExtenso(mesAtual)}</strong>
          <button onclick="trocarMes(1)" aria-label="Próximo mês">›</button>
        </div>
      </div>

      <div class="saldo resumo-saldo">
        <span class="resumo-saldo-rotulo">Total de ${ehEntrada ? "entradas" : "saídas"}</span>
        <strong>${moeda(total)}</strong>
        <small class="resumo-saldo-status">
          <b aria-hidden="true">${ehEntrada ? "↙" : "↗"}</b>
          ${lista.length
            ? `${lista.length} lançamento${lista.length > 1 ? "s" : ""} em ${mesPorExtenso(mesAtual).toLowerCase()}`
            : "Nada lançado neste mês"}
        </small>
      </div>

      ${_cardsDeNumero(entradas, saidas)}

      <div class="bloco resumo-secao">
        <div class="bloco-topo"><h2>${ehEntrada ? "De onde veio o dinheiro" : "Para onde foi o dinheiro"}</h2></div>
        ${ranking.length ? `
          <div class="resumo-grafico-layout">
            <div class="grafico resumo-grafico">
              <canvas id="canvas-cat"></canvas>
              <div class="resumo-grafico-total"><small>Total</small><strong>${moeda(total)}</strong></div>
            </div>
            <div class="resumo-ranking">
              ${ranking.slice(0, 6).map(([cat, v]) => `
                <div class="resumo-ranking-linha">
                  <span class="resumo-ranking-ponto"></span>
                  <span>${esc(cat)}</span>
                  <strong>${total > 0 ? Math.round(v / total * 100) + "%" : "--"}</strong>
                </div>`).join("")}
            </div>
          </div>` : `<p class="vazio">Nenhuma ${ehEntrada ? "entrada" : "saída"} neste mês.</p>`}
      </div>

      <div class="bloco resumo-secao">
        <div class="bloco-topo">
          <h2>${lista.length} ${ehEntrada
            ? (lista.length === 1 ? "entrada" : "entradas")
            : (lista.length === 1 ? "saída" : "saídas")}</h2>
        </div>
        ${lista.length
          ? `<div class="lista">${lista.map(linhaLancamento).join("")}</div>`
          : `<p class="vazio">Nada por aqui neste mês.</p>`}
      </div>

      <button class="botao-fraco resumo-voltar" onclick="voltarTela()">
        Ver entradas e saídas
      </button>
    </section>`;

  if (ranking.length) setTimeout(() => desenharGraficoCategorias(ranking), 0);
}

async function desenharGraficoCategorias(ranking) {
  if (!document.getElementById("canvas-cat")) return;
  if (!(await carregarChart())) return;

  // Buscar a biblioteca leva tempo, e nesse tempo a pessoa pode ter saído da
  // tela. Por isso o canvas é procurado DE NOVO aqui: o de antes já pode não
  // existir mais, e desenhar nele seria desenhar no nada.
  const cv = document.getElementById("canvas-cat");
  if (!cv) return;
  destruirGrafico();
  // A primeira fatia é a maior, então ela ganha o verde-petróleo da marca. As
  // seguintes se afastam no tom para não virar um borrão só.
  const cores = ["#0f3b5c", "#c9992e", "#0ea5e9", "#db2777", "#8b5cf6", "#14b8a6", "#64748b"];
  const top = ranking.slice(0, 6);
  const resto = ranking.slice(6).reduce((s, r) => s + r[1], 0);
  const nomes = top.map(r => r[0]).concat(resto > 0 ? ["Outros"] : []);
  const vals = top.map(r => r[1]).concat(resto > 0 ? [resto] : []);

  grafico = new Chart(cv.getContext("2d"), {
    type: "doughnut",
    data: { labels: nomes, datasets: [{ data: vals, backgroundColor: cores, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.label + ": " + moeda(c.parsed) } },
      },
    },
  });
}

// O id vai no elemento e nos botões: a lista aparece ordenada por data, e
// guardar a posição da lista ordenada faria os botões mexerem no lançamento
// errado. Com id, não tem como errar de linha.
function linhaLancamento(l) {
  const entrada = l.tipo === "entrada";
  return `
    <div class="item lanc-item" id="lanc-${l.id}">
      <div class="item-icone ${entrada ? "entrada" : "saida"}">${iconeDoLancamento(l)}</div>
      <div class="item-txt">
        <strong>${esc(l.descricao || l.categoria)}</strong>
        <small>${esc(l.categoria)} · ${dataBR(l.data)}</small>
      </div>
      <span class="item-valor ${entrada ? "entrada" : "saida"}">${entrada ? "+" : "−"} ${moeda(l.valor)}</span>
      <div class="lanc-acoes">
        <button class="botao-editar" onclick="abrirEdicaoLancamento('${l.id}', 'resumo')" aria-label="Editar">✏️</button>
        <button class="botao-editar botao-excluir" onclick="pedirExcluirLancamento('${l.id}', 'resumo')" aria-label="Excluir">🗑️</button>
      </div>
    </div>`;
}

function iconeDoLancamento(l) {
  const texto = `${l.categoria || ""} ${l.descricao || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (l.tipo === "entrada") {
    if (texto.includes("venda")) return "🛍️";
    if (texto.includes("extra")) return "💵";
    if (texto.includes("pix") || texto.includes("transferencia")) return "💵";
    return "💰";
  }

  const regras = [
    [["mercado", "supermercado"], "🛒"],
    [["almoco", "jantar", "restaurante", "comida", "lanche", "alimentacao"], "🍽️"],
    [["casa", "aluguel", "moradia"], "🏠"],
    [["transporte", "combustivel", "gasolina", "moto", "carro"], "🚗"],
    [["saude", "farmacia", "remedio"], "💊"],
    [["educacao", "escola", "curso", "livro"], "📚"],
    [["lazer", "passeio", "cinema"], "🎉"],
    [["internet", "telefone", "celular"], "🌐"],
    [["energia", "luz"], "⚡"],
    [["agua"], "💧"],
    [["cartao", "fatura"], "💳"],
  ];
  const encontrada = regras.find(([palavras]) => palavras.some(palavra => texto.includes(palavra)));
  return encontrada ? encontrada[1] : "💸";
}
