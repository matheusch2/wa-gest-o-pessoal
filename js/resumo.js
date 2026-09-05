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
    <h2 class="titulo">Resumo</h2>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarMes(-1)">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mesAtual)}</strong>
        <button class="pilula" onclick="trocarMes(1)">›</button>
      </div>
    </div>

    <div class="saldo">
      <span>Saldo do mês</span>
      <strong>${moeda(saldo)}</strong>
      <small>${saldo >= 0 ? "Você fechou no positivo" : "As saídas passaram as entradas"}</small>
    </div>

    <div class="numeros">
      <div class="numero entrada"><span>Entrou</span><strong>${moeda(entradas)}</strong></div>
      <div class="numero saida"><span>Saiu</span><strong>${moeda(saidas)}</strong></div>
    </div>

    ${vencidas.length ? `
      <div class="item vencida" onclick="abrirContas()" style="margin-bottom:12px;cursor:pointer">
        <div class="item-icone">⚠️</div>
        <div class="item-txt">
          <strong>${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}</strong>
          <small>${esc(vencidas.map(c => c.nome).join(", "))}</small>
        </div>
        <span class="item-x">›</span>
      </div>` : ""}

    ${aPagar.length ? `
      <div class="bloco">
        <div class="bloco-topo">
          <h2>Ainda a pagar neste mês</h2>
          <strong style="color:var(--saida)">${moeda(totalAPagar)}</strong>
        </div>
        <div class="lista">
          ${aPagar.slice(0, 4).map(c => `
            <div class="item" onclick="abrirContas()" style="cursor:pointer">
              <div class="item-icone">📄</div>
              <div class="item-txt"><strong>${esc(c.nome)}</strong><small>vence ${dataBR(c.vencimento)}</small></div>
              <span class="item-valor saida">${moeda(c.valor)}</span>
            </div>`).join("")}
        </div>
        ${aPagar.length > 4 ? `<button class="botao-fraco" onclick="abrirContas()">Ver todas as ${aPagar.length}</button>` : ""}
      </div>` : ""}

    <div class="bloco">
      <div class="bloco-topo"><h2>Para onde foi o dinheiro</h2></div>
      ${ranking.length ? `
        <div class="grafico"><canvas id="canvas-cat"></canvas></div>
        <div class="lista" style="margin-top:14px">
          ${ranking.slice(0, 6).map(([cat, v]) => `
            <div class="item">
              <div class="item-icone">${saidas > 0 ? Math.round(v / saidas * 100) + "%" : "--"}</div>
              <div class="item-txt"><strong>${esc(cat)}</strong></div>
              <span class="item-valor saida">${moeda(v)}</span>
            </div>`).join("")}
        </div>` : `<p class="vazio">Nenhuma saída lançada neste mês.</p>`}
    </div>

    <div class="bloco">
      <div class="bloco-topo"><h2>Últimos lançamentos</h2></div>
      ${doMes.length ? `<div class="lista">${doMes.slice(0, 5).map(linhaLancamento).join("")}</div>
        <button class="botao-fraco" onclick="abrirHistorico()">Ver o histórico completo</button>`
        : `<p class="vazio">Nada lançado neste mês ainda.</p>`}
    </div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;

  if (ranking.length) setTimeout(() => desenharGraficoCategorias(ranking), 0);
}

function trocarMes(passo) {
  mesAtual = mesVizinho(mesAtual, passo);
  desenharResumo();
}

function desenharGraficoCategorias(ranking) {
  const cv = document.getElementById("canvas-cat");
  if (!cv || typeof Chart === "undefined") return;
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
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: (c) => c.label + ": " + moeda(c.parsed) } },
      },
    },
  });
}

function linhaLancamento(l) {
  const entrada = l.tipo === "entrada";
  return `
    <div class="item">
      <div class="item-icone">${entrada ? "↑" : "↓"}</div>
      <div class="item-txt">
        <strong>${esc(l.descricao || l.categoria)}</strong>
        <small>${esc(l.categoria)} · ${dataBR(l.data)}</small>
      </div>
      <span class="item-valor ${entrada ? "entrada" : "saida"}">${entrada ? "+" : "−"} ${moeda(l.valor)}</span>
    </div>`;
}
