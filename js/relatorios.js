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
// Moram no core.js: o Resumo precisa das mesmas, e uma regra em dois
// lugares é uma regra que vai divergir — foi assim que o "Guardado"
// virou 38% da rosca do Resumo enquanto sumia daqui.
const _idsDeFechamento = idsDeFechamento;

// Os lançamentos que nasceram de um movimento de reserva, por id. Mesma
// natureza dos de cima e pelo mesmo motivo: guardar R$ 500 na reserva de
// emergência não é gastar R$ 500, e resgatar não é ganhar. O dinheiro
// mudou de lugar, não de dono.
//
// Por id, nunca pela categoria escrita no lançamento — "Guardado" é texto
// livre, e quem criar uma categoria com esse nome à mão não pode ver os
// próprios gastos sumirem daqui.
const _idsDeReserva = idsDeReserva;

const _cent = v => Math.round(Number(v || 0) * 100) / 100;

function _retratoDoMes(mesRef) {
  const doFechamento = _idsDeFechamento();
  const deReserva = _idsDeReserva();

  let entrou = 0, saldoTrazido = 0, guardado = 0, resgatado = 0;
  for (const l of lancamentos) {
    if (mesDe(l.data) !== mesRef) continue;
    const rolagem = doFechamento.has(l.id);
    const reserva = deReserva.has(l.id);
    if (l.tipo === "entrada") {
      if (rolagem) saldoTrazido += Number(l.valor);
      else if (reserva) resgatado += Number(l.valor);
      else entrou += Number(l.valor);
    } else if (rolagem || reserva) {
      guardado += Number(l.valor);
    }
  }

  // O gasto por categoria vem pronto das Metas. O que falta é tirar dele
  // o "Guardado", que entra ali como saída comum — nas Metas é inofensivo
  // (categoria sem meta não conta pra nada), aqui inflaria o total.
  const porCat = { ..._gastoDoMesPorCategoria(mesRef) };
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || mesDe(l.data) !== mesRef) continue;
    if (!doFechamento.has(l.id) && !deReserva.has(l.id)) continue;
    const cat = l.categoria || "Outros";
    porCat[cat] = _cent((porCat[cat] || 0) - Number(l.valor));
  }

  const ranking = Object.entries(porCat)
    .map(([cat, v]) => [cat, _cent(v)])
    .filter(([, v]) => v >= 0.005)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));

  const gastou = _cent(ranking.reduce((s, [, v]) => s + v, 0));
  entrou = _cent(entrou);

  /* DE ONDE VEIO CADA PEDAÇO DO GASTO.
     "Você gastou R$ 508,91" com R$ 328,60 de assinatura no cartão é
     verdade e parece erro: o dono do app olhou e disse "eu não paguei
     isso". Não pagou mesmo — esse dinheiro sai quando a fatura for paga.
     Guardar a divisão aqui é o que deixa a tela dizer isso em vez de
     esperar que a pessoa adivinhe. */
  const noCartao = _cent(comprasCartao
    .filter(c => _compraNoMes(c, mesRef))
    .reduce((s, c) => s + Number(c.valor), 0));

  return {
    entrou, gastou,
    noCartao,
    noExtrato: _cent(gastou - noCartao),
    sobrou: _cent(entrou - gastou),
    saldoTrazido: _cent(saldoTrazido),
    guardado: _cent(guardado),
    resgatado: _cent(resgatado),
    ranking,
    vazio: entrou < 0.005 && gastou < 0.005,
  };
}

/* ═══ OS MESES QUE EXISTEM ════════════════════════════════════════════
   De quais meses dá pra falar, e em que ordem. Serve a linha do tempo e
   as médias. */

// "R$ 1.500,00" não pode quebrar entre o "R$" e o número — e nas frases
// embaixo dos gráficos ele quebra, porque o valor vai no meio do texto em
// vez de numa coluna. Espaço que não quebra resolve, e só aqui: mudar o
// moeda() do app inteiro por causa de uma tela seria caro pelo motivo
// errado.
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

/* ═══ QUANTO UM MÊS SEU CUSTA ═════════════════════════════════════════
   A média dos últimos meses com movimento. Serve pra pergunta que dá
   sentido a uma reserva: "quantos meses eu aguento sem receber nada?"

   O MÊS CORRIDO FICA DE FORA de propósito. No dia 3 ele tem três dias de
   gasto dentro; entrando na média, ele a derruba, e a reserva passaria a
   prometer cobrir mais meses do que cobre — justo o número em que não se
   pode mentir, porque é o que a pessoa vai usar se perder o emprego. */

function _gastoMedioMensal(quantos) {
  const meses = _mesesAnteriores(mesDe(_hojeLocal()), quantos || 6);
  if (!meses.length) return 0;
  return _cent(meses.reduce((s, m) => s + _retratoDoMes(m).gastou, 0) / meses.length);
}

/* ═══ O QUE JÁ ESTÁ COMPROMETIDO ══════════════════════════════════════
   A projeção mais honesta que existe, porque não é adivinhação: tudo
   isto JÁ ESTÁ CADASTRADO. São três naturezas diferentes, e elas ficam
   separadas de propósito, porque a pergunta que importa é "quanto disso
   eu consigo desfazer?":

     PARCELAS      já foram contratadas. Não tem o que fazer: vão cair.
     ASSINATURAS   caem até você cancelar. Dá pra desfazer hoje.
     CONTAS FIXAS  aluguel, energia, internet. Vão vir de todo jeito.
     DIA A DIA     mercado, gasolina, farmácia. Não têm boleto nem data,
                   mas saem todo mês — e eram o buraco desta tela.

   O DIA A DIA VEM DAS METAS MARCADAS COMO OBRIGATÓRIAS, e não de uma
   média do que foi gasto. A diferença importa: média é chute sobre o
   passado, e esta seção promete que não é chute. A meta obrigatória é um
   número que a própria pessoa escreveu dizendo "isto vai sair de todo
   jeito" — e é exatamente assim que o Resumo já a trata.

   Tudo pelo mês em que o dinheiro SAI: o cartão pelo vencimento da
   fatura, a conta pelo vencimento dela. É a mesma régua da reserva do
   Resumo — usar outra aqui faria as duas telas discordarem sobre o mesmo
   mês, que é o defeito que mais dói neste app. */

function _comprometidoPorMes(mesRef, quantos) {
  const meses = Array.from({ length: quantos }, (_, i) => mesVizinho(mesRef, i + 1));
  const linhas = meses.map(m => ({ mes: m, parcelas: 0, assinaturas: 0, fixas: 0, diaADia: 0,
                                   porCategoria: {} }));

  // O que já foi contado numa categoria, pra meta daquela categoria não
  // contar o mesmo dinheiro de novo. É a mesma regra que o Resumo usa em
  // aindaVaiSairDoMes(), e usar outra aqui faria as duas telas
  // discordarem sobre o mesmo mês.
  const somarNaCategoria = (l, cat, v) => {
    const nome = cat || "Outros";
    l.porCategoria[nome] = _cent((l.porCategoria[nome] || 0) + v);
  };
  const porMes = Object.fromEntries(linhas.map(l => [l.mes, l]));

  /* AS FATURAS SÃO VARRIDAS PELO MÊS DELAS, não a partir da que está
     aberta. A diferença aparece quando se olha o relatório de um mês que
     já passou: a fatura do mês seguinte a ele já fechou, mas ainda vence
     dentro da janela projetada — e começar na fatura aberta pulava ela,
     deixando a projeção sem a parcela que vai cair. Foi o teste que achou.

     A janela vai de um mês antes a um depois porque o vencimento pode
     cair no mês seguinte ao da fatura (fecha dia 28, vence dia 5). */
  for (const cartao of cartoes) {
    for (let i = -1; i <= quantos + 1; i++) {
      const mesFatura = _somaMes(mesRef, i);
      const venc = mesDe(_vencimentoDaFatura(mesFatura, cartao.dia_fechamento, cartao.dia_vencimento));
      const alvo = porMes[venc];
      if (!alvo) continue;
      for (const item of _parcelasDaFatura(cartao, mesFatura)) {
        if (item.tipo === "parcelada") {
          /* A PARCELA NÃO ABATE A META, e isto não é descuido. As Metas
             contam a compra no cartão no mês em que ela foi FEITA, não
             nos meses em que as parcelas caem — a escolha de gastar
             aconteceu lá atrás. Então a parcela que cai em março não
             consome a meta de março, e descontá-la aqui encolheria o dia
             a dia de um mês que ela não ocupa. */
          alvo.parcelas = _cent(alvo.parcelas + item.valor);
        } else if (item.tipo === "assinatura") {
          /* A ASSINATURA ABATE, pelo motivo espelhado: _compraNoMes() a
             conta em TODO mês em que ela corre, então ela já ocupa a meta
             da categoria dela todo mês. Sem descontar, uma assinatura de
             internet dentro de uma meta "Casa" obrigatória apareceria
             duas vezes na mesma barra. */
          alvo.assinaturas = _cent(alvo.assinaturas + item.valor);
          somarNaCategoria(alvo, item.compra.categoria, item.valor);
        }
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
      if (c.recorrente) {
        l.fixas = _cent(l.fixas + Number(c.valor));
        somarNaCategoria(l, c.categoria, Number(c.valor));
      } else if (_parteDoCarne(c.nome)) {
        l.parcelas = _cent(l.parcelas + Number(c.valor));
      }
    }
    for (const [nome, c] of fixas) {
      const jaTem = contas.some(x => x.nome === nome && mesDe(x.vencimento) === l.mes);
      if (!jaTem) {
        l.fixas = _cent(l.fixas + Number(c.valor));
        somarNaCategoria(l, c.categoria, Number(c.valor));
      }
    }

    /* O DIA A DIA: o que a meta obrigatória prevê, MENOS o que já foi
       contado naquela categoria por uma conta fixa ou assinatura.

       Sem esse desconto, uma meta "Casa" de R$ 1.400 somaria inteira com
       o aluguel de R$ 1.200 que já está na barra como conta fixa — e o
       mês apareceria com R$ 1.200 a mais do que ele pede. É o mesmo
       cuidado que o Resumo toma, e tomá-lo com régua diferente faria as
       duas telas brigarem. */
    for (const m of metas) {
      if (!m.reservar) continue;
      const falta = Number(m.valor) - (l.porCategoria[m.categoria] || 0);
      if (falta >= 0.005) l.diaADia = _cent(l.diaADia + falta);
    }

    l.total = _cent(l.parcelas + l.assinaturas + l.fixas + l.diaADia);
  }

  return linhas;
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
  return [_corDoTema("--marca-txt"), _corDoTema("--dourado"), "#8b5cf6", "#0d9488"];
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
          { label: "Dia a dia", data: dados.projecao.map(x => x.diaADia),
            backgroundColor: _coresDaProjecao()[3], borderRadius: 3 },
        ],
      },
      options: Object.assign({}, comum, { scales: _eixos(true),
        plugins: { legend: { display: false }, tooltip: _DICA } }),
    }));
  }
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

/* "SOBROU" PROMETE O QUE ESTA CONTA NÃO ENTREGA.

   A caixa mostra entrou menos gastou — o que já caiu menos o que já
   saiu. Ela NÃO desconta a conta que vence dia 20, a fatura do cartão,
   nem o mercado que ainda falta fazer. Num mês que ainda está correndo,
   chamar isso de "sobrou" faz a pessoa ler como dinheiro livre: R$ 291
   com R$ 5.274 de contas chegando no mesmo mês.

   O número do "quanto posso gastar" existe, e é o do RESUMO: lá ele
   desconta as reservas e soma o que ainda vai entrar. São duas perguntas
   diferentes, e cada uma tem a sua tela.

   Então o rótulo diz o que o número é. Mês que já acabou sobrou ou
   faltou, e aí a palavra está certa. Mês correndo é "até agora", que não
   promete nada — e é por isso que o valor aí leva sinal: "até agora" com
   um número positivo escondendo um saldo negativo seria a mesma mentira
   com outro nome. */
function _corrido(mesRef) {
  return mesRef >= mesDe(_hojeLocal());
}

/* O RÓTULO DESTA CAIXA JÁ TROCOU DUAS VEZES, e as duas por bom motivo.

   Era "Sobrou". Num mês ainda correndo isso lê como dinheiro livre, e
   não é: a caixa é entrou menos custou, e ela não desconta a conta que
   vence dia 20 nem a fatura do cartão. O número do "quanto posso gastar"
   é o do Resumo, não este.

   Virou "Até agora", que não promete nada — e aí foi longe demais: o
   dono do app olhou e perguntou "qual é esse indicador?". "Até agora" diz
   QUANDO, mas não diz O QUÊ. Se quem conhece cada número do app não sabe
   o que ele é, ninguém sabe.

   Agora diz a conta: o que RESTA DA RENDA que entrou. Nomeia o número
   sem prometer que ele está livre, e fecha de olho com a caixa do lado
   ("Entrou") e com o número grande lá em cima ("O mês custou"). */
function _rotuloDaSobra(mesRef, sobrou) {
  if (!_corrido(mesRef)) return sobrou >= 0 ? "Sobrou" : "Faltou";
  // No mês correndo a PALAVRA carrega o sinal, e o valor vai positivo:
  // "Passou da renda R$ 500" se lê de primeira, "Resta da renda −R$ 500"
  // obriga a pessoa a interpretar um menos pra entender que é o oposto.
  return sobrou >= 0 ? "Resta da renda" : "Passou da renda";
}

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
    ? (r.gastou >= 0.005 ? "E nada entrou neste mês" : "Nada lançado neste mês")
    : usado > 1
      ? `${moeda(r.gastou - r.entrou)} a mais do que entrou`
      : `Custou R$ ${Math.round(usado * 100)} de cada R$ 100 que entraram`;

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

  /* A LEGENDA PRECISAVA DE UM MARCADOR, e ela tinha um que nunca
     apareceu: o quadradinho herdava tamanho de '.rel-cat .rel-cat-ponto',
     e fora de um '.rel-cat' ele nascia com zero por zero. Três nomes e
     três valores sem nenhuma ligação visível com as três faixas da barra
     — a pessoa tinha que adivinhar qual cor era qual.

     Quadrado, e não bolinha: ele representa uma FAIXA DA BARRA, e barra
     é retângulo. O mesmo arredondamento de 3px das barras do gráfico. */
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
  if (r.resgatado >= 0.005) {
    ajustes.push(`E ${moeda(r.resgatado)} que você tirou da reserva não contam como
                  renda: esse dinheiro já era seu, só voltou pra conta.`);
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
      <!-- "VOCÊ GASTOU" PROMETIA O QUE O NÚMERO NÃO ENTREGA. Ele soma o
           extrato com as compras do cartão, e o dono do app somou as
           quatro saídas da lista e perguntou: "só foi gasto essa parte,
           como é que dá mais de 500?". Estava certo — R$ 328,60 de
           assinatura não saíram da conta dele.

           O número não mudou, porque ele responde "quanto este mês me
           custou" e as categorias logo abaixo somam exatamente ele. O que
           mudou foi a palavra: "custou" é verdade com a fatura paga ou
           não, e não finge que o dinheiro já saiu. -->
      <span class="rel-topo-rotulo">O mês custou</span>
      <strong>${moeda(r.gastou)}</strong>
      <div class="rel-topo-barra"><span style="width:${Math.min(100, usado * 100)}%"></span></div>
      <small>${frase}</small>
      ${r.noCartao >= 0.005 ? `
        <p class="rel-topo-divisao">
          <b>${_vlr(r.noExtrato)}</b> já saíram da conta ·
          <b>${_vlr(r.noCartao)}</b> saem quando você pagar a fatura
        </p>` : ""}
    </div>

    <!-- DUAS CAIXAS, E NÃO TRÊS. A do meio dizia "Gastou R$ 508,91" com o
         mesmo R$ 508,91 escrito em letra garrafal cem pixels acima — o
         mesmo número duas vezes na mesma olhada, ocupando espaço sem
         acrescentar nada.

         A conta continua inteira e continua conferível: o número grande é
         o gastou, e 800 menos 508,91 dá os 291,09 da caixa da direita. O
         que saiu foi a repetição, não a aritmética. -->
    <div class="fatura-resumo">
      <div><small>Entrou</small><strong>${moeda(r.entrou)}</strong></div>
      <div class="${r.vazio ? "" : r.sobrou >= 0 ? "destaque" : "destaque-ruim"}">
        <small>${_rotuloDaSobra(mesAtual, r.sobrou)}</small>
        <strong>${moeda(Math.abs(r.sobrou))}</strong>
      </div>
    </div>

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
          ${legenda(proj[3], "Dia a dia", _cent(projecao.reduce((s, x) => s + x.diaADia, 0)))}
        </div>
        <!-- Esta linha só aparece enquanto o dia a dia está vazio, e ela
             some sozinha no dia em que a primeira meta obrigatória for
             criada. É a resposta pra "por que o mercado não está aqui?",
             que é a primeira pergunta que esta tela provoca. -->
        ${projecao.every(x => x.diaADia < 0.005) ? `
          <p class="rel-falta">
            Mercado, gasolina e farmácia não entram porque ainda não têm meta
            obrigatória. Crie uma em <b>Metas de gastos</b> e elas passam a
            contar aqui.
          </p>` : ""}
      </div>` : ""}

    ${ajustes.length ? `
      <div class="bloco rel-nota">${ajustes.map(a => `<p>${a}</p>`).join("")}</div>` : ""}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;

  // Depois do innerHTML, e sem travar o desenho: os números já estão na
  // tela, o gráfico deles é o que chega em seguida.
  setTimeout(() => _desenharGraficosDoRelatorio({ ranking: r.ranking, tempo, projecao }), 0);
}
