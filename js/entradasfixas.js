/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: entradas fixas — o salário e o que mais entra todo mês.
 */

/* ═══ O QUE ENTRA TODO MÊS ════════════════════════════════════════════
   O espelho do gasto fixo, do outro lado. Salário, aluguel recebido,
   pensão: valor que se repete no mesmo dia, e que a pessoa digitava
   inteiro toda vez — valor, descrição, data, categoria — sabendo que era
   igual ao do mês passado.

   O QUE FICA GUARDADO É O COMBINADO, não o recebimento: "meu salário é
   R$ 3.000 e cai dia 5". O recebimento continua sendo um lançamento de
   entrada normal, criado com um toque a partir daqui. É isso que mantém
   o extrato como a única fonte do que de fato entrou — se o salário
   atrasar, vier menor, ou não vier, quem manda é o lançamento.

   Por isso o botão diz "Recebi": ele não confirma uma previsão, ele
   registra um fato. E o que já foi recebido no mês aparece marcado,
   porque lançar o salário duas vezes é erro fácil e caro.

   DE QUANDO ATÉ QUANDO. A entrada tem dois marcos, e os dois podem ser
   nulos — nulo quer dizer "sem limite desse lado", que é o caso de
   sempre: entra todo mês, pra sempre.

   O 'fim' é o ÚLTIMO MÊS em que ela entra. Serve pro contrato que acaba
   em março: o salário continua contando em janeiro, fevereiro e março, e
   some das projeções de abril em diante. Ele não apaga nada — o que já
   foi recebido virou lançamento e vive no extrato, longe daqui.

   O 'inicio' é o primeiro. E com os dois no mesmo mês a entrada vira
   EXTRA: o 13º de dezembro, as férias de julho, o freela que você já
   sabe que vem. Não precisou de campo novo pra isso — extra é uma fixa
   que começa e acaba no mesmo mês. Uma regra só é mais fácil de acertar
   do que duas que fazem quase a mesma coisa. */

const _ICO_FIXA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/></svg>`;

// O lançamento daquela entrada fixa neste mês, se já existir. Reconhecido
// pela descrição igual ao nome — é com esse nome que ele nasce aqui.
function _recebidaNoMes(nome, mesRef) {
  return lancamentos.find(l =>
    l.tipo === "entrada" && l.descricao === nome && mesDe(l.data) === mesRef) || null;
}

/* Esta entrada vale neste mês? É a pergunta que todas as telas fazem, e
   por isso ela mora numa função só: espalhada em cinco lugares, bastaria
   um deles esquecer o 'fim' pra uma tela prometer um salário que acabou
   enquanto a outra não promete. */
function _entradaValeNoMes(f, mesRef) {
  if (f.inicio && mesRef < mesDe(f.inicio)) return false;
  if (f.fim && mesRef > mesDe(f.fim)) return false;
  return true;
}

// Extra é a que começa e acaba no mesmo mês. Não é um campo guardado: é
// o que esses dois marcos querem dizer juntos.
function _ehExtra(f) {
  return !!(f.inicio && f.fim && mesDe(f.inicio) === mesDe(f.fim));
}

function _entradasDoMes(mesRef) {
  return entradasFixas.filter(f => _entradaValeNoMes(f, mesRef));
}

// "Dezembro de 2026" a partir de "2026-12-01" ou "2026-12".
function _mesPorExtensoDe(data) {
  return mesPorExtenso(mesDe(data));
}

/* ═══ O QUE AINDA VAI ENTRAR ══════════════════════════════════════════
   O espelho de aindaVaiSairDoMes(), e ele existe pelo mesmo motivo.

   O Resumo desconta do saldo tudo que ainda TEM QUE SAIR: a conta que
   vence dia 20, o mercado que ainda falta fazer. Mas o salário que ainda
   não caiu não estava sendo somado de volta. O mês começava com todas as
   despesas descontadas e nenhuma receita contada — quem tem R$ 6.700 de
   salário cadastrado via "faltam R$ 6.700 pra cobrir o que vai sair" no
   dia 1º, e o número não queria dizer nada.

   A régua tem que ser a mesma dos dois lados: se conta o que vai sair,
   conta o que vai entrar.

   E, como do outro lado, isso não é lançamento nenhum — é previsão. No
   instante em que a pessoa toca "Recebi", a entrada vira lançamento de
   verdade e sai daqui. O número no alto não se mexe: o que era previsto
   virou realizado. Se ele pulasse nessa hora, uma das duas contas estaria
   errada. */

function aReceberDoMes(mesRef) {
  // Mês fechado não recebe mais nada. O que não caiu em agosto não vai
  // cair — e ficar prometendo aumentaria a sobra de um mês que já acabou.
  if (mesRef < mesDe(_hojeLocal())) return { linhas: [], total: 0 };

  const linhas = _entradasDoMes(mesRef)
    .filter(f => !_recebidaNoMes(f.nome, mesRef))
    .map(f => ({
      nome: f.nome, categoria: f.categoria || "",
      valor: Number(f.valor), dia: f.dia, data: _diaDoMes(f.dia, mesRef),
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  return { linhas, total: Math.round(linhas.reduce((s, x) => s + x.valor, 0) * 100) / 100 };
}

function _diaDoMes(dia, mesRef) {
  const [a, m] = mesRef.split("-").map(Number);
  // Dia 31 num mês de 30 vira o último dia do mês, não o dia 1 do seguinte.
  const ultimo = new Date(a, m, 0).getDate();
  return mesRef + "-" + String(Math.min(dia, ultimo)).padStart(2, "0");
}

// O bloco que entra no alto da tela de "Lançar entrada".
function blocoEntradasFixas() {
  const mes = mesDe(_hojeLocal());

  if (!entradasFixas.length) {
    return `
      <div class="fixas-vazio">
        <p>Recebe salário todo mês? Cadastre uma vez e lance com um toque.</p>
        <button class="botao-fraco" onclick="abrirNovaEntradaFixa()">
          ${_ICO_FIXA} Cadastrar entrada fixa
        </button>
      </div>`;
  }

  const doMes = _entradasDoMes(mes);

  const umaLinha = (f) => {
    const ja = _recebidaNoMes(f.nome, mes);
    const extra = _ehExtra(f);
    /* DUAS LINHAS, E NÃO UMA. Com o lápis ao lado do "Recebi", do valor e
       da lixeira, sobrava um palmo pro nome e "Salário Sabrina" quebrava
       em três. O nome ganha a linha inteira; os controles descem. */
    return `
      <div class="fixa-item ${ja ? "recebida" : ""}" id="fixa-${f.id}">
        <div class="fixa-topo">
          <strong>${esc(f.nome)}</strong>
          ${ja ? `<span class="conta-chip paga">✓ no mês</span>`
               : `<span class="fixa-valor">${moeda(f.valor)}</span>`}
        </div>
        <div class="fixa-baixo">
          <small>${ja
            ? "Recebido em " + dataBR(ja.data) + " · " + moeda(ja.valor)
            : extra
              ? `Só em ${soNomeDoMes(mesDe(f.inicio))}, dia ${f.dia}${f.categoria ? " · " + esc(f.categoria) : ""}`
              : `Todo dia ${f.dia}${f.fim ? ", até " + soNomeDoMes(mesDe(f.fim)) : ""}${f.categoria ? " · " + esc(f.categoria) : ""}`}</small>
          <div class="fixa-acoes">
            ${ja ? "" : `<button class="botao-pagar" onclick="receberEntradaFixa(this, '${f.id}')">Recebi</button>`}
            <button class="botao-editar" onclick="abrirEdicaoEntradaFixa('${f.id}')" aria-label="Editar">✏️</button>
            <button class="botao-editar botao-excluir" onclick="pedirExcluirEntradaFixa('${f.id}')" aria-label="Excluir">🗑️</button>
          </div>
        </div>
      </div>`;
  };

  const total = doMes.reduce((s, f) => s + Number(f.valor), 0);
  const faltam = doMes.filter(f => !_recebidaNoMes(f.nome, mes)).length;

  /* AS QUE NÃO CAEM NESTE MÊS PRECISAM APARECER EM ALGUM LUGAR.
     O 13º de dezembro cadastrado em outubro não entra na lista de
     outubro — e se ele não aparecesse em lugar nenhum, a pessoa não
     teria como corrigir o valor nem apagar o que lançou errado. Some do
     cálculo do mês, não da tela. */
  const fora = entradasFixas
    .filter(f => !_entradaValeNoMes(f, mes))
    .sort((a, b) => String(a.inicio || "").localeCompare(String(b.inicio || "")));

  return `
    <div class="bloco fixas-bloco">
      <div class="bloco-topo">
        <h2>Todo mês</h2>
        <strong class="fixas-total">${moeda(total)}</strong>
      </div>
      ${doMes.length
        ? `<div class="lista">${doMes.map(umaLinha).join("")}</div>`
        : `<p class="vazio">Nenhuma entrada cai em ${soNomeDoMes(mes)}.</p>`}
      <div class="fixas-pe">
        <small>${!doMes.length ? "" : faltam
          ? `${faltam} ainda não ${faltam > 1 ? "foram lançadas" : "foi lançada"} em ${soNomeDoMes(mes)}`
          : `Tudo lançado em ${soNomeDoMes(mes)}`}</small>
        ${faltam > 1 ? `<button class="fixas-todas" onclick="receberTodasAsFixas(this)">Recebi todas</button>` : ""}
        <button class="fixas-mais" onclick="abrirNovaEntradaFixa()">+ Nova</button>
      </div>
    </div>

    ${fora.length ? `
      <div class="bloco fixas-bloco">
        <div class="bloco-topo">
          <h2>Em outros meses</h2>
          <strong class="fixas-total">${moeda(fora.reduce((s, f) => s + Number(f.valor), 0))}</strong>
        </div>
        <div class="lista">
          ${fora.map(f => `
            <div class="fixa-item fixa-fora" id="fixa-${f.id}">
              <div class="fixa-topo">
                <strong>${esc(f.nome)}</strong>
                <span class="fixa-valor">${moeda(f.valor)}</span>
              </div>
              <div class="fixa-baixo">
                <small>${_ehExtra(f)
                  ? "Só em " + _mesPorExtensoDe(f.inicio).toLowerCase()
                  : f.fim && mes > mesDe(f.fim)
                    ? "Acabou em " + _mesPorExtensoDe(f.fim).toLowerCase()
                    : "Começa em " + _mesPorExtensoDe(f.inicio).toLowerCase()}</small>
                <div class="fixa-acoes">
                  <button class="botao-editar" onclick="abrirEdicaoEntradaFixa('${f.id}')" aria-label="Editar">✏️</button>
                  <button class="botao-editar botao-excluir" onclick="pedirExcluirEntradaFixa('${f.id}')" aria-label="Excluir">🗑️</button>
                </div>
              </div>
            </div>`).join("")}
        </div>
        <p class="cartao-nota">
          Estas não entram na conta de ${soNomeDoMes(mes)}. Elas aparecem
          aqui pra você poder mexer nelas antes de o mês delas chegar.
        </p>
      </div>` : ""}`;
}

/* ═══ LANÇAR A DO MÊS ═════════════════════════════════════════════════ */

async function receberEntradaFixa(botao, id) {
  if (botao?.disabled) return;
  const f = entradasFixas.find(x => x.id === id);
  if (!f) return;

  const mes = mesDe(_hojeLocal());
  if (_recebidaNoMes(f.nome, mes)) { erro("Esta entrada já foi lançada neste mês."); return; }

  const solta = travar(botao, "...");
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const { data, error } = await sb.from("lancamentos").insert({
    user_id: usuario.id, tipo: "entrada", valor: Number(f.valor),
    data: _diaDoMes(f.dia, mes), categoria: f.categoria || "Outros",
    descricao: f.nome, chave_envio: chave,
  }).select().single();

  if (error) { solta(); erro("Erro ao lançar: " + error.message); return; }

  lancamentos.unshift(data);
  lancamentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  ok(`${f.nome} de ${soNomeDoMes(mes)} lançado!`);
  desenharLancar("entrada");
}

// Quatro salários na casa viravam quatro toques todo mês, e bastava
// esquecer um pra conta do mês inteiro sair errada. Vai tudo num insert
// só: uma ida ao banco, e ou entram todas ou não entra nenhuma.
async function receberTodasAsFixas(botao) {
  if (botao?.disabled) return;
  const mes = mesDe(_hojeLocal());
  // Só as que valem neste mês: o 13º de dezembro não pode ser lançado em
  // outubro só porque alguém apertou "Recebi todas".
  const faltam = _entradasDoMes(mes).filter(f => !_recebidaNoMes(f.nome, mes));
  if (!faltam.length) { erro("Todas já foram lançadas neste mês."); return; }

  const solta = travar(botao, "Lançando...");
  const { data, error } = await sb.from("lancamentos").insert(
    faltam.map(f => ({
      user_id: usuario.id, tipo: "entrada", valor: Number(f.valor),
      data: _diaDoMes(f.dia, mes), categoria: f.categoria || "Outros",
      descricao: f.nome,
      chave_envio: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    }))
  ).select();

  if (error) { solta(); erro("Erro ao lançar: " + error.message); return; }

  lancamentos.push(...(data || []));
  lancamentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  ok(`${faltam.length} entradas lançadas em ${soNomeDoMes(mes)}!`);
  desenharLancar("entrada");
}

/* ═══ CADASTRAR E EDITAR ═════════════════════════════════════════════
   Um formulário só pros dois. Cadastrar e editar perguntam exatamente as
   mesmas coisas, e duas telas quase iguais são duas telas pra lembrar de
   mudar junto quando um campo nasce. */

// A lista de meses dos seletores. Começa no mês corrente e vai a quatro
// anos — mas aceita um mês mais antigo pra que editar uma entrada que já
// acabou não perca a data dela ao abrir a tela.
function _opcoesDeMes(escolhido) {
  const hoje = mesDe(_hojeLocal());
  let inicio = escolhido && escolhido < hoje ? escolhido : hoje;
  const meses = [];
  for (let i = 0; i < 48; i++) meses.push(_somaMes(inicio, i));
  if (escolhido && !meses.includes(escolhido)) meses.unshift(escolhido);
  return meses
    .map(m => `<option value="${m}"${m === escolhido ? " selected" : ""}>${mesPorExtenso(m)}</option>`)
    .join("");
}

function abrirNovaEntradaFixa() { abrirTela(() => _desenharFormEntrada(null)); }

function abrirEdicaoEntradaFixa(id) {
  const f = entradasFixas.find(x => x.id === id);
  if (!f) { erro("Entrada não encontrada."); return; }
  abrirTela(() => _desenharFormEntrada(f));
}

function _desenharFormEntrada(f) {
  destruirGrafico();

  const editando = !!f;
  const extra = editando && _ehExtra(f);
  const cats = categorias.filter(c => c.tipo === "entrada");
  const hoje = mesDe(_hojeLocal());

  const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
  const icoRepete = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela entrada">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_FIXA}</span>
      <span class="lancamento-caption">${extra ? "Só num mês" : "Todo mês"}</span>
      <h2>${editando ? "Editar entrada" : "Nova entrada"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <div class="campo-label">${icoTexto}<label for="ef-nome">O que é</label></div>
        <input type="text" id="ef-nome" placeholder="Ex: Salário" autocomplete="off"
               value="${editando ? esc(f.nome) : ""}">
      </div>

      <div class="campo">
        <label for="ef-valor">Quanto entra</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="ef-valor" placeholder="0,00" autocomplete="off"
                 value="${editando ? Number(f.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}">
        </div>
      </div>

      <div class="dois">
        <div class="campo">
          <div class="campo-label">${icoData}<label for="ef-dia">Cai no dia</label></div>
          <select id="ef-dia">
            ${Array.from({ length: 31 }, (_, i) => i + 1)
              .map(d => `<option value="${d}"${d === (editando ? Number(f.dia) : 5) ? " selected" : ""}>Dia ${d}</option>`).join("")}
          </select>
        </div>
        <div class="campo">
          <div class="campo-label">${icoEtiqueta}<label for="ef-cat">Categoria</label></div>
          ${campoDeCategoria({ id: "ef-cat", tipo: "entrada",
                              opcoes: cats.length ? cats.map(c => c.nome) : ["Salário"],
                              escolhida: editando ? (f.categoria || "") : "" })}
        </div>
      </div>

      <!-- AS TRÊS FORMAS DE UMA ENTRADA EXISTIREM NO TEMPO.
           A de sempre repete pra sempre. A segunda tem data pra acabar —
           o contrato que vai até março, e que precisa continuar contando
           em janeiro e fevereiro. A terceira cai uma vez só: o 13º, as
           férias, o freela que você já sabe que vem.

           Por baixo são os mesmos dois campos, início e fim. Em cima são
           três perguntas diferentes, porque é assim que a pessoa pensa. -->
      <div class="campo" style="margin:16px 0 0">
        <div class="campo-label">${icoRepete}<label>Até quando</label></div>
        <div class="escolha">
          <label class="escolha-op">
            <input type="radio" name="ef-prazo" value="sempre"
                   ${!editando || (!f.fim && !f.inicio) ? "checked" : ""} onchange="_aoTrocarPrazoEntrada()">
            <span><strong>🔁 Todo mês, pra sempre</strong></span>
          </label>
          <label class="escolha-op">
            <input type="radio" name="ef-prazo" value="ate"
                   ${editando && f.fim && !extra ? "checked" : ""} onchange="_aoTrocarPrazoEntrada()">
            <span><strong>📆 Todo mês, até um mês</strong></span>
          </label>
          <label class="escolha-op">
            <input type="radio" name="ef-prazo" value="unica"
                   ${extra ? "checked" : ""} onchange="_aoTrocarPrazoEntrada()">
            <span><strong>📅 Só num mês</strong></span>
          </label>
        </div>
      </div>

      <div class="campo" id="ef-caixa-mes" hidden>
        <div class="campo-label">${icoData}<label for="ef-mes" id="ef-mes-rotulo">Último mês</label></div>
        <select id="ef-mes" onchange="_previaPrazoEntrada()">
          ${_opcoesDeMes(editando && (f.fim || f.inicio) ? mesDe(f.fim || f.inicio) : hoje)}
        </select>
      </div>

      <p class="cartao-dica" id="ef-previa"></p>
    </div>

    <button class="botao entrada" onclick="salvarEntradaFixa(this, ${editando ? `'${f.id}'` : "null"})">
      <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      ${editando ? "Salvar alteração" : "Salvar entrada"}
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;

  _aoTrocarPrazoEntrada();
  // Sem foco automático: no celular ele abre o teclado sozinho e come
  // metade da tela antes de a pessoa ter lido o formulário.
}

function _prazoDaEntrada() {
  return document.querySelector('input[name="ef-prazo"]:checked')?.value || "sempre";
}

function _aoTrocarPrazoEntrada() {
  const prazo = _prazoDaEntrada();
  const caixa = document.getElementById("ef-caixa-mes");
  if (caixa) caixa.hidden = prazo === "sempre";

  // O rótulo muda porque o campo muda de significado: num caso ele é o
  // último mês, no outro é o único. Mesmo seletor, perguntas diferentes.
  const rotulo = document.getElementById("ef-mes-rotulo");
  if (rotulo) rotulo.textContent = prazo === "unica" ? "Em qual mês" : "Último mês";

  _previaPrazoEntrada();
}

// Diz com todas as letras o que vai acontecer, antes de salvar. "Até
// março" é ambíguo em português — março entra ou não? A frase responde.
function _previaPrazoEntrada() {
  const alvo = document.getElementById("ef-previa");
  if (!alvo) return;

  const prazo = _prazoDaEntrada();
  const mes = document.getElementById("ef-mes")?.value;

  if (prazo === "sempre") {
    alvo.textContent = "Entra todo mês, sem data pra acabar.";
    return;
  }
  if (!mes) { alvo.textContent = ""; return; }

  alvo.textContent = prazo === "unica"
    ? `Entra só em ${mesPorExtenso(mes).toLowerCase()}, e em mais nenhum mês.`
    : `${mesPorExtenso(mes)} é o último mês em que ela entra. ` +
      `De ${_mesPorExtensoDe(_somaMes(mes, 1)).toLowerCase()} em diante ela some das contas — ` +
      `o que já foi recebido continua no extrato.`;
}

async function salvarEntradaFixa(botao, id) {
  if (botao?.disabled) return;

  const nome = (document.getElementById("ef-nome").value || "").trim();
  const valor = parseMoedaBR(document.getElementById("ef-valor").value);
  const dia = Number(document.getElementById("ef-dia").value);
  const categoria = document.getElementById("ef-cat").value;
  const prazo = _prazoDaEntrada();
  const mes = document.getElementById("ef-mes")?.value;

  if (!nome) { erro("Diga o que é essa entrada."); return; }
  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (prazo !== "sempre" && !mes) { erro("Escolha o mês."); return; }

  // Os dois marcos, montados do jeito que a pessoa respondeu. O dia 1º é
  // só pra caber num campo de data: o que importa aqui é o mês.
  const inicio = prazo === "unica" ? mes + "-01" : null;
  const fim = prazo === "sempre" ? null : mes + "-01";

  const solta = travar(botao, "Salvando...");
  const campos = { nome, valor, dia, categoria, inicio, fim };

  const { data, error } = id
    ? await sb.from("entradas_fixas").update(campos)
        .eq("id", id).eq("user_id", usuario.id).select().single()
    : await sb.from("entradas_fixas")
        .insert(Object.assign({ user_id: usuario.id }, campos)).select().single();

  if (error) {
    solta();
    erro(error.code === "23505"
      ? `Já existe uma entrada chamada "${nome}". Dê outro nome — "13º 2026", por exemplo.`
      : "Erro: " + error.message);
    return;
  }

  entradasFixas = id
    ? entradasFixas.map(x => (x.id === id ? data : x))
    : entradasFixas.concat([data]);
  entradasFixas.sort((a, b) => a.dia - b.dia);

  ok(id ? "Entrada alterada!" : "Entrada cadastrada!");
  voltarTela();
}

/* ═══ EXCLUIR ═════════════════════════════════════════════════════════ */

function pedirExcluirEntradaFixa(id) {
  const linha = document.getElementById("fixa-" + id);
  const f = entradasFixas.find(x => x.id === id);
  if (!linha || !f) return;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%;border:none;padding:0">
      <p>Tem certeza que quer excluir "${esc(f.nome)}" das entradas fixas?
         Os lançamentos que você já fez continuam no extrato.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharLancar('entrada')">Cancelar</button>
        <button class="sim" onclick="excluirEntradaFixa(this, '${id}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirEntradaFixa(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "Tirando...");
  const { error } = await sb.from("entradas_fixas")
    .delete().eq("id", id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  entradasFixas = entradasFixas.filter(f => f.id !== id);
  ok("Entrada fixa removida.");
  desenharLancar("entrada");
}
