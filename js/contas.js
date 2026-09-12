/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: contas a pagar.
 */

/* ═══ CONTAS A PAGAR ══════════════════════════════════════════════════ */

/* ─── OS FIXOS ────────────────────────────────────────────────────────
   Gasto fixo não é conceito novo aqui: é a conta marcada "repete todo
   mês". Aluguel, internet, energia, água. O que faltava era ver isso
   junto — quanto eles somam por mês, e se a do mês corrente já existe.

   Cada fixo é uma SÉRIE de contas com o mesmo nome, uma por mês. Elas
   são agrupadas pelo nome porque é o que a pessoa reconhece, e porque a
   cópia do mês seguinte nasce com o mesmo nome. Renomear parte a série
   em duas — é o preço de não ter uma coluna de série no banco, e não
   vale uma migração enquanto uma renomeação por ano for o normal.

   O BURACO QUE ISSO FECHA: a conta do mês seguinte só nascia quando você
   PAGAVA a atual. Não pagou setembro, outubro nunca aparecia — e aí o
   Resumo de outubro não sabia do aluguel e mostrava sobra que não
   existe. Agora a aba avisa e deixa lançar a próxima com um toque. */

function fixosPorSerie() {
  const series = new Map();
  for (const c of contas) {
    if (!c.recorrente) continue;
    const atual = series.get(c.nome);
    if (!atual || c.vencimento > atual.ultima.vencimento) {
      series.set(c.nome, { nome: c.nome, ultima: c });
    }
  }

  const mesCorrente = mesDe(_hojeLocal());
  return [...series.values()].map(f => {
    // Já existe alguma em aberto deste mês em diante? Se sim, a série
    // está em dia e não há o que lançar.
    const emDia = contas.some(c =>
      c.recorrente && c.nome === f.nome && !c.pago && mesDe(c.vencimento) >= mesCorrente);
    const proxima = proximoMesMesmoDia(f.ultima.vencimento);
    return {
      ...f,
      valor: Number(f.ultima.valor),
      categoria: f.ultima.categoria || "",
      emDia,
      proxima,
      // Sem nada em aberto daqui pra frente, a próxima é a que falta.
      falta: emDia ? null : (mesDe(proxima) >= mesCorrente ? proxima : mesCorrente + "-" + f.ultima.vencimento.slice(-2)),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

async function lancarProximoFixo(botao, nome) {
  if (botao?.disabled) return;
  const f = fixosPorSerie().find(x => x.nome === nome);
  if (!f || !f.falta) return;

  const solta = travar(botao, "Lançando...");
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const { data, error } = await sb.from("contas").insert({
    user_id: usuario.id, nome: f.nome, valor: f.valor, vencimento: f.falta,
    categoria: f.categoria || null, recorrente: true, chave_envio: chave,
  }).select().single();

  if (error) { solta(); erro("Erro ao lançar: " + error.message); return; }

  contas.push(data);
  ok(`${f.nome} de ${mesPorExtenso(mesDe(f.falta)).toLowerCase()} lançada.`);
  desenharContas();
}

/* ─── OS CARNÊS ───────────────────────────────────────────────────────
   Um carnê de 26 boletos virava 26 linhas na lista de "A pagar". Com dois
   carnês, a tela tinha 52 linhas de "Moto (2/26)", "Moto (3/26)", e a
   conta de luz do mês sumia no meio — a tela que existe pra dizer o que
   pagar agora passava a esconder isso.

   O cartão já tinha resolvido o mesmo problema: ele mostra UMA linha por
   compra, com "3/18" do lado, e não dezoito. Aqui é igual. O carnê vira
   uma linha só — a próxima parcela a vencer — e as outras ficam na tela
   dele, que se abre no toque.

   O que junta as parcelas é o "(i/n)" no fim do nome, que foi este mesmo
   app que escreveu ao cadastrar. Conta recorrente nunca entra: ela não
   tem fim, e "(1/26)" num aluguel não quereria dizer nada. */

function _parteDoCarne(nome) {
  const m = /^(.+) \((\d+)\/(\d+)\)$/.exec(String(nome || ""));
  if (!m) return null;
  const i = Number(m[2]), n = Number(m[3]);
  if (n < 2 || i < 1 || i > n) return null;
  return { base: m[1], i, n };
}

// Separa uma lista de contas em carnês agrupados e contas soltas.
function _agruparCarnes(lista) {
  const carnes = new Map();
  const soltas = [];

  for (const c of lista) {
    const p = c.recorrente ? null : _parteDoCarne(c.nome);
    if (!p) { soltas.push(c); continue; }
    if (!carnes.has(p.base)) carnes.set(p.base, { base: p.base, n: p.n, parcelas: [] });
    carnes.get(p.base).parcelas.push(Object.assign({}, c, p));
  }

  const grupos = [...carnes.values()].map(g => {
    g.parcelas.sort((a, b) => a.i - b.i);
    const abertas = g.parcelas.filter(x => !x.pago);
    return Object.assign(g, {
      abertas,
      // A que vence primeiro entre as não pagas é a que representa o carnê
      // na lista — é a próxima que a pessoa vai ter na mão.
      proxima: abertas[0] || null,
      falta: abertas.reduce((s, x) => s + Number(x.valor), 0),
      pagas: g.parcelas.length - abertas.length,
    });
  });

  return { grupos, soltas };
}

function _carnePorBase(base) {
  return _agruparCarnes(contas).grupos.find(g => g.base === base) || null;
}

// Qual aba está aberta. Trocar de aba não empilha tela: é a mesma tela
// mostrando outro recorte, então o "Voltar" continua indo pro menu.
let _contasFiltro = "todos";

function abrirContas() { _contasFiltro = "todos"; abrirTela(desenharContas); }
function filtrarContas(f) { _contasFiltro = f; desenharContas(); }

function desenharContas() {
  destruirGrafico();
  const hoje = _hojeLocal();
  const abertas = contas.filter(c => !c.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = contas.filter(c => c.pago).sort((a, b) => b.vencimento.localeCompare(a.vencimento)).slice(0, 10);
  const total = abertas.reduce((s, c) => s + Number(c.valor), 0);

  const vencidas = abertas.filter(c => c.vencimento < hoje);
  // "Vencendo" é o que vence de hoje até 5 dias — a janela em que ainda dá
  // tempo de pagar sem juros.
  const vencendo = abertas.filter(c => {
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    return dias >= 0 && dias <= 5;
  });

  const fixos = fixosPorSerie();

  /* A aba "A pagar" mostra o carnê inteiro como UMA linha: a próxima
     parcela. As outras abas não agrupam de propósito — "Vencidos" tem que
     mostrar cada boleto vencido, um a um, porque cada um é um atraso. */
  const { grupos: carnes, soltas } = _agruparCarnes(abertas);
  const aPagar = soltas
    .map(c => ({ tipo: "conta", conta: c, vencimento: c.vencimento }))
    .concat(carnes.filter(g => g.proxima).map(g => ({ tipo: "carne", carne: g, vencimento: g.proxima.vencimento })))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  // O que some da lista por estar agrupado — dito em voz alta no cabeçalho,
  // senão o total lá em cima não bate com a soma do que se vê.
  const emCarnes = carnes.reduce((s, g) => s + g.falta, 0);
  const parcelasEscondidas = carnes.reduce((s, g) => s + Math.max(0, g.abertas.length - 1), 0);

  const abas = [
    { id: "todos", rotulo: "A pagar", itens: aPagar, vazio: "Nenhuma conta em aberto. 🎉" },
    { id: "vencendo", rotulo: "Vencendo", itens: vencendo, vazio: "Nada vencendo nos próximos dias." },
    { id: "vencidos", rotulo: "Vencidos", itens: vencidas, vazio: "Nenhuma conta vencida. 🎉" },
    { id: "pagos", rotulo: "Pagos", itens: pagas, vazio: "Nenhuma conta paga ainda." },
    { id: "fixos", rotulo: "Fixos", itens: fixos, vazio: "Nenhuma conta fixa ainda. Ao criar uma conta, escolha \"Conta fixa\"." },
  ];
  const abaAtual = abas.find(a => a.id === _contasFiltro) || abas[0];

  const linha = (c) => {
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    const estado = c.pago ? "paga" : dias < 0 ? "vencida" : dias <= 5 ? "vencendo" : "";
    const quando = c.pago ? "Paga em " + dataBR(c.pago_em || c.vencimento)
                 : dias < 0 ? `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`
                 : dias === 0 ? "Vence hoje"
                 : `Vence em ${dias} dia${dias > 1 ? "s" : ""}`;
    return `
      <div class="conta-item ${estado}" id="conta-${c.id}">
        <div class="conta-ico">${c.pago ? "✓" : c.recorrente ? "🔁" : "📄"}</div>
        <div class="conta-nome">${esc(c.nome)}</div>
        <div class="conta-valor">${moeda(c.valor)}</div>
        <div class="conta-prazo">
          <span class="conta-chip ${estado}">${quando}</span>
          ${c.categoria ? `<span class="conta-cat">${esc(c.categoria)}</span>` : ""}
        </div>
        <div class="conta-acao">
          ${c.pago ? "" : `<button class="botao-pagar" onclick="pagarConta(this, '${c.id}')">Pagar</button>`}
          <!-- O × vale pra conta paga E pra conta em aberto. Antes só a
               paga tinha: quem cadastrasse uma conta errada precisava
               PAGAR a conta errada pra depois poder apagá-la. -->
          <button class="item-x" onclick="pedirExcluirConta('${c.id}')" aria-label="Excluir">×</button>
        </div>
      </div>`;
  };

  // A linha do carnê: a próxima parcela, com "2/26" do lado. O toque abre
  // o carnê inteiro — as outras parcelas, e editar ou excluir a série.
  const linhaCarne = (g) => {
    const c = g.proxima;
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    const estado = dias < 0 ? "vencida" : dias <= 5 ? "vencendo" : "";
    const quando = dias < 0 ? `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`
                 : dias === 0 ? "Vence hoje"
                 : `Vence em ${dias} dia${dias > 1 ? "s" : ""}`;
    return `
      <div class="conta-item carne ${estado}" onclick="abrirCarne('${esc(g.base).replace(/'/g, "\\'")}')">
        <div class="conta-ico">🧾</div>
        <div class="conta-nome">${esc(g.base)} <span class="carne-pilula">${c.i}/${g.n}</span></div>
        <div class="conta-valor">${moeda(c.valor)}</div>
        <div class="conta-prazo">
          <span class="conta-chip ${estado}">${quando}</span>
          <span class="conta-cat">faltam ${g.abertas.length}</span>
        </div>
        <div class="conta-acao"><span class="item-x">›</span></div>
      </div>`;
  };

  // A aba "A pagar" mistura conta solta e carnê; as outras só têm conta.
  const linhaAPagar = (x) => x.tipo === "carne" ? linhaCarne(x.carne) : linha(x.conta);

  const linhaFixo = (f) => `
    <div class="fixo-item ${f.emDia ? "" : "falta"}">
      <div class="conta-ico">🔁</div>
      <div class="fixo-txt">
        <strong>${esc(f.nome)}</strong>
        <small>Todo dia ${Number(f.ultima.vencimento.slice(-2))}${f.categoria ? " · " + esc(f.categoria) : ""}</small>
      </div>
      <div class="fixo-valor">${moeda(f.valor)}</div>
      <div class="fixo-acao">
        ${f.emDia
          ? `<span class="conta-chip">em dia</span>`
          : `<button class="botao-pagar" onclick="lancarProximoFixo(this, '${esc(f.nome).replace(/'/g, "\\'")}')">Lançar ${soNomeDoMes(mesDe(f.falta))}</button>`}
      </div>
    </div>`;

  const totalFixos = fixos.reduce((s, f) => s + f.valor, 0);
  const faltando = fixos.filter(f => !f.emDia).length;

  const icoCalendario = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icoCalendario}</span>
        <span class="lancamento-caption">A pagar</span>
        <h2>Contas</h2>
      </div>
    </section>

    <div class="contas-total">
      <span>Total em aberto</span>
      <strong>${moeda(total)}</strong>
      <small>${abertas.length
        ? `${abertas.length} conta${abertas.length > 1 ? "s" : ""} em aberto`
        : "Nada em aberto"}${vencidas.length
        ? ` · <span class="alerta">${vencidas.length} vencida${vencidas.length > 1 ? "s" : ""}</span>` : ""}${
        // Sem esta linha, o total diz R$ 31.200 e a lista mostra três
        // linhas somando R$ 1.800 — dois números que não fecham na mesma
        // tela, que num app de dinheiro é o pior defeito que existe.
        parcelasEscondidas
          ? `<br>${moeda(emCarnes)} em carnê, agrupado nas linhas 🧾`
          : ""}</small>
    </div>

    <button class="botao" onclick="abrirNovaConta()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Nova conta
    </button>

    <div class="contas-abas">
      ${abas.map(a => `
        <button class="contas-aba${a.id === abaAtual.id ? " ativa" : ""}"
                onclick="filtrarContas('${a.id}')">${a.rotulo}</button>`).join("")}
    </div>

    ${abaAtual.id === "fixos" && fixos.length ? `
      <div class="fixos-soma">
        <span>Seus fixos somam</span>
        <strong>${moeda(totalFixos)} por mês</strong>
        ${faltando ? `<small class="alerta">${faltando} ainda não ${faltando > 1 ? "foram lançados" : "foi lançado"} neste mês</small>` : ""}
      </div>` : ""}

    ${abaAtual.itens.length
      ? `<div class="lista">${abaAtual.itens.map(
            abaAtual.id === "fixos" ? linhaFixo
          : abaAtual.id === "todos" ? linhaAPagar
          : linha).join("")}</div>`
      : `<div class="bloco"><p class="vazio">${abaAtual.vazio}</p></div>`}

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* ═══ A TELA DO CARNÊ ═════════════════════════════════════════════════
   Onde ficam as outras parcelas, e onde se mexe na compra inteira em vez
   de boleto por boleto. Excluir um carnê de 26 apagando 26 linhas à mão
   era o tipo de coisa que faz a pessoa desistir de usar o app. */

function abrirCarne(base) {
  if (!_carnePorBase(base)) { erro("Carnê não encontrado."); return; }
  abrirTela(() => desenharCarne(base));
}

function desenharCarne(base) {
  destruirGrafico();
  const g = _carnePorBase(base);
  if (!g) { voltarInicio(); return; }

  const hoje = _hojeLocal();
  const total = g.parcelas.reduce((s, x) => s + Number(x.valor), 0);
  const icoCarne = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="3"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg>`;

  const linhas = g.parcelas.map(c => {
    const dias = Math.round((_parseDataLocal(c.vencimento) - _parseDataLocal(hoje)) / 86400000);
    const estado = c.pago ? "paga" : dias < 0 ? "vencida" : dias <= 5 ? "vencendo" : "";
    const quando = c.pago ? "Paga em " + dataBR(c.pago_em || c.vencimento)
                 : dias < 0 ? `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`
                 : dias === 0 ? "Vence hoje"
                 : `Vence ${dataBR(c.vencimento)}`;
    return `
      <div class="conta-item ${estado}" id="conta-${c.id}">
        <div class="conta-ico">${c.pago ? "✓" : "📄"}</div>
        <div class="conta-nome">Boleto <span class="carne-pilula">${c.i}/${g.n}</span></div>
        <div class="conta-valor">${moeda(c.valor)}</div>
        <div class="conta-prazo"><span class="conta-chip ${estado}">${quando}</span></div>
        <div class="conta-acao">
          ${c.pago ? "" : `<button class="botao-pagar" onclick="pagarConta(this, '${c.id}')">Pagar</button>`}
          <button class="item-x" onclick="pedirExcluirConta('${c.id}')" aria-label="Excluir">×</button>
        </div>
      </div>`;
  }).join("");

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icoCarne}</span>
        <span class="lancamento-caption">Carnê</span>
        <h2>${esc(g.base)}</h2>
      </div>
    </section>

    <div class="contas-total">
      <span>${g.abertas.length ? "Falta pagar" : "Carnê quitado"}</span>
      <strong>${moeda(g.abertas.length ? g.falta : total)}</strong>
      <small>${g.pagas} de ${g.parcelas.length} pag${g.pagas === 1 ? "a" : "as"} · total ${moeda(total)}</small>
    </div>

    <div id="carne-acoes">
      <button class="botao-fraco" onclick="abrirEdicaoCarne('${esc(g.base).replace(/'/g, "\\'")}')">
        ✏️ Editar o carnê
      </button>
      <button class="botao-fraco cartao-apagar" onclick="pedirExcluirCarne('${esc(g.base).replace(/'/g, "\\'")}')">
        🗑️ Excluir o carnê
      </button>
    </div>

    <div class="bloco" style="margin-top:14px"><div class="lista">${linhas}</div></div>

    <button class="botao-fraco" onclick="voltarTela()">Voltar</button>
  `;
}

/* ─── Excluir o carnê ───────────────────────────────────────────────── */

function pedirExcluirCarne(base) {
  const alvo = document.getElementById("carne-acoes");
  const g = _carnePorBase(base);
  if (!alvo || !g) return;

  alvo.innerHTML = `
    <div class="confirmar">
      <p>Tem certeza que quer excluir o carnê "${esc(g.base)}"?
         ${g.abertas.length === g.parcelas.length
           ? `Os ${g.parcelas.length} boletos somem.`
           : `Os ${g.abertas.length} boletos em aberto somem. ${g.pagas > 1 ? `Os ${g.pagas} já pagos ficam` : "O já pago fica"} no histórico — aquele dinheiro saiu de verdade.`}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharCarne('${esc(base).replace(/'/g, "\\'")}')">Cancelar</button>
        <button class="sim" onclick="excluirCarne(this, '${esc(base).replace(/'/g, "\\'")}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirCarne(botao, base) {
  if (botao?.disabled) return;
  const g = _carnePorBase(base);
  if (!g) return;

  // Só as EM ABERTO. Boleto pago é história: o dinheiro saiu, e apagar
  // seria reescrever um mês que já aconteceu.
  const ids = g.abertas.map(x => x.id);
  if (!ids.length) { erro("Este carnê não tem boleto em aberto."); return; }

  const solta = travar(botao, "Excluindo...");
  const { error } = await sb.from("contas").delete().in("id", ids).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  contas = contas.filter(c => !ids.includes(c.id));
  ok(`${ids.length} boleto${ids.length > 1 ? "s" : ""} excluído${ids.length > 1 ? "s" : ""}.`);
  abrirContas();
  pilha.pop();   // não empilha a lista duas vezes
}

/* ─── Editar o carnê ────────────────────────────────────────────────── */

function abrirEdicaoCarne(base) {
  const g = _carnePorBase(base);
  if (!g) { erro("Carnê não encontrado."); return; }

  abrirTela(() => {
    destruirGrafico();
    const cats = categorias.filter(c => c.tipo === "saida");
    const atual = g.abertas[0] || g.parcelas[0];
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
    const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-caption">Carnê</span>
        <h2>Editar ${esc(g.base)}</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="ec-nome">Nome</label></div>
          <input type="text" id="ec-nome" value="${esc(g.base)}" autocomplete="off">
        </div>

        <div class="campo">
          <label for="ec-valor">Valor de cada boleto</label>
          <div class="lancamento-valor">
            <span>R$</span>
            <input type="text" inputmode="decimal" id="ec-valor" value="${Number(atual.valor).toFixed(2).replace(".", ",")}">
          </div>
        </div>

        <div class="campo">
          <div class="campo-label">${icoEtiqueta}<label for="ec-cat">Categoria</label></div>
          ${campoDeCategoria({ id: "ec-cat", tipo: "saida",
                              opcoes: cats.length ? cats.map(c => c.nome) : ["Outros"],
                              escolhida: atual.categoria || "" })}
        </div>

        <p class="cartao-dica">
          Muda só os <b>${g.abertas.length} boleto${g.abertas.length > 1 ? "s" : ""} em aberto</b>.
          ${g.pagas ? `${g.pagas > 1 ? `Os ${g.pagas} já pagos ficam` : "O já pago fica"} como está — o que saiu, saiu.` : ""}
          As datas não mudam por aqui: pra mexer nelas, exclua o carnê e cadastre de novo.
        </p>
      </div>

      <button class="botao" onclick="salvarEdicaoCarne(this, '${esc(g.base).replace(/'/g, "\\'")}')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;
  });
}

async function salvarEdicaoCarne(botao, base) {
  if (botao?.disabled) return;
  const g = _carnePorBase(base);
  if (!g) return;

  const nome = (document.getElementById("ec-nome").value || "").trim();
  const valor = parseMoedaBR(document.getElementById("ec-valor").value);
  const categoria = document.getElementById("ec-cat").value;

  if (!nome) { erro("Dê um nome ao carnê."); return; }
  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!g.abertas.length) { erro("Este carnê não tem boleto em aberto."); return; }

  const solta = travar(botao, "Salvando...");

  // Uma ida por boleto: o nome carrega o "(i/n)", que é diferente em cada
  // um, então não dá pra mandar um update só pra todos.
  for (const x of g.abertas) {
    const { error } = await sb.from("contas")
      .update({ nome: `${nome} (${x.i}/${g.n})`, valor, categoria })
      .eq("id", x.id).eq("user_id", usuario.id);
    if (error) { solta(); erro("Erro ao salvar: " + error.message); return; }

    const alvo = contas.find(c => c.id === x.id);
    if (alvo) { alvo.nome = `${nome} (${x.i}/${g.n})`; alvo.valor = valor; alvo.categoria = categoria; }
  }

  ok("Carnê atualizado!");
  voltarTela();
  desenharCarne(nome);
}

function abrirNovaConta() {
  abrirTela(() => {
    destruirGrafico();
    const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const cats = categorias.filter(c => c.tipo === "saida");
    const icoConta = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
    const icoData = icoConta;
    const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
    const icoTipo = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
    const icoParcelas = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="3"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg>`;

    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icoConta}</span>
        <span class="lancamento-caption">Contas a pagar</span>
        <h2>Nova conta</h2>
      </div>

      <div class="lancamento-form">
        <div class="campo">
          <div class="campo-label">${icoTexto}<label for="ct-nome">Nome da conta</label></div>
          <input type="text" id="ct-nome" placeholder="Ex: Energia" autocomplete="off">
        </div>

        <div class="campo">
          <label for="ct-valor" id="ct-valor-rotulo">Valor</label>
          <div class="lancamento-valor">
            <span>R$</span>
            <input type="text" inputmode="decimal" id="ct-valor" placeholder="0,00" autocomplete="off" oninput="_previaBoletos()">
          </div>
        </div>

        <div class="dois">
          <div class="campo lancamento-campo-data">
            <div class="campo-label">${icoData}<label for="ct-venc">Vencimento</label></div>
            <input type="date" id="ct-venc" value="${_hojeLocal()}" onchange="_previaBoletos()">
          </div>
          <div class="campo">
            <div class="campo-label">${icoEtiqueta}<label for="ct-cat">Categoria</label></div>
            ${campoDeCategoria({ id: "ct-cat", tipo: "saida",
                                opcoes: cats.length ? cats.map(c => c.nome) : ["Outros"] })}
          </div>
        </div>

        <!-- Os dois tipos já existiam, mas escondidos num "repete todo mês"
             sem nome: quem ia cadastrar um boleto não via o boleto em lugar
             nenhum, e quem ia cadastrar o aluguel tinha que adivinhar que a
             caixinha era isso. Escolha com nome e explicação, no mesmo
             formato das Metas. Por baixo continua sendo o mesmo recorrente
             de sempre — nada mudou no banco. -->
        <div class="campo" style="margin:16px 0 0">
          <div class="campo-label">${icoTipo}<label>Tipo de conta</label></div>
          <div class="escolha">
            <label class="escolha-op">
              <input type="radio" name="ct-tipo" value="fixa" checked onchange="_aoTrocarTipoConta()">
              <span>
                <strong>🔁 Conta fixa</strong>
                <small>Chega todo mês — aluguel, internet, energia, água.
                       Paga uma, o app já prepara a do mês seguinte.</small>
              </span>
            </label>
            <label class="escolha-op">
              <input type="radio" name="ct-tipo" value="boleto" onchange="_aoTrocarTipoConta()">
              <span>
                <strong>📄 Boleto ou carnê</strong>
                <small>Tem fim — IPTU, um conserto, uma compra parcelada.
                       Pode ser um boleto só ou um carnê de vários.</small>
              </span>
            </label>
          </div>
        </div>

        <!-- Carnê é boleto parcelado, e é o caso comum: 6x, 10x, 12x. Cada
             parcela vira uma conta com seu próprio vencimento, um mês depois
             da outra — porque é assim que elas chegam pra pagar.

             A conta FIXA não tem esse campo: ela já repete pra sempre, e
             perguntar "quantas vezes" pra algo sem fim não quer dizer nada. -->
        <div class="campo" id="ct-caixa-parcelas" hidden>
          <div class="campo-label">${icoParcelas}<label for="ct-parcelas">Quantos boletos</label></div>
          <select id="ct-parcelas" onchange="_previaBoletos()">
            ${Array.from({ length: 36 }, (_, i) => i + 1)
              .map(n => `<option value="${n}">${n === 1 ? "Um boleto só" : n + " boletos"}</option>`).join("")}
          </select>
          <p class="cartao-dica" id="ct-previa" style="margin-top:7px"></p>
        </div>
      </div>

      <button class="botao" onclick="salvarConta(this, '${chave}')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Salvar conta
      </button>
      <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
      </section>`;
    // Sem foco automático: no celular ele abre o teclado sozinho e come
    // metade da tela antes de a pessoa ter lido o formulário.
  });
}

/* ─── O CARNÊ ─────────────────────────────────────────────────────────
   Boleto parcelado é o caso comum, não a exceção: a compra em 6x, o IPTU
   em 10, o carnê da loja em 12. Cada parcela é uma conta com seu próprio
   vencimento, um mês depois da outra — porque é exatamente assim que elas
   chegam pra pagar, uma por vez.

   O VALOR AQUI É O DA PARCELA, e não o total. Dois motivos: o carnê chega
   com o valor de cada boleto impresso, então é o número que a pessoa tem
   na mão; e dividir um total por 7 dá 85,714... — as parcelas não fechariam
   com o total, e faltariam centavos que ninguém sabe de onde vieram.

   Elas NÃO são recorrentes. Recorrente é o que não acaba; carnê acaba, e
   por isso não aparece na aba de fixos. */

function _aoTrocarTipoConta() {
  const boleto = document.querySelector('input[name="ct-tipo"]:checked')?.value === "boleto";
  const caixa = document.getElementById("ct-caixa-parcelas");
  if (caixa) caixa.hidden = !boleto;
  if (!boleto) {
    const sel = document.getElementById("ct-parcelas");
    if (sel) sel.value = "1";
  }
  _previaBoletos();
}

function _previaBoletos() {
  const alvo = document.getElementById("ct-previa");
  const rotulo = document.getElementById("ct-valor-rotulo");
  if (!alvo) return;

  const boleto = document.querySelector('input[name="ct-tipo"]:checked')?.value === "boleto";
  const n = boleto ? (Number(document.getElementById("ct-parcelas")?.value) || 1) : 1;
  const valor = parseMoedaBR(document.getElementById("ct-valor")?.value);

  // O rótulo do valor diz o que se está digitando. Sem isso, "Valor" num
  // carnê de 6x é ambíguo: total ou parcela?
  if (rotulo) rotulo.textContent = n > 1 ? "Valor de cada boleto" : "Valor";

  if (n < 2 || !valor || valor <= 0) { alvo.textContent = ""; return; }
  const venc = document.getElementById("ct-venc")?.value;
  const ultimo = venc ? _vencimentoDaParcela(venc, n - 1) : null;
  alvo.textContent = `${n} boletos de ${moeda(valor)} — total ${moeda(valor * n)}`
    + (ultimo ? `, o último em ${dataBR(ultimo)}` : "");
}

// O vencimento da parcela de índice i (0 = a primeira), mês a mês.
function _vencimentoDaParcela(primeiro, i) {
  let d = primeiro;
  for (let k = 0; k < i; k++) d = proximoMesMesmoDia(d);
  return d;
}

async function salvarConta(botao, chave) {
  if (botao?.disabled) return;
  const nome = (document.getElementById("ct-nome").value || "").trim();
  const valor = parseMoedaBR(document.getElementById("ct-valor").value);
  const vencimento = document.getElementById("ct-venc").value;
  const categoria = document.getElementById("ct-cat").value;
  const recorrente = document.querySelector('input[name="ct-tipo"]:checked').value === "fixa";
  const parcelas = recorrente ? 1 : (Number(document.getElementById("ct-parcelas")?.value) || 1);

  if (!nome) { erro("Dê um nome à conta."); return; }
  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!vencimento) { erro("Escolha o vencimento."); return; }

  const solta = travar(botao, "Salvando...");

  // Uma linha por boleto, num envio só: ou entram todas ou não entra
  // nenhuma. Meio carnê cadastrado seria pior que nenhum.
  const linhas = Array.from({ length: parcelas }, (_, i) => ({
    user_id: usuario.id,
    nome: parcelas > 1 ? `${nome} (${i + 1}/${parcelas})` : nome,
    valor,
    vencimento: _vencimentoDaParcela(vencimento, i),
    categoria, recorrente,
    chave_envio: parcelas > 1 ? `${chave}-${i + 1}` : chave,
  }));

  const { data, error } = await sb.from("contas").insert(linhas).select();

  if (error) {
    solta();
    if (error.code === "23505") { ok("Conta já registrada."); voltarTela(); return; }
    erro("Erro ao salvar: " + error.message);
    return;
  }

  contas.push(...(data || []));
  ok(parcelas > 1 ? `${parcelas} boletos cadastrados!` : "Conta cadastrada!");
  voltarTela();
}

async function pagarConta(botao, id) {
  if (botao?.disabled) return;
  const c = contas.find(x => x.id === id);
  if (!c) return;

  const solta = travar(botao, "...");
  const hoje = _hojeLocal();
  const { error } = await sb.from("contas").update({ pago: true, pago_em: hoje }).eq("id", id);
  if (error) { solta(); erro("Erro: " + error.message); return; }

  c.pago = true; c.pago_em = hoje;

  // Pagar uma conta é dinheiro saindo. Sem isto o Resumo mostraria um saldo
  // que não existe — as contas ficariam num mundo à parte do extrato.
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const { data: lanc } = await sb.from("lancamentos").insert({
    user_id: usuario.id, tipo: "saida", valor: c.valor, data: hoje,
    categoria: c.categoria || "Contas", descricao: c.nome, chave_envio: chave,
  }).select().single();
  if (lanc) { lancamentos.unshift(lanc); lancamentos.sort((a, b) => b.data.localeCompare(a.data)); }

  // Conta que repete: já deixa a do mês que vem cadastrada.
  if (c.recorrente) {
    const prox = proximoMesMesmoDia(c.vencimento);
    const { data: nova } = await sb.from("contas").insert({
      user_id: usuario.id, nome: c.nome, valor: c.valor, vencimento: prox,
      categoria: c.categoria, recorrente: true,
      chave_envio: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    }).select().single();
    if (nova) contas.push(nova);
  }

  ok("Conta paga e lançada como saída!");
  desenharContas();
}

// Dia 31 em mês de 30 vira o último dia do mês, e não dia 1º do seguinte.
function proximoMesMesmoDia(ymd) {
  const [a, m, d] = ymd.split("-").map(Number);
  const ultimoDoProximo = new Date(a, m + 1, 0).getDate();
  const dia = Math.min(d, ultimoDoProximo);
  const alvo = new Date(a, m, dia);
  return alvo.getFullYear() + "-" + String(alvo.getMonth() + 1).padStart(2, "0") + "-" + String(alvo.getDate()).padStart(2, "0");
}

function pedirExcluirConta(id) {
  const linha = document.getElementById("conta-" + id);
  const c = contas.find(x => x.id === id);
  if (!linha || !c) return;
  linha.innerHTML = `
    <div class="confirmar" style="width:100%">
      <p>Tem certeza que quer excluir "${esc(c.nome)}"?${c.pago
        ? " O lançamento de saída continua no histórico."
        : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharContas()">Cancelar</button>
        <button class="sim" onclick="excluirConta(this, '${id}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirConta(botao, id) {
  if (botao?.disabled) return;
  const solta = travar(botao, "...");
  const { error } = await sb.from("contas").delete().eq("id", id);
  if (error) { solta(); erro("Erro: " + error.message); return; }
  contas = contas.filter(c => c.id !== id);
  ok("Conta excluída.");
  desenharContas();
}
