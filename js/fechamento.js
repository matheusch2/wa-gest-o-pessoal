/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: fechamento do mês e saldo que rola pro mês seguinte.
 */

/* ═══ O QUE SOBRA NÃO SOME ════════════════════════════════════════════
   Virava o mês e a sobra evaporava: outubro começava do zero como se
   setembro nunca tivesse existido. Quem economizou não via o resultado
   em lugar nenhum, e a economia vira exercício sem prêmio.

   Agora o mês fecha. O que sobrou vai pro mês seguinte como uma ENTRADA
   chamada "Saldo" — e no mês seguinte ela soma com o que entrar lá, e
   sobra de novo, e rola. Ou você tira da conta, e aí ela vira uma saída
   "Guardado" no mês que fechou.

   O QUE É "O QUE SOBROU": entradas menos saídas do mês, o dinheiro que
   de fato ficou na conta. Não é a soma do que sobrou das metas — se você
   economizou R$ 200 no mercado e estourou R$ 300 no carro, não sobrou
   nada, e levar os R$ 200 seria carregar dinheiro que não existe. O que
   sobrou de cada meta aparece na tela, mas como explicação: é o de onde
   veio, não o quanto. */

function _sobraDoMes(mesRef) {
  let entradas = 0, saidas = 0;
  for (const l of lancamentos) {
    if (mesDe(l.data) !== mesRef) continue;
    if (l.tipo === "entrada") entradas += Number(l.valor);
    else saidas += Number(l.valor);
  }
  return {
    entradas, saidas,
    sobra: Math.round((entradas - saidas) * 100) / 100,
  };
}

function fechamentoDoMes(mesRef) {
  return fechamentos.find(f => f.mes_ref === mesRef) || null;
}

// O mês só fecha depois de acabar. Fechar o mês corrente seria levar pro
// seguinte um saldo que ainda vai mudar até o dia 30.
function mesJaAcabou(mesRef) {
  return mesRef < mesDe(_hojeLocal());
}

function _ultimoDiaDoMes(mesRef) {
  const [a, m] = mesRef.split("-").map(Number);
  return mesRef + "-" + String(new Date(a, m, 0).getDate()).padStart(2, "0");
}

/* ═══ O CONVITE, DENTRO DO RESUMO ═════════════════════════════════════ */

function faixaDeFechamento(mesRef) {
  if (!mesJaAcabou(mesRef)) return "";

  const f = fechamentoDoMes(mesRef);
  if (f) {
    const partes = [];
    if (Number(f.levado) > 0) partes.push(`${moeda(f.levado)} foram pra ${_soMesSeguinte(mesRef)}`);
    if (Number(f.guardado) > 0) partes.push(`${moeda(f.guardado)} guardados`);
    if (Number(f.levado) < 0) partes.push(`${moeda(-f.levado)} de dívida foram pra ${_soMesSeguinte(mesRef)}`);
    return `
      <div class="fechado">
        <div class="fechado-txt">
          <strong>Mês fechado</strong>
          <small>${partes.length ? partes.join(" · ") : "Nada sobrou pra levar"}</small>
        </div>
        <button class="fatura-desfazer" onclick="pedirReabrirMes('${mesRef}')">Reabrir</button>
      </div>`;
  }

  const { sobra } = _sobraDoMes(mesRef);
  return `
    <button class="botao ${sobra >= 0 ? "entrada" : "saida"} fechar-mes"
            onclick="abrirFechamento('${mesRef}')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      ${sobra >= 0
        ? `Fechar o mês · sobraram ${moeda(sobra)}`
        : `Fechar o mês · faltaram ${moeda(-sobra)}`}
    </button>`;
}

function _soMesSeguinte(mesRef) {
  const [a, m] = mesVizinho(mesRef, 1).split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

/* ═══ A TELA DE FECHAR ════════════════════════════════════════════════ */

const _ICO_FECHAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6"/><path d="M22 4 12 14.2l-3-3"/></svg>`;

function abrirFechamento(mesRef) {
  abrirTela(() => desenharFechamento(mesRef));
}

function desenharFechamento(mesRef) {
  destruirGrafico();

  const { entradas, saidas, sobra } = _sobraDoMes(mesRef);
  const proximo = mesVizinho(mesRef, 1);
  const emCampo = v => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // De onde veio a folga: onde você gastou menos que o previsto. É
  // explicação, não parcela — estas linhas NÃO somam a sobra, e por isso
  // o título diz "por que sobrou" e não "de quanto".
  const jaSaiu = {};
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || mesDe(l.data) !== mesRef) continue;
    jaSaiu[l.categoria] = (jaSaiu[l.categoria] || 0) + Number(l.valor);
  }
  const economias = metas
    .map(m => ({ nome: m.categoria, previsto: Number(m.valor), gasto: jaSaiu[m.categoria] || 0 }))
    .map(x => ({ ...x, folga: Math.round((x.previsto - x.gasto) * 100) / 100 }))
    .filter(x => x.folga >= 0.005)
    .sort((a, b) => b.folga - a.folga);

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(${sobra >= 0 ? "--entrada" : "--saida"})">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_FECHAR}</span>
      <span class="lancamento-caption">${mesPorExtenso(mesRef)}</span>
      <h2>Fechar o mês</h2>
    </div>

    <div class="fatura-resumo">
      <div><small>Entrou</small><strong>${moeda(entradas)}</strong></div>
      <div><small>Saiu</small><strong>${moeda(saidas)}</strong></div>
      <div class="${sobra >= 0 ? "destaque" : "destaque-ruim"}">
        <small>${sobra >= 0 ? "Sobrou" : "Faltou"}</small>
        <strong>${moeda(Math.abs(sobra))}</strong>
      </div>
    </div>

    ${sobra > 0 ? `
      <div class="lancamento-form">
        <div class="campo lancamento-campo-valor">
          <label for="fc-levar">Levar pra ${_soMesSeguinte(mesRef)}</label>
          <div class="lancamento-valor">
            <span>R$</span>
            <input type="text" inputmode="decimal" id="fc-levar" placeholder="0,00"
                   autocomplete="off" value="${emCampo(sobra)}" oninput="_previaFechamento('${mesRef}')">
          </div>
        </div>
        <p class="cartao-dica" id="fc-previa"></p>
      </div>` : ""}

    ${sobra < 0 ? `
      <div class="bloco" style="margin-bottom:12px">
        <p style="margin:0;font-size:13.5px;line-height:1.55">
          O mês fechou no vermelho. Fechando assim, ${moeda(-sobra)} vão pra
          ${_soMesSeguinte(mesRef)} como uma saída chamada
          <b>"Saldo de ${_soMes(mesRef)}"</b> — a dívida anda junto com você
          em vez de sumir na virada.
        </p>
      </div>` : ""}

    ${sobra === 0 ? `
      <div class="bloco" style="margin-bottom:12px">
        <p class="vazio" style="padding:14px 8px">
          Entrou e saiu exatamente o mesmo. Fechando, o mês fica marcado como
          fechado e nada é lançado.
        </p>
      </div>` : ""}

    ${economias.length ? `
      <div class="bloco">
        <div class="bloco-topo"><h2>Por que sobrou</h2></div>
        <div class="lista">
          ${economias.slice(0, 6).map(e => `
            <div class="meta-sem">
              <span class="meta-sem-nome">${iconeDoLancamento({ tipo: "saida", categoria: e.nome })} ${esc(e.nome)}</span>
              <small class="fechar-previsto">${moeda(e.gasto)} de ${moeda(e.previsto)}</small>
              <strong class="fechar-folga">${moeda(e.folga)}</strong>
            </div>`).join("")}
        </div>
        <p class="fechar-nota">
          Onde você gastou menos que o previsto. Estes números explicam a
          folga, não a somam — o que sobra de verdade é o do extrato.
        </p>
      </div>` : ""}

    <button class="botao ${sobra >= 0 ? "entrada" : "saida"}"
            onclick="fecharMes(this, '${mesRef}')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      Fechar ${_soMes(mesRef)}
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;

  _previaFechamento(mesRef);
}

function _soMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

// Levar menos que a sobra quer dizer que o resto saiu da conta. Esta linha
// diz isso com todas as letras antes de confirmar — senão o dinheiro que
// "sumiu" viraria mistério no mês seguinte.
function _previaFechamento(mesRef) {
  const alvo = document.getElementById("fc-previa");
  if (!alvo) return;

  const { sobra } = _sobraDoMes(mesRef);
  const levar = parseMoedaBR(document.getElementById("fc-levar")?.value);

  if (levar === null || levar < 0) { alvo.textContent = ""; return; }
  if (levar - sobra >= 0.005) {
    alvo.innerHTML = `<span class="fatura-alerta">Só sobraram ${moeda(sobra)} neste mês.</span>`;
    return;
  }
  const guardar = Math.round((sobra - levar) * 100) / 100;
  alvo.textContent = guardar < 0.005
    ? `Tudo vai pra ${_soMesSeguinte(mesRef)} como entrada "Saldo".`
    : `${moeda(levar)} viram entrada em ${_soMesSeguinte(mesRef)} e ${moeda(guardar)} saem da conta como "Guardado".`;
}

/* ═══ FECHAR ══════════════════════════════════════════════════════════ */

async function fecharMes(botao, mesRef) {
  if (botao?.disabled) return;
  if (fechamentoDoMes(mesRef)) { erro("Este mês já está fechado."); return; }

  const { sobra } = _sobraDoMes(mesRef);
  const campo = document.getElementById("fc-levar");

  // Sobra negativa não se divide: a dívida inteira anda pro mês seguinte.
  let levar = sobra < 0 ? sobra : parseMoedaBR(campo?.value);
  if (sobra === 0) levar = 0;
  if (levar === null) { erro("Informe quanto quer levar."); return; }
  if (sobra > 0 && levar < 0) { erro("O valor não pode ser negativo."); return; }
  if (sobra > 0 && levar - sobra >= 0.005) { erro(`Só sobraram ${moeda(sobra)} neste mês.`); return; }

  const guardar = sobra > 0 ? Math.round((sobra - levar) * 100) / 100 : 0;
  const solta = travar(botao, "Fechando...");

  // Os lançamentos nascem PRIMEIRO. Se algum falhar, o mês continua aberto
  // e dá pra tentar de novo; o contrário deixaria o mês marcado como
  // fechado sem o saldo ter chegado no mês seguinte.
  const criados = [];
  const nascer = async (tipo, valor, data, categoria, descricao) => {
    const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const { data: l, error } = await sb.from("lancamentos").insert({
      user_id: usuario.id, tipo, valor, data, categoria, descricao, chave_envio: chave,
    }).select().single();
    if (error) throw error;
    criados.push(l);
    return l;
  };

  let lancLevado = null, lancGuardado = null;
  try {
    if (Math.abs(levar) >= 0.005) {
      lancLevado = await nascer(
        levar > 0 ? "entrada" : "saida",
        Math.abs(levar),
        mesVizinho(mesRef, 1) + "-01",
        "Saldo",
        `Saldo de ${_soMes(mesRef)}`);
    }
    if (guardar >= 0.005) {
      lancGuardado = await nascer(
        "saida", guardar, _ultimoDiaDoMes(mesRef),
        "Guardado", `Guardado de ${_soMes(mesRef)}`);
    }
  } catch (e) {
    for (const l of criados) await sb.from("lancamentos").delete().eq("id", l.id).eq("user_id", usuario.id);
    solta();
    erro("Erro ao fechar o mês: " + e.message);
    return;
  }

  const { data: fech, error } = await sb.from("fechamentos").insert({
    user_id: usuario.id, mes_ref: mesRef, sobra,
    levado: levar, guardado: guardar,
    lancamento_levado_id: lancLevado?.id || null,
    lancamento_guardado_id: lancGuardado?.id || null,
    fechado_em: _hojeLocal(),
  }).select().single();

  if (error) {
    for (const l of criados) await sb.from("lancamentos").delete().eq("id", l.id).eq("user_id", usuario.id);
    solta();
    erro(error.code === "23505" ? "Este mês já está fechado." : "Erro ao fechar o mês: " + error.message);
    return;
  }

  for (const l of criados) lancamentos.push(l);
  lancamentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  fechamentos.push(fech);

  ok(Math.abs(levar) >= 0.005
    ? `${moeda(Math.abs(levar))} ${levar > 0 ? "foram" : "de dívida foram"} pra ${_soMesSeguinte(mesRef)}.`
    : "Mês fechado.");
  voltarTela();
}

/* ═══ REABRIR ═════════════════════════════════════════════════════════ */

function pedirReabrirMes(mesRef) {
  const alvo = document.getElementById("fechamento-acao");
  const f = fechamentoDoMes(mesRef);
  if (!alvo || !f) return;
  alvo.innerHTML = `
    <div class="confirmar">
      <p>Reabrir ${_soMes(mesRef)}? O saldo que foi pra
         ${_soMesSeguinte(mesRef)}${Number(f.guardado) > 0 ? " e o que você guardou" : ""}
         ${Number(f.guardado) > 0 ? "somem" : "some"} do extrato.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharResumo(null)">Cancelar</button>
        <button class="sim" onclick="reabrirMes(this, '${mesRef}')">Reabrir</button>
      </div>
    </div>`;
}

async function reabrirMes(botao, mesRef) {
  if (botao?.disabled) return;
  const f = fechamentoDoMes(mesRef);
  if (!f) return;

  const solta = travar(botao, "Reabrindo...");
  const { error } = await sb.from("fechamentos")
    .delete().eq("id", f.id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao reabrir: " + error.message); return; }

  // Os lançamentos podem já ter sido apagados à mão pelo Histórico; nesse
  // caso não há o que remover e a reabertura vale do mesmo jeito.
  for (const id of [f.lancamento_levado_id, f.lancamento_guardado_id]) {
    if (!id) continue;
    await sb.from("lancamentos").delete().eq("id", id).eq("user_id", usuario.id);
    lancamentos = lancamentos.filter(l => l.id !== id);
  }

  fechamentos = fechamentos.filter(x => x.id !== f.id);
  ok(`${_soMes(mesRef).charAt(0).toUpperCase() + _soMes(mesRef).slice(1)} reaberto.`);
  desenharResumo(null);
}
