/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: cartões de crédito e faturas.
 */

/* ═══ BANCOS ══════════════════════════════════════════════════════════
   A cor vem do banco, não fica guardada no cartão: corrigindo aqui, todo
   cartão daquele banco muda junto. Guardar a cor em cada cartão deixaria
   os antigos com a cor errada pra sempre.

   São as cores de marca de cada banco, de memória — se alguma estiver
   destoando da real, é trocar o valor aqui. */

const BANCOS = [
  { id: "nubank",      nome: "Nubank",          cor: "#820AD1", texto: "#fff" },
  { id: "inter",       nome: "Banco Inter",     cor: "#FF7A00", texto: "#fff" },
  { id: "bb",          nome: "Banco do Brasil", cor: "#0033A0", texto: "#fff" },
  { id: "itau",        nome: "Itaú",            cor: "#EC7000", texto: "#fff" },
  { id: "bradesco",    nome: "Bradesco",        cor: "#CC092F", texto: "#fff" },
  { id: "santander",   nome: "Santander",       cor: "#EC0000", texto: "#fff" },
  { id: "caixa",       nome: "Caixa",           cor: "#005CA9", texto: "#fff" },
  { id: "c6",          nome: "C6 Bank",         cor: "#242424", texto: "#fff" },
  { id: "btg",         nome: "BTG Pactual",     cor: "#051C3C", texto: "#fff" },
  { id: "picpay",      nome: "PicPay",          cor: "#11C76F", texto: "#fff" },
  { id: "mercadopago", nome: "Mercado Pago",    cor: "#00B1EA", texto: "#fff" },
  { id: "neon",        nome: "Neon",            cor: "#00AEEF", texto: "#fff" },
  { id: "will",        nome: "Will Bank",       cor: "#FFE600", texto: "#1f2937" },
  { id: "outro",       nome: "Outro",           cor: "#4b5563", texto: "#fff" },
];

function _banco(id) {
  return BANCOS.find(b => b.id === id) || BANCOS[BANCOS.length - 1];
}

/* ═══ CONTA DA FATURA ═════════════════════════════════════════════════
   Estas quatro funções são o coração do módulo. Ficam separadas e pequenas
   de propósito: erro de fatura aparece como dinheiro no mês errado, que é
   difícil de perceber olhando a tela. */

// Soma meses a um "AAAA-MM" sem passar por Date — mês é contagem, e
// converter pra data só abre porta pra fuso e pra dia 31 virar dia 1.
function _somaMes(mesRef, n) {
  const [a, m] = mesRef.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return Math.floor(total / 12) + "-" + String((total % 12) + 1).padStart(2, "0");
}

// Em qual fatura a PRIMEIRA parcela cai. Comprou depois do fechamento, já
// entra na fatura do mês seguinte — a deste mês já fechou.
function _mesDaPrimeiraParcela(dataCompra, diaFechamento) {
  const [a, m, d] = dataCompra.split("-").map(Number);
  const mesRef = a + "-" + String(m).padStart(2, "0");
  return d <= diaFechamento ? mesRef : _somaMes(mesRef, 1);
}

// O vencimento da fatura de um mês. Quando o dia do vencimento é ANTES do
// dia do fechamento, ele cai no mês seguinte: fecha dia 28, vence dia 5 —
// esse dia 5 é o do mês que vem, não o que já passou.
function _vencimentoDaFatura(mesRef, diaFechamento, diaVencimento) {
  const mes = diaVencimento > diaFechamento ? mesRef : _somaMes(mesRef, 1);
  return mes + "-" + String(diaVencimento).padStart(2, "0");
}

// Todas as parcelas que caem na fatura de um mês, com o número da parcela
// ("2/6") pra pessoa saber quanto ainda falta daquela compra.
function _parcelasDaFatura(cartao, mesRef) {
  const itens = [];
  for (const c of comprasCartao) {
    if (c.cartao_id !== cartao.id) continue;
    const inicio = _mesDaPrimeiraParcela(c.data, cartao.dia_fechamento);
    const total = Number(c.parcelas) || 1;
    for (let n = 1; n <= total; n++) {
      if (_somaMes(inicio, n - 1) !== mesRef) continue;
      itens.push({
        compra: c,
        parcela: n,
        totalParcelas: total,
        valor: Number(c.valor) / total,
      });
      break;
    }
  }
  return itens.sort((a, b) => a.compra.data.localeCompare(b.compra.data));
}

function _totalDaFatura(cartao, mesRef) {
  return _parcelasDaFatura(cartao, mesRef).reduce((s, i) => s + i.valor, 0);
}

// A fatura "de agora" é a que ainda não fechou: comprando hoje, é nela que
// a compra entra.
function _mesFaturaAberta(cartao) {
  return _mesDaPrimeiraParcela(_hojeLocal(), cartao.dia_fechamento);
}

/* ═══ LISTA DE CARTÕES ════════════════════════════════════════════════ */

const _ICO_CARTAO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="3"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg>`;

function abrirCartoes() { abrirTela(desenharCartoes); }

function desenharCartoes() {
  destruirGrafico();

  const cards = cartoes.map(c => {
    const b = _banco(c.banco);
    // A MESMA fatura que abre ao tocar no cartão. Aqui estava a "aberta",
    // e o cartão mostrava outubro vencendo 10/10 enquanto a conta a pagar
    // era a de setembro, vencendo dia 10. Lista e tela de dentro falando
    // de meses diferentes é o tipo de coisa que faz a pessoa desconfiar do
    // número — com razão.
    const mes = _faturaAoAbrir(c);
    const aberta = mes === _mesFaturaAberta(c);
    const venc = _vencimentoDaFatura(mes, c.dia_fechamento, c.dia_vencimento);
    const s = _situacaoFatura(c, mes);
    return `
      <button class="cartao-card" style="background:${b.cor};color:${b.texto}"
              onclick="abrirCartao('${c.id}')">
        <div class="cartao-card-topo">
          <span class="cartao-card-banco">${esc(b.nome)}</span>
          ${_ICO_CARTAO}
        </div>
        <span class="cartao-card-nome">${esc(c.nome)}</span>
        <div class="cartao-card-baixo">
          <div>
            <small>${s.parcial ? "Falta pagar" : aberta ? "Fatura atual" : "Fatura de " + soNomeDoMes(mes)}</small>
            <strong>${moeda(s.quitada ? s.pago : s.parcial ? s.restante : s.total)}</strong>
          </div>
          <div class="cartao-card-venc">
            ${s.quitada
              ? `<span class="cartao-card-selo">${_ICO_CONFERE} Paga</span>`
              : `<small>Vence</small><strong>${dataBR(venc)}</strong>`}
          </div>
        </div>
      </button>`;
  }).join("");

  // O que já foi pago sai da soma: virou saída no extrato no dia do
  // pagamento, e continuar somando aqui seria contar o mesmo dinheiro duas
  // vezes. E a soma é das mesmas faturas que os cartões mostram — senão o
  // total não bate com a conta de baixo, e não há erro pior num app de
  // dinheiro do que dois números que não fecham na mesma tela.
  const totalGeral = cartoes.reduce(
    (soma, c) => soma + _situacaoFatura(c, _faturaAoAbrir(c)).restante, 0);

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_CARTAO}</span>
        <span class="lancamento-caption">Crédito</span>
        <h2>Cartões</h2>
      </div>
    </section>

    <div class="contas-total">
      <!-- "em aberto" = não pago, que é o que o número diz. "Abertas" dava
           a entender a fatura que ainda está juntando compras, e agora nem
           sempre é dela que se trata. -->
      <span>Total em aberto</span>
      <strong>${moeda(totalGeral)}</strong>
      <small>${cartoes.length
        ? `${cartoes.length} ${cartoes.length > 1 ? "cartões cadastrados" : "cartão cadastrado"}`
        : "Nenhum cartão ainda"}</small>
    </div>

    <button class="botao" onclick="abrirNovoCartao()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Novo cartão
    </button>

    ${cartoes.length
      ? `<div class="cartao-lista">${cards}</div>`
      : `<div class="bloco" style="margin-top:14px"><p class="vazio">Cadastre seu primeiro cartão pra acompanhar as faturas.</p></div>`}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ═══ CADASTRAR CARTÃO ════════════════════════════════════════════════ */

function abrirNovoCartao() {
  abrirTela(() => {
    destruirGrafico();
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
    const icoBanco = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18M5 10v9m4-9v9m6-9v9m4-9v9M2 19h20M12 3 3 8h18z"/></svg>`;
    const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const dias = n => Array.from({ length: 28 }, (_, i) => i + 1)
      .map(d => `<option value="${d}"${d === n ? " selected" : ""}>Dia ${d}</option>`).join("");

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_CARTAO}</span>
        <span class="lancamento-caption">Cartões</span>
        <h2>Novo cartão</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="ct-cartao-nome">Nome do cartão</label></div>
          <input type="text" id="ct-cartao-nome" placeholder="Ex: Nubank principal" autocomplete="off">
        </div>

        <div class="campo">
          <div class="campo-label">${icoBanco}<label for="ct-cartao-banco">Banco</label></div>
          <select id="ct-cartao-banco" onchange="_previaCorCartao()">
            ${BANCOS.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join("")}
          </select>
        </div>

        <div class="dois">
          <div class="campo">
            <div class="campo-label">${icoData}<label for="ct-fechamento">Fecha no</label></div>
            <select id="ct-fechamento">${dias(1)}</select>
          </div>
          <div class="campo">
            <div class="campo-label">${icoData}<label for="ct-vencimento">Vence no</label></div>
            <select id="ct-vencimento">${dias(10)}</select>
          </div>
        </div>

        <p class="cartao-dica">A compra feita depois do dia de fechamento já entra na fatura do mês seguinte.</p>
      </div>

      <div class="cartao-previa" id="cartao-previa"></div>

      <button class="botao" onclick="salvarCartao(this)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar cartão
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;

    _previaCorCartao();
    // Sem foco automático: no celular ele abre o teclado sozinho e come
    // metade da tela antes de a pessoa ter lido o formulário.
  });
}

// Mostra a cor do banco escolhido antes de salvar — a cor é a única coisa
// da tela que a pessoa não consegue prever lendo os campos.
function _previaCorCartao() {
  const alvo = document.getElementById("cartao-previa");
  if (!alvo) return;
  const b = _banco(document.getElementById("ct-cartao-banco")?.value);
  alvo.innerHTML = `
    <div class="cartao-previa-amostra" style="background:${b.cor};color:${b.texto}">
      ${_ICO_CARTAO}<span>${esc(b.nome)}</span>
    </div>`;
}

async function salvarCartao(botao) {
  if (botao?.disabled) return;

  const nome = (document.getElementById("ct-cartao-nome").value || "").trim();
  const banco = document.getElementById("ct-cartao-banco").value;
  const fechamento = Number(document.getElementById("ct-fechamento").value);
  const vencimento = Number(document.getElementById("ct-vencimento").value);

  if (!nome) { erro("Dê um nome ao cartão."); return; }

  const solta = travar(botao, "Salvando...");
  const { data, error } = await sb.from("cartoes").insert({
    user_id: usuario.id, nome, banco,
    dia_fechamento: fechamento, dia_vencimento: vencimento,
  }).select().single();

  if (error) { solta(); erro("Erro ao salvar: " + error.message); return; }

  cartoes.push(data);
  cartoes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  ok("Cartão cadastrado!");
  voltarTela();
}

/* ═══ UM CARTÃO: A FATURA ═════════════════════════════════════════════ */

// Qual mês de fatura está aberto na tela. Fica fora da função de desenho
// pra pessoa poder navegar entre as faturas sem empilhar telas.
let _faturaMes = null;

function abrirCartao(id) {
  const c = cartoes.find(x => x.id === id);
  if (!c) { erro("Cartão não encontrado."); return; }
  _faturaMes = _faturaAoAbrir(c);
  abrirTela(() => desenharCartao(id));
}

function trocarFatura(id, passo) {
  _faturaMes = _somaMes(_faturaMes, passo);
  desenharCartao(id);
}

function desenharCartao(id) {
  destruirGrafico();
  const c = cartoes.find(x => x.id === id);
  if (!c) { voltarInicio(); return; }

  const b = _banco(c.banco);
  const mes = _faturaMes || _mesFaturaAberta(c);
  const itens = _parcelasDaFatura(c, mes);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const venc = _vencimentoDaFatura(mes, c.dia_fechamento, c.dia_vencimento);
  const aberta = mes === _mesFaturaAberta(c);
  const s = _situacaoFatura(c, mes);

  /* PARCELADAS E À VISTA SÃO DUAS COISAS DIFERENTES NA MESMA FATURA.
     A parcela é dívida que já estava contratada — vem de uma decisão de
     meses atrás e vai continuar vindo. A compra à vista é o que se gastou
     AGORA, no mês. Misturadas, a fatura não responde a pergunta que
     interessa: quanto dela eu ainda escolho, e quanto já está preso?

     Cada grupo com seu subtotal, e o cabeçalho só aparece quando existem
     os dois — fatura só de parceladas não precisa de título pra dizer o
     óbvio. É a mesma separação das Metas, com a mesma cara. */
  const parceladas = itens.filter(i => i.totalParcelas > 1);
  const aVista = itens.filter(i => i.totalParcelas === 1);
  const separar = parceladas.length > 0 && aVista.length > 0;

  // A pílula só existe no grupo das parceladas — e lá TODA linha tem uma,
  // então elas caem naturalmente na mesma coluna. No grupo à vista não
  // sobra coluna vazia nenhuma.
  const umaCompra = (i, comParcela) => `
    <div class="compra-item" id="compra-${i.compra.id}">
      <div class="compra-txt">
        <strong>${esc(i.compra.descricao)}</strong>
        <small>${dataBR(i.compra.data)}${i.compra.categoria ? " · " + esc(i.compra.categoria) : ""}</small>
      </div>
      ${comParcela ? `<span class="compra-parcela">${i.parcela}/${i.totalParcelas}</span>` : ""}
      <span class="compra-valor">${moeda(i.valor)}</span>
      <button class="botao-editar botao-excluir" onclick="pedirExcluirCompra('${i.compra.id}', '${c.id}')" aria-label="Excluir">🗑️</button>
    </div>`;

  const grupo = (titulo, lista, comParcela) => !lista.length ? "" : `
    ${separar ? `
      <div class="compra-grupo">
        <h3>${titulo}</h3>
        <span>${moeda(lista.reduce((s, i) => s + i.valor, 0))}</span>
      </div>` : ""}
    ${lista.map(i => umaCompra(i, comParcela)).join("")}`;

  const linhas =
    grupo("Parceladas", parceladas, true) +
    grupo("À vista", aVista, false);

  document.getElementById("area").innerHTML = `
    <div class="cartao-capa" style="background:${b.cor};color:${b.texto}">
      <div class="cartao-card-topo">
        <span class="cartao-card-banco">${esc(b.nome)}</span>
        ${_ICO_CARTAO}
      </div>
      <span class="cartao-card-nome">${esc(c.nome)}</span>
      <small class="cartao-capa-regra">Fecha dia ${c.dia_fechamento} · Vence dia ${c.dia_vencimento}</small>
    </div>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarFatura('${c.id}', -1)">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mes)}</strong>
        <button class="pilula" onclick="trocarFatura('${c.id}', 1)">›</button>
      </div>
    </div>

    <div class="contas-total">
      <span>Fatura ${s.quitada ? "quitada" : aberta ? "aberta" : "de " + mesPorExtenso(mes)}</span>
      <strong>${moeda(total)}</strong>
      <small>Vence em ${dataBR(venc)}${itens.length ? ` · ${itens.length} lançamento${itens.length > 1 ? "s" : ""}` : ""}</small>
    </div>

    ${_blocoFaturasAntigas(c)}

    <div id="fatura-acao">${_acaoDaFatura(c, mes, s)}</div>

    <button class="botao" onclick="abrirNovaCompra('${c.id}')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Lançar compra
    </button>

    ${itens.length
      ? `<div class="bloco" style="margin-top:14px"><div class="lista">${linhas}</div></div>`
      : `<div class="bloco" style="margin-top:14px"><p class="vazio">Nenhuma compra nesta fatura.</p></div>`}

    <div id="cartao-excluir">
      <button class="botao-fraco cartao-apagar" onclick="pedirExcluirCartao('${c.id}')">
        🗑️ Excluir este cartão
      </button>
    </div>

    <button class="botao-fraco" onclick="abrirCartoes()">Voltar aos cartões</button>
  `;
}

/* ═══ EXCLUIR O CARTÃO ════════════════════════════════════════════════
   O banco leva junto as compras e os pagamentos (on delete cascade), mas
   NÃO as saídas que os pagamentos criaram no extrato — e é assim que tem
   que ser. Aquele dinheiro saiu da conta de verdade, no dia em que saiu.
   Apagar o cartão é dizer "não uso mais este cartão", não "aquele mês
   custou menos do que custou".

   Por isso a pergunta diz o que some e o que fica: é a diferença entre
   arrumar a lista de cartões e reescrever o seu histórico. */

function pedirExcluirCartao(id) {
  const alvo = document.getElementById("cartao-excluir");
  const c = cartoes.find(x => x.id === id);
  if (!alvo || !c) return;

  const compras = comprasCartao.filter(x => x.cartao_id === id).length;
  const saidas = pagamentosFatura.filter(p => p.cartao_id === id && p.lancamento_id).length;

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Tem certeza que quer excluir o cartão "${esc(c.nome)}"?
         ${compras ? `As ${compras} compra${compras > 1 ? "s" : ""} e as faturas dele somem junto.` : "Ele não tem nenhuma compra lançada."}
         ${saidas ? `As ${saidas} saída${saidas > 1 ? "s" : ""} de pagamento de fatura ficam no seu extrato — aquele dinheiro saiu de verdade.` : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharCartao('${id}')">Cancelar</button>
        <button class="sim" onclick="excluirCartao(this, '${id}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirCartao(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "Excluindo...");

  const { error } = await sb.from("cartoes").delete().eq("id", id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  // O cascade já limpou as duas tabelas no banco; aqui é a mesma limpeza
  // na cópia que está na memória, pra tela não ficar mostrando fantasma.
  cartoes = cartoes.filter(x => x.id !== id);
  comprasCartao = comprasCartao.filter(x => x.cartao_id !== id);
  pagamentosFatura = pagamentosFatura.filter(p => p.cartao_id !== id);

  ok("Cartão excluído.");
  abrirCartoes();
  pilha.pop();   // não empilha a lista duas vezes
}

/* ═══ LANÇAR COMPRA ═══════════════════════════════════════════════════ */

function abrirNovaCompra(cartaoId) {
  abrirTela(() => {
    destruirGrafico();
    const c = cartoes.find(x => x.id === cartaoId);
    if (!c) { voltarInicio(); return; }

    const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const cats = categorias.filter(x => x.tipo === "saida");
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
    const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
    const icoParcela = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="14" x2="9" y2="15"/><line x1="15" y1="14" x2="15" y2="15"/></svg>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela saida">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_CARTAO}</span>
        <span class="lancamento-caption">${esc(c.nome)}</span>
        <h2>Nova compra</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <label for="cp-valor">Valor total da compra</label>
          <div class="lancamento-valor">
            <span>R$</span>
            <input type="text" inputmode="decimal" id="cp-valor" placeholder="0,00" autocomplete="off"
                   oninput="_previaParcelas()">
          </div>
        </div>

        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="cp-desc">Descrição</label></div>
          <input type="text" id="cp-desc" placeholder="Ex: tênis" autocomplete="off">
        </div>

        <div class="dois">
          <div class="campo lancamento-campo-data">
            <div class="campo-label">${icoData}<label for="cp-data">Data</label></div>
            <input type="date" id="cp-data" value="${_hojeLocal()}">
          </div>
          <div class="campo">
            <div class="campo-label">${icoEtiqueta}<label for="cp-cat">Categoria</label></div>
            ${campoDeCategoria({ id: "cp-cat", tipo: "saida",
                                opcoes: cats.length ? cats.map(x => x.nome) : ["Outros"] })}
          </div>
        </div>

        <div class="campo" style="margin-bottom:0">
          <div class="campo-label">${icoParcela}<label for="cp-parcelas">Parcelas</label></div>
          <select id="cp-parcelas" onchange="_previaParcelas()">
            ${Array.from({ length: 24 }, (_, i) => i + 1)
              .map(n => `<option value="${n}">${n}x</option>`).join("")}
          </select>
        </div>

        <p class="cartao-dica" id="cp-previa"></p>
      </div>

      <button class="botao saida" onclick="salvarCompra(this, '${c.id}', '${chave}')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Lançar compra
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;

    _previaParcelas();
    // Sem foco automático: no celular ele abre o teclado sozinho e come
    // metade da tela antes de a pessoa ter lido o formulário.
  });
}

// "3x de R$ 400,00" enquanto a pessoa digita: parcelar é a decisão que ela
// está tomando ali, e o valor da parcela é o número que ela quer saber.
function _previaParcelas() {
  const alvo = document.getElementById("cp-previa");
  if (!alvo) return;
  const total = parseMoedaBR(document.getElementById("cp-valor")?.value);
  const n = Number(document.getElementById("cp-parcelas")?.value) || 1;
  if (!total || total <= 0) { alvo.textContent = ""; return; }
  alvo.textContent = n === 1
    ? `À vista: ${moeda(total)}`
    : `${n}x de ${moeda(total / n)} — total ${moeda(total)}`;
}

async function salvarCompra(botao, cartaoId, chave) {
  if (botao?.disabled) return;

  const valor = parseMoedaBR(document.getElementById("cp-valor").value);
  const descricao = (document.getElementById("cp-desc").value || "").trim();
  const data = document.getElementById("cp-data").value;
  const categoria = document.getElementById("cp-cat").value;
  const parcelas = Number(document.getElementById("cp-parcelas").value) || 1;

  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!descricao) { erro("Diga o que foi a compra."); return; }
  if (!data) { erro("Escolha a data."); return; }

  const solta = travar(botao, "Salvando...");
  const { data: nova, error } = await sb.from("compras_cartao").insert({
    user_id: usuario.id, cartao_id: cartaoId,
    descricao, valor, parcelas, data, categoria, chave_envio: chave,
  }).select().single();

  if (error) {
    solta();
    if (error.code === "23505") { ok("Compra já registrada."); voltarTela(); return; }
    erro("Erro ao salvar: " + error.message);
    return;
  }

  comprasCartao.push(nova);
  ok(parcelas > 1 ? `Compra em ${parcelas}x lançada!` : "Compra lançada!");
  voltarTela();
}

/* ═══ EXCLUIR COMPRA ══════════════════════════════════════════════════
   Apaga a compra inteira, com todas as parcelas dela — é uma linha só no
   banco. Por isso o aviso diz quantas parcelas somem junto: quem está
   olhando a fatura de junho pode não lembrar que aquilo se estende até
   dezembro. */

function pedirExcluirCompra(id, cartaoId) {
  const linha = document.getElementById("compra-" + id);
  const c = comprasCartao.find(x => x.id === id);
  if (!linha || !c) return;
  const n = Number(c.parcelas) || 1;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%">
      <p>Tem certeza que quer excluir "${esc(c.descricao)}"?${n > 1 ? ` As ${n} parcelas somem juntas.` : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharCartao('${cartaoId}')">Cancelar</button>
        <button class="sim" onclick="excluirCompra(this, '${id}', '${cartaoId}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirCompra(botao, id, cartaoId) {
  if (botao?.disabled) return;
  const solta = travar(botao, "Excluindo...");

  const { error } = await sb.from("compras_cartao")
    .delete()
    .eq("id", id)
    .eq("user_id", usuario.id);

  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  comprasCartao = comprasCartao.filter(x => x.id !== id);
  ok("Compra excluída.");
  desenharCartao(cartaoId);
}

/* ═══ PAGAR A FATURA ══════════════════════════════════════════════════
   É aqui que o cartão encosta no resto do app. As compras não são
   lançamentos — elas moram só dentro do cartão. O dinheiro só sai de
   verdade quando a fatura é paga, e é nesse momento que nasce a saída no
   extrato.

   A fatura aceita VÁRIOS pagamentos. Pagar o mínimo, pagar um pedaço
   agora e outro depois, adiantar uma fatura que ainda nem fechou — tudo
   isso é a mesma coisa vista de ângulos diferentes: soma de pagamentos
   contra o total da fatura. Por isso "quitada" é conta, não um campo
   guardado: um pagamento desfeito reabre a fatura sozinho.

   O que sobra tem um caminho próprio: "jogar o resto pra próxima fatura"
   grava uma compra na fatura seguinte e abate esta. É o que o banco faz
   quando você paga só uma parte — só que aqui você vê a linha. */

// 15% é o piso que os bancos brasileiros costumam cobrar. É atalho de
// digitação, não regra: cada banco tem o seu, e o campo aceita qualquer
// valor.
const _MINIMO_FATURA = 0.15;

function _centavos(v) { return Math.round(Number(v || 0) * 100) / 100; }

function _pagamentosDaFatura(cartaoId, mesRef) {
  return pagamentosFatura
    .filter(p => p.cartao_id === cartaoId && p.mes_ref === mesRef)
    .sort((a, b) => String(a.pago_em).localeCompare(String(b.pago_em)));
}

// O estado da fatura, num lugar só. Toda tela pergunta a mesma coisa:
// quanto é, quanto já foi, quanto falta.
function _situacaoFatura(cartao, mesRef) {
  const pagamentos = _pagamentosDaFatura(cartao.id, mesRef);
  const total = _centavos(_totalDaFatura(cartao, mesRef));
  const pago = _centavos(pagamentos.reduce((s, p) => s + Number(p.valor), 0));
  const restante = _centavos(Math.max(0, total - pago));
  return {
    pagamentos, total, pago, restante,
    // Meio centavo de folga: parcela de R$ 100 em 3x não fecha exato, e sem
    // essa folga a fatura ficaria eternamente devendo R$ 0,00.
    quitada: pago > 0 && restante < 0.005,
    parcial: pago > 0 && restante >= 0.005,
  };
}

/* ═══ AS FATURAS DE ANTES ═════════════════════════════════════════════
   Quem começa a usar o app hoje cadastra a compra parcelada que já está
   na quarta de dez. O app faz a conta certa e mostra as três primeiras
   faturas em aberto — mas elas não estão em aberto, foram pagas meses
   atrás, antes de o app existir.

   Marcar essas como pagas NÃO pode lançar saída no extrato. O pagamento
   normal lança, e tem que lançar: o dinheiro está saindo agora. Mas
   inventar três saídas em junho, julho e agosto mudaria o resultado de
   meses que já acabaram — e que talvez já tenham sido fechados. O que
   aconteceu antes do app fica fora do extrato do app.

   Por isso o pagamento nasce com lancamento_id nulo, que o banco já
   aceita e o "Desfazer" já sabe tratar. Ele abate a fatura e não toca no
   seu dinheiro — que é exatamente o que aconteceu na vida real. */

// Todo mês que tem parcela caindo nele, do mais antigo pro mais novo. Não
// existe fatura sem compra: os meses saem das parcelas.
function _mesesComFatura(cartao) {
  const meses = new Set();
  for (const c of comprasCartao) {
    if (c.cartao_id !== cartao.id) continue;
    const inicio = _mesDaPrimeiraParcela(c.data, cartao.dia_fechamento);
    const total = Number(c.parcelas) || 1;
    for (let n = 0; n < total; n++) meses.add(_somaMes(inicio, n));
  }
  return [...meses].sort();
}

/* "De antes" é DO MÊS PASSADO PRA TRÁS — e não "toda fatura já fechada",
   que era como estava e estava errado.

   Um cartão que fecha dia 1 fecha a fatura de setembro no dia 1º de
   setembro. No dia 8, essa fatura está fechada, vence dia 10, e ninguém
   pagou nada: é A CONTA DO MÊS. Chamando toda fatura fechada de "de
   antes", o app oferecia quitar setembro junto com junho e julho — e
   quem aceitasse ficaria com a conta do mês marcada como paga sem ter
   pago.

   Fechada não quer dizer paga. O que dá pra presumir já pago é o mês que
   passou, não o mês que está correndo. */
function _faturasAntigasEmAberto(cartao) {
  const limite = mesDe(_hojeLocal());
  return _mesesComFatura(cartao)
    .filter(mes => mes < limite)
    .map(mes => ({ mes, s: _situacaoFatura(cartao, mes) }))
    .filter(x => x.s.restante >= 0.005);
}

/* Qual fatura aparece quando o cartão abre.

   A "aberta" é onde uma compra feita HOJE cairia — mas não é a que a
   pessoa veio ver. Fechando dia 1, no dia 8 a fatura aberta já é a de
   outubro, que ainda nem terminou de juntar compras e vence daqui a mais
   de um mês. A que importa é a de setembro: fechada, vencendo dia 10, com
   as compras que ela acabou de lançar.

   Então: a fatura fechada mais recente que ainda deve alguma coisa. Não
   devendo nada, aí sim a aberta. */
function _faturaAoAbrir(cartao) {
  const aberta = _mesFaturaAberta(cartao);
  const devendo = _mesesComFatura(cartao)
    .filter(mes => mes < aberta && _situacaoFatura(cartao, mes).restante >= 0.005);
  return devendo.length ? devendo[devendo.length - 1] : aberta;
}

const _ICO_CONFERE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16.5 9"/></svg>`;
const _ICO_EMPURRA = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="14 5 21 12 14 19"/><path d="M21 12H6a3 3 0 0 1-3-3V6"/></svg>`;

/* ─── O bloco de pagamento dentro da tela do cartão ─────────────────── */

function _acaoDaFatura(cartao, mesRef, s) {
  const pedacos = [];

  if (s.pagamentos.length) pedacos.push(_blocoJaPago(cartao, mesRef, s));

  if (s.restante >= 0.005) {
    pedacos.push(`
      <button class="botao entrada" onclick="abrirPagarFatura('${cartao.id}', '${mesRef}')">
        ${_ICO_CONFERE}
        ${s.parcial ? "Pagar o resto" : "Pagar fatura"} · ${moeda(s.restante)}
      </button>`);

    // Empurrar o resto só faz sentido depois de pagar alguma coisa, ou numa
    // fatura que já fechou e ficou pra trás. Na fatura ainda aberta seria
    // mandar pro mês que vem uma conta que nem venceu.
    const fechada = mesRef < _mesFaturaAberta(cartao);
    if (s.pago > 0 || fechada) {
      pedacos.push(`
        <button class="botao-fraco fatura-empurrar" onclick="pedirJogarSaldo('${cartao.id}', '${mesRef}')">
          ${_ICO_EMPURRA}
          Jogar o resto pra fatura de ${soNomeDoMes(_somaMes(mesRef, 1))}
        </button>`);
    }
  }

  return pedacos.join("");
}

function _blocoJaPago(cartao, mesRef, s) {
  const largura = s.total > 0 ? Math.min(100, (s.pago / s.total) * 100) : 100;

  // O valor pago fica gravado. Se a fatura mudou depois (uma compra
  // excluída, por exemplo), o que saiu do banco continua tendo sido aquilo
  // — e aí pago passa do total, que é o que esta linha avisa.
  const passou = s.pago - s.total >= 0.005;

  const linhas = s.pagamentos.map(p => `
    <div class="fatura-pgto">
      <span class="fatura-pgto-ico ${p.tipo === "saldo" ? "empurrado" : ""}">
        ${p.tipo === "saldo" ? _ICO_EMPURRA : _ICO_CONFERE}
      </span>
      <div class="fatura-pgto-txt">
        <strong>${moeda(p.valor)}</strong>
        <small>${dataBR(p.pago_em)} · ${p.tipo === "saldo"
          ? "jogado pra fatura de " + soNomeDoMes(_somaMes(mesRef, 1))
          : p.lancamento_id
            ? "saída no extrato"
            : "pago fora do app"}</small>
      </div>
      <button class="fatura-desfazer" onclick="pedirDesfazerPagamento('${p.id}', '${cartao.id}')">Desfazer</button>
    </div>`).join("");

  return `
    <div class="fatura-pago ${s.quitada ? "quitada" : ""}">
      <div class="fatura-pago-topo">
        <strong>${s.quitada ? "Fatura quitada" : "Pago " + moeda(s.pago)}</strong>
        <span>${s.quitada ? moeda(s.pago) : "Faltam " + moeda(s.restante)}</span>
      </div>
      <div class="fatura-barra"><span style="width:${largura}%"></span></div>
      ${passou ? `<p class="fatura-nota">Você pagou ${moeda(s.pago)} e a fatura hoje soma ${moeda(s.total)}.</p>` : ""}
      <div class="fatura-pgtos">${linhas}</div>
    </div>`;
}

/* ─── Quitar sem lançar (as faturas de antes do app) ────────────────── */

// "junho, julho, agosto e setembro" — vírgula entre todos, "e" antes do
// último. É como se fala, e a frase abaixo é pra ser lida em voz normal.
function _listaEmPortugues(itens) {
  if (itens.length < 2) return itens.join("");
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}

// O bloco que aparece na tela do cartão quando sobrou fatura velha aberta.
function _blocoFaturasAntigas(cartao) {
  const antigas = _faturasAntigasEmAberto(cartao);
  if (!antigas.length) return "";

  const total = _centavos(antigas.reduce((s, x) => s + x.s.restante, 0));
  const nomes = _listaEmPortugues(antigas.map(x => soNomeDoMes(x.mes)));

  return `
    <div class="bloco" id="fatura-antigas">
      <div class="bloco-topo">
        <h2>Faturas de antes</h2>
        <strong class="resumo-total-saida">${moeda(total)}</strong>
      </div>
      <p class="cartao-dica">
        ${antigas.length > 1 ? `${antigas.length} faturas` : "A fatura"} de ${esc(nomes)}
        ${antigas.length > 1 ? "continuam" : "continua"} em aberto — normal, se você
        cadastrou compras que já estavam correndo. Se já pagou, marque de uma vez:
        <b>isso não entra como saída no seu extrato</b>, porque esse dinheiro saiu
        antes de você começar a usar o app.
      </p>
      <button class="botao-fraco" onclick="pedirQuitarAntigas('${cartao.id}')">
        ${_ICO_CONFERE} Marcar como ${antigas.length > 1 ? "pagas" : "paga"}
      </button>
    </div>`;
}

function pedirQuitarAntigas(cartaoId) {
  const alvo = document.getElementById("fatura-antigas");
  const c = cartoes.find(x => x.id === cartaoId);
  if (!alvo || !c) return;

  const antigas = _faturasAntigasEmAberto(c);
  if (!antigas.length) return;
  const total = _centavos(antigas.reduce((s, x) => s + x.s.restante, 0));

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Quitar ${antigas.length > 1 ? `as ${antigas.length} faturas` : "a fatura"}
         de ${esc(_listaEmPortugues(antigas.map(x => soNomeDoMes(x.mes))))}, somando ${moeda(total)}?
         Nada disso vira saída no extrato, e o seu saldo não muda. Dá pra
         desfazer uma por uma depois.</p>
      <div class="confirmar-acoes">
        <button onclick="desenharCartao('${cartaoId}')">Cancelar</button>
        <button class="sim" onclick="quitarAntigas(this, '${cartaoId}')">Sim, já paguei</button>
      </div>
    </div>`;
}

async function quitarAntigas(botao, cartaoId) {
  if (botao?.disabled) return;
  const c = cartoes.find(x => x.id === cartaoId);
  if (!c) return;

  const antigas = _faturasAntigasEmAberto(c);
  if (!antigas.length) { erro("Nenhuma fatura anterior em aberto."); return; }

  const solta = travar(botao, "Quitando...");
  const raiz = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  // A data do pagamento é o vencimento da própria fatura, não hoje: é
  // quando aquilo foi pago de verdade, e é o que a linha vai mostrar.
  const { data, error } = await sb.from("pagamentos_fatura").insert(
    antigas.map(x => ({
      user_id: usuario.id, cartao_id: cartaoId, mes_ref: x.mes,
      tipo: "pago", valor: x.s.restante,
      pago_em: _vencimentoDaFatura(x.mes, c.dia_fechamento, c.dia_vencimento),
      lancamento_id: null, chave_envio: raiz + "-" + x.mes,
    }))
  ).select();

  if (error) { solta(); erro("Erro ao quitar: " + error.message); return; }

  pagamentosFatura.push(...(data || []));
  ok(antigas.length > 1 ? `${antigas.length} faturas quitadas!` : "Fatura quitada!");
  desenharCartao(cartaoId);
}

/* ─── A tela de pagar ───────────────────────────────────────────────── */

function abrirPagarFatura(cartaoId, mesRef) {
  abrirTela(() => desenharPagarFatura(cartaoId, mesRef));
}

function desenharPagarFatura(cartaoId, mesRef) {
  destruirGrafico();
  const c = cartoes.find(x => x.id === cartaoId);
  if (!c) { voltarInicio(); return; }

  const s = _situacaoFatura(c, mesRef);
  if (s.restante < 0.005) { erro("Essa fatura já está quitada."); voltarTela(); return; }

  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  // O mínimo é 15% da fatura INTEIRA, então o que ainda falta pra alcançá-lo
  // desconta o que já foi pago. Quem já pagou o mínimo não tem por que ver
  // esse atalho de novo — e quando ele bate com o total em aberto, o botão
  // "Tudo" já diz a mesma coisa.
  const faltaProMinimo = _centavos(Math.max(0, s.total * _MINIMO_FATURA - s.pago));
  const mostrarMinimo = faltaProMinimo >= 0.005 && s.restante - faltaProMinimo >= 0.005;

  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  const emCampo = v => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--entrada)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_CONFERE}</span>
      <span class="lancamento-caption">${esc(c.nome)} · ${mesPorExtenso(mesRef)}</span>
      <h2>Pagar fatura</h2>
    </div>

    <div class="fatura-resumo">
      <div><small>Fatura</small><strong>${moeda(s.total)}</strong></div>
      ${s.pago > 0 ? `<div><small>Já pago</small><strong>${moeda(s.pago)}</strong></div>` : ""}
      <div class="destaque"><small>Em aberto</small><strong>${moeda(s.restante)}</strong></div>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <label for="pg-valor">Quanto você vai pagar</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="pg-valor" placeholder="0,00"
                 autocomplete="off" value="${emCampo(s.restante)}">
        </div>
      </div>

      <div class="fatura-chips">
        ${mostrarMinimo
          ? `<button type="button" onclick="_porNoCampo('${emCampo(faltaProMinimo)}')">Mínimo 15% · ${moeda(faltaProMinimo)}</button>`
          : ""}
        <button type="button" onclick="_porNoCampo('${emCampo(s.restante)}')">Tudo · ${moeda(s.restante)}</button>
      </div>

      <div class="campo lancamento-campo-data" style="margin:14px 0 0">
        <div class="campo-label">${icoData}<label for="pg-data">Data do pagamento</label></div>
        <input type="date" id="pg-data" value="${_hojeLocal()}">
      </div>

      <p class="cartao-dica" id="pg-previa"></p>
    </div>

    <button class="botao entrada" onclick="salvarPagamento(this, '${c.id}', '${mesRef}', '${chave}')">
      ${_ICO_CONFERE}
      Confirmar pagamento
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;

  document.getElementById("pg-valor").addEventListener("input", () => _previaPagamento(cartaoId, mesRef));
  _previaPagamento(cartaoId, mesRef);
}

function _porNoCampo(texto) {
  const campo = document.getElementById("pg-valor");
  if (!campo) return;
  campo.value = texto;
  campo.dispatchEvent(new Event("input"));
}

// Diz o que vai sobrar ANTES de confirmar. Pagar parcial sem ver o resto é
// como assinar cheque sem olhar o valor.
function _previaPagamento(cartaoId, mesRef) {
  const alvo = document.getElementById("pg-previa");
  const c = cartoes.find(x => x.id === cartaoId);
  if (!alvo || !c) return;

  const s = _situacaoFatura(c, mesRef);
  const v = parseMoedaBR(document.getElementById("pg-valor")?.value);

  if (v === null || v <= 0) { alvo.textContent = ""; return; }
  if (v - s.restante >= 0.005) {
    alvo.innerHTML = `<span class="fatura-alerta">Essa fatura tem só ${moeda(s.restante)} em aberto.</span>`;
    return;
  }
  const sobra = _centavos(s.restante - v);
  alvo.textContent = sobra < 0.005
    ? "Quita a fatura."
    : `Ficam ${moeda(sobra)} em aberto nesta fatura.`;
}

async function salvarPagamento(botao, cartaoId, mesRef, chave) {
  if (botao?.disabled) return;
  const c = cartoes.find(x => x.id === cartaoId);
  if (!c) return;

  const s = _situacaoFatura(c, mesRef);
  const valor = parseMoedaBR(document.getElementById("pg-valor").value);
  const data = document.getElementById("pg-data").value;

  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  // Trava contra o zero a mais: R$ 6.843,00 numa fatura de R$ 684,30 passaria
  // por qualquer validação de "número positivo" e sairia do extrato calado.
  if (valor - s.restante >= 0.005) { erro(`Essa fatura tem só ${moeda(s.restante)} em aberto.`); return; }
  if (!data) { erro("Escolha a data do pagamento."); return; }

  const solta = travar(botao, "Pagando...");
  const quita = valor - s.restante > -0.005;

  // Primeiro a saída. Se ela falhar, nada foi abatido e dá pra tentar de
  // novo — o contrário abateria a fatura sem o dinheiro ter saído.
  const { data: lanc, error: erroLanc } = await sb.from("lancamentos").insert({
    user_id: usuario.id,
    tipo: "saida",
    valor,
    data,
    categoria: "Cartão",
    descricao: `Fatura ${c.nome} · ${mesPorExtenso(mesRef)}${quita ? "" : " (parcial)"}`,
    chave_envio: chave,
  }).select().single();

  if (erroLanc) {
    solta();
    if (erroLanc.code === "23505") { ok("Pagamento já registrado."); voltarTela(); return; }
    erro("Erro ao lançar a saída: " + erroLanc.message);
    return;
  }

  const { data: pgto, error: erroPgto } = await sb.from("pagamentos_fatura").insert({
    user_id: usuario.id, cartao_id: cartaoId, mes_ref: mesRef,
    tipo: "pago", valor, pago_em: data, lancamento_id: lanc.id, chave_envio: chave + "-p",
  }).select().single();

  if (erroPgto) {
    // A saída entrou mas o abatimento não: desfaz a saída pra não sobrar
    // dinheiro saindo duas vezes quando a pessoa tentar de novo.
    await sb.from("lancamentos").delete().eq("id", lanc.id).eq("user_id", usuario.id);
    solta();
    erro("Erro ao registrar o pagamento: " + erroPgto.message);
    return;
  }

  lancamentos.unshift(lanc);
  lancamentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  pagamentosFatura.push(pgto);

  ok(quita ? "Fatura quitada!" : `Pagos ${moeda(valor)}. Ficam ${moeda(_centavos(s.restante - valor))} em aberto.`);
  voltarTela();
}

/* ─── Jogar o resto pra fatura seguinte ─────────────────────────────── */

function pedirJogarSaldo(cartaoId, mesRef) {
  const alvo = document.getElementById("fatura-acao");
  const c = cartoes.find(x => x.id === cartaoId);
  if (!alvo || !c) return;

  const s = _situacaoFatura(c, mesRef);
  if (s.restante < 0.005) return;
  const proximo = _somaMes(mesRef, 1);

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Jogar os ${moeda(s.restante)} que faltam pra fatura de ${mesPorExtenso(proximo)}?
         Vira uma compra lá, e esta fatura fica quitada.</p>
      <div class="campo" style="margin:12px 0 0">
        <label for="saldo-parcelas">Em quantas vezes</label>
        <select id="saldo-parcelas">
          ${Array.from({ length: 24 }, (_, i) => i + 1)
            .map(n => `<option value="${n}">${n === 1 ? "1x (de uma vez)" : `${n}x de ${moeda(s.restante / n)}`}</option>`).join("")}
        </select>
      </div>
      <div class="confirmar-acoes" style="margin-top:12px">
        <button onclick="desenharCartao('${cartaoId}')">Cancelar</button>
        <button class="sim neutro" onclick="jogarSaldo(this, '${cartaoId}', '${mesRef}')">Sim, jogar</button>
      </div>
    </div>`;
}

async function jogarSaldo(botao, cartaoId, mesRef) {
  if (botao?.disabled) return;
  const c = cartoes.find(x => x.id === cartaoId);
  if (!c) return;

  const s = _situacaoFatura(c, mesRef);
  if (s.restante < 0.005) { erro("Não sobrou nada nesta fatura."); return; }

  const parcelas = Number(document.getElementById("saldo-parcelas")?.value) || 1;
  const proximo = _somaMes(mesRef, 1);
  const solta = travar(botao, "Jogando...");
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  // Dia 1: o fechamento nunca é antes do dia 1, então a compra cai
  // exatamente na fatura do mês seguinte, sem depender de quando é hoje.
  const { data: compra, error: erroCompra } = await sb.from("compras_cartao").insert({
    user_id: usuario.id, cartao_id: cartaoId,
    descricao: `Saldo da fatura de ${soNomeDoMes(mesRef)}`,
    valor: s.restante, parcelas, data: proximo + "-01",
    categoria: "Cartão", chave_envio: chave,
  }).select().single();

  if (erroCompra) {
    solta();
    if (erroCompra.code === "23505") { ok("Saldo já foi jogado."); desenharCartao(cartaoId); return; }
    erro("Erro ao jogar o saldo: " + erroCompra.message);
    return;
  }

  const { data: pgto, error: erroPgto } = await sb.from("pagamentos_fatura").insert({
    user_id: usuario.id, cartao_id: cartaoId, mes_ref: mesRef,
    tipo: "saldo", valor: s.restante, pago_em: _hojeLocal(),
    compra_id: compra.id, chave_envio: chave + "-s",
  }).select().single();

  if (erroPgto) {
    // Sem o abatimento, a compra do mês que vem seria uma dívida a mais em
    // cima de uma fatura que continuaria aberta: cobrança em dobro.
    await sb.from("compras_cartao").delete().eq("id", compra.id).eq("user_id", usuario.id);
    solta();
    erro("Erro ao registrar o saldo: " + erroPgto.message);
    return;
  }

  comprasCartao.push(compra);
  pagamentosFatura.push(pgto);
  ok(`Saldo de ${moeda(s.restante)} foi pra fatura de ${mesPorExtenso(proximo)}.`);
  desenharCartao(cartaoId);
}

/* ─── Desfazer ──────────────────────────────────────────────────────── */

function pedirDesfazerPagamento(pagamentoId, cartaoId) {
  const alvo = document.getElementById("fatura-acao");
  const p = pagamentosFatura.find(x => x.id === pagamentoId);
  if (!alvo || !p) return;

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Tem certeza que quer desfazer ${p.tipo === "saldo" ? "o saldo" : "o pagamento"} de ${moeda(p.valor)}?
         ${p.tipo === "saldo"
           ? "A compra que ele criou na fatura seguinte some junto."
           : p.lancamento_id
             ? "A saída correspondente sai do seu extrato."
             : "Este não criou saída nenhuma, então seu extrato não muda."}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharCartao('${cartaoId}')">Cancelar</button>
        <button class="sim" onclick="desfazerPagamento(this, '${pagamentoId}', '${cartaoId}')">Desfazer</button>
      </div>
    </div>`;
}

async function desfazerPagamento(botao, pagamentoId, cartaoId) {
  if (botao?.disabled) return;
  const p = pagamentosFatura.find(x => x.id === pagamentoId);
  if (!p) return;

  const solta = travar(botao, "Desfazendo...");

  const { error } = await sb.from("pagamentos_fatura")
    .delete().eq("id", p.id).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao desfazer: " + error.message); return; }

  // O que o pagamento criou lá fora pode já ter sido apagado à mão (a saída
  // pelo Histórico, a compra pela própria fatura); nesse caso não há o que
  // remover e o desfazer vale do mesmo jeito.
  if (p.lancamento_id) {
    await sb.from("lancamentos").delete().eq("id", p.lancamento_id).eq("user_id", usuario.id);
    lancamentos = lancamentos.filter(l => l.id !== p.lancamento_id);
  }
  if (p.compra_id) {
    await sb.from("compras_cartao").delete().eq("id", p.compra_id).eq("user_id", usuario.id);
    comprasCartao = comprasCartao.filter(x => x.id !== p.compra_id);
  }

  pagamentosFatura = pagamentosFatura.filter(x => x.id !== p.id);
  ok(p.tipo === "saldo" ? "Saldo desfeito." : "Pagamento desfeito.");
  desenharCartao(cartaoId);
}
