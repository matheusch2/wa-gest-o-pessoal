/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: telas ainda por construir.
 *
 * O botão existe antes da tela. Em vez de deixá-lo sem reação — o que a
 * pessoa lê como app quebrado —, ele abre um aviso dizendo o que vem ali.
 * Quando a tela de verdade for feita, é só trocar a função correspondente,
 * e ela some daqui.
 *
 * Cartão, Metas de gastos e Relatórios já saíram: viraram js/cartoes.js,
 * js/metas.js e js/relatorios.js. Faltam Meu plano (em Ajustes),
 * Investimentos e Meu negócio (os dois no menu).
 */

function _telaEmBreve(caption, titulo, icone, texto) {
  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icone}</span>
        <span class="lancamento-caption">${caption}</span>
        <h2>${titulo}</h2>
      </div>

      <div class="bloco">
        <p class="em-breve-txt">${texto}</p>
        <p class="em-breve-selo">Em construção</p>
      </div>

      <!-- voltarTela(), e não voltarInicio(): Relatórios se abre pelo menu,
           mas Meu plano se abre de dentro de Ajustes. Voltar tem que
           devolver pra de onde a pessoa veio, não sempre pro menu. -->
      <button class="botao-fraco" onclick="voltarTela()">Voltar</button>
    </section>`;
}

const _ICO_ESTRELA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3-5.5-3-5.5 3 1-6.3L3 8.9 9 8z"/></svg>`;

function abrirMeuPlano() {
  abrirTela(() => _telaEmBreve("Assinatura", "Meu plano", _ICO_ESTRELA,
    "Aqui ficam os dados do seu plano e as opções de assinatura."));
}

const _ICO_SUBINDO = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`;

/* INVESTIMENTOS É BOTÃO ANTES DE SER TELA, de propósito, e isto não é
   atalho: o que ela vai mostrar — a evolução do dinheiro na bolsa e no
   Tesouro — depende de preço de mercado, que o app ainda não busca em
   lugar nenhum. Montar uma tela de investimento sem cotação daria um
   número parado que envelhece calado, que é pior do que não ter a tela.

   O que já dá pra fazer hoje, e está feito, é a Reserva: dinheiro
   guardado na conta não precisa de cotação pra ser contado certo.

   O botão existe no menu desde já porque ele é a promessa: quem está
   montando reserva quer ver onde isso vai dar, e um menu que esconde o
   próximo passo não ajuda ninguém a dar o primeiro. */
function abrirInvestimentos() {
  abrirTela(() => _telaEmBreve("Patrimônio", "Investimentos", _ICO_SUBINDO,
    `Aqui você vai acompanhar a evolução do que investiu — bolsa, Tesouro
     Direto, renda fixa — com o rendimento mês a mês ao lado do que você
     tem guardado na reserva.<br><br>
     Enquanto isso, use as <b>Reservas</b>: elas já contam o dinheiro que
     está fora da conta corrente sem chamá-lo de gasto.`));
}

const _ICO_LOJA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 4.6 4.6A1 1 0 0 1 5.5 4h13a1 1 0 0 1 .9.6L21 9.5"/><path d="M3 9.5h18"/><path d="M4.5 9.5V20h15V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>`;

/* MEU NEGÓCIO: O WA AQUA DENTRO DAS FINANÇAS PESSOAIS.
   Botão antes de tela, e aqui o motivo é outro — não falta dado de fora,
   falta decidir uma coisa que muda tudo o que vem depois: onde passa a
   linha entre o dinheiro do negócio e o dinheiro da pessoa.

   É a decisão que não dá pra adiar pro meio do caminho. Faturamento do
   negócio entrando como "entrada" no Resumo quebraria as duas contas de
   uma vez: a sobra pessoal ficaria inflada por dinheiro que não é de
   gastar, e os Relatórios diriam que a pessoa ganhou o que a empresa
   faturou. O que é renda pessoal é a RETIRADA — o que sai do negócio e
   entra na conta dela.

   Por isso o botão abre com a pergunta escrita em vez de uma tela meia
   pronta: o lugar de errar isso é antes de existir dado, não depois. */
function abrirMeuNegocio() {
  abrirTela(() => _telaEmBreve("WA Aqua", "Meu negócio", _ICO_LOJA,
    `Aqui vai ficar a gestão do <b>WA Aqua</b> dentro das suas finanças —
     o que o negócio fatura, o que ele custa e o que sobra dele, separado
     do seu dinheiro pessoal.<br><br>
     Separado de propósito: o que entra na sua conta é a <b>retirada</b>,
     não o faturamento. Misturar os dois inflaria a sua sobra com dinheiro
     que não é de gastar.`));
}
