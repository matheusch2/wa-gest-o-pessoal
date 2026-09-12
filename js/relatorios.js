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

/* ═══ O QUE OS NÚMEROS DIZEM ══════════════════════════════════════════
   A parte da tela que não mostra número: mostra o que o número quer
   dizer. "R$ 3.227,90" é dado; "você estourou o mercado em 3 dos últimos
   4 meses" é conselho — e é conselho que nunca erra, porque é conta.

   Cada aviso é uma função que devolve {tom, texto} ou null. Null quer
   dizer "não tenho nada a dizer sobre isso neste mês", e aviso sem o que
   dizer NÃO APARECE. Lista que mostra sempre as mesmas seis linhas vira
   paisagem, e paisagem ninguém lê — é assim que um alerta de verdade
   passa despercebido no meio dos outros cinco de mentira.

   Todos olham o mês que está na tela, e o passado A PARTIR DELE. Abrir
   agosto e ler um aviso sobre outubro seria o mesmo defeito das telas que
   discordam entre si, só que no tempo. */

// "R$ 1.500,00" não pode quebrar entre o "R$" e o número — e nestas
// frases ele quebra, porque o valor vai no meio do texto em vez de numa
// coluna. Espaço que não quebra resolve, e só aqui: mudar o moeda() do
// app inteiro por causa de uma tela seria caro pelo motivo errado.
const _vlr = v => moeda(v).replace(" ", "\u00A0");

// Mês com movimento é mês que tem lançamento ou compra. Mês em que a
// pessoa não usou o app não pode contar como "mês em que ela não gastou
// nada" — isso baixaria a média e viraria alerta em cima do vazio.
function _temMovimento(mesRef) {
  return lancamentos.some(l => mesDe(l.data) === mesRef)
      || comprasCartao.some(c => _compraNoMes(c, mesRef));
}

// Os N meses com movimento ANTES de mesRef, do mais antigo pro mais novo.
// Para de procurar em dois anos: sem esse teto, uma base vazia faria o
// laço varrer o calendário inteiro à toa.
function _mesesAnteriores(mesRef, quantos) {
  const meses = [];
  let m = mesRef;
  for (let i = 0; i < 24 && meses.length < quantos; i++) {
    m = mesVizinho(m, -1);
    if (_temMovimento(m)) meses.push(m);
  }
  return meses.reverse();
}

/* ─── A meta que vive estourando ────────────────────────────────────── */

function _avisoMetaEstourada(mesRef) {
  const meses = _mesesAnteriores(mesRef, 4);
  if (meses.length < 2) return null;   // dois meses não fazem um hábito

  const gastos = meses.map(m => _gastoDoMesPorCategoria(m));

  const contagem = metas.map(meta => {
    const teto = Number(meta.valor);
    const vezes = gastos.filter(g => (g[meta.categoria] || 0) > teto).length;
    return { categoria: meta.categoria, vezes };
  }).filter(x => x.vezes >= 2).sort((a, b) => b.vezes - a.vezes);

  if (!contagem.length) return null;

  const p = contagem[0];
  return {
    tom: "ruim",
    texto: `Você estourou a meta de <b>${esc(p.categoria)}</b> em
            <b>${p.vezes} dos últimos ${meses.length} meses</b>.`,
  };
}

/* ─── Quanto do mês já tem dono ─────────────────────────────────────── */

function _avisoObrigatorios(mesRef) {
  // Contas E faturas, e não "gastos obrigatórios" em geral. A diferença
  // não é de estilo: incluir as metas obrigatórias aqui contaria a compra
  // de mercado no cartão duas vezes, uma na meta e outra na fatura. Nome
  // preciso é o que impede a frase de mentir.
  const emContas = contas
    .filter(c => mesDe(c.vencimento) === mesRef)
    .reduce((s, c) => s + Number(c.valor), 0);

  let emFaturas = 0;
  for (const cartao of cartoes) {
    for (const mes of _mesesComFatura(cartao)) {
      const venc = _vencimentoDaFatura(mes, cartao.dia_fechamento, cartao.dia_vencimento);
      if (mesDe(venc) === mesRef) emFaturas += _totalDaFatura(cartao, mes);
    }
  }

  const obrigatorio = _cent(emContas + emFaturas);
  if (obrigatorio < 0.005) return null;

  // A renda do mês é o que entrou MAIS o que ainda vai entrar — a mesma
  // conta que o Resumo faz. Só o que já caiu daria 300% no dia 2.
  const renda = _cent(_retratoDoMes(mesRef).entrou + aReceberDoMes(mesRef).total);
  if (renda < 0.005) return null;

  const pct = Math.round((obrigatorio / renda) * 100);
  return {
    tom: pct >= 80 ? "ruim" : pct >= 60 ? "atencao" : "bom",
    texto: `Contas e faturas de ${soNomeDoMes(mesRef)} somam <b>${_vlr(obrigatorio)}</b> —
            <b>${pct}%</b> do que entra no mês.`,
  };
}

/* ─── O que as parcelas já prenderam lá na frente ───────────────────── */

// Quanto de parcela cai em cada mês DEPOIS de mesRef. Cartão pelo mês em
// que a fatura VENCE — o mesmo critério da reserva do Resumo, senão o
// mesmo dinheiro apareceria em dois meses diferentes nas duas telas.
function _parcelasPorMes(mesRef) {
  const porMes = {};
  const somar = (m, v) => { if (v >= 0.005) porMes[m] = _cent((porMes[m] || 0) + v); };

  for (const cartao of cartoes) {
    for (const mes of _mesesComFatura(cartao)) {
      const venc = mesDe(_vencimentoDaFatura(mes, cartao.dia_fechamento, cartao.dia_vencimento));
      if (venc <= mesRef) continue;
      // Só o que é PARCELA. A compra à vista de uma fatura futura é gasto
      // do mês que vem, não dívida contratada — e a frase fala de dívida.
      somar(venc, _parcelasDaFatura(cartao, mes)
        .filter(i => i.totalParcelas > 1)
        .reduce((s, i) => s + i.valor, 0));
    }
  }

  // O carnê: boleto parcelado ainda não pago.
  for (const c of contas) {
    if (c.pago || c.recorrente || !_parteDoCarne(c.nome)) continue;
    const m = mesDe(c.vencimento);
    if (m > mesRef) somar(m, Number(c.valor));
  }

  return porMes;
}

function _avisoParcelas(mesRef) {
  // Olhar o futuro a partir de um mês que já passou não diz nada útil.
  if (mesRef < mesDe(_hojeLocal())) return null;

  const porMes = _parcelasPorMes(mesRef);
  const meses = Object.keys(porMes).sort();
  if (!meses.length) return null;

  const primeiro = meses[0];
  const ultimo = meses[meses.length - 1];
  const total = _cent(meses.reduce((s, m) => s + porMes[m], 0));

  return {
    tom: "atencao",
    texto: `Suas parcelas comprometem <b>${_vlr(porMes[primeiro])}</b> em
            ${soNomeDoMes(primeiro)}${primeiro === ultimo ? "" : `, e seguem até
            <b>${mesPorExtenso(ultimo).toLowerCase()}</b> — <b>${_vlr(total)}</b> no total`}.`,
  };
}

/* ─── Este mês contra a sua média ───────────────────────────────────── */

function _avisoMedia(mesRef) {
  const meses = _mesesAnteriores(mesRef, 3);
  if (meses.length < 2) return null;

  const media = _cent(meses.reduce((s, m) => s + _retratoDoMes(m).gastou, 0) / meses.length);
  if (media < 0.005) return null;

  const atual = _retratoDoMes(mesRef).gastou;
  const diferenca = _cent(atual - media);
  const correndo = mesRef >= mesDe(_hojeLocal());

  if (diferenca >= 0.005) {
    return {
      tom: "ruim",
      texto: `Você ${correndo ? "já gastou" : "gastou"} <b>${_vlr(diferenca)} a mais</b> que
              sua média dos últimos ${meses.length} meses${correndo ? " — e o mês ainda não acabou" : ""}.`,
    };
  }

  // Gastar menos no dia 5 não é mérito, é calendário. Só vale dizer
  // "gastou menos" depois que o mês fechou.
  if (correndo) return null;
  return {
    tom: "bom",
    texto: `Você gastou <b>${_vlr(-diferenca)} a menos</b> que sua média dos
            últimos ${meses.length} meses.`,
  };
}

/* ─── A categoria que subiu sem ninguém perceber ────────────────────── */

function _avisoCategoriaQueSubiu(mesRef) {
  const meses = _mesesAnteriores(mesRef, 3);
  if (meses.length < 2) return null;

  const anteriores = meses.map(m => _gastoDoMesPorCategoria(m));
  const agora = _gastoDoMesPorCategoria(mesRef);

  let pior = null;
  for (const [cat, valor] of Object.entries(agora)) {
    const media = _cent(anteriores.reduce((s, g) => s + (g[cat] || 0), 0) / anteriores.length);
    // Piso de R$ 50: sem ele, um café de R$ 8 contra uma média de R$ 2
    // vira "subiu 300%" e enche a tela de alarme sobre trocado.
    if (media < 50) continue;
    const alta = _cent(valor - media);
    if (alta < 50 || valor < media * 1.3) continue;
    if (!pior || alta > pior.alta) pior = { cat, valor, media, alta };
  }
  if (!pior) return null;

  return {
    tom: "atencao",
    texto: `<b>${esc(pior.cat)}</b> subiu <b>${Math.round((pior.valor / pior.media - 1) * 100)}%</b>
            sobre a sua média: ${_vlr(pior.valor)} contra ${_vlr(pior.media)}.`,
  };
}

/* ─── Como os meses vêm terminando ──────────────────────────────────── */

function _avisoMesesNoAzul(mesRef) {
  const meses = _mesesAnteriores(mesRef, 4);
  if (meses.length < 3) return null;

  const azuis = meses.filter(m => {
    const r = _retratoDoMes(m);
    return r.entrou - r.gastou >= 0.005;
  }).length;

  if (azuis === meses.length) {
    return { tom: "bom", texto: `Você fechou <b>os últimos ${meses.length} meses no azul</b>.` };
  }
  if (azuis === 0) {
    return { tom: "ruim", texto: `Você fechou <b>os últimos ${meses.length} meses no vermelho</b>.` };
  }
  return null;   // dois e dois não é notícia, é vida normal
}

/* ─── A lista, montada ──────────────────────────────────────────────── */

const _PESO_TOM = { ruim: 0, atencao: 1, bom: 2 };
const _ICONE_TOM = { ruim: "⚠️", atencao: "🔎", bom: "✅" };

function _avisosDoMes(mesRef) {
  return [
    _avisoMetaEstourada(mesRef),
    _avisoMedia(mesRef),
    _avisoObrigatorios(mesRef),
    _avisoParcelas(mesRef),
    _avisoCategoriaQueSubiu(mesRef),
    _avisoMesesNoAzul(mesRef),
  ].filter(Boolean)
   // O que dói primeiro. Alerta no fim da lista é alerta que não foi lido.
   .sort((a, b) => _PESO_TOM[a.tom] - _PESO_TOM[b.tom]);
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
  const avisos = _avisosDoMes(mesAtual);
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

    ${avisos.length ? `
      <div class="bloco">
        <div class="bloco-topo"><h2>O que os números dizem</h2></div>
        <div class="rel-avisos">
          ${avisos.map(a => `
            <div class="rel-aviso ${a.tom}">
              <span class="rel-aviso-ico" aria-hidden="true">${_ICONE_TOM[a.tom]}</span>
              <p>${a.texto}</p>
            </div>`).join("")}
        </div>
      </div>` : ""}

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
