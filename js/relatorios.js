/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: relatórios e projeções.
 */

/* ═══ QUAL CONTA ESTA TELA FAZ ════════════════════════════════════════
   O Resumo é o EXTRATO: ele responde "o que saiu da conta", e por isso
   tem que bater com o app do banco. O relatório é outra pergunta — é o
   COMPORTAMENTO: "o que eu gastei". Passar o cartão no mercado é gastar
   no mercado, mesmo que o dinheiro só saia da conta na fatura do mês que
   vem.

   Por isso aqui o gasto sai da MESMA função das Metas
   (_gastoDoMesPorCategoria): extrato mais as compras do cartão no mês da
   compra, sem o pagamento da fatura — que é a mesma despesa chegando
   pela segunda vez.

   Duas telas com contas diferentes só podem conviver com duas condições,
   e as duas valem aqui:

   1. RÓTULOS DIFERENTES. Lá é "Entradas" e "Saídas". Aqui é "Entrou" e
      "Gastou". Palavra igual pra número diferente é o defeito que já
      custou caro neste app três vezes.

   2. A DIFERENÇA APARECE. Quando o mês tem saldo trazido do anterior, a
      tela diz o valor exato que ficou de fora, em vez de deixar a pessoa
      descobrir sozinha por que os dois números não fecham. */

// Os lançamentos que o fechamento do mês criou sozinho, por id. O saldo
// que veio de agosto não é renda de setembro — é dinheiro seu que já era
// seu. E o "Guardado" não é gasto: é dinheiro que continua seu, só que
// fora da conta. Contar os dois faria o relatório dizer que você ganhou e
// gastou o que apenas mudou de lugar.
//
// Por id, e não pelo nome da categoria: quem criar uma categoria chamada
// "Saldo" à mão não pode ver os próprios lançamentos sumirem do relatório.
function _idsDeFechamento() {
  const ids = new Set();
  for (const f of fechamentos) {
    if (f.lancamento_levado_id) ids.add(f.lancamento_levado_id);
    if (f.lancamento_guardado_id) ids.add(f.lancamento_guardado_id);
  }
  return ids;
}

const _cent = v => Math.round(Number(v || 0) * 100) / 100;

function _retratoDoMes(mesRef) {
  const doFechamento = _idsDeFechamento();

  let entrou = 0, saldoTrazido = 0, guardado = 0;
  for (const l of lancamentos) {
    if (mesDe(l.data) !== mesRef) continue;
    const rolagem = doFechamento.has(l.id);
    if (l.tipo === "entrada") {
      if (rolagem) saldoTrazido += Number(l.valor);
      else entrou += Number(l.valor);
    } else if (rolagem) {
      guardado += Number(l.valor);
    }
  }

  // O gasto por categoria vem pronto das Metas. O que falta é tirar dele
  // o "Guardado", que entra ali como saída comum — nas Metas é inofensivo
  // (categoria sem meta não conta pra nada), aqui inflaria o total.
  const porCat = { ..._gastoDoMesPorCategoria(mesRef) };
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || mesDe(l.data) !== mesRef) continue;
    if (!doFechamento.has(l.id)) continue;
    const cat = l.categoria || "Outros";
    porCat[cat] = _cent((porCat[cat] || 0) - Number(l.valor));
  }

  const ranking = Object.entries(porCat)
    .map(([cat, v]) => [cat, _cent(v)])
    .filter(([, v]) => v >= 0.005)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));

  const gastou = _cent(ranking.reduce((s, [, v]) => s + v, 0));
  entrou = _cent(entrou);

  return {
    entrou, gastou,
    sobrou: _cent(entrou - gastou),
    saldoTrazido: _cent(saldoTrazido),
    guardado: _cent(guardado),
    ranking,
    vazio: entrou < 0.005 && gastou < 0.005,
  };
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

const _ICO_BARRAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="13"/><line x1="22" y1="20" x2="22" y2="7"/></svg>`;

// Segue o mês do Resumo e das Metas. Trocar de mês num lugar e voltar no
// outro mostrando outro mês confundiria mais do que ajudaria.
function abrirRelatorios() { abrirTela(desenharRelatorios); }

function trocarMesRelatorio(passo) {
  mesAtual = mesVizinho(mesAtual, passo);
  desenharRelatorios();
}

function desenharRelatorios() {
  destruirGrafico();

  const r = _retratoDoMes(mesAtual);
  const temRenda = r.entrou >= 0.005;
  const usado = temRenda ? r.gastou / r.entrou : 0;

  // A cor mede o gasto CONTRA A RENDA — verde, âmbar, vermelho, igual às
  // Metas. Sem renda no mês não existe essa medida, e pintar de verde um
  // mês em que nada entrou seria elogiar o que não aconteceu: aí a tela
  // fica neutra de propósito.
  const classe = temRenda ? _corDaMeta(usado).classe : "";

  // A frase embaixo do número grande. É ela que transforma "R$ 3.210" em
  // informação: sozinho, o valor não diz se foi muito ou pouco.
  const frase = !temRenda
    ? (r.gastou >= 0.005
        ? "Nada entrou neste mês — tudo isto saiu de dinheiro de antes"
        : "Nada lançado neste mês")
    : usado > 1
      ? `${moeda(r.gastou - r.entrou)} a mais do que entrou`
      : `De cada R$ 100 que entraram, você gastou R$ ${Math.round(usado * 100)}`;

  const linhaCategoria = ([cat, v]) => `
    <div class="rel-cat">
      <div class="rel-cat-topo">
        <span class="rel-cat-nome">${iconeDoLancamento({ tipo: "saida", categoria: cat })} ${esc(cat)}</span>
        <strong class="rel-cat-valor">${moeda(v)}</strong>
      </div>
      <div class="rel-cat-barra"><span style="width:${r.gastou > 0 ? (v / r.gastou) * 100 : 0}%"></span></div>
      <small class="rel-cat-pct">${r.gastou > 0 ? Math.round(v / r.gastou * 100) : 0}% do que você gastou</small>
    </div>`;

  // A nota só cita o que de fato aconteceu neste mês. Explicação genérica
  // de coisa que não está na tela é ruído; com o valor na frente, ela vira
  // a resposta pra "por que isto não bate com o Resumo?".
  const ajustes = [];
  if (r.saldoTrazido >= 0.005) {
    ajustes.push(`Não entram aqui ${moeda(r.saldoTrazido)} de saldo trazido de
                  ${soNomeDoMes(mesVizinho(mesAtual, -1))}: é dinheiro que já era
                  seu, não renda nova deste mês.`);
  }
  if (r.guardado >= 0.005) {
    ajustes.push(`Também não entram ${moeda(r.guardado)} que você guardou: sair da
                  conta pra poupar não é gastar.`);
  }

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_BARRAS}</span>
        <span class="lancamento-caption">Análise</span>
        <h2>Relatórios e projeções</h2>
      </div>
    </section>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarMesRelatorio(-1)" aria-label="Mês anterior">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mesAtual)}</strong>
        <button class="pilula" onclick="trocarMesRelatorio(1)" aria-label="Próximo mês">›</button>
      </div>
    </div>

    <div class="rel-topo ${classe}">
      <span class="rel-topo-rotulo">Você gastou</span>
      <strong>${moeda(r.gastou)}</strong>
      <div class="rel-topo-barra"><span style="width:${Math.min(100, usado * 100)}%"></span></div>
      <small>${frase}</small>
    </div>

    <div class="fatura-resumo">
      <div><small>Entrou</small><strong>${moeda(r.entrou)}</strong></div>
      <div><small>Gastou</small><strong>${moeda(r.gastou)}</strong></div>
      <div class="${r.vazio ? "" : r.sobrou >= 0 ? "destaque" : "destaque-ruim"}">
        <small>${r.sobrou >= 0 ? "Sobrou" : "Faltou"}</small>
        <strong>${moeda(Math.abs(r.sobrou))}</strong>
      </div>
    </div>

    <div class="bloco">
      <div class="bloco-topo">
        <h2>Para onde foi o dinheiro</h2>
        ${r.ranking.length > 1 ? `<span class="rel-conta">${r.ranking.length} categorias</span>` : ""}
      </div>
      ${r.ranking.length
        ? `<div class="rel-cats">${r.ranking.map(linhaCategoria).join("")}</div>`
        : `<p class="vazio">Nenhum gasto em ${soNomeDoMes(mesAtual)}.</p>`}
    </div>

    <div class="bloco rel-nota">
      <h3>Como esta conta é feita</h3>
      <p>
        Conta as saídas do extrato <b>e as compras do cartão</b>, cada uma no
        mês em que você comprou — passar o cartão é gastar, mesmo que o
        dinheiro só saia da conta na fatura. O pagamento da fatura fica de
        fora pra não contar a mesma despesa duas vezes.
      </p>
      <p>
        É o mesmo critério das <b>Metas</b>. O <b>Resumo</b> faz outra conta,
        a do extrato: lá você vê o que saiu da conta, aqui o que você gastou.
      </p>
      ${ajustes.map(a => `<p>${a}</p>`).join("")}
    </div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}
