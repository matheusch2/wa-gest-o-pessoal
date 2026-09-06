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

   As entradas EXTRAS — freela, venda, 13º — não têm cadastro nenhum:
   são o formulário de sempre, logo abaixo. Extra que se repetisse todo
   mês não seria extra, seria fixa. */

const _ICO_FIXA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/></svg>`;

// O lançamento daquela entrada fixa neste mês, se já existir. Reconhecido
// pela descrição igual ao nome — é com esse nome que ele nasce aqui.
function _recebidaNoMes(nome, mesRef) {
  return lancamentos.find(l =>
    l.tipo === "entrada" && l.descricao === nome && mesDe(l.data) === mesRef) || null;
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

  const linhas = entradasFixas.map(f => {
    const ja = _recebidaNoMes(f.nome, mes);
    return `
      <div class="fixa-item ${ja ? "recebida" : ""}" id="fixa-${f.id}">
        <div class="fixa-txt">
          <strong>${esc(f.nome)}</strong>
          <small>${ja
            ? "Recebido em " + dataBR(ja.data) + " · " + moeda(ja.valor)
            : `Todo dia ${f.dia}${f.categoria ? " · " + esc(f.categoria) : ""}`}</small>
        </div>
        ${ja
          ? `<span class="conta-chip paga">✓ no mês</span>`
          : `<span class="fixa-valor">${moeda(f.valor)}</span>
             <button class="botao-pagar" onclick="receberEntradaFixa(this, '${f.id}')">Recebi</button>`}
        <button class="botao-editar botao-excluir" onclick="pedirExcluirEntradaFixa('${f.id}')" aria-label="Excluir">🗑️</button>
      </div>`;
  }).join("");

  const total = entradasFixas.reduce((s, f) => s + Number(f.valor), 0);
  const faltam = entradasFixas.filter(f => !_recebidaNoMes(f.nome, mes)).length;

  return `
    <div class="bloco fixas-bloco">
      <div class="bloco-topo">
        <h2>Todo mês</h2>
        <strong class="fixas-total">${moeda(total)}</strong>
      </div>
      <div class="lista">${linhas}</div>
      <div class="fixas-pe">
        <small>${faltam
          ? `${faltam} ainda não ${faltam > 1 ? "foram lançadas" : "foi lançada"} em ${soNomeDoMes(mes)}`
          : `Tudo lançado em ${soNomeDoMes(mes)}`}</small>
        <button class="fixas-mais" onclick="abrirNovaEntradaFixa()">+ Nova</button>
      </div>
    </div>`;
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

/* ═══ CADASTRAR ═══════════════════════════════════════════════════════ */

function abrirNovaEntradaFixa() {
  abrirTela(() => {
    destruirGrafico();
    const cats = categorias.filter(c => c.tipo === "entrada");
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
    const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela entrada">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_FIXA}</span>
        <span class="lancamento-caption">Todo mês</span>
        <h2>Entrada fixa</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="ef-nome">O que é</label></div>
          <input type="text" id="ef-nome" placeholder="Ex: Salário" autocomplete="off">
        </div>

        <div class="campo">
          <label for="ef-valor">Quanto entra</label>
          <div class="lancamento-valor">
            <span>R$</span>
            <input type="text" inputmode="decimal" id="ef-valor" placeholder="0,00" autocomplete="off">
          </div>
        </div>

        <div class="dois">
          <div class="campo">
            <div class="campo-label">${icoData}<label for="ef-dia">Cai no dia</label></div>
            <select id="ef-dia">
              ${Array.from({ length: 31 }, (_, i) => i + 1)
                .map(d => `<option value="${d}"${d === 5 ? " selected" : ""}>Dia ${d}</option>`).join("")}
            </select>
          </div>
          <div class="campo">
            <div class="campo-label">${icoEtiqueta}<label for="ef-cat">Categoria</label></div>
            ${campoDeCategoria({ id: "ef-cat", tipo: "entrada",
                                opcoes: cats.length ? cats.map(c => c.nome) : ["Salário"] })}
          </div>
        </div>

        <p class="cartao-dica">
          Isto guarda o combinado, não o recebimento. Todo mês você lança o
          que entrou de verdade com um toque — se vier diferente, dá pra
          corrigir o valor na hora do lançamento.
        </p>
      </div>

      <button class="botao entrada" onclick="salvarEntradaFixa(this)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar entrada fixa
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;

    document.getElementById("ef-nome").focus();
  });
}

async function salvarEntradaFixa(botao) {
  if (botao?.disabled) return;
  const nome = (document.getElementById("ef-nome").value || "").trim();
  const valor = parseMoedaBR(document.getElementById("ef-valor").value);
  const dia = Number(document.getElementById("ef-dia").value);
  const categoria = document.getElementById("ef-cat").value;

  if (!nome) { erro("Diga o que é essa entrada."); return; }
  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }

  const solta = travar(botao, "Salvando...");
  const { data, error } = await sb.from("entradas_fixas")
    .insert({ user_id: usuario.id, nome, valor, dia, categoria })
    .select().single();

  if (error) {
    solta();
    erro(error.code === "23505" ? "Já existe uma entrada fixa com esse nome." : "Erro: " + error.message);
    return;
  }

  entradasFixas.push(data);
  entradasFixas.sort((a, b) => a.dia - b.dia);
  ok("Entrada fixa cadastrada!");
  voltarTela();
}

/* ═══ EXCLUIR ═════════════════════════════════════════════════════════ */

function pedirExcluirEntradaFixa(id) {
  const linha = document.getElementById("fixa-" + id);
  const f = entradasFixas.find(x => x.id === id);
  if (!linha || !f) return;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%;border:none;padding:0">
      <p>Tirar "${esc(f.nome)}" das entradas fixas? Os lançamentos que você
         já fez continuam no extrato.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharLancar('entrada')">Cancelar</button>
        <button class="sim" onclick="excluirEntradaFixa(this, '${id}')">Sim, tirar</button>
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
