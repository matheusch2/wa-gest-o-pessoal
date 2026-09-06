/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: resumo mensal.
 */

/* ═══ RESUMO DO MÊS ═══════════════════════════════════════════════════ */

function abrirResumo() { abrirTela(desenharResumo); }

function desenharResumo() {
  destruirGrafico();
  const area = document.getElementById("area");
  const doMes = lancamentos.filter(l => mesDe(l.data) === mesAtual);
  const entradas = doMes.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
  const saidas = doMes.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
  const saldo = entradas - saidas;

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

      <div class="numeros resumo-numeros">
        <div class="numero entrada resumo-numero">
          <span><b aria-hidden="true">↙</b> Entradas</span>
          <strong>${moeda(entradas)}</strong>
        </div>
        <div class="numero saida resumo-numero">
          <span><b aria-hidden="true">↗</b> Saídas</span>
          <strong>${moeda(saidas)}</strong>
        </div>
      </div>

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
  desenharResumo();
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
