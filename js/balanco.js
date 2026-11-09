/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: balanço — quanto você tem, quanto ainda entra, quanto ainda sai.
 */

/* ═══ O APP NUNCA SOUBE QUANTO VOCÊ TEM ═══════════════════════════════
   O Resumo mostra "saldo do mês": entradas menos saídas DAQUELE mês,
   começando do zero. Quem já tinha R$ 3.000 na conta quando instalou o
   app nunca viu esses R$ 3.000 em lugar nenhum — e quem fechou outubro
   com R$ 800 sobrando viu novembro começar em zero.

   Aqui a pessoa diz quanto tem. Esse número vira a base, e o app soma o
   que se moveu desde então pra saber o de hoje. Com isso dá pra fazer a
   única conta que esta tela existe pra fazer:

       o que eu tenho  +  o que ainda vou receber  −  o que ainda vou
       pagar  =  sobra (ou falta) até o fim do mês

   ─── O QUE ESTA TELA JÁ TEVE E NÃO TEM MAIS ──────────────────────────
   A primeira versão comparava o saldo informado com o que o app tinha
   calculado e anunciava a diferença como "faltou dinheiro na conta".
   Saiu inteira, e vale dizer por quê, pra não voltar:

   1. ERA RUÍDO NA PRIMEIRA VEZ. Sem base anterior, o app somava todos os
      lançamentos desde sempre e chamava aquilo de expectativa — alguém
      com um ano de uso abriu a tela e viu um buraco de R$ 4.180,83 que
      não existia.

   2. NÃO ERA O QUE FOI PEDIDO. A "diferença" que o dono do app queria
      era tenho + receber − pagar. A conferência banco-contra-app foi
      invenção minha por cima disso.

   3. COBRAVA UMA EXPLICAÇÃO. Toda vez que aparecia, precisava de um
      parágrafo ensinando o que ela queria dizer. Número que precisa de
      aula não cabe na tela que responde "quanto eu tenho". */

const _cBal = v => Math.round(Number(v || 0) * 100) / 100;

function _conferenciasOrdenadas() {
  return conferencias.slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

// O que se moveu na conta entre duas datas. O começo é EXCLUSIVO e o fim
// é INCLUSIVO: o saldo informado no dia 8 já contém o que foi lançado no
// dia 8, então contá-lo de novo seria contar duas vezes.
function _movimentoEntre(depoisDe, ate) {
  let total = 0;
  for (const l of lancamentos) {
    const d = String(l.data);
    if (depoisDe && d <= depoisDe) continue;
    if (d > ate) continue;
    total += l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
  }
  return _cBal(total);
}

// O saldo informado mais recente que já aconteceu. É dele que sai o
// "você tem" de hoje.
function _ultimoSaldoInformado() {
  const hoje = _hojeLocal();
  const ate = _conferenciasOrdenadas().filter(c => String(c.data) <= hoje);
  return ate.length ? ate[ate.length - 1] : null;
}

/* QUANTO VOCÊ TEM HOJE. É o último saldo informado mais o que se moveu
   desde ele. Sem nenhum saldo informado, o app NÃO SABE — e dizer que
   não sabe é melhor do que dar um número que começou do zero. */
function saldoDeHoje() {
  const u = _ultimoSaldoInformado();
  if (!u) return null;
  return {
    valor: _cBal(Number(u.saldo_informado) + _movimentoEntre(String(u.data), _hojeLocal())),
    desde: String(u.data),
    dehoje: String(u.data) === _hojeLocal(),
  };
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

const _ICO_BALANCA = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="7" x2="19" y2="7"/><path d="M5 7 2 14h6z"/><path d="M19 7l-3 7h6z"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`;
const _ICO_LAPIS_B = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;

function abrirBalanco() { abrirTela(desenharBalanco); }

function _faltaOBancoDoBalanco() { return faltaATabela("conferencias"); }

function _cabecalhoDoBalanco(titulo) {
  return `
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_BALANCA}</span>
      <span class="lancamento-caption">Saldo</span>
      <h2>${titulo}</h2>
    </div>`;
}

function desenharBalanco() {
  destruirGrafico();

  if (_faltaOBancoDoBalanco()) {
    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
        ${_cabecalhoDoBalanco("Balanço")}
        <div class="bloco">
          <p class="em-breve-txt">Esta parte é nova e precisa de uma atualização no banco.</p>
          <p class="cartao-dica" style="margin-top:12px">
            Abra o Supabase, vá em <b>SQL Editor → New query</b>, cole o
            <b>banco.sql</b> do projeto inteiro e rode. Depois, feche e abra o app.
          </p>
        </div>
        <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
      </section>`;
    return;
  }

  const hoje = saldoDeHoje();
  const mes = mesDe(_hojeLocal());
  const aReceber = aReceberDoMes(mes);
  const aPagar = aindaVaiSairDoMes(mes);
  const sobra = hoje ? _cBal(hoje.valor + aReceber.total - aPagar.total) : null;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      ${_cabecalhoDoBalanco("Balanço")}
    </section>

    <!-- O NÚMERO GRANDE É O QUE VOCÊ TEM, não o que entrou no mês. É a
         única coisa nesta tela que o app não consegue calcular sozinho:
         alguém digitou. -->
    <div class="contas-total">
      <span>${hoje ? "Você tem na conta" : "Quanto você tem na conta?"}</span>
      <strong>${hoje ? moeda(hoje.valor) : "—"}</strong>
      <small>${!hoje
        ? "O app soma seus lançamentos, mas não sabe de quanto partiu. Coloque o saldo do banco uma vez."
        : hoje.dehoje
          ? "Atualizado hoje"
          : `Do dia ${dataBR(hoje.desde)}, mais o que se moveu desde então`}</small>
    </div>

    <button class="botao" onclick="abrirAtualizarSaldo()">
      ${_ICO_LAPIS_B}
      ${hoje ? "Atualizar o saldo" : "Colocar o saldo"}
    </button>

    ${hoje ? `
      <!-- A CONTA, E SÓ ELA: tenho, mais o que vou receber, menos o que
           tenho a pagar. O horizonte é o MÊS CORRENTE, o mesmo do Resumo
           — usar outro aqui faria as duas telas discordarem sobre quanto
           sobra.

           SEM FRASE EMBAIXO. Havia um parágrafo repetindo o resultado em
           palavras ("faltam R$ 319,45 pra cobrir o que ainda vence neste
           mês"). Quatro linhas que somam e um total em corpo 21 não
           precisam de legenda; a frase só empurrava a conta pra cima e
           dizia de novo o que o número já tinha dito. -->
      <div class="bloco">
        <div class="bloco-topo"><h2>E daqui até o fim do mês</h2></div>
        <div class="balanco-conta">
          <div><span>Você tem</span><strong>${moeda(hoje.valor)}</strong></div>
          <div><span>Ainda vai receber</span><strong class="mais">+ ${moeda(aReceber.total)}</strong></div>
          <div><span>Ainda vai pagar</span><strong class="menos">− ${moeda(aPagar.total)}</strong></div>
          <div class="balanco-conta-fim ${sobra < 0 ? "ruim" : ""}">
            <span>${sobra >= 0 ? "Sobra" : "Falta"}</span>
            <strong>${moeda(Math.abs(sobra))}</strong>
          </div>
        </div>
      </div>` : ""}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ═══ COLOCAR O SALDO ═════════════════════════════════════════════════
   Um campo e um botão. Sem data (é sempre o saldo de hoje, copiado do
   app do banco agora), sem prévia, sem veredicto. Colocar de novo no
   mesmo dia simplesmente corrige o número — é por isso que a gravação é
   upsert e não insert: sem lista e sem botão de apagar, um saldo
   digitado errado precisa ter conserto, e o conserto é digitar de novo. */

function abrirAtualizarSaldo() { abrirTela(_desenharFormSaldo); }

function _desenharFormSaldo() {
  destruirGrafico();
  const tem = !!_ultimoSaldoInformado();

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    ${_cabecalhoDoBalanco(tem ? "Atualizar o saldo" : "Colocar o saldo")}

    <div class="lancamento-form">
      <div class="campo">
        <label for="cf-saldo">Quanto o banco mostra hoje</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="cf-saldo" placeholder="0,00"
                 autocomplete="off">
        </div>
      </div>

      <!-- O VALOR NÃO VEM PREENCHIDO, e isso é de propósito. Preenchido
           com o que o app calculou, o campo convidaria a confirmar sem
           olhar — e aí o número não teria vindo do banco. -->
      <p class="cartao-dica">
        Abra o app do seu banco e copie o saldo. A partir dele o app soma
        e subtrai o que você for lançando.
      </p>
    </div>

    <button class="botao" onclick="salvarSaldo(this)">
      ${_ICO_LAPIS_B}
      Salvar
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;
}

async function salvarSaldo(botao) {
  if (botao?.disabled) return;

  const saldo = parseMoedaBR(document.getElementById("cf-saldo").value);
  const data = _hojeLocal();

  // Saldo ZERO é um saldo legítimo — conta zerada existe. Por isso só o
  // campo vazio é recusado, não o número baixo.
  if (saldo === null) { erro("Informe o saldo que o banco mostra."); return; }
  if (saldo < 0) { erro("Saldo negativo não: se a conta está no cheque especial, lance isso como uma dívida."); return; }

  const solta = travar(botao, "Salvando...");
  const { data: nova, error } = await sb.from("conferencias")
    .upsert({ user_id: usuario.id, data, saldo_informado: saldo },
            { onConflict: "user_id,data" })
    .select().single();

  if (error) { solta(); erro("Erro ao salvar: " + error.message); return; }

  // Mesma regra do banco, do lado de cá: um saldo por dia, e o de hoje
  // substitui o de hoje.
  conferencias = conferencias.filter(c => String(c.data) !== data).concat([nova]);
  ok("Saldo atualizado.");
  voltarTela();
}
