/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: reservas — dinheiro guardado fora da conta corrente.
 */

/* ═══ A TERCEIRA NATUREZA DE DINHEIRO ═════════════════════════════════
   O app conhecia duas: o que entra e o que sai. Reserva é a terceira —
   dinheiro que SAIU DA CONTA e CONTINUA SENDO SEU.

   É por isso que ela não podia ser só mais uma categoria de lançamento.
   Como categoria de saída, guardar R$ 500 apareceria no relatório como
   R$ 500 gastos, e o mês em que a pessoa mais poupou seria o mês em que
   ela mais "gastou". Como entrada, resgatar viraria renda, e a tela diria
   que ela ganhou um dinheiro que ela própria tinha posto ali.

   Então cada movimento tem DOIS lados:

     1. um LANÇAMENTO no extrato, porque o dinheiro de fato saiu (ou
        voltou) da conta corrente, e o Resumo tem que continuar batendo
        com o aplicativo do banco;

     2. uma linha em movimentos_reserva, que é quem sabe que aquele
        lançamento não é gasto nem renda — e o relatório desconta os dois
        pelo id, em _idsDeReserva().

   Sem o lado 1, o Resumo mostraria saldo que não existe. Sem o lado 2, o
   relatório chamaria poupança de gasto. Os dois juntos é a única
   combinação em que nenhuma tela mente. */

/* ═══ QUANTAS RESERVAS ════════════════════════════════════════════════
   Quantas a pessoa quiser, e isso não é generosidade de recurso: é a
   única forma de a tela responder "posso usar?". "Tenho R$ 8.000
   guardados" não responde nada quando R$ 6.000 deles são a emergência e
   R$ 2.000 são a viagem de dezembro. Separadas, cada saldo responde por
   si. */

// O saldo NÃO é campo no banco: é a soma dos movimentos. Mesma decisão da
// fatura do cartão. Saldo gravado é um número que pode discordar do
// histórico que o explica, e aí não há como saber qual dos dois mentiu.
function _saldoDaReserva(id) {
  let total = 0;
  for (const m of movimentosReserva) {
    if (m.reserva_id !== id) continue;
    total += m.tipo === "guardar" ? Number(m.valor) : -Number(m.valor);
  }
  return Math.round(total * 100) / 100;
}

function _totalGuardado() {
  return Math.round(reservas.reduce((s, r) => s + _saldoDaReserva(r.id), 0) * 100) / 100;
}

function _movimentosDaReserva(id) {
  return movimentosReserva
    .filter(m => m.reserva_id === id)
    .slice()
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) ||
                    String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

/* ═══ O NÚMERO QUE DÁ SENTIDO AO SALDO ════════════════════════════════
   "Você tem R$ 6.000 guardados" é um número sem régua: pode ser muito ou
   pouco, depende de quanto custa a sua vida. "Cobre 3 meses" é a mesma
   informação com a régua dentro, e é a pergunta que uma reserva de
   emergência existe pra responder.

   A média vem de _gastoMedioMensal(), em relatorios.js — a MESMA que a
   tela de relatórios escreve embaixo do gráfico. Calcular a média aqui de
   outro jeito faria as duas telas discordarem sobre quanto custa um mês
   da mesma pessoa, que é o defeito que mais dói neste app. */

function _mesesQueAReservaCobre(total) {
  const media = _gastoMedioMensal(6);
  if (media < 0.005) return null;
  return { media, meses: total / media };
}

// "3,4 meses" com uma casa até 10; depois disso a casa decimal não
// acrescenta nada — quem tem um ano guardado não precisa saber do décimo.
function _mesesPorExtenso(n) {
  if (n < 0.05) return "nada";
  if (n < 1) return "menos de um mês";
  const txt = n < 10
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : String(Math.round(n));
  return txt + (n < 2 ? " mês" : " meses");
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

const _ICO_RESERVA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 5.5c-.6.6-1 1.4-1.1 2.3A10.6 10.6 0 0 0 12 6.5c-4.7 0-8.5 2.9-8.5 6.5 0 1.9 1 3.6 2.7 4.8V20h3v-1.7c.4.1.9.1 1.3.1h3c.4 0 .9 0 1.3-.1V20h3v-2.2c.9-.6 1.6-1.5 2-2.4h1.2a.8.8 0 0 0 .8-.8v-2.2a.8.8 0 0 0-.8-.8h-1.3a6 6 0 0 0-1.2-1.7z"/><circle cx="8.5" cy="12" r="1"/><path d="M11.5 6.7 10.5 4"/></svg>`;

const _ICO_MAIS = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const _ICO_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

function abrirReservas() { abrirTela(desenharReservas); }

/* AS TABELAS PODEM NÃO ESTAR LÁ, e a tela tem que dizer isso. Esta parte
   do app chegou depois do banco de quem já usa: quem não rodou o banco.sql
   de novo não tem as tabelas, e uma lista vazia mentiria — leria como "não
   tenho reserva nenhuma" em vez de "esta parte ainda não foi instalada".

   O app em volta continua inteiro: o carregamento trata tabela que falta
   como lista vazia de propósito, pra que a falta fique dentro da tela que
   depende dela em vez de derrubar as outras oito. */
function _faltaOBancoDasReservas() {
  return faltaATabela("reservas") || faltaATabela("movimentos_reserva");
}

function desenharReservas() {
  destruirGrafico();

  if (_faltaOBancoDasReservas()) {
    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
        <div class="lancamento-cabecalho">
          <span class="lancamento-cabecalho-icone">${_ICO_RESERVA}</span>
          <span class="lancamento-caption">Guardado</span>
          <h2>Reservas</h2>
        </div>

        <div class="bloco">
          <p class="em-breve-txt">
            Esta parte é nova e precisa de uma atualização no banco — ela
            guarda as reservas em tabelas que o seu Supabase ainda não tem.
          </p>
          <p class="cartao-dica" style="margin-top:12px">
            Abra o Supabase, vá em <b>SQL Editor → New query</b>, cole o
            <b>banco.sql</b> do projeto inteiro e rode. Ele não estraga nada
            do que já existe: tudo lá dentro só cria o que estiver faltando.
            Depois, feche e abra o app.
          </p>
        </div>

        <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
      </section>`;
    return;
  }

  const total = _totalGuardado();
  const cobertura = _mesesQueAReservaCobre(total);

  // Com objetivo, quem está mais longe de alcançá-lo aparece primeiro: é a
  // que precisa de atenção. Sem objetivo, a maior na frente.
  const lista = reservas.slice().sort((a, b) => {
    const pa = a.objetivo ? _saldoDaReserva(a.id) / Number(a.objetivo) : 2;
    const pb = b.objetivo ? _saldoDaReserva(b.id) / Number(b.objetivo) : 2;
    return pa - pb || a.nome.localeCompare(b.nome, "pt-BR");
  });

  const umaReserva = r => {
    const saldo = _saldoDaReserva(r.id);
    const objetivo = r.objetivo ? Number(r.objetivo) : 0;
    const pct = objetivo > 0 ? saldo / objetivo : 0;
    const completa = objetivo > 0 && saldo >= objetivo - 0.005;

    return `
      <div class="reserva-card ${completa ? "completa" : ""}" id="reserva-${r.id}"
           onclick="abrirReserva('${r.id}')">
        <div class="reserva-card-topo">
          <span class="reserva-card-nome">${esc(r.nome)}</span>
          <strong class="reserva-card-saldo">${moeda(saldo)}</strong>
        </div>
        ${objetivo > 0 ? `
          <div class="reserva-barra"><span style="width:${Math.min(100, Math.max(0, pct * 100))}%"></span></div>
          <div class="reserva-card-baixo">
            <span>${Math.round(pct * 100)}% de ${moeda(objetivo)}</span>
            <span>${completa
              ? "Objetivo alcançado"
              : "Faltam " + moeda(objetivo - saldo)}</span>
          </div>`
          : `<div class="reserva-card-baixo"><span>Sem objetivo definido</span></div>`}
      </div>`;
  };

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_RESERVA}</span>
        <span class="lancamento-caption">Guardado</span>
        <h2>Reservas</h2>
      </div>
    </section>

    <!-- A FRASE DEBAIXO DO NÚMERO É O CONTEÚDO, não enfeite. Um saldo
         guardado sozinho não diz se é muito ou pouco: "R$ 6.000" vale
         meio ano pra uma pessoa e três semanas pra outra. "Cobre 3,2
         meses" é a mesma informação com a régua dentro. -->
    <div class="contas-total">
      <span>Você tem guardado</span>
      <strong>${moeda(total)}</strong>
      <small>${
        !reservas.length
          ? "Comece pela reserva de emergência."
          : cobertura
            ? `Cobre ${_mesesPorExtenso(cobertura.meses)} da sua vida — você gasta ${moeda(cobertura.media)} por mês, em média`
            : "Lance alguns meses pra saber quantos meses isso cobre"
      }</small>
    </div>

    <button class="botao" onclick="abrirNovaReserva()">
      ${_ICO_MAIS}
      Nova reserva
    </button>

    ${lista.length
      ? `<div class="reserva-lista">${lista.map(umaReserva).join("")}</div>`
      : `<div class="bloco" style="margin-top:14px">
           <p class="vazio">Nenhuma reserva ainda.</p>
           <p class="cartao-dica" style="margin:0">
             Reserva é dinheiro que sai da conta e continua sendo seu. Crie
             uma pra emergência — a que cobre os meses em que nada entra —
             e outras pro que você está juntando: a viagem, a troca do
             carro, a obra.
           </p>
         </div>`}

    <!-- INVESTIMENTOS NÃO FICA AQUI: tem botão próprio no menu. Um atalho
         daqui pra lá seria o segundo caminho pro mesmo lugar, que é
         justamente o que acabou de sair do menu quando "Lançar saída" e
         "Lançar entrada" viraram um botão só. -->
    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ═══ UMA RESERVA ═════════════════════════════════════════════════════ */

function abrirReserva(id) {
  const r = reservas.find(x => x.id === id);
  if (!r) { erro("Reserva não encontrada."); return; }
  abrirTela(() => desenharReserva(id));
}

function desenharReserva(id) {
  destruirGrafico();

  const r = reservas.find(x => x.id === id);
  if (!r) { voltarTela(); return; }

  const saldo = _saldoDaReserva(id);
  const objetivo = r.objetivo ? Number(r.objetivo) : 0;
  const pct = objetivo > 0 ? saldo / objetivo : 0;
  const completa = objetivo > 0 && saldo >= objetivo - 0.005;
  const movs = _movimentosDaReserva(id);

  const guardado = movs.filter(m => m.tipo === "guardar").reduce((s, m) => s + Number(m.valor), 0);
  const resgatado = movs.filter(m => m.tipo === "resgatar").reduce((s, m) => s + Number(m.valor), 0);

  const umaLinha = m => `
    <div class="item" id="mov-${m.id}">
      <div class="item-icone">${m.tipo === "guardar" ? "🐷" : "↩️"}</div>
      <div class="item-txt">
        <strong>${m.tipo === "guardar" ? "Guardou" : "Resgatou"}</strong>
        <small>${dataBR(m.data)}</small>
      </div>
      <span class="item-valor ${m.tipo === "guardar" ? "entrada" : "saida"}">
        ${m.tipo === "guardar" ? "+" : "−"}${moeda(m.valor)}
      </span>
      <button class="item-x" onclick="pedirDesfazerMovimento('${m.id}')" aria-label="Desfazer">×</button>
    </div>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_RESERVA}</span>
        <span class="lancamento-caption">Reserva</span>
        <h2>${esc(r.nome)}</h2>
      </div>
    </section>

    <div class="contas-total">
      <span>Nesta reserva</span>
      <strong>${moeda(saldo)}</strong>
      <small>${objetivo > 0
        ? (completa
            ? `Objetivo de ${moeda(objetivo)} alcançado`
            : `${Math.round(pct * 100)}% de ${moeda(objetivo)} · faltam ${moeda(objetivo - saldo)}`)
        : "Sem objetivo definido"}</small>
    </div>

    <!-- A barra SOLTA, sem card em volta. Dentro de um .bloco ela virava
         um cartão branco quase vazio entre o saldo e os botões, e o que
         ela diz — 39% — já está escrito na linha de cima. Ela é o desenho
         daquele número, não outra seção. -->
    ${objetivo > 0 ? `
      <div class="reserva-barra grande ${completa ? "cheia" : ""}">
        <span style="width:${Math.min(100, Math.max(0, pct * 100))}%"></span>
      </div>` : ""}

    <!-- Os dois botões lado a lado, e guardar à esquerda: é o que mais se
         faz. Resgatar é a exceção, e botão de exceção não disputa o
         tamanho do botão do caso comum. -->
    <div class="reserva-botoes">
      <button class="botao" onclick="abrirGuardar('${id}')">
        ${_ICO_MAIS}
        Guardar
      </button>
      <button class="botao saida" onclick="abrirResgatar('${id}')" ${saldo < 0.005 ? "disabled" : ""}>
        Resgatar
      </button>
    </div>

    <div class="bloco">
      <div class="bloco-topo">
        <h2>Movimentos</h2>
        ${movs.length ? `<span class="rel-conta">${movs.length}</span>` : ""}
      </div>
      ${movs.length
        ? `<div class="lista">${movs.map(umaLinha).join("")}</div>
           <p class="rel-rodape">
             Você já guardou <b>${moeda(guardado)}</b> aqui${resgatado >= 0.005
               ? ` e resgatou <b>${moeda(resgatado)}</b>`
               : ""}.
           </p>`
        : `<p class="vazio">Nada guardado nesta reserva ainda.</p>`}
    </div>

    <div class="reserva-rodape">
      <button class="botao-editar" onclick="abrirEdicaoReserva('${id}')" aria-label="Editar">✏️</button>
      <button class="botao-editar botao-excluir" onclick="pedirExcluirReserva('${id}')" aria-label="Excluir">🗑️</button>
    </div>
    <div id="reserva-confirma"></div>

    <button class="botao-fraco" onclick="voltarTela()">Voltar</button>
  `;
}

/* ═══ CRIAR E EDITAR A RESERVA ════════════════════════════════════════ */

function abrirNovaReserva() { abrirTela(() => _desenharFormReserva(null)); }

function abrirEdicaoReserva(id) {
  const r = reservas.find(x => x.id === id);
  if (!r) { erro("Reserva não encontrada."); return; }
  abrirTela(() => _desenharFormReserva(r));
}

function _desenharFormReserva(r) {
  destruirGrafico();

  const editando = !!r;
  const icoNome = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
  const icoAlvo = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`;

  const media = _gastoMedioMensal(6);

  // Os atalhos só aparecem com média conhecida: botão "3 meses" num app
  // sem lançamento nenhum escreveria R$ 0,00 no campo e viraria um erro na
  // cara da pessoa. E só pra reserva de emergência faz sentido medir o
  // objetivo em meses — pra viagem, o objetivo é o preço da viagem.
  const atalhos = media >= 0.005 ? `
    <div class="reserva-atalhos">
      <span>Reserva de emergência:</span>
      ${[3, 6, 12].map(n => `
        <button type="button" class="pilula" onclick="_porObjetivoEmMeses(${n})">
          ${n} meses
        </button>`).join("")}
    </div>
    <p class="cartao-dica" style="margin-top:7px">
      Um mês da sua vida custa ${moeda(media)}, pela média dos últimos meses.
    </p>` : "";

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_RESERVA}</span>
      <span class="lancamento-caption">Guardado</span>
      <h2>${editando ? "Editar reserva" : "Nova reserva"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <div class="campo-label">${icoNome}<label for="rs-nome">Nome</label></div>
        <input type="text" id="rs-nome" maxlength="40" autocomplete="off"
               placeholder="Emergência, Viagem, Troca do carro"
               value="${esc(r ? r.nome : "")}">
      </div>

      <div class="campo" style="margin-bottom:0">
        <div class="campo-label">${icoAlvo}<label for="rs-objetivo">Objetivo (opcional)</label></div>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="rs-objetivo" placeholder="0,00" autocomplete="off"
                 value="${r && r.objetivo ? Number(r.objetivo).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}">
        </div>
      </div>

      <!-- OPCIONAL de verdade, e isto é decisão de produto: exigir o
           número impediria de começar quem ainda não sabe quanto quer
           juntar — que é quase todo mundo no primeiro dia. Em branco, a
           reserva só mostra o saldo, sem barra de progresso. -->
      <p class="cartao-dica">Deixe em branco se ainda não sabe o número. Dá pra pôr depois.</p>
      ${atalhos}
    </div>

    <button class="botao" onclick="salvarReserva(this, ${r ? `'${r.id}'` : "null"})">
      ${_ICO_CHECK}
      ${editando ? "Salvar alteração" : "Criar reserva"}
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;
}

function _porObjetivoEmMeses(n) {
  const media = _gastoMedioMensal(6);
  const campo = document.getElementById("rs-objetivo");
  if (!campo || media < 0.005) return;
  // Arredonda pra centena: "R$ 10.231,47 de objetivo" é precisão falsa
  // sobre uma média, e número redondo é número que se persegue.
  const alvo = Math.round(media * n / 100) * 100;
  campo.value = alvo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function salvarReserva(botao, id) {
  if (botao?.disabled) return;

  const nome = (document.getElementById("rs-nome").value || "").trim();
  const txtObjetivo = (document.getElementById("rs-objetivo").value || "").trim();
  const objetivo = txtObjetivo ? parseMoedaBR(txtObjetivo) : null;

  if (!nome) { erro("Dê um nome à reserva."); return; }
  if (txtObjetivo && (objetivo === null || objetivo <= 0)) {
    erro("O objetivo precisa ser maior que zero, ou ficar em branco."); return;
  }

  const solta = travar(botao, "Salvando...");

  if (id) {
    const { data, error } = await sb.from("reservas")
      .update({ nome, objetivo })
      .eq("id", id).eq("user_id", usuario.id)
      .select().single();
    if (error) {
      solta();
      erro(error.code === "23505" ? "Você já tem uma reserva com esse nome." : "Erro ao salvar: " + error.message);
      return;
    }
    reservas = reservas.map(x => (x.id === id ? data : x));
    ok("Reserva alterada!");
  } else {
    const { data, error } = await sb.from("reservas")
      .insert({ user_id: usuario.id, nome, objetivo })
      .select().single();
    if (error) {
      solta();
      erro(error.code === "23505" ? "Você já tem uma reserva com esse nome." : "Erro ao salvar: " + error.message);
      return;
    }
    reservas.push(data);
    reservas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    ok("Reserva criada!");
  }

  voltarTela();
}

/* ═══ EXCLUIR A RESERVA ═══════════════════════════════════════════════
   Excluir a reserva NÃO desfaz os lançamentos: o dinheiro saiu da conta
   de verdade naquele dia, e apagar isso reescreveria o extrato. O que a
   tela faz é dizer isso antes, com o saldo na frente — porque "excluir"
   com R$ 6.000 dentro é a hora exata de não deixar dúvida sobre o que
   vai acontecer com eles. */

function pedirExcluirReserva(id) {
  const alvo = document.getElementById("reserva-confirma");
  const r = reservas.find(x => x.id === id);
  if (!alvo || !r) return;
  const saldo = _saldoDaReserva(id);

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Excluir a reserva "${esc(r.nome)}"?${saldo >= 0.005
        ? ` Os ${moeda(saldo)} que estão nela deixam de ser acompanhados aqui,
            mas os lançamentos continuam no seu histórico — o dinheiro saiu
            da conta de verdade.`
        : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharReserva('${id}')">Cancelar</button>
        <button class="sim" onclick="excluirReserva(this, '${id}')">Sim, excluir</button>
      </div>
    </div>`;
  alvo.scrollIntoView({ block: "nearest" });
}

async function excluirReserva(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "...");

  const { error } = await sb.from("reservas").delete().eq("id", id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  // O banco apaga os movimentos em cascata; aqui a memória acompanha.
  reservas = reservas.filter(x => x.id !== id);
  movimentosReserva = movimentosReserva.filter(m => m.reserva_id !== id);
  ok("Reserva excluída.");
  voltarTela();
}

/* ═══ GUARDAR E RESGATAR ══════════════════════════════════════════════ */

function abrirGuardar(id) { abrirTela(() => _desenharFormMovimento(id, "guardar")); }
function abrirResgatar(id) { abrirTela(() => _desenharFormMovimento(id, "resgatar")); }

function _desenharFormMovimento(id, tipo) {
  destruirGrafico();

  const r = reservas.find(x => x.id === id);
  if (!r) { voltarTela(); return; }

  const saldo = _saldoDaReserva(id);
  const guardando = tipo === "guardar";
  const objetivo = r.objetivo ? Number(r.objetivo) : 0;
  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  // Falta pro objetivo como atalho: é o valor que a pessoa mais quer
  // digitar, e o único que ela não consegue calcular de cabeça.
  const falta = objetivo > 0 ? Math.round((objetivo - saldo) * 100) / 100 : 0;

  document.getElementById("area").innerHTML = `
    <!-- A TELA É NEUTRA, e isso foi correção de um erro meu. Pintada de
         verde pra guardar, ela dizia "entrada" em cor três centímetros
         acima da frase que diz "vira uma SAÍDA no seu extrato" — porque
         guardar é entrada pra reserva e saída pra conta, ao mesmo tempo.
         Cor não dá conta de uma coisa que é as duas; a palavra dá. Então
         a cor sai de cena e o texto responde. -->
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_RESERVA}</span>
      <span class="lancamento-caption">${esc(r.nome)}</span>
      <h2>${guardando ? "Guardar" : "Resgatar"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <label for="rv-valor">Quanto</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="rv-valor" placeholder="0,00" autocomplete="off">
        </div>
      </div>

      ${guardando && falta >= 0.005 ? `
        <div class="reserva-atalhos">
          <span>Atalho:</span>
          <button type="button" class="pilula" onclick="_porValorNoMovimento(${falta})">
            Faltam ${moeda(falta)}
          </button>
        </div>` : ""}
      ${!guardando ? `
        <div class="reserva-atalhos">
          <span>Atalho:</span>
          <button type="button" class="pilula" onclick="_porValorNoMovimento(${saldo})">
            Tudo (${moeda(saldo)})
          </button>
        </div>` : ""}

      <div class="campo lancamento-campo-data" style="margin-top:14px">
        <div class="campo-label">${icoData}<label for="rv-data">Quando</label></div>
        <input type="date" id="rv-data" value="${_hojeLocal()}">
      </div>

      <!-- O QUE VAI ACONTECER, ESCRITO ANTES. Guardar mexe no extrato, e
           quem não espera isso vai achar que o app criou um gasto do
           nada. Dizer aqui custa duas linhas e evita a desconfiança. -->
      <p class="cartao-dica">${guardando
        ? `Vira uma <b>saída</b> no seu extrato, porque o dinheiro sai da conta —
           mas não conta como gasto no relatório: guardar não é gastar.`
        : `Vira uma <b>entrada</b> no seu extrato, porque o dinheiro volta pra conta —
           mas não conta como renda no relatório: esse dinheiro já era seu.`}</p>
    </div>

    <!-- Nem vermelho nem verde, pelo mesmo motivo da tela: o botão
         vermelho do app confirma uma SAÍDA, e resgatar é saída da reserva
         e entrada na conta. Quem diz qual é o título lá em cima. -->
    <button class="botao"
            onclick="salvarMovimentoReserva(this, '${id}', '${tipo}')">
      ${_ICO_CHECK}
      ${guardando ? "Guardar" : "Resgatar"}
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;
}

function _porValorNoMovimento(v) {
  const campo = document.getElementById("rv-valor");
  if (!campo) return;
  campo.value = Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* O LANÇAMENTO NASCE PRIMEIRO, o movimento depois. É a mesma ordem do
   pagamento de fatura e do fechamento do mês, e o motivo é o mesmo: se o
   segundo passo falhar, o que sobra é um lançamento solto no extrato —
   visível, editável, apagável pela pessoa. Na ordem inversa sobraria um
   movimento de reserva sem contrapartida no extrato, e aí o Resumo
   mostraria um saldo que o banco não mostra, calado. */

async function salvarMovimentoReserva(botao, id, tipo) {
  if (botao?.disabled) return;

  const r = reservas.find(x => x.id === id);
  if (!r) { erro("Reserva não encontrada."); return; }

  const valor = parseMoedaBR(document.getElementById("rv-valor").value);
  const data = document.getElementById("rv-data").value;

  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!data) { erro("Escolha a data."); return; }

  const guardando = tipo === "guardar";
  const saldo = _saldoDaReserva(id);
  if (!guardando && valor - saldo >= 0.005) {
    erro(`Esta reserva tem ${moeda(saldo)}.`); return;
  }

  const solta = travar(botao, "Salvando...");
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const { data: lanc, error: erroLanc } = await sb.from("lancamentos").insert({
    user_id: usuario.id,
    tipo: guardando ? "saida" : "entrada",
    valor, data,
    categoria: guardando ? "Guardado" : "Resgate",
    descricao: (guardando ? "Guardado: " : "Resgate: ") + r.nome,
    chave_envio: chave,
  }).select().single();

  if (erroLanc) {
    solta();
    // 23505 aqui só acontece por toque duplo, e o primeiro toque já
    // gravou: tratar como sucesso é o certo. Igual ao resto do app.
    if (erroLanc.code === "23505") { ok(guardando ? "Já guardado." : "Já resgatado."); voltarTela(); return; }
    erro("Erro ao salvar: " + erroLanc.message);
    return;
  }

  const { data: mov, error: erroMov } = await sb.from("movimentos_reserva").insert({
    user_id: usuario.id, reserva_id: id, tipo, valor, data,
    lancamento_id: lanc.id, chave_envio: chave + "-r",
  }).select().single();

  if (erroMov) {
    // Desfaz o lançamento: sem o movimento ele é uma saída sem motivo no
    // extrato, e deixar isso lá é pior do que não ter gravado nada.
    await sb.from("lancamentos").delete().eq("id", lanc.id).eq("user_id", usuario.id);
    solta();
    erro("Erro ao salvar: " + erroMov.message);
    return;
  }

  lancamentos.unshift(lanc);
  lancamentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  movimentosReserva.unshift(mov);

  ok(guardando ? `${moeda(valor)} guardados!` : `${moeda(valor)} de volta na conta.`);
  voltarTela();
}

/* ═══ DESFAZER UM MOVIMENTO ═══════════════════════════════════════════
   Desfazer apaga os DOIS lados — o movimento e o lançamento que ele
   criou. Apagar só um deixaria as telas discordando: a reserva com um
   saldo e o extrato com outro. */

function pedirDesfazerMovimento(movId) {
  const m = movimentosReserva.find(x => x.id === movId);
  const linha = document.getElementById("mov-" + movId);
  if (!m || !linha) return;

  linha.innerHTML = `
    <div class="confirmar" style="width:100%;border:none;padding:0">
      <p>Desfazer ${m.tipo === "guardar" ? "o depósito" : "o resgate"} de
         ${moeda(m.valor)} de ${dataBR(m.data)}? O lançamento no extrato
         sai junto.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharReserva('${m.reserva_id}')">Cancelar</button>
        <button class="sim" onclick="desfazerMovimento(this, '${movId}')">Sim, desfazer</button>
      </div>
    </div>`;
}

async function desfazerMovimento(botao, movId) {
  if (botao?.disabled) return;
  const m = movimentosReserva.find(x => x.id === movId);
  if (!m) return;

  const solta = travar(botao, "...");

  const { error } = await sb.from("movimentos_reserva")
    .delete().eq("id", movId).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao desfazer: " + error.message); return; }

  if (m.lancamento_id) {
    await sb.from("lancamentos").delete().eq("id", m.lancamento_id).eq("user_id", usuario.id);
    lancamentos = lancamentos.filter(l => l.id !== m.lancamento_id);
  }
  movimentosReserva = movimentosReserva.filter(x => x.id !== movId);

  ok("Desfeito.");
  desenharReserva(m.reserva_id);
}
