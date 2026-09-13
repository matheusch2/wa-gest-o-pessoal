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

  /* "SUBIU 1942%" NÃO É FRASE QUE AJUDA NINGUÉM. Percentual grande deixa
     de ser medida e vira barulho: ninguém imagina 1942%, e a pessoa lê o
     número como erro do app. Passando de três vezes a média, a frase
     troca de régua e fala em vezes, que é como se fala. */
  const vezes = pior.valor / pior.media;
  const quanto = vezes >= 3
    ? `<b>${vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes</b> a sua média`
    : `<b>${Math.round((vezes - 1) * 100)}%</b> acima da sua média`;

  return {
    tom: "atencao",
    texto: `<b>${esc(pior.cat)}</b> foi ${quanto}: ${_vlr(pior.valor)} contra ${_vlr(pior.media)}.`,
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

/* ─── O que as assinaturas custam ───────────────────────────────────── */

// Quanto sai por mês em assinatura, e quanto isso dá no ano. Assinatura
// é o gasto que ninguém soma: R$ 39,90 aqui, R$ 21,90 ali, e no fim do
// ano deu mais que a viagem que não coube no orçamento.
function _assinaturasAtivas(mesRef) {
  return comprasCartao.filter(c => c.recorrente && _compraNoMes(c, mesRef));
}

function _avisoAssinaturas(mesRef) {
  const ativas = _assinaturasAtivas(mesRef);
  if (!ativas.length) return null;

  const porMes = _cent(ativas.reduce((s, c) => s + Number(c.valor), 0));
  return {
    tom: "atencao",
    texto: `${ativas.length === 1 ? "Sua assinatura soma" : `Suas ${ativas.length} assinaturas somam`}
            <b>${_vlr(porMes)} por mês</b> — <b>${_vlr(porMes * 12)} por ano</b>.`,
  };
}

/* ═══ A LINHA DO TEMPO ════════════════════════════════════════════════
   O Resumo só enxerga um mês. É aqui que se vê o desenho: o mês em que
   apertou, o mês em que sobrou, e se a linha está subindo ou descendo.
   Só meses com movimento — mês em que a pessoa não usou o app viraria um
   buraco no gráfico e leria como "não gastei nada". */

function _linhaDoTempo(mesRef, quantos) {
  const meses = _mesesAnteriores(mesRef, quantos - 1);
  if (_temMovimento(mesRef)) meses.push(mesRef);
  return meses.map(m => {
    const r = _retratoDoMes(m);
    return { mes: m, entrou: r.entrou, gastou: r.gastou, sobrou: r.sobrou };
  });
}

/* ═══ O QUE JÁ ESTÁ COMPROMETIDO ══════════════════════════════════════
   A projeção mais honesta que existe, porque não é adivinhação: tudo
   isto JÁ ESTÁ CADASTRADO. São três naturezas diferentes, e elas ficam
   separadas de propósito, porque a pergunta que importa é "quanto disso
   eu consigo desfazer?":

     PARCELAS      já foram contratadas. Não tem o que fazer: vão cair.
     ASSINATURAS   caem até você cancelar. Dá pra desfazer hoje.
     CONTAS FIXAS  aluguel, energia, internet. Vão vir de todo jeito.

   Tudo pelo mês em que o dinheiro SAI: o cartão pelo vencimento da
   fatura, a conta pelo vencimento dela. É a mesma régua da reserva do
   Resumo — usar outra aqui faria as duas telas discordarem sobre o mesmo
   mês, que é o defeito que mais dói neste app. */

function _comprometidoPorMes(mesRef, quantos) {
  const meses = Array.from({ length: quantos }, (_, i) => mesVizinho(mesRef, i + 1));
  const linhas = meses.map(m => ({ mes: m, parcelas: 0, assinaturas: 0, fixas: 0 }));
  const porMes = Object.fromEntries(linhas.map(l => [l.mes, l]));

  for (const cartao of cartoes) {
    // Um teto de busca: a fatura de daqui a 60 meses não interessa a
    // ninguém, e assinatura ativa não dá fim ao laço sozinha.
    for (let i = 1; i <= quantos + 12; i++) {
      const mesFatura = _somaMes(_mesFaturaAberta(cartao), i - 1);
      const venc = mesDe(_vencimentoDaFatura(mesFatura, cartao.dia_fechamento, cartao.dia_vencimento));
      const alvo = porMes[venc];
      if (!alvo) continue;
      for (const item of _parcelasDaFatura(cartao, mesFatura)) {
        if (item.tipo === "parcelada") alvo.parcelas = _cent(alvo.parcelas + item.valor);
        else if (item.tipo === "assinatura") alvo.assinaturas = _cent(alvo.assinaturas + item.valor);
      }
    }
  }

  /* AS CONTAS FIXAS TÊM QUE SER PROJETADAS, e as do carnê não.
     O carnê já existe inteiro no banco, uma linha por parcela — é só
     somar as que caem em cada mês. A conta fixa não: o app só cria a do
     mês seguinte quando a atual é paga, então lá na frente não há linha
     nenhuma. Projetar é repetir o último valor conhecido de cada nome.

     E só onde não existe linha de verdade: contar as duas coisas faria o
     aluguel aparecer duas vezes no mês que o app já preparou. */
  const fixas = new Map();
  for (const c of contas) {
    if (!c.recorrente) continue;
    const atual = fixas.get(c.nome);
    if (!atual || c.vencimento > atual.vencimento) fixas.set(c.nome, c);
  }

  for (const l of linhas) {
    for (const c of contas) {
      if (c.pago || mesDe(c.vencimento) !== l.mes) continue;
      if (c.recorrente) l.fixas = _cent(l.fixas + Number(c.valor));
      else if (_parteDoCarne(c.nome)) l.parcelas = _cent(l.parcelas + Number(c.valor));
    }
    for (const [nome, c] of fixas) {
      const jaTem = contas.some(x => x.nome === nome && mesDe(x.vencimento) === l.mes);
      if (!jaTem) l.fixas = _cent(l.fixas + Number(c.valor));
    }
    l.total = _cent(l.parcelas + l.assinaturas + l.fixas);
  }

  return linhas;
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
    _avisoAssinaturas(mesRef),
    _avisoCategoriaQueSubiu(mesRef),
    _avisoMesesNoAzul(mesRef),
  ].filter(Boolean)
   // O que dói primeiro. Alerta no fim da lista é alerta que não foi lido.
   .sort((a, b) => _PESO_TOM[a.tom] - _PESO_TOM[b.tom]);
}

/* ═══ OS GRÁFICOS ═════════════════════════════════════════════════════
   O Chart.js pesa mais que o app inteiro e chega depois, de um CDN. Se
   ele não vier, NADA nesta tela pode sumir junto: por isso todo número
   que o gráfico desenha está também escrito em texto ali do lado ou
   embaixo. O desenho é o extra; a frase é o conteúdo. */

function _corDoTema(nome) {
  const v = getComputedStyle(document.body).getPropertyValue(nome).trim();
  return v || "#0f3b5c";
}

/* AS CORES SEGUEM O TEMA, e isso não é capricho: o azul da marca é
   #0f3b5c, e no modo escuro ele fica quase igual ao fundo do bloco. O
   bloco das "Parcelas" — que é o maior do gráfico de projeção —
   simplesmente sumia, e sobrava um gráfico que dizia menos do que a
   soma escrita embaixo dele.

   Por isso as duas primeiras saem das variáveis do tema (elas já têm um
   tom claro no escuro) e as outras são tons que funcionam nos dois
   fundos. A última é o cinza do tema, pra fatia "Outros". */
function _coresDoGrafico() {
  return [_corDoTema("--marca-txt"), _corDoTema("--dourado"),
          "#0ea5e9", "#db2777", "#8b5cf6", "#14b8a6", _corDoTema("--fraco")];
}

// A projeção tem três blocos empilhados e eles precisam se distinguir no
// escuro também, onde a marca já é azul-claro: o roxo entra no lugar do
// azul-céu, que ficaria colado nela.
function _coresDaProjecao() {
  return [_corDoTema("--marca-txt"), _corDoTema("--dourado"), "#8b5cf6"];
}

// Os eixos e as grades seguem o tema: no escuro, o cinza-claro do Chart.js
// some no fundo e o gráfico fica boiando sem referência.
function _eixos(empilhado) {
  const fraco = _corDoTema("--fraco");
  const grade = "color-mix(in srgb, " + fraco + " 22%, transparent)";
  return {
    x: { stacked: !!empilhado, grid: { display: false },
         ticks: { color: fraco, font: { size: 10 } } },
    y: { stacked: !!empilhado, beginAtZero: true, border: { display: false },
         grid: { color: grade }, ticks: { color: fraco, font: { size: 10 },
         callback: v => "R$ " + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) } },
  };
}

const _DICA = { callbacks: { label: c => c.dataset.label + ": " + moeda(c.parsed.y ?? c.parsed) } };

async function _desenharGraficosDoRelatorio(dados) {
  if (!(await carregarChart())) return;

  // Buscar a biblioteca leva tempo, e nesse tempo a pessoa pode ter saído
  // da tela. Por isso os canvas são procurados DE NOVO aqui: os de antes
  // já podem não existir, e desenhar neles seria desenhar no nada.
  const pegar = id => document.getElementById(id);
  const comum = { responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } } };

  const cvCat = pegar("rel-canvas-cat");
  if (cvCat && dados.ranking.length) {
    const top = dados.ranking.slice(0, 6);
    const resto = dados.ranking.slice(6).reduce((s, r) => s + r[1], 0);
    graficos.push(new Chart(cvCat.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: top.map(r => r[0]).concat(resto > 0 ? ["Outros"] : []),
        datasets: [{ data: top.map(r => r[1]).concat(resto > 0 ? [resto] : []),
                     backgroundColor: _coresDoGrafico(), borderWidth: 0 }],
      },
      options: Object.assign({}, comum, { cutout: "58%",
        plugins: { legend: { display: false },
                   tooltip: { callbacks: { label: c => c.label + ": " + moeda(c.parsed) } } } }),
    }));
  }

  const cvTempo = pegar("rel-canvas-tempo");
  if (cvTempo && dados.tempo.length) {
    graficos.push(new Chart(cvTempo.getContext("2d"), {
      type: "bar",
      data: {
        labels: dados.tempo.map(x => soNomeDoMes(x.mes).slice(0, 3)),
        datasets: [
          { label: "Entrou", data: dados.tempo.map(x => x.entrou),
            backgroundColor: _corDoTema("--entrada"), borderRadius: 4 },
          { label: "Gastou", data: dados.tempo.map(x => x.gastou),
            backgroundColor: _corDoTema("--saida"), borderRadius: 4 },
        ],
      },
      options: Object.assign({}, comum, { scales: _eixos(false),
        plugins: { legend: { display: false }, tooltip: _DICA } }),
    }));
  }

  const cvProj = pegar("rel-canvas-proj");
  if (cvProj && dados.projecao.some(x => x.total > 0)) {
    graficos.push(new Chart(cvProj.getContext("2d"), {
      type: "bar",
      data: {
        labels: dados.projecao.map(x => soNomeDoMes(x.mes).slice(0, 3)),
        datasets: [
          { label: "Parcelas", data: dados.projecao.map(x => x.parcelas),
            backgroundColor: _coresDaProjecao()[0], borderRadius: 3 },
          { label: "Assinaturas", data: dados.projecao.map(x => x.assinaturas),
            backgroundColor: _coresDaProjecao()[1], borderRadius: 3 },
          { label: "Contas fixas", data: dados.projecao.map(x => x.fixas),
            backgroundColor: _coresDaProjecao()[2], borderRadius: 3 },
        ],
      },
      options: Object.assign({}, comum, { scales: _eixos(true),
        plugins: { legend: { display: false }, tooltip: _DICA } }),
    }));
  }
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

  /* A LISTA GANHOU A ROSCA DO LADO. A barrinha por categoria dizia a
     mesma coisa seis vezes seguidas e nenhuma delas de relance: pra saber
     se o mercado era metade do mês, a pessoa tinha que comparar
     comprimentos empilhados. A rosca responde isso num olhar, e a lista
     continua trazendo o que a rosca não tem — o valor de cada uma, e
     TODAS elas, não só as seis maiores.

     A bolinha colorida liga as duas: a cor da fatia é a cor da linha. */
  const cores = _coresDoGrafico();
  const proj = _coresDaProjecao();
  const linhaCategoria = ([cat, v], i) => `
    <div class="rel-cat">
      <span class="rel-cat-ponto" style="background:${cores[Math.min(i, cores.length - 1)]}"></span>
      <span class="rel-cat-nome">${iconeDoLancamento({ tipo: "saida", categoria: cat })} ${esc(cat)}</span>
      <span class="rel-cat-pct">${r.gastou > 0 ? Math.round(v / r.gastou * 100) : 0}%</span>
      <strong class="rel-cat-valor">${moeda(v)}</strong>
    </div>`;

  const tempo = _linhaDoTempo(mesAtual, 6);
  const projecao = _comprometidoPorMes(mesAtual, 6);
  const totalProjetado = _cent(projecao.reduce((s, x) => s + x.total, 0));
  const mediaGasto = tempo.length
    ? _cent(tempo.reduce((s, x) => s + x.gastou, 0) / tempo.length) : 0;

  const legenda = (cor, nome, valor) => `
    <div class="rel-legenda-item">
      <span class="rel-cat-ponto" style="background:${cor}"></span>
      <span>${nome}</span>
      <strong>${moeda(valor)}</strong>
    </div>`;

  /* A EXPLICAÇÃO DE COMO A CONTA É FEITA SAIU DAQUI. Eram dois parágrafos
     fixos, sempre iguais, no pé de toda visita — e ninguém lê a mesma
     aula duas vezes. Ela vive nos comentários deste arquivo, que é onde
     ela serve pra alguma coisa.

     O QUE FICOU é o que não é genérico: a linha que aparece SÓ no mês em
     que houve saldo trazido ou dinheiro guardado, com o valor na frente.
     Essa não é aula, é a resposta pra "por que isto não bate com o
     Resumo?" — e sem ela a pergunta vira desconfiança no app. */
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
      ${r.ranking.length ? `
        <div class="rel-rosca">
          <canvas id="rel-canvas-cat"></canvas>
          <div class="rel-rosca-meio"><small>Gasto</small><strong>${moeda(r.gastou)}</strong></div>
        </div>
        <div class="rel-cats">${r.ranking.map(linhaCategoria).join("")}</div>`
        : `<p class="vazio">Nenhum gasto em ${soNomeDoMes(mesAtual)}.</p>`}
    </div>

    ${tempo.length > 1 ? `
      <div class="bloco">
        <div class="bloco-topo">
          <h2>Como os meses vêm indo</h2>
          <span class="rel-conta">${tempo.length} meses</span>
        </div>
        <div class="rel-grafico"><canvas id="rel-canvas-tempo"></canvas></div>
        <div class="rel-legenda">
          ${legenda(_corDoTema("--entrada"), "Entrou", _cent(tempo.reduce((s, x) => s + x.entrou, 0)))}
          ${legenda(_corDoTema("--saida"), "Gastou", _cent(tempo.reduce((s, x) => s + x.gastou, 0)))}
        </div>
        <p class="rel-rodape">Você gasta <b>${_vlr(mediaGasto)}</b> por mês, em média.</p>
      </div>` : ""}

    ${totalProjetado > 0 ? `
      <div class="bloco">
        <div class="bloco-topo">
          <h2>O que já está comprometido</h2>
          <strong class="resumo-total-saida">${moeda(totalProjetado)}</strong>
        </div>
        <div class="rel-grafico"><canvas id="rel-canvas-proj"></canvas></div>
        <div class="rel-legenda">
          ${legenda(proj[0], "Parcelas", _cent(projecao.reduce((s, x) => s + x.parcelas, 0)))}
          ${legenda(proj[1], "Assinaturas", _cent(projecao.reduce((s, x) => s + x.assinaturas, 0)))}
          ${legenda(proj[2], "Contas fixas", _cent(projecao.reduce((s, x) => s + x.fixas, 0)))}
        </div>
        <p class="rel-rodape">
          Dos próximos 6 meses, <b>${_vlr(totalProjetado)}</b> já têm dono — o mês
          mais pesado é <b>${soNomeDoMes(projecao.reduce((a, b) => (b.total > a.total ? b : a)).mes)}</b>,
          com ${_vlr(Math.max(...projecao.map(x => x.total)))}. Isto não é chute:
          é o que já está cadastrado.
        </p>
      </div>` : ""}

    ${ajustes.length ? `
      <div class="bloco rel-nota">${ajustes.map(a => `<p>${a}</p>`).join("")}</div>` : ""}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;

  // Depois do innerHTML, e sem travar o desenho: os números já estão na
  // tela, o gráfico deles é o que chega em seguida.
  setTimeout(() => _desenharGraficosDoRelatorio({ ranking: r.ranking, tempo, projecao }), 0);
}
