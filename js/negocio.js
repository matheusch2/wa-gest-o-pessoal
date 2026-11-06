/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: meu negócio — a interface do negócio com o dinheiro pessoal.
 */

/* ═══ O QUE ESTA TELA É, E O QUE ELA NÃO É ════════════════════════════
   ELA NÃO É UM SISTEMA DE GESTÃO DO NEGÓCIO. Viveiro, agendamento de
   horário, controle de estoque, nota fiscal — nada disso entra aqui.
   Isso é operação, muda de ramo pra ramo, e um app que tentasse abraçar
   tudo acabaria servindo pra ninguém.

   ELA É A INTERFACE DO NEGÓCIO COM O SEU DINHEIRO. São quatro números, e
   os quatro são os mesmos pro barbeiro, pro padeiro, pro entregador de
   água e pro produtor de camarão:

     ENTROU    o que o negócio recebeu
     CUSTOU    o que ele gastou pra receber
     SOBROU    a diferença — o lucro do mês
     RETIREI   o que saiu dele pra sua conta

   É por isso que isto funciona pra qualquer cliente sem uma linha de
   código a mais. O que muda de ramo pra ramo são as PALAVRAS e as
   CATEGORIAS, e essas são dado: moram em TIPOS_DE_NEGOCIO, logo abaixo.

   ═══ A REGRA QUE SUSTENTA TUDO ═══════════════════════════════════════
   Faturamento e custo NÃO viram lançamento pessoal. Retirada vira.

   Quem fatura R$ 20.000 e tem R$ 14.000 de custo não ganhou R$ 20.000:
   ganhou o que tirou. Jogar o faturamento no extrato inflaria a sobra do
   Resumo com dinheiro que não é de gastar, e os Relatórios diriam que a
   pessoa ganhou o que a empresa faturou.

   A retirada é o contrário, e por isso ela não precisa de exceção
   nenhuma: ela É renda pessoal, e conta no Resumo e nos Relatórios como
   qualquer outra entrada. É a única porta entre os dois bolsos. */

/* ═══ OS RAMOS ════════════════════════════════════════════════════════
   Cada tipo é um molde: o nome do ramo, a unidade que ele vende e as
   categorias com que ele começa. Nada aqui muda a estrutura da tela —
   trocar de ramo troca palavra e lista, nunca conta.

   Cliente novo de um ramo que não está aqui = mais uma entrada neste
   objeto. Não é código novo, é uma linha de dado. */
const TIPOS_DE_NEGOCIO = {
  servico: {
    nome: "Prestação de serviço",
    unidade: "serviço",
    exemplo: "Consultoria, assistência técnica, software",
    faturamento: ["Serviço prestado", "Mensalidade", "Projeto"],
    custo: ["Ferramentas e sistemas", "Impostos", "Transporte", "Marketing", "Outros"],
  },
  comercio: {
    nome: "Comércio e revenda",
    unidade: "venda",
    exemplo: "Loja, revenda, bazar",
    faturamento: ["Vendas", "Encomendas"],
    custo: ["Mercadoria", "Frete", "Embalagem", "Impostos", "Aluguel", "Outros"],
  },
  alimentacao: {
    nome: "Alimentação",
    unidade: "pedido",
    exemplo: "Lanchonete, padaria, marmita, doces",
    faturamento: ["Vendas no balcão", "Delivery", "Encomendas"],
    custo: ["Ingredientes", "Gás e energia", "Embalagem", "Aluguel", "Outros"],
  },
  entrega: {
    nome: "Entrega e transporte",
    unidade: "entrega",
    exemplo: "Água, gás, frete, aplicativo",
    faturamento: ["Entregas", "Fretes"],
    custo: ["Produto", "Combustível", "Manutenção", "Impostos", "Outros"],
  },
  producao: {
    nome: "Produção",
    unidade: "kg",
    exemplo: "Roça, criação, artesanato",
    faturamento: ["Venda da produção"],
    custo: ["Insumos", "Energia", "Mão de obra", "Manutenção", "Outros"],
  },
  beleza: {
    nome: "Beleza e cuidados",
    unidade: "atendimento",
    exemplo: "Barbearia, salão, estética",
    faturamento: ["Atendimentos", "Produtos vendidos"],
    custo: ["Produtos", "Aluguel", "Energia", "Outros"],
  },
  outro: {
    nome: "Outro",
    unidade: "",
    exemplo: "Qualquer outro ramo",
    faturamento: ["Faturamento"],
    custo: ["Custos", "Impostos", "Outros"],
  },
};

function _moldeDoNegocio(n) {
  return TIPOS_DE_NEGOCIO[n?.tipo] || TIPOS_DE_NEGOCIO.outro;
}

/* ═══ AS CONTAS ═══════════════════════════════════════════════════════ */

const _cNeg = v => Math.round(Number(v || 0) * 100) / 100;

function _negocioAtual() { return negocios[0] || null; }

function _movimentosDoNegocio(negocioId, mesRef) {
  return movimentosNegocio.filter(m =>
    m.negocio_id === negocioId && (!mesRef || mesDe(m.data) === mesRef));
}

/* Os quatro números do mês, mais a conta que os fecha.

   SOBROU É LUCRO, NÃO É CAIXA, e a diferença entre os dois é onde este
   app já tropeçou várias vezes: dois números pra mesma palavra. "Sobrou
   R$ 6.000" com "Retirei R$ 4.000" logo abaixo faz qualquer um perguntar
   se tem seis ou dois mil no negócio.

   Por isso 'ficou' existe e aparece escrito: sobrou É o lucro, e dele
   saiu a retirada; o que restou ficou no negócio. A frase fecha a conta
   em vez de deixar a pessoa descobrir sozinha. */
function _retratoDoNegocio(negocioId, mesRef) {
  let entrou = 0, custou = 0, retirado = 0, unidades = 0;
  const porCategoria = {};

  for (const m of _movimentosDoNegocio(negocioId, mesRef)) {
    const v = Number(m.valor);
    if (m.tipo === "faturamento") {
      entrou += v;
      if (m.quantidade) unidades += Number(m.quantidade);
    } else if (m.tipo === "custo") {
      custou += v;
      const cat = m.categoria || "Outros";
      porCategoria[cat] = _cNeg((porCategoria[cat] || 0) + v);
    } else {
      retirado += v;
    }
  }

  entrou = _cNeg(entrou);
  custou = _cNeg(custou);
  const sobrou = _cNeg(entrou - custou);

  return {
    entrou, custou, sobrou,
    retirado: _cNeg(retirado),
    ficou: _cNeg(sobrou - retirado),
    margem: entrou >= 0.005 ? sobrou / entrou : null,
    unidades: _cNeg(unidades),
    ticket: unidades >= 0.005 ? _cNeg(entrou / unidades) : null,
    custos: Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")),
    vazio: entrou < 0.005 && custou < 0.005 && retirado < 0.005,
  };
}

/* O CAIXA DO NEGÓCIO é a soma de todos os meses, não do mês na tela. É a
   resposta pra "quanto tem lá dentro?" — e ela não pode depender de qual
   mês a pessoa está olhando. */
function _caixaDoNegocio(negocioId) {
  let total = 0;
  for (const m of _movimentosDoNegocio(negocioId, null)) {
    total += m.tipo === "faturamento" ? Number(m.valor) : -Number(m.valor);
  }
  return _cNeg(total);
}

/* ═══ A TELA ══════════════════════════════════════════════════════════ */

const _ICO_NEGOCIO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 4.6 4.6A1 1 0 0 1 5.5 4h13a1 1 0 0 1 .9.6L21 9.5"/><path d="M3 9.5h18"/><path d="M4.5 9.5V20h15V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>`;
const _ICO_MAIS_N = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const _ICO_CHECK_N = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

function abrirMeuNegocio() { abrirTela(desenharNegocio); }

function _faltaOBancoDoNegocio() {
  return faltaATabela("negocios") || faltaATabela("movimentos_negocio");
}

function trocarMesNegocio(passo) {
  mesAtual = mesVizinho(mesAtual, passo);
  desenharNegocio();
}

function desenharNegocio() {
  destruirGrafico();

  if (_faltaOBancoDoNegocio()) {
    document.getElementById("area").innerHTML = `
      <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
        <div class="lancamento-cabecalho">
          <span class="lancamento-cabecalho-icone">${_ICO_NEGOCIO}</span>
          <span class="lancamento-caption">Negócio</span>
          <h2>Meu negócio</h2>
        </div>
        <div class="bloco">
          <p class="em-breve-txt">
            Esta parte é nova e precisa de uma atualização no banco.
          </p>
          <p class="cartao-dica" style="margin-top:12px">
            Abra o Supabase, vá em <b>SQL Editor → New query</b>, cole o
            <b>banco.sql</b> do projeto inteiro e rode. Ele não estraga nada
            do que já existe. Depois, feche e abra o app.
          </p>
        </div>
        <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
      </section>`;
    return;
  }

  const n = _negocioAtual();
  if (!n) { _telaSemNegocio(); return; }

  const r = _retratoDoNegocio(n.id, mesAtual);
  const caixa = _caixaDoNegocio(n.id);
  const molde = _moldeDoNegocio(n);
  const unidade = n.unidade || molde.unidade;

  const linhaCusto = ([cat, v]) => `
    <div class="rel-cat">
      <span class="rel-cat-nome">${esc(cat)}</span>
      <span class="rel-cat-pct">${r.custou > 0 ? Math.round(v / r.custou * 100) : 0}%</span>
      <strong class="rel-cat-valor">${moeda(v)}</strong>
    </div>`;

  const movs = _movimentosDoNegocio(n.id, mesAtual)
    .slice()
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) ||
                    String(b.created_at || "").localeCompare(String(a.created_at || "")));

  const rotulo = { faturamento: "Entrou", custo: "Saiu", retirada: "Retirada" };
  const icone = { faturamento: "💰", custo: "🧾", retirada: "🤝" };

  const umMovimento = m => `
    <div class="item" id="mn-${m.id}">
      <div class="item-icone">${icone[m.tipo]}</div>
      <div class="item-txt">
        <strong>${esc(m.descricao || m.categoria || rotulo[m.tipo])}</strong>
        <small>${dataBR(m.data)}${m.quantidade ? ` · ${_qtd(m.quantidade)} ${esc(_plural(unidade || "un", m.quantidade))}` : ""}</small>
      </div>
      <span class="item-valor ${m.tipo === "faturamento" ? "entrada" : "saida"}">
        ${m.tipo === "faturamento" ? "+" : "−"}${moeda(m.valor)}
      </span>
      <button class="item-x" onclick="pedirExcluirMovimentoNegocio('${m.id}')" aria-label="Excluir">×</button>
    </div>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_NEGOCIO}</span>
        <span class="lancamento-caption">${esc(molde.nome)}</span>
        <h2>${esc(n.nome)}</h2>
      </div>
    </section>

    <div class="bloco" style="padding:11px">
      <div class="bloco-topo" style="margin:0">
        <button class="pilula" onclick="trocarMesNegocio(-1)" aria-label="Mês anterior">‹</button>
        <strong style="font-size:14.5px">${mesPorExtenso(mesAtual)}</strong>
        <button class="pilula" onclick="trocarMesNegocio(1)" aria-label="Próximo mês">›</button>
      </div>
    </div>

    <!-- O NÚMERO GRANDE É O QUE SOBROU, não o que entrou. Faturamento
         grande com margem pequena é a ilusão que quebra negócio pequeno:
         quem fatura R$ 20.000 e gasta R$ 19.000 acha que está indo bem. -->
    <div class="contas-total ${r.sobrou < 0 ? "ruim" : ""}">
      <span>${r.sobrou >= 0 ? "O negócio deu" : "O negócio ficou negativo em"}</span>
      <strong>${moeda(Math.abs(r.sobrou))}</strong>
      <small>${r.vazio
        ? `Nada lançado em ${soNomeDoMes(mesAtual)}`
        : `${moeda(r.entrou)} entraram · ${moeda(r.custou)} saíram${
            r.margem !== null && r.sobrou >= 0
              ? ` · margem de ${Math.round(r.margem * 100)}%`
              : ""}`}</small>
    </div>

    <div class="negocio-botoes">
      <button class="botao" onclick="abrirMovimentoNegocio('faturamento')">
        ${_ICO_MAIS_N} Entrou
      </button>
      <button class="botao saida" onclick="abrirMovimentoNegocio('custo')">
        Saiu
      </button>
    </div>

    <!-- A RETIRADA FICA SOZINHA porque ela é de outra natureza: é a única
         que atravessa pro seu dinheiro pessoal. Misturada com as outras
         duas, ela pareceria mais um lançamento do negócio. -->
    <div class="bloco negocio-retirada">
      <div class="bloco-topo">
        <h2>Retirada do mês</h2>
        <strong>${moeda(r.retirado)}</strong>
      </div>
      <p class="cartao-dica" style="margin:0 0 12px">
        ${r.retirado >= 0.005
          ? `Dos ${moeda(r.sobrou)} que o negócio deu, você levou ${moeda(r.retirado)} —
             ${r.ficou >= 0
               ? `ficaram ${moeda(r.ficou)} no negócio.`
               : `${moeda(-r.ficou)} a mais do que ele deu, saindo do caixa.`}`
          : `Ainda não tirou nada este mês. Retirada é o que cai na sua conta —
             é ela, e só ela, que vira entrada no seu Resumo.`}
      </p>
      <button class="botao-fraco" style="margin:0" onclick="abrirMovimentoNegocio('retirada')">
        Registrar retirada
      </button>
    </div>

    <div class="fatura-resumo">
      <div><small>No caixa do negócio</small><strong>${
        caixa < 0 ? "−" + moeda(-caixa) : moeda(caixa)}</strong></div>
      ${r.ticket !== null
        ? `<div><small>Cada ${esc(unidade || "venda")}</small><strong>${moeda(r.ticket)}</strong></div>`
        : ""}
    </div>

    ${r.custos.length ? `
      <div class="bloco">
        <div class="bloco-topo">
          <h2>Para onde foi o custo</h2>
          <strong class="resumo-total-saida">${moeda(r.custou)}</strong>
        </div>
        <div class="rel-cats negocio-custos">${r.custos.map(linhaCusto).join("")}</div>
      </div>` : ""}

    <div class="bloco">
      <div class="bloco-topo">
        <h2>Movimentos</h2>
        ${movs.length ? `<span class="rel-conta">${movs.length}</span>` : ""}
      </div>
      ${movs.length
        ? `<div class="lista">${movs.map(umMovimento).join("")}</div>`
        : `<p class="vazio">Nada lançado em ${soNomeDoMes(mesAtual)}.</p>`}
    </div>

    <div class="reserva-rodape">
      <button class="botao-editar" onclick="abrirEdicaoNegocio()" aria-label="Editar">✏️</button>
    </div>
    <div id="negocio-confirma"></div>

    <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
  `;
}

/* "6 serviço" é o tipo de descuido que faz o app parecer amador numa tela
   de dinheiro. Regra simples e honesta: unidade terminada em vogal ganha
   "s" no plural (serviço → serviços, entrega → entregas); as outras
   ficam como estão, porque "kg" é "kg" no plural. */
function _plural(unidade, n) {
  const u = String(unidade || "").trim();
  if (!u || Math.abs(Number(n)) === 1) return u;
  return /[aeiouáéíóúâêô]$/i.test(u) ? u + "s" : u;
}

// "8" e não "8,00"; "1,5" quando tem casa. Quantidade não é dinheiro.
function _qtd(v) {
  const n = Number(v);
  return Number.isInteger(n) ? String(n)
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/* ═══ O PRIMEIRO NEGÓCIO ══════════════════════════════════════════════ */

function _telaSemNegocio() {
  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${_ICO_NEGOCIO}</span>
        <span class="lancamento-caption">Negócio</span>
        <h2>Meu negócio</h2>
      </div>

      <div class="bloco">
        <p class="cartao-dica" style="margin:0">
          Aqui ficam os quatro números do seu negócio: o que ele <b>entrou</b>,
          o que <b>custou</b>, o que <b>sobrou</b> e o que você <b>retirou</b>.
          Só a retirada aparece no seu Resumo pessoal — o resto fica aqui
          dentro, pra sua sobra não ser inflada por dinheiro que não é de
          gastar.
        </p>
      </div>

      <button class="botao" onclick="abrirNovoNegocio()">
        ${_ICO_MAIS_N}
        Cadastrar meu negócio
      </button>
      <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
    </section>`;
}

function abrirNovoNegocio() { abrirTela(() => _desenharFormNegocio(null)); }

function abrirEdicaoNegocio() {
  const n = _negocioAtual();
  if (!n) return;
  abrirTela(() => _desenharFormNegocio(n));
}

function _desenharFormNegocio(n) {
  destruirGrafico();

  const editando = !!n;
  const tipo = n?.tipo || "servico";
  const icoNome = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
  const icoRamo = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 4.6 4.6A1 1 0 0 1 5.5 4h13a1 1 0 0 1 .9.6L21 9.5"/><path d="M3 9.5h18"/><path d="M4.5 9.5V20h15V9.5"/></svg>`;
  const icoUn = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_NEGOCIO}</span>
      <span class="lancamento-caption">Negócio</span>
      <h2>${editando ? "Editar negócio" : "Cadastrar negócio"}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <div class="campo-label">${icoNome}<label for="ng-nome">Nome do negócio</label></div>
        <input type="text" id="ng-nome" maxlength="40" autocomplete="off"
               placeholder="WA Aqua" value="${esc(n ? n.nome : "")}">
      </div>

      <!-- O RAMO SÓ TROCA PALAVRAS E CATEGORIAS, nunca a conta. É por isso
           que um cliente de um ramo novo não custa código: custa mais uma
           entrada em TIPOS_DE_NEGOCIO. -->
      <div class="campo">
        <div class="campo-label">${icoRamo}<label for="ng-tipo">Ramo</label></div>
        <select id="ng-tipo" onchange="_aoTrocarRamo()">
          ${Object.entries(TIPOS_DE_NEGOCIO).map(([k, t]) => `
            <option value="${k}"${k === tipo ? " selected" : ""}>${esc(t.nome)}</option>`).join("")}
        </select>
        <p class="cartao-dica" id="ng-exemplo" style="margin-top:7px"></p>
      </div>

      <div class="campo" style="margin-bottom:0">
        <div class="campo-label">${icoUn}<label for="ng-unidade">O que você conta (opcional)</label></div>
        <input type="text" id="ng-unidade" maxlength="20" autocomplete="off"
               value="${esc(n ? (n.unidade || "") : "")}">
      </div>
      <!-- Opcional de verdade: sem ela o negócio funciona igual. Com ela,
           a tela passa a dizer quanto vale cada venda, que é o número que
           o dono usa pra saber se vale a pena atender mais um. -->
      <p class="cartao-dica">
        Serve pro ticket médio: quanto rendeu cada serviço, cada entrega,
        cada corte. Deixe em branco se não quiser contar.
      </p>
    </div>

    <button class="botao" onclick="salvarNegocio(this, ${n ? `'${n.id}'` : "null"})">
      ${_ICO_CHECK_N}
      ${editando ? "Salvar alteração" : "Criar negócio"}
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;

  _aoTrocarRamo(!editando);
}

/* Trocar o ramo preenche a unidade sugerida — mas só quando ela ainda não
   foi escrita à mão. Sobrescrever o que a pessoa digitou seria o tipo de
   "ajuda" que faz perder o que se acabou de escrever. */
function _aoTrocarRamo(preencherUnidade) {
  const tipo = document.getElementById("ng-tipo")?.value;
  const molde = TIPOS_DE_NEGOCIO[tipo];
  if (!molde) return;

  const exemplo = document.getElementById("ng-exemplo");
  if (exemplo) exemplo.textContent = molde.exemplo;

  const campo = document.getElementById("ng-unidade");
  if (!campo) return;
  const atual = campo.value.trim();
  const sugestoes = Object.values(TIPOS_DE_NEGOCIO).map(t => t.unidade);
  if (preencherUnidade || !atual || sugestoes.includes(atual)) campo.value = molde.unidade;
}

async function salvarNegocio(botao, id) {
  if (botao?.disabled) return;

  const nome = (document.getElementById("ng-nome").value || "").trim();
  const tipo = document.getElementById("ng-tipo").value;
  const unidade = (document.getElementById("ng-unidade").value || "").trim() || null;

  if (!nome) { erro("Dê um nome ao seu negócio."); return; }
  if (!TIPOS_DE_NEGOCIO[tipo]) { erro("Escolha o ramo."); return; }

  const solta = travar(botao, "Salvando...");
  const campos = { nome, tipo, unidade };

  if (id) {
    const { data, error } = await sb.from("negocios")
      .update(campos).eq("id", id).eq("user_id", usuario.id)
      .select().single();
    if (error) {
      solta();
      erro(error.code === "23505" ? "Você já tem um negócio com esse nome." : "Erro ao salvar: " + error.message);
      return;
    }
    negocios = negocios.map(x => (x.id === id ? data : x));
    ok("Negócio alterado!");
  } else {
    const { data, error } = await sb.from("negocios")
      .insert({ user_id: usuario.id, ...campos })
      .select().single();
    if (error) {
      solta();
      erro(error.code === "23505" ? "Você já tem um negócio com esse nome." : "Erro ao salvar: " + error.message);
      return;
    }
    negocios.push(data);
    ok("Negócio criado!");
  }

  voltarTela();
}

/* ═══ LANÇAR NO NEGÓCIO ═══════════════════════════════════════════════ */

function abrirMovimentoNegocio(tipo) {
  const n = _negocioAtual();
  if (!n) return;
  abrirTela(() => _desenharFormMovimentoNegocio(n, tipo));
}

function _desenharFormMovimentoNegocio(n, tipo) {
  destruirGrafico();

  const molde = _moldeDoNegocio(n);
  const unidade = n.unidade || molde.unidade;
  const ehRetirada = tipo === "retirada";
  const ehFaturamento = tipo === "faturamento";

  const titulo = ehRetirada ? "Retirada" : ehFaturamento ? "Entrou no negócio" : "Saiu do negócio";
  const cats = ehFaturamento ? molde.faturamento : molde.custo;

  const icoTexto = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>`;
  const icoData = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const icoEtiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
  const icoUn = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;

  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
    <div class="lancamento-cabecalho">
      <span class="lancamento-cabecalho-icone">${_ICO_NEGOCIO}</span>
      <span class="lancamento-caption">${esc(n.nome)}</span>
      <h2>${titulo}</h2>
    </div>

    <div class="lancamento-form">
      <div class="campo">
        <label for="mn-valor">Valor</label>
        <div class="lancamento-valor">
          <span>R$</span>
          <input type="text" inputmode="decimal" id="mn-valor" placeholder="0,00" autocomplete="off">
        </div>
      </div>

      ${!ehRetirada ? `
        <div class="campo">
          <div class="campo-label">${icoEtiqueta}<label for="mn-cat">Categoria</label></div>
          <select id="mn-cat">
            ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
          </select>
        </div>` : ""}

      <div class="campo">
        <div class="campo-label">${icoTexto}<label for="mn-desc">Descrição (opcional)</label></div>
        <input type="text" id="mn-desc" maxlength="60" autocomplete="off"
               placeholder="${ehRetirada ? "Pró-labore de novembro" : ehFaturamento ? "Mensalidade do cliente X" : "Nota do fornecedor"}">
      </div>

      <div class="dois">
        <div class="campo lancamento-campo-data">
          <div class="campo-label">${icoData}<label for="mn-data">Data</label></div>
          <input type="date" id="mn-data" value="${_hojeLocal()}">
        </div>
        ${ehFaturamento && unidade ? `
          <div class="campo">
            <div class="campo-label">${icoUn}<label for="mn-qtd">Quantos ${esc(unidade)}</label></div>
            <input type="text" inputmode="decimal" id="mn-qtd" placeholder="0" autocomplete="off">
          </div>` : ""}
      </div>

      <!-- O QUE VAI ACONTECER, ESCRITO ANTES. É a regra que sustenta a
           tela inteira, e ela não pode ser surpresa. -->
      <p class="cartao-dica">${ehRetirada
        ? `Vira uma <b>entrada</b> no seu Resumo pessoal, porque esse dinheiro
           cai na sua conta. É a única coisa daqui que atravessa.`
        : `Fica <b>dentro do negócio</b> e não aparece no seu Resumo pessoal.
           ${ehFaturamento
             ? "Faturamento não é a sua renda — a sua renda é o que você retira."
             : "Custo do negócio não é gasto seu: quem paga é o negócio."}`}</p>
    </div>

    <button class="botao ${tipo === "custo" ? "saida" : ""}"
            onclick="salvarMovimentoNegocio(this, '${n.id}', '${tipo}')">
      ${_ICO_CHECK_N}
      Salvar
    </button>
    <button class="botao-fraco lancamento-voltar" onclick="voltarTela()">Voltar</button>
    </section>`;
}

/* A RETIRADA CRIA O LANÇAMENTO PRIMEIRO, igual ao resto do app: se o
   segundo passo falhar, o que sobra é uma entrada solta no extrato —
   visível e apagável. Na ordem inversa sobraria uma retirada sem
   contrapartida, e o Resumo mostraria menos dinheiro do que existe.

   Faturamento e custo não criam nada: são uma gravação só. */
async function salvarMovimentoNegocio(botao, negocioId, tipo) {
  if (botao?.disabled) return;

  const n = negocios.find(x => x.id === negocioId);
  if (!n) { erro("Negócio não encontrado."); return; }

  const valor = parseMoedaBR(document.getElementById("mn-valor").value);
  const data = document.getElementById("mn-data").value;
  const descricao = (document.getElementById("mn-desc").value || "").trim() || null;
  const categoria = document.getElementById("mn-cat")?.value || null;
  const qtdTxt = (document.getElementById("mn-qtd")?.value || "").trim();
  const quantidade = qtdTxt ? parseMoedaBR(qtdTxt) : null;

  if (valor === null || valor <= 0) { erro("Informe um valor maior que zero."); return; }
  if (!data) { erro("Escolha a data."); return; }
  if (qtdTxt && (quantidade === null || quantidade <= 0)) {
    erro("A quantidade precisa ser maior que zero, ou ficar em branco."); return;
  }

  const solta = travar(botao, "Salvando...");
  const chave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  let lanc = null;
  if (tipo === "retirada") {
    const { data: l, error: erroLanc } = await sb.from("lancamentos").insert({
      user_id: usuario.id, tipo: "entrada", valor, data,
      categoria: "Retirada",
      descricao: descricao || `Retirada · ${n.nome}`,
      chave_envio: chave,
    }).select().single();

    if (erroLanc) {
      solta();
      if (erroLanc.code === "23505") { ok("Retirada já registrada."); voltarTela(); return; }
      erro("Erro ao salvar: " + erroLanc.message);
      return;
    }
    lanc = l;
  }

  const { data: mov, error: erroMov } = await sb.from("movimentos_negocio").insert({
    user_id: usuario.id, negocio_id: negocioId, tipo, valor, data,
    categoria, descricao, quantidade,
    lancamento_id: lanc?.id || null,
    chave_envio: chave + "-n",
  }).select().single();

  if (erroMov) {
    if (lanc) await sb.from("lancamentos").delete().eq("id", lanc.id).eq("user_id", usuario.id);
    solta();
    erro("Erro ao salvar: " + erroMov.message);
    return;
  }

  if (lanc) {
    lancamentos.unshift(lanc);
    lancamentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }
  movimentosNegocio.unshift(mov);

  ok(tipo === "retirada" ? `${moeda(valor)} na sua conta!` : "Lançado!");
  voltarTela();
}

/* ═══ EXCLUIR UM MOVIMENTO ════════════════════════════════════════════ */

function pedirExcluirMovimentoNegocio(movId) {
  const m = movimentosNegocio.find(x => x.id === movId);
  const linha = document.getElementById("mn-" + movId);
  if (!m || !linha) return;

  linha.innerHTML = `
    <div class="confirmar" style="width:100%;border:none;padding:0">
      <p>Excluir ${moeda(m.valor)} de ${dataBR(m.data)}?${m.lancamento_id
        ? " O lançamento no seu extrato sai junto."
        : ""}</p>
      <div class="confirmar-acoes">
        <button onclick="desenharNegocio()">Cancelar</button>
        <button class="sim" onclick="excluirMovimentoNegocio(this, '${movId}')">Sim, excluir</button>
      </div>
    </div>`;
}

async function excluirMovimentoNegocio(botao, movId) {
  if (botao?.disabled) return;
  const m = movimentosNegocio.find(x => x.id === movId);
  if (!m) return;

  const solta = travar(botao, "...");
  const { error } = await sb.from("movimentos_negocio")
    .delete().eq("id", movId).eq("user_id", usuario.id);
  if (error) { solta(); erro("Erro ao excluir: " + error.message); return; }

  // A retirada apaga os dois lados: deixar o lançamento sozinho faria o
  // Resumo contar uma renda que o negócio não registra mais.
  if (m.lancamento_id) {
    await sb.from("lancamentos").delete().eq("id", m.lancamento_id).eq("user_id", usuario.id);
    lancamentos = lancamentos.filter(l => l.id !== m.lancamento_id);
  }
  movimentosNegocio = movimentosNegocio.filter(x => x.id !== movId);

  ok("Excluído.");
  desenharNegocio();
}
