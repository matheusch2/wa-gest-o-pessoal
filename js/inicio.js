/* WA Finanças — js/inicio.js — A TELA INICIAL
   Copyright © 2026 Matheus.

   ═══ POR QUE ESTA TELA FOI REFEITA ════════════════════════════════════

   Eram dez botões azuis iguais, em cinco pares. "Lançar", que se usa
   todo dia, tinha o mesmo peso visual de "Investimentos", que é um botão
   antes da tela. Sem nada mandando, o olho lia os dez toda vez.

   É o mesmo defeito que o WA Aqua já tinha corrigido na tela inicial
   dele, e a correção é a mesma: TRÊS NÍVEIS em vez de um.

     1. O QUE SE FAZ TODO DIA     um botão só, dourado, grande
     2. ATALHOS                   as quatro telas de consulta
     3. GERENCIAR                 cadastro e leitura, pastilha discreta

   Mais duas coisas que o menu antigo não tinha:

     O AVISO DE CONTA VENCIDA, logo embaixo da ação do dia — não no pé da
     página. Dinheiro vencido terminava onde ninguém rola.

     O PAINEL DO MÊS, que SOMA em vez de listar: quanto você tem, quanto
     sobra, e as três parcelas dessa conta. Antes era preciso abrir o
     Resumo pra saber se o mês estava de pé.

   ═══ A COR ════════════════════════════════════════════════════════════

   A ESTRUTURA é do WA Aqua; a COR é daqui. Lá o botão principal é ouro
   porque a marca é verde; aqui é ouro porque é a cor da logo, e porque o
   azul-petróleo da marca já é o fundo do topo — botão azul sobre tela
   clara embaixo de um topo azul não lidera nada.

   O dourado também não bate com o âmbar do "vencendo": var(--dourado) é
   #c9992e e var(--aviso) é #b45309. O botão mais importante da tela não
   pode ter a cor do alerta.

   ═══ POR QUE ESTA TELA É DESENHADA, E NÃO ESCRITA NO HTML ═════════════

   Porque ela tem números, e número no HTML envelhece: ele seria o de
   quando a página carregou, não o de agora. Pagar um boleto e voltar
   pra cá precisa mexer no painel. Quem chama é voltarInicio(), no core,
   que roda toda vez que se fecha uma tela.

   E os números vêm de extratoDoMes() e contasVencidas(), no core — as
   MESMAS funções do Resumo. A sobra do painel e a sobra do Resumo são o
   mesmo número porque são a mesma conta, não porque conferem hoje. */

/* ═══ OS ÍCONES ═══════════════════════════════════════════════════════
   São os mesmos do menu antigo: cada um já foi desenhado pra sua tela e
   a pessoa já os reconhece. O que mudou foi o tamanho e a moldura. */

const _I_LANCAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="4" x2="8" y2="17"/><polyline points="4 13 8 17 12 13"/><line x1="16" y1="20" x2="16" y2="7"/><polyline points="12 11 16 7 20 11"/></svg>`;
const _I_RESUMO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
const _I_BALANCO = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="7" x2="19" y2="7"/><path d="M5 7 2 14h6z"/><path d="M19 7l-3 7h6z"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`;
const _I_CONTAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const _I_CARTAO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="3"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg>`;
const _I_HIST = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>`;
const _I_METAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`;
const _I_RELAT = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="13"/><line x1="22" y1="20" x2="22" y2="7"/></svg>`;
const _I_RESERVAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 5.5c-.6.6-1 1.4-1.1 2.3A10.6 10.6 0 0 0 12 6.5c-4.7 0-8.5 2.9-8.5 6.5 0 1.9 1 3.6 2.7 4.8V20h3v-1.7c.4.1.9.1 1.3.1h3c.4 0 .9 0 1.3-.1V20h3v-2.2c.9-.6 1.6-1.5 2-2.4h1.2a.8.8 0 0 0 .8-.8v-2.2a.8.8 0 0 0-.8-.8h-1.3a6 6 0 0 0-1.2-1.7z"/><circle cx="8.5" cy="12" r="1"/><path d="M11.5 6.7 10.5 4"/></svg>`;
const _I_INVEST = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`;
const _I_SINO = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

function desenharInicio() {
  const menu = document.getElementById("menu");
  if (!menu) return;

  /* O PAINEL É SEMPRE DO MÊS DE HOJE, nunca do mês que ficou aberto no
     Resumo. Quem navegou até março e voltou pra cá quer ver novembro —
     e o painel diz em cima qual mês ele está mostrando, então não há
     como confundir. */
  const hoje = _hojeLocal();
  const mes = mesDe(hoje);

  menu.innerHTML = `
    <button class="ini-principal" onclick="abrirLancarEscolha()">
      ${_I_LANCAR} Lançar
    </button>

    ${_avisoDeContas(hoje)}

    <div class="ini-lbl">Atalhos</div>
    <div class="ini-grade">
      ${_atalho("abrirResumo()", "var(--marca)", _I_RESUMO, "Resumo do mês")}
      ${_atalho("abrirBalanco()", "#0e7490", _I_BALANCO, "Balanço")}
      ${_atalho("abrirContas()", "#a16207", _I_CONTAS, "Contas a pagar")}
      ${_atalho("abrirCartoes()", "#6d28d9", _I_CARTAO, "Cartão")}
    </div>

    ${_painelDoMes(mes, hoje)}

    <div class="ini-lbl">Gerenciar</div>
    <div class="ini-mais">
      ${_pastilha("abrirHistorico()", "#1d4ed8", _I_HIST, "Histórico")}
      ${_pastilha("abrirMetas()", "#0891b2", _I_METAS, "Metas de gastos")}
      ${_pastilha("abrirRelatorios()", "#7c3aed", _I_RELAT, "Relatórios")}
      ${_pastilha("abrirReservas()", "#0f766e", _I_RESERVAS, "Reservas")}
      ${_pastilha("abrirInvestimentos()", "#65a30d", _I_INVEST, "Investimentos", true)}
    </div>`;

  menu.style.display = "block";
}

/* MEU NEGÓCIO NÃO ESTÁ AQUI, e a ausência é de propósito: o dono do app
   pediu pra tirar o botão porque o jeito de modelar um negócio dentro de
   um app de finanças pessoais ainda não fechou. A tela e os dados
   continuam inteiros — js/negocio.js segue carregado e as tabelas seguem
   no banco. Só o caminho até ela está fechado, e devolver o botão é
   acrescentar uma linha na grade acima. Apagar o módulo junto teria
   jogado fora o faturamento e as retiradas já lançados. */

/* AJUSTES TAMBÉM NÃO: o círculo com as iniciais, no canto do topo, já
   abre aquela tela. Dois caminhos pro mesmo lugar só ocupam espaço. */

function _atalho(acao, cor, icone, rotulo) {
  return `
    <button class="ini-btn" onclick="${acao}">
      <span class="ini-ico" style="background:${cor}">${icone}</span>
      <span>${rotulo}</span>
    </button>`;
}

/* A PASTILHA É CLARA, NÃO CHEIA. Dá vida sem competir com os atalhos de
   cima, que são os de uso frequente — a hierarquia continua de pé. */
function _pastilha(acao, cor, icone, rotulo, largo) {
  return `
    <button class="ini-btn-peq${largo ? " ini-largo" : ""}" onclick="${acao}">
      <span class="ini-ico-peq" style="background:${cor}1f;color:${cor}">${icone}</span>
      <span>${rotulo}</span>
    </button>`;
}

/* ═══ O AVISO DE CONTA ════════════════════════════════════════════════
   UMA LINHA COM UM NÚMERO, nunca uma lista — a lista cresceria com o
   tamanho do mês e empurraria o resto da tela pra baixo. Quem quer saber
   quais são toca e vai pra tela das contas.

   Vencido manda no vencendo: ter os dois ao mesmo tempo é comum, e o
   atrasado é o que precisa de decisão hoje. Dois cartões empilhados
   diriam a mesma coisa duas vezes.

   Só conta que existe no banco. A projeção de conta fixa dos meses à
   frente é assunto das Contas e dos Relatórios — trazê-la pra cá criaria
   uma terceira contagem de "quanto eu devo", e a terceira contagem é
   sempre a que discorda das outras duas. */
function _avisoDeContas(hoje) {
  const vencidas = contasVencidas();

  if (vencidas.length) {
    const total = vencidas.reduce((s, c) => s + faltaDaConta(c), 0);
    return _cartaoDeAviso(
      true,
      `${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`,
      `${moeda(total)} — a mais antiga venceu em ${dataBR(vencidas[0].vencimento)}`);
  }

  // Três dias é o prazo de quem recebe o aviso e ainda consegue agir:
  // dá tempo de o boleto cair, de o dinheiro entrar, de ir ao banco.
  const limite = _somarDias(hoje, 3);
  const vencendo = contas
    .filter(c => !c.pago && c.vencimento >= hoje && c.vencimento <= limite)
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));

  if (!vencendo.length) return "";

  const total = vencendo.reduce((s, c) => s + faltaDaConta(c), 0);
  const primeira = vencendo[0].vencimento;
  const quando = primeira === hoje ? "vence hoje"
               : primeira === _somarDias(hoje, 1) ? "vence amanhã"
               : "vence em " + dataBR(primeira);

  return _cartaoDeAviso(
    false,
    `${vencendo.length} conta${vencendo.length > 1 ? "s" : ""} vencendo`,
    `${moeda(total)} — a primeira ${quando}`);
}

function _cartaoDeAviso(vencido, titulo, detalhe) {
  return `
    <button class="ini-boletos${vencido ? " ini-boletos-vencido" : ""}" onclick="abrirContas()">
      <span class="ini-boletos-ico">${_I_SINO}</span>
      <span class="ini-boletos-txt">
        <strong>${esc(titulo)}</strong>
        <span>${esc(detalhe)}</span>
      </span>
      <span class="ini-boletos-seta">›</span>
    </button>`;
}

// Soma dias numa data AAAA-MM-DD sem passar pelo fuso: new Date("2026-11-13")
// é meia-noite em Londres, e no Brasil isso ainda é o dia 12.
function _somarDias(ymd, dias) {
  const d = _parseDataLocal(ymd);
  d.setDate(d.getDate() + dias);
  return d.getFullYear() + "-" +
         String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}

/* ═══ O PAINEL ════════════════════════════════════════════════════════
   UM NÚMERO MANDA E TRÊS ACOMPANHAM. Quatro do mesmo tamanho disputavam
   entre si e nenhum ganhava o olho.

   Em cima, as duas perguntas que fazem alguém abrir um app de dinheiro:
   QUANTO EU TENHO e QUANTO SOBRA. Embaixo, as três parcelas da segunda —
   entrou, saiu, e o que ainda tem que pagar.

   O painel é escuro de propósito: ele é o único bloco da tela que não é
   botão, e o contraste diz isso sem precisar de texto explicando. */
function _painelDoMes(mes, hoje) {
  const e = extratoDoMes(mes);
  const tem = saldoDeHoje();

  /* O RÓTULO SEGUE O SINAL, e o sinal não aparece no número. "Sobra do
     mês: -R$ 500" obriga a pessoa a ler o menos pra entender que é o
     contrário do que o rótulo diz. */
  const falta = e.sobra < 0;
  const rotulo = !e.previsto ? "Saldo do mês" : falta ? "Falta no mês" : "Sobra do mês";

  /* ZERO NÃO É NOTÍCIA BOA NEM RUIM, e por isso não ganha cor. Quem
     acabou de criar a conta via um painel de "R$ 0,00" verde dizendo
     que sobrou dinheiro, e "R$ 0,00" vermelho dizendo que saiu — três
     cores vibrantes anunciando que não aconteceu nada. */
  const zerado = v => Math.abs(v) < 0.005;

  return `
    <div class="ini-painel">
      <div class="ini-painel-topo">
        <span class="ini-painel-titulo">Seu mês hoje</span>
        <span class="ini-painel-data">${dataBR(hoje)}</span>
      </div>

      <div class="ini-herois">
        <div class="ini-heroi ${tem ? "" : "ini-heroi-vazio"}">
          <small>Você tem na conta</small>
          <b>${tem ? moeda(tem.valor) : "—"}</b>
        </div>
        <div class="ini-heroi ${zerado(e.sobra) ? "" : falta ? "ini-heroi-ruim" : "ini-heroi-bom"}">
          <small>${rotulo}</small>
          <b>${falta ? moeda(Math.abs(e.sobra)) : moeda(e.sobra)}</b>
        </div>
      </div>

      <div class="ini-risco"></div>

      <div class="ini-nums">
        <div class="ini-num ${zerado(e.entradas) ? "" : "ini-num-entrada"}"><small>Entrou</small><b>${moeda(e.entradas)}</b></div>
        <div class="ini-num ${zerado(e.saidas) ? "" : "ini-num-saida"}"><small>Saiu</small><b>${moeda(e.saidas)}</b></div>
        <div class="ini-num"><small>Falta pagar</small><b>${moeda(e.aSair.total)}</b></div>
      </div>

      ${_linhaDoPainel(tem, e)}
    </div>`;
}

/* A LINHA DE BAIXO SÓ APARECE QUANDO TEM O QUE DIZER, e diz uma coisa
   só. Sem saldo informado, o "Você tem na conta" está vazio e a linha
   explica por quê — era a única parte do painel que podia aparecer em
   branco sem motivo visível. */
function _linhaDoPainel(tem, e) {
  if (!tem) {
    return `<button class="ini-painel-linha" onclick="abrirBalanco()">
      ${_I_SINO} Informe o saldo da sua conta pra o app saber quanto você tem
    </button>`;
  }

  if (!tem.dehoje) {
    return `<button class="ini-painel-linha" onclick="abrirBalanco()">
      ${_I_SINO} Saldo informado em ${dataBR(tem.desde)} — confira se ainda bate
    </button>`;
  }

  if (e.aReceber.total > 0) {
    return `<button class="ini-painel-linha" onclick="abrirResumo()">
      ${_I_SINO} Ainda tem ${moeda(e.aReceber.total)} pra entrar este mês
    </button>`;
  }

  return "";
}
