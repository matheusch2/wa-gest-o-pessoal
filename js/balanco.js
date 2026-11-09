/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: balanço — conferir o saldo real contra o que o app calculou.
 */

/* ═══ O APP NUNCA SOUBE QUANTO VOCÊ TEM ═══════════════════════════════
   O Resumo mostra "saldo do mês": entradas menos saídas DAQUELE mês,
   começando do zero. Quem já tinha R$ 3.000 na conta quando instalou o
   app nunca viu esses R$ 3.000 em lugar nenhum — e quem fechou outubro
   com R$ 800 sobrando viu novembro começar em zero.

   Isso dá pra viver, e o app viveu até aqui. O que não dá é responder a
   pergunta que faz alguém abrir um app de dinheiro de manhã: "quanto eu
   tenho?". A resposta exigia o número que só o banco sabe.

   Agora a pessoa diz. E dizer uma vez resolve duas coisas:

   1. O SALDO PASSA A EXISTIR. Informado o saldo de um dia, o app soma o
      que se moveu desde então e sabe o de hoje.

   2. A CONTA PASSA A SER CONFERÍVEL. Na conferência seguinte, a
      diferença entre o que o app esperava e o que o banco mostra é
      exatamente o que ficou sem lançar. É o erro aparecendo sozinho, em
      vez de ficar escondido somando mês a mês. */

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

/* O QUE O APP ACHA QUE VOCÊ TINHA NUMA DATA.
   Parte da conferência anterior mais recente e soma o movimento desde
   ela.

   SEM CONFERÊNCIA ANTERIOR, DEVOLVE null — e isso é a correção de um
   defeito que foi parar na mão do usuário. Antes, sem âncora, esta
   função somava TUDO desde sempre, a partir do zero. Numa conta que
   nunca foi conferida isso não é uma expectativa, é a soma dos
   lançamentos de todos os meses: alguém com um ano de app via "o app
   esperava R$ 7.201,83" e um buraco de R$ 4.180,83 na PRIMEIRA
   conferência, que é justamente a única que não tem com o que ser
   comparada.

   Devolver null em vez de um número obriga quem chama a tratar o caso,
   que é o que ninguém fez da primeira vez. */
function saldoCalculadoEm(data, ignorarId) {
  const antes = _conferenciasOrdenadas()
    .filter(c => String(c.data) < data && c.id !== ignorarId);
  if (!antes.length) return null;
  const base = antes[antes.length - 1];
  return _cBal(Number(base.saldo_informado) + _movimentoEntre(String(base.data), data));
}

// A conferência mais recente que já aconteceu. É dela que sai o "você
// tem" de hoje.
function _ultimaConferencia() {
  const hoje = _hojeLocal();
  const ate = _conferenciasOrdenadas().filter(c => String(c.data) <= hoje);
  return ate.length ? ate[ate.length - 1] : null;
}

/* QUANTO VOCÊ TEM HOJE. Com conferência, é o saldo informado mais o que
   se moveu desde ela — o número mais honesto que o app consegue dar.
   Sem conferência nenhuma, o app não sabe, e dizer que não sabe é
   melhor do que dar um número que começou do zero. */
function saldoDeHoje() {
  const u = _ultimaConferencia();
  if (!u) return null;
  return {
    valor: _cBal(Number(u.saldo_informado) + _movimentoEntre(String(u.data), _hojeLocal())),
    desde: String(u.data),
    conferido: String(u.data) === _hojeLocal(),
  };
}

/* A diferença de uma conferência: o que o banco mostrava menos o que o
   app esperava. Positiva = entrou dinheiro que não foi lançado.
   Negativa = saiu dinheiro que não foi lançado, que é o caso comum.

   A PRIMEIRA CONFERÊNCIA NÃO TEM DIFERENÇA, e não é um detalhe: ela é o
   ponto de partida. Não existe nada antes dela pra discordar dela.
   Qualquer número ali seria inventado. */
function diferencaDaConferencia(c) {
  const esperado = saldoCalculadoEm(String(c.data), c.id);
  if (esperado === null) return { esperado: null, diferenca: null, partida: true };
  return { esperado, diferenca: _cBal(Number(c.saldo_informado) - esperado), partida: false };
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

const _ICO_BALANCA = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="7" x2="19" y2="7"/><path d="M5 7 2 14h6z"/><path d="M19 7l-3 7h6z"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`;
const _ICO_CHECK_B = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

function abrirBalanco() { abrirTela(desenharBalanco); }

function _faltaOBancoDoBalanco() { return faltaATabela("conferencias"); }

function desenharBalanco() {
  destruirGrafico();

  if (_faltaOBancoDoBalanco()) {
    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
        <div class="lancamento-cabecalho">
          <span class="lancamento-cabecalho-icone">${_ICO_BALANCA}</span>
          <span class="lancamento-caption">Conferência</span>
          <h2>Balanço</h2>
        </div>
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

  const lista = _conferenciasOrdenadas().slice().reverse();

  const umaLinha = (c) => {
    const { esperado, diferenca, partida } = diferencaDaConferencia(c);
    const bate = !partida && Math.abs(diferenca) < 0.005;
    return `
      <div class="item" id="conf-${c.id}">
        <div class="item-icone">${partida ? "•" : bate ? "✓" : diferenca > 0 ? "↑" : "↓"}</div>
        <div class="item-txt">
          <strong>${moeda(c.saldo_informado)}</strong>
          <small>${dataBR(c.data)}${partida
            ? " · ponto de partida"
            : bate
              ? " · bateu certinho"
              : ` · o app esperava ${moeda(esperado)}`}</small>
        </div>
        <span class="item-valor ${partida || bate ? "" : diferenca > 0 ? "entrada" : "saida"}">
          ${partida || bate ? "—" : (diferenca > 0 ? "+" : "−") + moeda(Math.abs(diferenca))}
        </span>
        <button class="item-x" onclick="pedirExcluirConferencia('${c.id}')" aria-label="Excluir">×</button>
      </div>`;
  };

  const ultima = lista[0] ? diferencaDaConferencia(lista[0]) : null;
  // O '!ultima.partida' é redundante hoje — Math.abs(null) é zero, então
  // o ponto de partida já não passaria daqui. Fica escrito mesmo assim,
  // porque depender de um acidente do JavaScript pra esconder um bloco
  // vermelho é como o defeito anterior nasceu. Nenhum teste pega a
  // remoção dele; é intenção no papel, de propósito.
  const furo = ultima && !ultima.partida && Math.abs(ultima.diferenca) >= 0.005
    ? ultima.diferenca : 0;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_BALANCA}</span>
        <span class="lancamento-caption">Conferência</span>
        <h2>Balanço</h2>
      </div>
    </section>

    <!-- O NÚMERO GRANDE É O QUE VOCÊ TEM, não o que entrou no mês. É a
         primeira vez que o app sabe responder isso, e ele só sabe porque
         alguém digitou o número uma vez. -->
    <div class="contas-total">
      <span>${hoje ? "Você tem na conta" : "Quanto você tem na conta?"}</span>
      <strong>${hoje ? moeda(hoje.valor) : "—"}</strong>
      <small>${!hoje
        ? "O app soma lançamentos, mas nunca soube o seu ponto de partida. Confira uma vez e ele passa a saber."
        : hoje.conferido
          ? "Conferido hoje"
          : `Conferido em ${dataBR(hoje.desde)}, mais o que se moveu desde então`}</small>
    </div>

    <button class="botao" onclick="abrirNovaConferencia()">
      ${_ICO_CHECK_B}
      ${hoje ? "Conferir de novo" : "Conferir o saldo"}
    </button>

    ${furo ? `
      <!-- A DIFERENÇA É O ACHADO, não um erro do app. Ela diz, em
           dinheiro, o tamanho do que ficou sem lançar — e some sozinha
           no dia em que o lançamento que faltava for cadastrado, porque
           ela é recalculada, nunca gravada. -->
      <div class="bloco balanco-furo ${furo > 0 ? "sobrando" : ""}">
        <div class="bloco-topo">
          <h2>${furo > 0 ? "Sobrou dinheiro na conta" : "Faltou dinheiro na conta"}</h2>
          <strong>${moeda(Math.abs(furo))}</strong>
        </div>
        <p class="cartao-dica" style="margin:0">
          Na última conferência o banco mostrava <b>${moeda(lista[0].saldo_informado)}</b>
          e o app esperava <b>${moeda(ultima.esperado)}</b>.
          ${furo > 0
            ? "Provavelmente entrou alguma coisa que não foi lançada."
            : "Provavelmente saiu alguma coisa que não foi lançada."}
          Ache o lançamento que falta e esta linha some sozinha.
        </p>
      </div>` : ""}

    ${ultima && ultima.partida ? `
      <!-- A PRIMEIRA CONFERÊNCIA NÃO TEM COM O QUE SER COMPARADA, e a
           tela tem que dizer isso em vez de ficar calada: quem acabou de
           conferir está esperando um veredicto. O lugar do veredicto é
           aqui, e hoje ele é "a partir de agora dá pra conferir". -->
      <p class="balanco-partida">
        Esta é a sua primeira conferência, então não há o que comparar
        ainda — ela é o ponto de partida. Da próxima vez que você conferir,
        o app diz se o que ele calculou bate com o banco.
      </p>` : ""}

    ${hoje ? `
      <!-- O QUE ELE PEDIU: tenho, mais o que vou receber, menos o que
           tenho a pagar. O horizonte é o MÊS CORRENTE, o mesmo do
           Resumo — usar outro aqui faria as duas telas discordarem sobre
           quanto sobra. -->
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
        <p class="rel-rodape">
          ${sobra >= 0
            ? `Dá pra chegar no fim do mês com <b>${moeda(sobra)}</b>, se nada novo aparecer.`
            : `Faltam <b>${moeda(-sobra)}</b> pra cobrir o que ainda vence neste mês.`}
        </p>
      </div>` : ""}

    ${lista.length ? `
      <div class="bloco">
        <div class="bloco-topo">
          <h2>Conferências</h2>
          <span class="rel-conta">${lista.length}</span>
        </div>
        <div class="lista">${lista.map(umaLinha).join("")}</div>
      </div>` : ""}
    <div id="balanco-confirma"></div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ═══ CONFERIR ════════════════════════════════════════════════════════ */

function abrirNovaConferencia() { abrirTela(_desenharFormConferencia); }

function _desenharFormConferencia() {
  destruirGrafico();

  const hoje = _hojeLocal();
  const esperado = saldoCalculadoEm(hoje);
  // A âncora é a conferência ANTERIOR, não "existe alguma conferência":
  // é saldoCalculadoEm que sabe disso, e perguntar a ela é o que garante
  // que a dica nunca cite um esperado que não existe.
  const temAncora = esperado !== null;
  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_BALANCA}</span>
      <span class="lancamento-caption">Balanço</span>
      <h2>Conferir o saldo</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <label for="cf-saldo">Quanto o banco mostra</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="cf-saldo" placeholder="0,00"
                 autocomplete="off" oninput="_previaDaConferencia()">
        </div>
      </div>

      <div class="campo lancamento-campo-data">
        <div class="campo-label">${icoData}<label for="cf-data">De quando é esse saldo</label></div>
        <input type="date" id="cf-data" value="${hoje}" max="${hoje}" onchange="_previaDaConferencia()">
      </div>

      <!-- O VALOR NÃO VEM PREENCHIDO, e isso é de propósito. Preenchido
           com o que o app espera, o campo convidaria a confirmar sem
           olhar — e aí a conferência não confere nada. O número tem que
           vir do app do banco. -->
      <p class="cartao-dica" id="cf-previa">${temAncora
        ? `Abra o app do seu banco e copie o saldo de hoje. O app espera
           <b>${moeda(esperado)}</b> — se der diferente, a diferença é o que
           ficou sem lançar.`
        : `Abra o app do seu banco e copie o saldo de hoje. É a primeira
           conferência: ela vira o ponto de partida, e a partir daqui o app
           passa a saber quanto você tem.`}</p>
    </div>

    <button class="botao" onclick="salvarConferencia(this)">
      ${_ICO_CHECK_B}
      Salvar conferência
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;
}

/* A PRÉVIA MOSTRA A DIFERENÇA ENQUANTO SE DIGITA. É o momento em que a
   informação vale mais: ainda dá pra conferir se foi engano de digitação
   antes de gravar. */
function _previaDaConferencia() {
  const alvo = document.getElementById("cf-previa");
  const campo = document.getElementById("cf-saldo");
  const data = document.getElementById("cf-data")?.value;
  if (!alvo || !campo || !data) return;

  const informado = parseMoedaBR(campo.value);
  if (informado === null) return;

  const esperado = saldoCalculadoEm(data);

  /* SEM ÂNCORA NÃO HÁ PRÉVIA DE DIFERENÇA. Era aqui que o defeito
     começava a aparecer: a tela anunciava um buraco enquanto a pessoa
     ainda estava digitando o primeiro saldo da vida dela. */
  if (esperado === null) {
    alvo.innerHTML = `Esse número vira o seu ponto de partida. Não tem com o
      que comparar ainda — na próxima conferência o app já sabe dizer se bate.`;
    return;
  }

  const dif = _cBal(informado - esperado);

  alvo.innerHTML = Math.abs(dif) < 0.005
    ? `Bate certinho com o que o app calculou. Nada ficou sem lançar.`
    : dif > 0
      ? `Tem <b>${moeda(dif)}</b> a mais do que o app esperava — alguma
         entrada não foi lançada.`
      : `Tem <b>${moeda(-dif)}</b> a menos do que o app esperava — alguma
         saída não foi lançada.`;
}

async function salvarConferencia(botao) {
  if (botao?.disabled) return;

  const saldo = parseMoedaBR(document.getElementById("cf-saldo").value);
  const data = document.getElementById("cf-data").value;

  // Saldo ZERO é um saldo legítimo — conta zerada existe. Por isso a
  // conferência só recusa o campo vazio, não o número baixo.
  if (saldo === null) { erro("Informe o saldo que o banco mostra."); return; }
  if (saldo < 0) { erro("Saldo negativo não: se a conta está no cheque especial, lance isso como uma dívida."); return; }
  if (!data) { erro("Escolha a data do saldo."); return; }

  /* DATA NO FUTURO NÃO. Ninguém sabe o saldo de amanhã, e uma conferência
     adiantada faz um estrago calado: ela vira âncora das contas e some do
     "você tem na conta", porque esse só olha conferência que já
     aconteceu. A pessoa veria a conferência na lista e o número grande
     ignorando ela. */
  if (data > _hojeLocal()) {
    erro("Essa data é no futuro. Confira com o saldo que o banco mostra hoje.");
    return;
  }

  const solta = travar(botao, "Salvando...");
  const { data: nova, error } = await sb.from("conferencias")
    .insert({ user_id: usuario.id, data, saldo_informado: saldo })
    .select().single();

  if (error) {
    solta();
    erro(error.code === "23505"
      ? "Já existe uma conferência nesse dia. Apague a antiga se quiser refazer."
      : "Erro ao salvar: " + error.message);
    return;
  }

  conferencias.push(nova);
  const { diferenca, partida } = diferencaDaConferencia(nova);
  ok(partida
    ? "Pronto! Agora o app sabe quanto você tem."
    : Math.abs(diferenca) < 0.005
      ? "Bateu certinho!"
      : `Salvo. Diferença de ${moeda(Math.abs(diferenca))} ${diferenca > 0 ? "a mais" : "a menos"} do que o app esperava.`);
  voltarTela();
}

/* ═══ APAGAR UMA CONFERÊNCIA ══════════════════════════════════════════
   Apagar é o jeito de refazer: uma por dia, e um saldo digitado errado
   estraga todas as contas dali pra frente, porque ele é a âncora. */

function pedirExcluirConferencia(id) {
  const alvo = document.getElementById("balanco-confirma");
  const c = conferencias.find(x => x.id === id);
  if (!alvo || !c) return;

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Apagar a conferência de ${dataBR(c.data)}, de ${moeda(c.saldo_informado)}?
         As contas voltam a partir da conferência anterior.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharBalanco()">Cancelar</button>
        <button class="sim" onclick="excluirConferencia(this, '${id}')">Sim, apagar</button>
      </div>
    </div>`;
  alvo.scrollIntoView({ block: "nearest" });
}

async function excluirConferencia(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "...");

  const { error } = await sb.from("conferencias")
    .delete().eq("id", id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao apagar: " + error.message); return; }

  conferencias = conferencias.filter(x => x.id !== id);
  ok("Conferência apagada.");
  desenharBalanco();
}
